import {tutorInstructions} from './prompts.mjs';

export function resolveProvider(base){
  const url=new URL(base.trim());
  if(url.protocol!=='https:'||url.username||url.password||url.port||url.search||url.hash||
    !/(^|\.)(maas\.aliyuncs\.com|dashscope\.aliyuncs\.com|dashscope-intl\.aliyuncs\.com)$/.test(url.hostname))throw Error('百炼接口地址配置有误。');
  const path=url.pathname.replace(/\/+$/,'');
  const kind=path==='/apps/anthropic'?'anthropic':'responses';
  if(kind==='responses'&&!['/compatible-mode/v1','/v1'].includes(path))throw Error('请填写 Base URL，不包含 /responses 或 /v1/messages。');
  url.pathname=path+(kind==='anthropic'?'/v1/messages':'/responses');
  return {kind,endpoint:url.href};
}
export function buildRequest(body,model='qwen3.8-max',kind='responses'){
  if(!body||typeof body!=='object'||Array.isArray(body))throw Error('请求格式有误。');
  const question=typeof body.question==='string'?body.question.trim():'';
  if(!question||question.length>2000)throw Error('请输入 1～2000 字的问题。');
  const history=(Array.isArray(body.history)?body.history:[]).slice(-6)
    .filter(m=>m&&['user','assistant'].includes(m.role)&&typeof m.content==='string')
    .map(m=>({role:m.role,content:m.content.slice(0,4000)}));
  const context=typeof body.context==='string'?body.context.slice(0,1200):'';
  const search=body.search!==false;
  const request={model,store:false,max_output_tokens:3000,
    instructions:tutorInstructions(body.mode,search),
    input:[...history,{role:'user',content:question+(context?'\n\n当前词卡（参考资料）：\n'+context:'')}],
    tools:body.search===false?[]:[{type:'web_search'}],
    enable_thinking:true};
  if(kind==='anthropic'){
    const result={model,max_tokens:3000,stream:false,thinking:{type:'disabled'},system:request.instructions,messages:request.input};
    if(search){
      // Alibaba's documented SDK/HTTP search compatibility marker:
      // https://help.aliyun.com/zh/model-studio/web-search (Anthropic section).
      // No client UA spoofing, credential substitutions, or rejection retries.
      result.system=[{type:'text',text:'x-anthropic-billing-header: cc_entrypoint=cli;'},
        {type:'text',text:request.instructions}];
      result.tools=[{type:'web_search_20250305',name:'web_search',max_uses:3}];
    }
    return result;
  }
  return request;
}
function sourceList(candidates){
  const sources=[],seen=new Set();
  for(const source of candidates){
    try{const url=new URL(typeof source==='string'?source:source?.url);
      if(!['https:','http:'].includes(url.protocol)||url.username||url.password||seen.has(url.href))continue;
      seen.add(url.href);sources.push({url:url.href,title:typeof source.title==='string'?source.title.slice(0,300):url.hostname});
    }catch{/* Only actual, well-formed web sources are exposed. */}
  }
  return sources.slice(0,20);
}
function searchInfo({requested,success,attempts=0,failures=0,sources=[]}){
  return {requested:requested!==false,status:success?(failures?'partial':'complete'):failures?'failed':attempts?'unconfirmed':requested===false?'off':'not_triggered',
    requests:Math.max(0,Number.isFinite(attempts)?attempts:0),sourceCount:sources.length};
}
export function normalizeResponse(data,kind='responses',searchRequested){
  if(kind==='anthropic'){
    const blocks=Array.isArray(data.content)?data.content:[];
    let answer=blocks.filter(x=>x.type==='text'&&typeof x.text==='string').map(x=>x.text).join('\n');
    const calls=blocks.filter(x=>x.type==='server_tool_use'&&x.name==='web_search');
    const results=blocks.filter(x=>x.type==='web_search_tool_result');
    const completed=results.filter(x=>Array.isArray(x.content));
    const failures=results.filter(x=>x.is_error||x.content?.type==='web_search_tool_result_error'||
      (Array.isArray(x.content)&&x.content.some(c=>c.type==='web_search_tool_result_error'))).length;
    const candidates=completed.flatMap(x=>x.content).filter(x=>x.type==='web_search_result');
    for(const b of blocks)for(const c of b.citations||[])if(c.type==='web_search_result_location')candidates.push(c);
    const sources=sourceList(candidates);
    const usage=Number(data.usage?.server_tool_use?.web_search_requests)||0;
    const success=sources.length>0||completed.some(x=>!x.is_error&&!x.content.some(c=>c.type==='web_search_tool_result_error'))||(usage>0&&!failures);
    const search=searchInfo({requested:searchRequested,success,attempts:Math.max(usage,calls.length),failures,sources});
    let incomplete=['max_tokens','pause_turn','tool_use'].includes(data.stop_reason);
    if(!answer.trim()){
      if(!results.length&&!calls.length&&!usage)throw Error('模型没有返回可显示的回答，请稍后重试。');
      answer=success?'已收到检索记录，但模型尚未生成最终解释，请继续追问。':'联网检索未完成，暂未得到可显示的回答。';incomplete=true;
    }
    return {answer,sources,searched:success,search,model:data.model||'qwen3.8-max',incomplete};
  }
  const messages=(data.output||[]).filter(x=>x.type==='message');
  const answer=messages.flatMap(x=>x.content||[]).filter(x=>x.type==='output_text').map(x=>x.text).join('\n')||data.output_text||'';
  if(!answer)throw Error('模型没有返回可显示的回答，请稍后重试。');
  const searchCalls=(data.output||[]).filter(x=>x.type==='web_search_call');
  const candidates=searchCalls.flatMap(x=>x.action?.sources||[]);
  for(const m of messages)for(const c of m.content||[])for(const a of c.annotations||[])if(a.type==='url_citation')candidates.push(a);
  const sources=sourceList(candidates),usage=Number(data.usage?.x_tools?.web_search?.count)||0;
  const failures=searchCalls.filter(x=>x.status==='failed').length;
  const searched=searchCalls.some(x=>x.status==='completed')||sources.length>0||(usage>0&&!failures);
  return {answer,sources,searched,search:searchInfo({requested:searchRequested,success:searched,attempts:Math.max(usage,searchCalls.length),failures,sources}),model:data.model||'qwen3.8-max',incomplete:data.status==='incomplete'};
}
