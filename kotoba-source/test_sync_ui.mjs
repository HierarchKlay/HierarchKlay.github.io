// DOM integration with a mocked signed-in Supabase client; no live account access.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {restoreState,ensureDay,rateWord} from './dist/core.mjs';
const {JSDOM}=await import(process.env.JSDOM_MODULE||'jsdom');
const dom=new JSDOM(fs.readFileSync(new URL('./dist/index.html',import.meta.url),'utf8'),{url:'https://hierarchklay.github.io/kotoba/'});
globalThis.window=dom.window;globalThis.document=dom.window.document;globalThis.localStorage=dom.window.localStorage;
Object.defineProperty(globalThis,'navigator',{value:dom.window.navigator,configurable:true});
const priorInterval=globalThis.setInterval;globalThis.setInterval=()=>0;
const course=JSON.parse(fs.readFileSync(new URL('./dist/lesson.json',import.meta.url)));
let state=restoreState(null,course);ensureDay(state,course,'1');rateWord(state,course.days[0].core[0],'known');
const saved=JSON.stringify(state);let mode='permission',sent;
const client={
  auth:{getSession:async()=>({data:{session:{user:{id:'test-owner',email:'test@example.com'}}}}),onAuthStateChange:()=>{}},
  rpc(_name,p){sent=structuredClone(p);return {abortSignal:async()=>mode==='permission'?{data:null,error:{code:'42501',message:'permission denied for function kotoba_merge',details:'PRIVATE_RECORD',hint:'grant to anon'},status:403}:
    mode==='bad-response'?{data:{version:1,records:[],events:{}},error:null,status:200}:{data:structuredClone(p.p_document),error:null,status:200}};}
};
window.supabase={createClient:()=>client};
const append=document.head.appendChild.bind(document.head);
document.head.appendChild=node=>{const r=append(node);if(node.tagName==='SCRIPT')queueMicrotask(()=>node.onload());return r;};
globalThis.fetch=async()=>({ok:true,json:async()=>({supabaseUrl:'https://test.supabase.co',publishableKey:'sb_publishable_test'})});
const {attachCloud}=await import('./dist/cloud.mjs');
attachCloud({state:()=>state,course:()=>course,normalize:s=>restoreState(s,course),replace:s=>{state=s;},persist:()=>localStorage.setItem('test-progress',JSON.stringify(state)),card:()=>''});
const waitFor=async fn=>{for(let i=0;i<30;i++){if(fn())return;await new Promise(r=>setTimeout(r,0));}assert.fail('UI did not settle');};
const status=()=>document.querySelector('#cloudStatus').textContent;
await waitFor(()=>status().includes('42501'));
assert.equal(localStorage.getItem('test-progress'),saved);assert.equal(JSON.stringify(state),saved);
assert(!document.querySelector('#syncErrorDetails').hidden);assert(document.querySelector('#syncErrorText').textContent.includes('HTTP：403'));
assert(!document.querySelector('#syncErrorText').textContent.includes('PRIVATE_RECORD'));
mode='ok';document.querySelector('#cloudSync').click();await waitFor(()=>status().startsWith('已同步'));
assert(document.querySelector('#syncErrorDetails').hidden);assert.equal(sent.p_course,course.id);
assert.equal(sent.p_document.records['word:'+course.days[0].core[0]].value.rating,'known');
const after=JSON.stringify(state);mode='bad-response';document.querySelector('#cloudSync').click();await waitFor(()=>status().includes('INVALID_RESPONSE'));
assert.equal(JSON.stringify(state),after);assert.equal(localStorage.getItem('test-progress'),after);
globalThis.setInterval=priorInterval;dom.window.close();
console.log('PASS signed-in sync UI: detailed RPC failure, local progress retained, manual retry succeeds, invalid cloud response rejected');
