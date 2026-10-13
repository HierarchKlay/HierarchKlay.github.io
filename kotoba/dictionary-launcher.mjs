const dialog=document.querySelector('#dictionaryDialog');
let opening=0;
// An old dictionary page is cache-first. Refresh its existing worker before
// showing the iframe so upgrading from the English-only shell takes one visit.
async function refreshDictionary(url,token){
  try{
    const reg=await navigator.serviceWorker?.getRegistration?.(url.href);
    if(!reg||reg.scope!==new URL('./',url).href)return;
    await reg.update();
    const sw=reg.installing||reg.waiting;
    if(sw&&sw.state!=='activated')await new Promise(resolve=>{const timer=setTimeout(resolve,15000);const check=()=>{if(sw.state==='activated'||sw.state==='redundant'){clearTimeout(timer);resolve();}};sw.addEventListener('statechange',check);check();});
    if(sw?.state==='activated'&&opening===token&&dialog.open)document.querySelector('#dictionaryFrame').src=url.href;
  }catch{} // Offline opening always continues with the existing shell.
}
document.addEventListener('click',e=>{
  const el=e.target.closest('[data-dictionary]');if(!el)return;
  const query=el.dataset.dictionary||'';
  const url=new URL('dictionary/index.html',location.href);if(query)url.searchParams.set('q',query);
  if(!dialog?.showModal)return;
  e.preventDefault();document.querySelector('#dictionaryFrame').src=url.href;
  document.querySelector('#dictionaryStandalone').href=url.href;
  dialog.showModal();
  refreshDictionary(url,++opening);
});
document.querySelector('#closeDictionary')?.addEventListener('click',()=>dialog.close());
dialog?.addEventListener('close',()=>{opening++;document.querySelector('#dictionaryFrame').src='about:blank';});
