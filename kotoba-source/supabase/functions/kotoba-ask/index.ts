import {buildRequest,normalizeResponse,resolveProvider} from './logic.mjs';

Deno.serve(async (req: Request) => {
  const allowed=(Deno.env.get('ALLOWED_ORIGINS')||'https://hierarchklay.github.io,https://kotoba-daily-demo.hierarch-klay.chatgpt.site').split(',').map(s=>s.trim());
  const origin=req.headers.get('origin')||'';
  const headers={'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','Vary':'Origin',
    'Access-Control-Allow-Origin':allowed.includes(origin)?origin:'null',
    'Access-Control-Allow-Headers':'authorization,apikey,content-type,x-client-info','Access-Control-Allow-Methods':'POST,OPTIONS'};
  const json=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers});
  if(!allowed.includes(origin))return json({error:'来源未启用。'},403);
  if(req.method==='OPTIONS')return new Response(null,{status:204,headers});
  if(req.method!=='POST')return json({error:'仅支持 POST。'},405);
  const authorization=req.headers.get('authorization');
  if(!authorization?.startsWith('Bearer '))return json({error:'请先登录。'},401);
  const supabaseUrl=Deno.env.get('SUPABASE_URL')!;
  const serviceKey=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  try{
    // getUser validates the bearer token server-side; never trust client-supplied IDs.
    const auth=await fetch(supabaseUrl+'/auth/v1/user',{headers:{apikey:serviceKey,Authorization:authorization},signal:AbortSignal.timeout(10000)});
    if(!auth.ok)return json({error:'登录已过期，请重新登录。'},401);
    const user=await auth.json();
    if(!user.id||user.is_anonymous)return json({error:'请使用已开通的学习账号。'},403);
    const apiKey=(Deno.env.get('DASHSCOPE_API_KEY')||'').trim();
    const base=(Deno.env.get('QWEN_BASE_URL')||'').trim();
    if(!apiKey||!base)return json({error:'日语问答尚未配置百炼接口。'},503);
    // Protocol follows the configured endpoint; subscription/key prefixes are
    // not an application-level rejection rule. Provider authorization still applies.
    let provider;
    try{provider=resolveProvider(base);}
    catch{return json({error:'百炼接口地址配置有误，请填写不带请求路径的 Base URL。'},503);}
    const raw=await req.text();
    if(new TextEncoder().encode(raw).length>24000)return json({error:'问题或对话过长，请开始新对话。'},413);
    let request;
    try{request=buildRequest(JSON.parse(raw),Deno.env.get('QWEN_MODEL')||'qwen3.8-max',provider.kind);}
    catch(e){return json({error:e instanceof SyntaxError?'请求格式有误。':e instanceof Error?e.message:'请求格式有误。'},400);}
    const limit=Math.max(1,Math.min(200,Number(Deno.env.get('AI_DAILY_LIMIT'))||40));
    const quota=await fetch(supabaseUrl+'/rest/v1/rpc/kotoba_take_ai_quota',{
      method:'POST',headers:{apikey:serviceKey,Authorization:'Bearer '+serviceKey,'Content-Type':'application/json'},
      body:JSON.stringify({p_user:user.id,p_limit:limit}),signal:AbortSignal.timeout(10000)});
    if(!quota.ok)return json({error:'问答权限尚未配置完成。'},503);
    if(await quota.json()!==true)return json({error:'此账号尚未开通问答，或今日提问次数已用完。'},429);
    const providerHeaders:Record<string,string>={Authorization:'Bearer '+apiKey,'Content-Type':'application/json'};
    if(provider.kind==='anthropic')providerHeaders['anthropic-version']='2023-06-01';
    const upstream=await fetch(provider.endpoint,{method:'POST',headers:providerHeaders,body:JSON.stringify(request),redirect:'error',signal:AbortSignal.timeout(65000)});
    if(!upstream.ok){
      const hint=upstream.status===429?'模型服务繁忙或额度不足。':
        [401,403].includes(upstream.status)?'请检查 Key、接口权限及套餐使用范围。':
        upstream.status===404?'请检查接口地址及模型名称。':'请检查模型、接口参数、地域和账户状态。';
      return json({error:`百炼调用未成功（HTTP ${upstream.status}）。${hint}`,upstreamStatus:upstream.status},502);
    }
    return json(normalizeResponse(await upstream.json(),provider.kind));
  }catch(e){return json({error:e instanceof Error&&e.name==='TimeoutError'?'查询超时，请稍后重试。':'查询暂时失败，请稍后重试。'},502);}
});
