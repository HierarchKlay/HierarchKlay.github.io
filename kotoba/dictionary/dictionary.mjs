import {PACK} from './config.mjs';
const $=s=>document.querySelector(s);
import {renderEntry} from './render.mjs';
let worker,ready=false,request=0,busy=false,registration;
const url=new URL(PACK.file,import.meta.url).href,cacheName='kotoba-dictionary-data-v1';
$('#packInfo').textContent=`${PACK.entries.toLocaleString('zh-CN')} 条 · ${(PACK.bytes/1000000).toFixed(1)} MB · 日英词典`;
$('#snapshot').textContent=`词库快照：${PACK.date}；${PACK.entries.toLocaleString('zh-CN')} 条。数据转换仅压缩与重组结构。`;
const setStatus=t=>{$('#downloadStatus').textContent=t;};
const queryLink=()=>{$('#professionalSearch').href='mkdictionaries:///?text='+encodeURIComponent($('#query').value.trim()||'迎える')+'&category=cn-ja&scope=jc';};
const search=()=>{queryLink();if(!ready)return;const query=$('#query').value.trim();if(!query){$('#results').innerHTML='';$('#resultStatus').textContent='输入日语词语或英文释义开始查询。';return;}$('#resultStatus').textContent='正在本机查询…';worker.postMessage({type:'search',query,mode:$('#match').value,id:++request});};
function makeWorker(){
  if(worker)return worker;
  worker=new Worker(new URL('./worker.mjs',import.meta.url),{type:'module'});
  worker.onerror=()=>fail('词典程序加载失败，请刷新重试。');
  worker.onmessage=({data:d})=>{
    if(d.type==='progress'){setStatus(d.phase+(d.value?' · '+d.value+'%':''));$('#downloadProgress').value=d.value;}
    if(d.type==='ready'){ready=true;busy=false;$('#searchButton').disabled=false;$('#downloadProgress').hidden=true;$('#download').textContent='已下载';$('#download').disabled=true;setStatus(registration?'已保存在本机 · 本词典页可离线打开与查询':'词库已保存 · 离线页面准备失败，请联网刷新重试');search();}
    if(d.type==='result'&&d.id===request){$('#resultStatus').textContent=d.total?`找到 ${d.total.toLocaleString('zh-CN')} 条${d.total>30?'，显示前 30 条；可输入更完整的词缩小范围':''}。`:'没有匹配词条。试试辞书形、假名或“包含”匹配。';$('#results').innerHTML=d.items.map(renderEntry).join('')||'<p class="empty">词典未收录或输入形式未匹配，不会自动生成释义。</p>';}
    if(d.type==='error')fail(d.message);
    if(d.type==='removed'){ready=false;busy=false;$('#results').innerHTML='';$('#resultStatus').textContent='';$('#searchButton').disabled=true;$('#download').disabled=false;$('#download').textContent='下载到本机';setStatus('词库已删除；学习进度不受影响。');}
  };return worker;
}
function fail(message){busy=false;ready=false;$('#searchButton').disabled=true;$('#download').disabled=false;$('#download').textContent='重新下载';$('#downloadProgress').hidden=true;setStatus(message);}
async function installPage(){
  if(!('serviceWorker' in navigator))throw Error('浏览器不支持离线页面，请使用新版 Safari / Chrome。');
  const reg=await navigator.serviceWorker.register('./sw.js',{scope:'./',updateViaCache:'none'});
  const active=reg.active||await new Promise((resolve,reject)=>{const sw=reg.installing||reg.waiting;if(!sw)return reject(Error('离线页面未就绪'));const timer=setTimeout(()=>reject(Error('离线页面准备超时')),20000);sw.addEventListener('statechange',()=>{if(sw.state==='activated'){clearTimeout(timer);resolve(sw);}if(sw.state==='redundant'){clearTimeout(timer);reject(Error('离线页面下载失败'));}});});
  if(!active)throw Error('离线页面未就绪');return reg;
}
$('#searchForm').addEventListener('submit',e=>{e.preventDefault();search();});
$('#match').addEventListener('change',search);
$('#query').addEventListener('input',()=>{request++;queryLink();});
$('#currentExample').addEventListener('click',()=>{$('#query').value='迎える';search();});
$('#download').addEventListener('click',async()=>{
  if(busy)return;busy=true;$('#download').disabled=true;$('#downloadProgress').hidden=false;
  try{registration=await installPage();navigator.storage?.persist?.().catch(()=>{});makeWorker().postMessage({type:'load',download:true});}catch(e){fail(e.message);}
});
$('#remove').addEventListener('click',()=>{if(busy)return;if(!confirm('删除此浏览器里的离线词库？学习进度不会删除。'))return;request++;makeWorker().postMessage({type:'remove'});});
$('#query').value=new URLSearchParams(location.search).get('q')?.slice(0,80)||'';queryLink();
try{
  if(!('caches' in globalThis)||!isSecureContext)throw Error('当前浏览器不支持安全离线存储，请用 HTTPS 地址和新版浏览器。');
  // Registration failure does not prevent use of an already cached word database.
  try{registration=await installPage();}catch{}
  const cache=await caches.open(cacheName);
  if(await cache.match(url)){busy=true;makeWorker().postMessage({type:'load'});}
  else{$('#download').disabled=false;setStatus('首次下载需要联网；完成后查词无需网络。');}
}catch(e){fail(e.message);}
