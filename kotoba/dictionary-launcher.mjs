const dialog=document.querySelector('#dictionaryDialog');
document.addEventListener('click',e=>{
  const el=e.target.closest('[data-dictionary]');if(!el)return;
  const query=el.dataset.dictionary||'';
  const url=new URL('dictionary/index.html',location.href);if(query)url.searchParams.set('q',query);
  if(!dialog?.showModal)return;
  e.preventDefault();document.querySelector('#dictionaryFrame').src=url.href;
  document.querySelector('#dictionaryStandalone').href=url.href;
  dialog.showModal();
});
document.querySelector('#closeDictionary')?.addEventListener('click',()=>dialog.close());
dialog?.addEventListener('close',()=>{document.querySelector('#dictionaryFrame').src='about:blank';});
