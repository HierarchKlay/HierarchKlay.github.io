'use strict';
const SONGS = [
  { key:'rain', title:'Rain', artist:'秦 基博', path:'/album/1801540012?i=1801540626', note:'已核对官方播放器曲目；会员播放与地区可用性待验证' },
  { key:'nanmonee', title:'なんもねえ', artist:'忘れらんねえよ', path:'/album/6781198667', note:'已核对官方播放器曲目；会员播放与地区可用性待验证' },
  { key:'nekojarashi', title:'猫じゃらし', artist:'7co', path:'/album/6781555396', note:'已核对官方播放器曲目；会员播放与地区可用性待验证' }
];
const STORAGE_KEY='hibi-uta-playback-check-v1';
const $=id=>document.getElementById(id);
let saved={region:'cn',regionPreferenceVersion:2,selected:'rain',overrides:{},results:{}};
try{const value=JSON.parse(localStorage.getItem(STORAGE_KEY)||'null');if(value&&typeof value==='object'){saved={...saved,...value,overrides:value.overrides||{},results:value.results||{}};}}catch{}
// Apply the user's confirmed mainland account region once, keeping earlier reports and custom links.
try{const previous=JSON.parse(localStorage.getItem(STORAGE_KEY)||'null');if(previous&&!previous.regionPreferenceVersion)saved.region='cn';}catch{}
saved.regionPreferenceVersion=2;
if(!['jp','cn','hk','tw','us','gb'].includes(saved.region))saved.region='cn';
if(!SONGS.some(s=>s.key===saved.selected))saved.selected='rain';
let frameGeneration=0;
function song(){return SONGS.find(s=>s.key===saved.selected);}
function normalizeLink(raw){
  const u=new URL(raw);
  if(u.protocol!=='https:'||u.hostname!=='music.apple.com'||u.username||u.password||u.port)throw Error('请使用 https://music.apple.com/ 开头的歌曲或专辑链接。');
  if(!/^\/[a-z]{2}\/(album|song)\/(?:[^/]+\/)?\d+\/?$/.test(u.pathname))throw Error('请粘贴歌曲或专辑分享链接，不是搜索页或歌手主页。');
  for(const key of [...u.searchParams.keys()])if(key!=='i')u.searchParams.delete(key);
  if(u.searchParams.has('i')&&!/^\d+$/.test(u.searchParams.get('i')))throw Error('链接中的歌曲编号无效。');
  u.hash='';return u;
}
function currentURL(){
  if(saved.overrides[saved.selected]){try{return normalizeLink(saved.overrides[saved.selected]);}catch{delete saved.overrides[saved.selected];}}
  return new URL('https://music.apple.com/'+saved.region+song().path);
}
function resultKey(){return saved.selected+'|'+currentURL().href;}
function save(message='已保存在此浏览器'){
  try{localStorage.setItem(STORAGE_KEY,JSON.stringify(saved));$('save-status').textContent=message;}
  catch{$('save-status').textContent='当前浏览器无法保存；请复制结果保留。';}
}
function loadResult(){
  const r=saved.results[resultKey()]||{};
  for(const field of ['play','lock','controls']){
    const select=$('result-'+field);select.value=r[field]||'未测试';if(select.selectedIndex<0)select.selectedIndex=0;
  }
  $('notes').value=r.notes||'';
  $('report-output').hidden=true;
}
function renderPicker(){
  const list=$('song-list');list.replaceChildren();
  SONGS.forEach((s,i)=>{
    const button=document.createElement('button');button.type='button';button.className='song';button.setAttribute('aria-pressed',String(s.key===saved.selected));
    const number=document.createElement('span');number.className='song-index';number.textContent='0'+(i+1);
    const info=document.createElement('span');info.className='song-info';const title=document.createElement('strong');title.textContent=s.title;const artist=document.createElement('small');artist.textContent=s.artist;info.append(title,artist);button.append(number,info);
    button.addEventListener('click',()=>{if(saved.selected===s.key)return;saved.selected=s.key;save();renderSelection();});list.append(button);
  });
}
function mountPlayer(){
  const u=currentURL();const generation=++frameGeneration;
  $('apple-link').href=u.href;
  $('track-share-url').value=u.href;
  const region=u.pathname.split('/')[1];
  const regionNames={cn:'中国大陆',jp:'日本',hk:'香港',tw:'台湾',us:'美国',gb:'英国'};
  $('active-region').textContent='当前曲库地区：'+(regionNames[region]||region.toUpperCase());
  $('official-web-link').href='https://music.apple.com/'+region+'/new';
  $('official-web-link').textContent='前往 Apple 官网登录 ↗';
  $('frame-status').textContent='正在载入 Apple Music 播放器…';
  const frame=document.createElement('iframe');frame.title=song().title+' — Apple Music 官方播放器';frame.allow='autoplay *; encrypted-media *; fullscreen *; clipboard-write';frame.referrerPolicy='strict-origin-when-cross-origin';
  frame.setAttribute('sandbox','allow-forms allow-popups allow-popups-to-escape-sandbox allow-same-origin allow-scripts allow-storage-access-by-user-activation allow-top-navigation-by-user-activation');
  frame.src='https://embed.music.apple.com'+u.pathname+u.search;
  frame.addEventListener('load',()=>{if(generation===frameGeneration)$('frame-status').textContent='已载入播放器页面。登录与歌曲可用性，请以上方 Apple 播放器显示为准。';});
  frame.addEventListener('error',()=>{if(generation===frameGeneration)$('frame-status').textContent='播放器载入失败，请尝试重新载入或打开 Apple Music 链接。';});
  $('player-host').replaceChildren(frame);
  setTimeout(()=>{if(generation===frameGeneration&&$('frame-status').textContent==='正在载入 Apple Music 播放器…')$('frame-status').textContent='播放器仍在载入。如果上方空白，可重新载入或打开 Apple Music 链接。';},15000);
}
function renderSelection(){
  const s=song();$('song-title').textContent=s.title;$('song-artist').textContent=s.artist;$('source-note').textContent=saved.overrides[s.key]?'使用你提供的 Apple Music 链接':s.note;
  $('track-number').textContent='0'+(SONGS.indexOf(s)+1)+' / 03';$('song-url').value=saved.overrides[s.key]||'';$('link-error').textContent='';
  renderPicker();loadResult();mountPlayer();
}
// Keep the share link on the current deployment, including its subdirectory.
$('site-share-url').value=new URL('./',location.href).href;
$('storefront').value=saved.region;
$('storefront').addEventListener('change',()=>{saved.region=$('storefront').value;delete saved.overrides[saved.selected];save();renderSelection();});
$('reload-player').addEventListener('click',mountPlayer);
async function copyLink(inputId,label){
  const input=$(inputId);
  try{await navigator.clipboard.writeText(input.value);$('link-copy-status').textContent=label+'已复制，请在 Safari 地址栏粘贴打开。';}
  catch{input.focus();input.select();input.setSelectionRange(0,input.value.length);$('link-copy-status').textContent='无法自动复制，已选中'+label+'；请长按并选择「复制」。';}
}
$('copy-site-url').addEventListener('click',()=>copyLink('site-share-url','本站链接'));
$('copy-track-url').addEventListener('click',()=>copyLink('track-share-url','歌曲链接'));
$('link-form').addEventListener('submit',event=>{
  event.preventDefault();try{const u=normalizeLink($('song-url').value.trim());saved.overrides[saved.selected]=u.href;save();renderSelection();}catch(error){$('link-error').textContent=error.message;}
});
function recordResult(){
  saved.results[resultKey()]={title:song().title,artist:song().artist,url:currentURL().href,play:$('result-play').value,lock:$('result-lock').value,controls:$('result-controls').value,notes:$('notes').value,updatedAt:new Date().toISOString()};save();
}
for(const field of ['play','lock','controls'])$('result-'+field).addEventListener('change',recordResult);
$('notes').addEventListener('input',recordResult);
function reportText(){
  const rows=Object.values(saved.results).filter(r=>r&&typeof r==='object');
  return ['日々うた · Apple Music 播放验证','设备目标：iPhone / iOS 27.0.1','记录来源：用户手动观察，非自动播放检测','生成时间：'+new Date().toLocaleString('zh-CN'),...rows.map(r=>['',r.title+' — '+r.artist,'歌曲链接：'+r.url,'播放：'+r.play,'锁屏：'+r.lock,'锁屏控制：'+r.controls,'备注：'+(r.notes||'无')].join('\n'))].join('\n');
}
$('copy-report').addEventListener('click',async()=>{
  recordResult();const text=reportText();try{await navigator.clipboard.writeText(text);$('save-status').textContent='已复制，可以粘贴回对话。';}catch{$('report-output').value=text;$('report-output').hidden=false;$('report-output').focus();$('report-output').select();$('save-status').textContent='请长按下方文本，选择复制。';}
});
renderSelection();
try{localStorage.setItem(STORAGE_KEY,JSON.stringify(saved));}catch{}
