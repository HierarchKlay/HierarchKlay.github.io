// Node 24 can execute the erasable TypeScript used by the Deno handler.
import assert from 'node:assert/strict';
let handler,mode='ok',calls=[];
const env={SUPABASE_URL:'https://test.supabase.co',SUPABASE_SERVICE_ROLE_KEY:'test-service-value',DASHSCOPE_API_KEY:'test-private-value',QWEN_BASE_URL:'https://test.cn-beijing.maas.aliyuncs.com/compatible-mode/v1'};
globalThis.Deno={env:{get:key=>env[key]},serve:fn=>handler=fn};
globalThis.fetch=async(url,init)=>{
  calls.push(String(url));
  if(String(url).endsWith('/auth/v1/user'))return Response.json(mode==='bad-auth'?{error:'invalid'}:{id:'owner'},{status:mode==='bad-auth'?401:200});
  if(String(url).endsWith('/rpc/kotoba_take_ai_quota'))return Response.json(mode!=='no-quota');
  const request=JSON.parse(init.body);assert.equal(request.model,'qwen3.8-max');assert.equal(request.tools[0].type,'web_search');
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
mode='ok';env.DASHSCOPE_API_KEY='sk-sp-placeholder';r=await ask();assert.equal(r.status,503);assert.equal(calls.length,1);env.DASHSCOPE_API_KEY='test-private-value';
r=await ask({body:{question:''}});assert.equal(r.status,400);assert.equal(calls.length,1);
mode='provider-failure';r=await ask();assert.equal(r.status,502);assert(!(await r.text()).includes('PRIVATE_PROVIDER_DIAGNOSTIC'));
mode='ok';r=await ask();assert.equal(r.status,200);const data=await r.json();assert(data.searched);assert.equal(data.sources.length,1);assert(!JSON.stringify(data).includes('private-value'));
console.log('PASS endpoint auth, CORS, quota, Coding Plan separation, validation, secret isolation and search sources (mock provider)');
