// Node 24 can execute the erasable TypeScript used by the Deno handler.
import assert from 'node:assert/strict';
import {resolveProvider,buildRequest,normalizeResponse} from './supabase/functions/kotoba-ask/logic.mjs';
let handler,mode='ok',calls=[];
const env={SUPABASE_URL:'https://test.supabase.co',SUPABASE_SERVICE_ROLE_KEY:'test-service-value',DASHSCOPE_API_KEY:'test-private-value',QWEN_BASE_URL:'https://test.cn-beijing.maas.aliyuncs.com/compatible-mode/v1'};
globalThis.Deno={env:{get:key=>env[key]},serve:fn=>handler=fn};
globalThis.fetch=async(url,init)=>{
  calls.push(String(url));
  if(String(url).endsWith('/auth/v1/user'))return Response.json(mode==='bad-auth'?{error:'invalid'}:{id:'owner'},{status:mode==='bad-auth'?401:200});
  if(String(url).endsWith('/rpc/kotoba_take_ai_quota'))return Response.json(mode!=='no-quota');
  const request=JSON.parse(init.body);assert.equal(request.model,'qwen3.8-max');
  assert.equal(init.headers.Authorization,'Bearer '+env.DASHSCOPE_API_KEY);assert.equal(init.redirect,'error');
  assert(!('user-agent' in init.headers));assert(!('x-app' in init.headers));
  if(String(url).endsWith('/v1/messages')){
    assert.equal(init.headers['anthropic-version'],'2023-06-01');
    assert(!('instructions' in request));assert(!('input' in request));assert(!('tools' in request));
    assert.equal(request.messages.at(-1).role,'user');assert.equal(request.thinking.type,'disabled');
    assert.equal(request.stream,false);assert.equal(request.max_tokens,3000);assert(request.system.includes('未配置联网'));
    if(mode==='provider-forbidden')return Response.json({error:'PRIVATE_PROVIDER_DIAGNOSTIC'},{status:403});
    return Response.json({model:'qwen3.8-max',content:[{type:'thinking',thinking:'PRIVATE_THINKING'},{type:'text',text:'迎える：迎接。'}],stop_reason:'end_turn'});
  }
  assert.equal(request.tools[0].type,'web_search');
  if(mode==='provider-failure')return Response.json({error:'PRIVATE_PROVIDER_DIAGNOSTIC'},{status:401});
  return Response.json({output:[{type:'web_search_call',status:'completed',action:{sources:[{url:'https://www.ninjal.ac.jp/'}]}},{type:'message',content:[{type:'output_text',text:'欢迎：歓迎する。'}]}]});
};
await import('./supabase/functions/kotoba-ask/index.ts');
const ask=async({origin='https://hierarchklay.github.io',auth='Bearer session',method='POST',body={question:'欢迎怎么说？'}}={})=>{
  calls=[];return handler(new Request('https://test.supabase.co/functions/v1/kotoba-ask',{method,headers:{origin,authorization:auth,'Content-Type':'application/json'},...(method==='POST'?{body:JSON.stringify(body)}:{})}));
};
let r=await ask({origin:'https://unapproved.example'});assert.equal(r.status,403);assert.equal(calls.length,0);
r=await ask({method:'OPTIONS'});assert.equal(r.status,204);
r=await ask({auth:''});assert.equal(r.status,401);assert.equal(calls.length,0);
mode='bad-auth';r=await ask();assert.equal(r.status,401);assert.equal(calls.length,1);
mode='no-quota';r=await ask();assert.equal(r.status,429);assert.equal(calls.length,2);
mode='ok';env.DASHSCOPE_API_KEY='sk-sp-placeholder';r=await ask();assert.equal(r.status,200);assert.equal(calls.length,3);env.DASHSCOPE_API_KEY='test-private-value';
r=await ask({body:{question:''}});assert.equal(r.status,400);assert.equal(calls.length,1);
mode='provider-failure';r=await ask();assert.equal(r.status,502);assert(!(await r.text()).includes('PRIVATE_PROVIDER_DIAGNOSTIC'));
mode='ok';r=await ask();assert.equal(r.status,200);const data=await r.json();assert(data.searched);assert.equal(data.sources.length,1);assert(!JSON.stringify(data).includes('private-value'));
console.log('PASS endpoint auth, CORS, quota, Responses compatibility, validation, secret isolation and search sources (mock provider)');

env.DASHSCOPE_API_KEY='sk-sp-placeholder';env.QWEN_BASE_URL='https://token-plan.cn-beijing.maas.aliyuncs.com/apps/anthropic/';
r=await ask({body:{question:'迎える是什么意思？',search:false}});assert.equal(r.status,200);
const plain=await r.json();assert.equal(plain.answer,'迎える：迎接。');assert.equal(plain.searched,false);assert.deepEqual(plain.sources,[]);
assert(!JSON.stringify(plain).includes('PRIVATE_THINKING'));assert(!JSON.stringify(plain).includes(env.DASHSCOPE_API_KEY));
assert.equal(calls.at(-1),'https://token-plan.cn-beijing.maas.aliyuncs.com/apps/anthropic/v1/messages');
r=await ask();assert.equal(r.status,400);assert((await r.json()).error.includes('取消'));assert.equal(calls.length,1);
mode='no-quota';r=await ask({body:{question:'test',search:false}});assert.equal(r.status,429);assert.equal(calls.length,2);
mode='provider-forbidden';r=await ask({body:{question:'test',search:false}});assert.equal(r.status,502);
const rejected=await r.json();assert.equal(rejected.upstreamStatus,403);assert(rejected.error.includes('HTTP 403'));assert(!JSON.stringify(rejected).includes('PRIVATE_PROVIDER_DIAGNOSTIC'));
mode='ok';env.QWEN_BASE_URL='https://coding.dashscope.aliyuncs.com/apps/anthropic';
r=await ask({body:{question:'test',search:false}});assert.equal(r.status,200);assert.equal(calls.at(-1),'https://coding.dashscope.aliyuncs.com/apps/anthropic/v1/messages');
for(const base of ['http://token-plan.cn-beijing.maas.aliyuncs.com/apps/anthropic','https://evil.example/apps/anthropic','https://dashscope.aliyuncs.com.evil.example/apps/anthropic','https://user:pass@dashscope.aliyuncs.com/apps/anthropic','https://dashscope.aliyuncs.com/apps/anthropic?forward=1','https://dashscope.aliyuncs.com/apps/anthropic/v1/messages']){
  assert.throws(()=>resolveProvider(base));env.QWEN_BASE_URL=base;r=await ask({body:{question:'test',search:false}});assert.equal(r.status,503);assert.equal(calls.length,1);
}
const followup=buildRequest({question:'区别呢',search:false,history:[{role:'system',content:'bad'},{role:'user',content:'迎える'},{role:'assistant',content:'迎接'}],context:'迎える'},'qwen3.8-max','anthropic');
assert.equal(followup.messages.length,3);assert(followup.messages[2].content.includes('当前词卡'));
assert(normalizeResponse({content:[{type:'text',text:'部分回答'}],stop_reason:'max_tokens'},'anthropic').incomplete);
assert.throws(()=>normalizeResponse({content:[{type:'thinking',thinking:'not an answer'}]},'anthropic'));
assert.throws(()=>buildRequest(null));
console.log('PASS Anthropic/Token Plan/Coding Plan routing, plain-answer parsing, honest search state, provider rejection, endpoint validation and conversation context (mock provider; no real key used)');
