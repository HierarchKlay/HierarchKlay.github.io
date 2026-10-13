// Auth diagnostics and mobile form behavior; no real credentials or network calls.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {describeAuthError} from './dist/auth-errors.mjs';
import {restoreState} from './dist/core.mjs';
for(const [error,kind] of [
  [{code:'invalid_credentials',status:400},'credentials'],
  [{message:'Invalid login credentials'},'credentials'],
  [{code:'email_not_confirmed',status:400},'confirmation'],
  [{code:'over_request_rate_limit',status:429},'rate_limit'],
  [{message:'Load failed',name:'AuthRetryableFetchError',status:0},'network'],
  [{message:'Failed to fetch'},'network'],
  [{code:'request_timeout'},'timeout'],
  [{name:'QuotaExceededError'},'storage'],
  [{code:'user_banned'},'account'],
  [{code:'email_provider_disabled'},'configuration'],
  [{code:'captcha_failed'},'captcha'],
  [{status:503,name:'AuthRetryableFetchError'},'server'],
  [{message:'Private password x@example.com sk-private Bearer eyJ.test.token',details:'sensitive'},'unknown']
]){
  const info=describeAuthError(error);assert.equal(info.kind,kind);
  assert(!JSON.stringify(info).includes('sk-private'));assert(!JSON.stringify(info).includes('x@example.com'));
}
const {JSDOM}=await import(process.env.JSDOM_MODULE||'jsdom');
const dom=new JSDOM(fs.readFileSync(new URL('./dist/index.html',import.meta.url),'utf8'),{url:'https://hierarchklay.github.io/kotoba/'});
globalThis.window=dom.window;globalThis.document=dom.window.document;globalThis.localStorage=dom.window.localStorage;
Object.defineProperty(globalThis,'navigator',{value:dom.window.navigator,configurable:true});
const originalInterval=globalThis.setInterval;globalThis.setInterval=()=>0;
const course=JSON.parse(fs.readFileSync(new URL('./dist/lesson.json',import.meta.url)));
let state=restoreState(null,course),authChange,mode='network',sent,calls=0,release;
const client={auth:{
  getSession:async()=>({data:{session:null}}),onAuthStateChange:fn=>{authChange=fn;},
  async signInWithPassword(p){
    calls++;sent=p;
    if(mode==='network')return {error:{status:0,name:'AuthRetryableFetchError',message:'Load failed'}};
    if(mode==='pending'){await new Promise(resolve=>{release=resolve;});return {error:{code:'invalid_credentials',status:400}};}
    if(mode==='storage')throw Object.assign(Error('Do not expose password'),{name:'SecurityError'});
    authChange('SIGNED_IN',{user:{id:'test-owner',email:'learner@example.com'}});return {error:null};
  }
},rpc(_name,p){return {abortSignal:async()=>({data:structuredClone(p.p_document),error:null,status:200})};}};
window.supabase={createClient:()=>client};
const append=document.head.appendChild.bind(document.head);
document.head.appendChild=node=>{const result=append(node);if(node.tagName==='SCRIPT')queueMicrotask(()=>node.onload());return result;};
globalThis.fetch=async()=>({ok:true,json:async()=>({supabaseUrl:'https://test.supabase.co',publishableKey:'sb_publishable_test'})});
const {attachCloud}=await import('./dist/cloud.mjs');
attachCloud({state:()=>state,course:()=>course,normalize:s=>restoreState(s,course),replace:s=>{state=s;},persist:()=>localStorage.setItem('test-progress',JSON.stringify(state)),card:()=>''});
const $=s=>document.querySelector(s),status=()=>$('#cloudStatus').textContent;
const waitFor=async fn=>{for(let i=0;i<50;i++){if(fn())return;await new Promise(r=>setTimeout(r,0));}assert.fail('UI did not settle');};
await waitFor(()=>!$('#loginSubmit').disabled);
const before=localStorage.getItem('test-progress'),password=' ExactPassword with spaces ';
$('#loginEmail').value='learner@example.com';$('#loginPassword').value=password;
$('#togglePassword').click();assert.equal($('#loginPassword').type,'text');assert.equal($('#togglePassword').getAttribute('aria-pressed'),'true');
const submit=()=>$('#loginForm').dispatchEvent(new dom.window.Event('submit',{bubbles:true,cancelable:true}));
submit();await waitFor(()=>!$('#loginSubmit').disabled);
assert(status().includes('NETWORK'));assert(!status().includes('邮箱或密码'));
assert(!$('#loginErrorDetails').hidden);assert(!$('#loginErrorText').textContent.includes(password));
assert.equal($('#loginPassword').type,'password');assert.equal($('#loginPassword').value,password);assert.equal(sent.password,password);
assert.equal(localStorage.getItem('test-progress'),before);
mode='pending';const count=calls;submit();submit();assert.equal(calls,count+1);release();await waitFor(()=>!$('#loginSubmit').disabled);
assert(status().includes('invalid_credentials'));assert.equal($('#loginPassword').value,password);
mode='storage';submit();await waitFor(()=>!$('#loginSubmit').disabled);assert(status().includes('STORAGE'));
mode='ok';submit();await waitFor(()=>status().startsWith('已同步'));
assert($('#loginForm').hidden);assert(!$('#cloudAccount').hidden);assert.equal($('#accountLabel').textContent,'learner@example.com');
assert($('#loginErrorDetails').hidden);assert.equal($('#loginErrorText').textContent,'');assert.equal($('#loginPassword').value,'');
assert.equal(localStorage.getItem('test-progress'),before);
globalThis.setInterval=originalInterval;dom.window.close();
console.log('PASS auth: error classification, no credential leaks, password visibility/exact preservation, duplicate prevention, success clears errors/password, progress retained');
