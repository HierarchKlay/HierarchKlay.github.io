import {Marked} from './vendor/marked.mjs';
import DOMPurify from './vendor/purify.mjs';

const escape=text=>String(text??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const parser=new Marked({gfm:true,breaks:true,renderer:{
  // Render remote images and raw HTML as inert text, never load model-supplied assets.
  image:token=>escape(token.text),html:token=>escape(token.text)
}});
const tags=['p','br','h1','h2','h3','h4','h5','h6','strong','em','del','blockquote','ul','ol','li','hr','pre','code','a','table','thead','tbody','tr','th','td'];

export function renderMarkdown(target,markdown){
  const text=String(markdown??'');
  if(!DOMPurify.isSupported){target.textContent=text;return;}
  const fragment=DOMPurify.sanitize(parser.parse(text),{
    ALLOWED_TAGS:tags,ALLOWED_ATTR:['href','title','start','align'],
    ALLOW_DATA_ATTR:false,ALLOW_ARIA_ATTR:false,RETURN_DOM_FRAGMENT:true
  });
  for(const link of fragment.querySelectorAll('a')){
    try{
      const url=new URL(link.getAttribute('href'));
      if(!['http:','https:'].includes(url.protocol)||url.username||url.password)throw Error();
      link.href=url.href;link.target='_blank';link.rel='noopener noreferrer';
    }catch{link.removeAttribute('href');}
  }
  target.replaceChildren(fragment);target.classList.add('markdown-body');
  for(const table of target.querySelectorAll('table')){
    const wrap=target.ownerDocument.createElement('div');wrap.className='md-table';
    wrap.tabIndex=0;wrap.setAttribute('role','region');wrap.setAttribute('aria-label','回答表格，可横向滚动');
    table.replaceWith(wrap);wrap.appendChild(table);
  }
}

export function searchLabel(data,requested){
  const status=data.search?.status;
  const labels={off:'未启用联网检索',complete:'已联网检索',partial:'已联网检索 · 部分检索失败',failed:'联网检索失败 · 回答未完成联网核实',unconfirmed:'已发起检索 · 未收到成功结果',not_triggered:'未触发联网检索 · 回答未完成联网核实'};
  const label=labels[status]||(data.searched?'已联网检索':requested?'未返回检索证据 · 回答未完成联网核实':'未启用联网检索');
  const sources=Array.isArray(data.sources)?data.sources.length:0;
  const count=Number(data.search?.requests)||0;
  return label+(data.searched?(count?` · ${count} 次`:'')+(sources?` · ${sources} 个来源`:' · 未返回来源链接'):'');
}
