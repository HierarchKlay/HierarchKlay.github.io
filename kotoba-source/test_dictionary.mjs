import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {gunzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import {PACK} from './dist/dictionary/config.mjs';
import {prepare,search,normalize} from './dist/dictionary/search.mjs';
import {renderEntry} from './dist/dictionary/render.mjs';
const base=new URL('./dist/dictionary/',import.meta.url),blobs=new Map();
let parsed={};
for(const p of PACK.packs){const blob=fs.readFileSync(new URL(p.file,base));blobs.set(p.file,blob);assert.equal(blob.length,p.bytes);assert.equal(createHash('sha256').update(blob).digest('hex'),p.sha256);parsed[p.id]=JSON.parse(gunzipSync(blob)).entries;assert.equal(parsed[p.id].length,p.entries);}
assert.equal(PACK.bytes,[...blobs.values()].reduce((n,b)=>n+b.length,0));
assert.equal(normalize(' ｶﾀｶﾅ '),'かたかな');
let byid=new Map(parsed.jmdict.map(e=>[e.id,e]));
for(const t of parsed.tomoshi){assert(byid.has(t.id));for(const [i,s] of Object.entries(t.s)){assert(byid.get(t.id).s[i]);assert(s.g.length);assert.deepEqual(Object.keys(s),['g']);}}
for(const w of parsed.wiktionary){if(!w.j)continue;const e=byid.get(w.j);assert(e);assert([...e.k,...e.r].some(k=>normalize(k.t)===normalize(w.t)));const isKanji=e.k.some(k=>normalize(k.t)===normalize(w.t));for(const reading of w.r)assert(e.r.some(r=>normalize(r.t)===reading&&!(isKanji&&r.n)&&(!r.k?.length||r.k.includes(w.t))),w.t+' '+reading);}
let index=prepare(parsed.jmdict,parsed.tomoshi,parsed.wiktionary);
for(const q of ['迎える','歓迎','日本','猫','食べる','ありがとう','コンピューター'])assert(search(index,q).items.length,q);
const exact=(q,l='ja')=>search(index,q,'exact',30,l);
const cat=exact('猫').items[0];assert.equal(cat.k[0].t,'猫');assert(cat.w.every(w=>!w.r.includes('ねこま')));
assert(exact('ねこ').items.some(e=>e.id===cat.id));assert(exact('ネコ').items.some(e=>e.id===cat.id));
assert(exact('cat','en').items.some(e=>e.id===cat.id));assert(exact('猫','zh').items.some(e=>e.id===cat.id));
const eat=exact('食べる').items[0];assert(exact('吃','zh').items.some(e=>e.id===eat.id));
assert(search(index,'欢迎','contains',30,'zh').items.length);assert.equal(exact('欢迎').total,0);
assert.equal(search(index,'xyz-no-such-word-82736').total,0);assert.equal(search(index,'').total,0);
const e=exact('迎える').items[0],html=renderEntry(e);
assert(e.s.some(s=>s.g.some(g=>g.t.includes('meet')||g.t.includes('welcome'))));assert(e.z);assert(e.w.some(w=>w.r.includes('むかえる')));
for(const label of ['JMdict / EDRDG','维基词典','AI 辅助释义','CC BY-SA 4.0'])assert(html.includes(label),label);
assert(renderEntry(exact('ねこま').items.find(e=>e.w?.length)).includes('已废用'));
const firstDay=exact('ついたち').items.find(e=>e.w?.some(w=>w.t==='一日'));assert(firstDay);assert(firstDay.w.every(w=>!w.r.includes('いちにち')));
const standalone=parsed.wiktionary.find(w=>!w.j);assert(standalone);assert(renderEntry(index.find(x=>x.e.id===standalone.id).e).includes('维基独立词条'));
const hostile=structuredClone(e);hostile.k[0].t='<img src=x onerror=alert(1)>';hostile.s[0].g[0].t='<script>evil</script>';hostile.z[0]={g:['<svg onload=evil>']};hostile.w[0].s[0].g=['<iframe src=bad>'];
const escaped=renderEntry(hostile);for(const tag of ['<img','<script>','<svg','<iframe'])assert(!escaped.includes(tag));
assert(parsed.jmdict.some(e=>e.r.some(r=>r.k?.length)));assert(parsed.jmdict.some(e=>e.s.some(s=>s.k?.length||s.r?.length)));
// Index preparation must not mutate its input or double-attach sources on reuse.
assert(!parsed.jmdict.some(e=>e.z||e.w));
console.log('PASS three complete corpora, checksums, association restrictions, Japanese/Chinese/English lookup, heteronyms, source labels and HTML escaping');
index=null;parsed=null;byid=null;
// Production worker with a persistent CacheStorage and controllable network.
const cacheMap=new Map();let network=true,requests=[],messages=[],badFile='';
const keyOf=k=>k.url||String(k),cache={match:async k=>cacheMap.get(keyOf(k))?.clone(),put:async(k,res)=>cacheMap.set(keyOf(k),res.clone()),delete:async k=>cacheMap.delete(keyOf(k)),keys:async()=>[...cacheMap.keys()].map(url=>({url}))};
globalThis.caches={open:async name=>{assert.equal(name,'kotoba-dictionary-data-v1');return cache;},delete:async name=>{assert.equal(name,'kotoba-dictionary-data-v1');cacheMap.clear();return true;}};
globalThis.self={postMessage:m=>messages.push(m)};
globalThis.fetch=async url=>{const file=new URL(url).pathname.split('/').pop();requests.push(file);if(!network)throw Error('unexpected network');return new Response(file===badFile?'corrupted':blobs.get(file));};
const jm=PACK.packs.find(p=>p.id==='jmdict'),wiki=PACK.packs.find(p=>p.id==='wiktionary');
// Upgrade starts with the previous English pack. A corrupt third pack must not
// report success or discard the first two verified packs.
cacheMap.set(new URL(jm.file,base).href,new Response(blobs.get(jm.file)));
badFile=wiki.file;await import('./dist/dictionary/worker.mjs?upgrade');
await self.onmessage({data:{type:'load',download:true}});assert(messages.some(m=>m.type==='error'));assert(!messages.some(m=>m.type==='ready'));assert.equal(cacheMap.size,2);assert(!requests.includes(jm.file));
messages=[];badFile='';await self.onmessage({data:{type:'load',download:true}});assert(messages.some(m=>m.type==='ready'));assert.equal(cacheMap.size,3);assert.equal(requests.length,3);assert.equal(requests.filter(f=>f===wiki.file).length,2);
await self.onmessage({data:{type:'search',query:'吃',mode:'exact',language:'zh',id:7}});assert(messages.some(m=>m.type==='result'&&m.id===7&&m.items.some(e=>e.id===eat.id)));
// Drop the first worker's heap, preserving its CacheStorage to model reopening.
const saved=new Map(cacheMap);await self.onmessage({data:{type:'remove'}});for(const [k,v] of saved)cacheMap.set(k,v);messages=[];network=false;
await import('./dist/dictionary/worker.mjs?offline');
await self.onmessage({data:{type:'load'}});assert(messages.some(m=>m.type==='ready'));assert.equal(requests.length,3);
await self.onmessage({data:{type:'search',query:'ネコ',mode:'exact',language:'ja',id:8}});assert(messages.some(m=>m.type==='result'&&m.id===8&&m.items.some(e=>e.id===cat.id)));
await self.onmessage({data:{type:'remove'}});assert.equal(cacheMap.size,0);messages=[];
await self.onmessage({data:{type:'load'}});assert(messages.some(m=>m.type==='error'&&m.message.includes('下载')));assert.equal(requests.length,3);
console.log('PASS existing English pack reuse, corruption rejection, partial download resume, fresh offline reopen/search, scoped cache removal');
// Service-worker shell update and isolation from study, login and cloud data.
const handlers={},served=[],deleted=[];
vm.runInNewContext(fs.readFileSync(new URL('sw.js',base),'utf8'),{URL,Request,fetch:()=>{throw Error('unexpected network');},caches:{keys:async()=>['kotoba-dictionary-shell-v1-old','kotoba-dictionary-shell-v2-2026-10-13-trilingual','kotoba-dictionary-data-v1','study-records'],delete:async key=>deleted.push(key),open:async()=>({match:async key=>{served.push(String(key));return new Response('offline-shell');}})},self:{registration:{scope:'https://example.test/kotoba/dictionary/'},clients:{claim:async()=>{}},addEventListener:(n,f)=>handlers[n]=f}});
let response;handlers.activate({waitUntil:p=>response=p});await response;assert.deepEqual(deleted,['kotoba-dictionary-shell-v1-old']);
handlers.fetch({request:{url:'https://example.test/kotoba/dictionary/index.html?q=猫',method:'GET',mode:'navigate'},respondWith:p=>response=p});assert.equal(await (await response).text(),'offline-shell');assert.equal(served[0],'https://example.test/kotoba/dictionary/index.html');
for(const url of ['https://example.test/kotoba/cloud-config.json','https://mtszdktdpjipjvbspetr.supabase.co/rest/v1/rpc/kotoba_sync',new URL(jm.file,base).href]){response=null;handlers.fetch({request:{url,method:'GET'},respondWith:p=>response=p});assert.equal(response,null);}
const sw=fs.readFileSync(new URL('sw.js',base),'utf8');const files=sw.match(/const FILES=\[(.*?)\];/s)[1].match(/'([^']+)'/g).map(s=>s.slice(1,-1));for(const f of files)assert(fs.existsSync(new URL(f==='./'?'index.html':f,base)),f);
console.log('PASS shell upgrade, offline navigation, query URLs, isolated scope, complete shell files');
