import {PACK} from './config.mjs';
import {prepare,search} from './search.mjs';
export const DATA_CACHE='kotoba-dictionary-data-v1';
let index=null, loading=null;
const url=new URL(PACK.file,import.meta.url).href;
const progress=(phase,value)=>self.postMessage({type:'progress',phase,value});
async function decode(response){
  const bytes=await response.arrayBuffer();
  const digest=[...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(x=>x.toString(16).padStart(2,'0')).join('');
  if(digest!==PACK.sha256)throw Error('词库校验失败，请联网重新下载。');
  const json=await new Response(new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'))).json();
  if(json.entries.length!==PACK.entries)throw Error('词库条目不完整，请重新下载。');
  return json.entries;
}
async function load(download=false){
  if(index)return;
  if(loading)return loading;
  loading=(async()=>{
    if(typeof DecompressionStream==='undefined')throw Error('浏览器版本较旧，请更新 Safari / Chrome 后重试。');
    const cache=await caches.open(DATA_CACHE);
    let response=await cache.match(url);
    let entries;
    if(response){
      progress('校验本机词库',0);
      try{entries=await decode(response);}catch(e){await cache.delete(url);throw e;}
    }else{
      if(!download)throw Error('请先联网点击“下载到本机”。');
      const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),180000);
      try{
        const res=await fetch(url,{cache:'no-store',signal:controller.signal});
        if(!res.ok)throw Error('词库下载失败（HTTP '+res.status+'），请重试。');
        const reader=res.body.getReader(),chunks=[];let received=0;
        while(true){const {done,value}=await reader.read();if(done)break;chunks.push(value);received+=value.byteLength;progress('下载词库',Math.min(99,Math.round(received/PACK.bytes*100)));}
        response=new Response(new Blob(chunks),{headers:{'Content-Type':'application/gzip'}});
        progress('校验与整理词库',100);
        entries=await decode(response.clone());
        await cache.put(url,response);
      }finally{clearTimeout(timer);}
    }
    index=prepare(entries);progress('词库就绪',100);
  })();
  try{await loading;}finally{loading=null;}
}
self.onmessage=async({data})=>{
  try{
    if(data.type==='load'){await load(data.download);self.postMessage({type:'ready',count:PACK.entries});}
    if(data.type==='search'){await load();self.postMessage({type:'result',id:data.id,...search(index,data.query,data.mode)});}
    if(data.type==='remove'){index=null;await caches.delete(DATA_CACHE);self.postMessage({type:'removed'});}
  }catch(e){self.postMessage({type:'error',message:e.name==='QuotaExceededError'?'本机存储空间不足。请释放空间后重试。':e.name==='AbortError'?'下载超时，请联网后重试。':e.message||'词典暂时无法打开，请重试。'});}
};
