import {PACK} from './config.mjs';
import {prepare,search} from './search.mjs';
// Keep the v1 data cache so existing definition packs can be reused during upgrade.
export const DATA_CACHE='kotoba-dictionary-data-v1';
let index=null,loading=null;
const urlOf=p=>new URL(p.file,import.meta.url).href;
const progress=(phase,value)=>self.postMessage({type:'progress',phase,value});
async function decode(response,pack){
  const bytes=await response.arrayBuffer();
  const digest=[...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(x=>x.toString(16).padStart(2,'0')).join('');
  if(bytes.byteLength!==pack.bytes||digest!==pack.sha256)throw Error(pack.title+'校验失败，请联网重新下载。');
  const json=await new Response(new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'))).json();
  if(json.entries?.length!==pack.entries||json.date!==pack.date)throw Error(pack.title+'不完整，请重新下载。');
  return json.entries;
}
async function load(download=false){
  if(index)return;if(loading)return loading;
  loading=(async()=>{
    if(typeof DecompressionStream==='undefined')throw Error('浏览器版本较旧，请更新 Safari / Chrome 后重试。');
    const cache=await caches.open(DATA_CACHE),data={};let completed=0;
    for(const pack of PACK.packs){
      const url=urlOf(pack);let response=await cache.match(url);
      if(response){
        progress('校验 '+pack.title,Math.round(completed/PACK.bytes*100));
        try{data[pack.id]=await decode(response,pack);}catch(e){await cache.delete(url);if(!download)throw e;response=null;}
      }
      if(!response){
        if(!download)throw Error('三语词库尚未完整下载，请联网点击“下载到本机”。');
        const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),180000);
        try{
          const res=await fetch(url,{cache:'no-store',signal:controller.signal});
          if(!res.ok)throw Error(pack.title+'下载失败（HTTP '+res.status+'），请重试。');
          const reader=res.body.getReader(),chunks=[];let received=0;
          while(true){const {done,value}=await reader.read();if(done)break;chunks.push(value);received+=value.byteLength;progress('下载 '+pack.title,Math.min(99,Math.round((completed+received)/PACK.bytes*100)));}
          response=new Response(new Blob(chunks),{headers:{'Content-Type':'application/gzip'}});
          progress('校验 '+pack.title,Math.round((completed+pack.bytes)/PACK.bytes*100));
          data[pack.id]=await decode(response.clone(),pack);await cache.put(url,response);
        }finally{clearTimeout(timer);}
      }
      completed+=pack.bytes;
    }
    progress('整理三语查询索引',100);
    index=prepare(data.jmdict,data.tomoshi,data.wiktionary,data.pitch,data.examples);
    // Remove only superseded dictionary packs, and only after all new packs verify.
    const current=new Set(PACK.packs.map(urlOf));
    for(const key of await cache.keys())if(!current.has(key.url))await cache.delete(key);
    progress('三语词库就绪',100);
  })();
  try{await loading;}finally{loading=null;}
}
self.onmessage=async({data})=>{
  try{
    if(data.type==='load'){await load(data.download);self.postMessage({type:'ready',count:index.length});}
    if(data.type==='search'){await load();self.postMessage({type:'result',id:data.id,...search(index,data.query,data.mode,30,data.language)});}
    if(data.type==='remove'){index=null;await caches.delete(DATA_CACHE);self.postMessage({type:'removed'});}
  }catch(e){self.postMessage({type:'error',message:e.name==='QuotaExceededError'?'本机存储空间不足。请释放空间后重试。':e.name==='AbortError'?'下载超时，已完成的分包会保留，请联网重试。':e.message||'词典暂时无法打开，请重试。'});}
};
