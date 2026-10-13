// Render only supplied, matched data. No pronunciation or translation is inferred here.
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function morae(reading){
  const text=String(reading).normalize('NFKC').replace(/[ァ-ヶ]/g,c=>String.fromCharCode(c.charCodeAt(0)-0x60));
  if(!/^[ぁ-ゖー]+$/.test(text))return [];
  const out=[];for(const c of text){if(/[ゃゅょぁぃぅぇぉゎ]/.test(c)&&out.length)out[out.length-1]+=c;else out.push(c);}return out;
}
export const pitchName=(n,length)=>n===0?'平板':n===1?'头高':n===length?'尾高':'中高';
export function pitchLevels(length,n){
  if(!Number.isInteger(n)||n<0||n>length||length<1)return [];
  return Array.from({length:length+1},(_,i)=>i===length?n===0?1:0:n===1?i===0?1:0:i===0?0:n===0||i<n?1:0);
}
export function pitchGraph(reading,n){
  const units=morae(reading),levels=pitchLevels(units.length,n);if(!levels.length)return '';
  const step=34,first=17,width=first+units.length*step+55;
  const point=i=>[first+i*step,levels[i]?12:32];
  const line=units.map((_,i)=>point(i).join(',')).join(' '),tail=[point(units.length-1),point(units.length)].map(p=>p.join(',')).join(' ');
  const label=`${reading}，${n}型，${pitchName(n,units.length)}；${levels.map(x=>x?'高':'低').join('、')}，最后一拍示意助词`;
  return `<svg class="pitch-graph" role="img" aria-label="${esc(label)}" viewBox="0 0 ${width} 62" width="${width}" height="62"><polyline class="pitch-line" points="${line}"/><polyline class="pitch-tail" points="${tail}"/>${units.map((m,i)=>{const [x,y]=point(i);return `<circle cx="${x}" cy="${y}" r="3"/><text x="${x}" y="55" text-anchor="middle">${esc(m)}</text>`;}).join('')}<circle class="pitch-tail" cx="${point(units.length)[0]}" cy="${point(units.length)[1]}" r="3"/><text class="particle-label" x="${point(units.length)[0]+4}" y="55" text-anchor="middle">助词</text></svg>`;
}
const kinds={Heiban:'平板',Atamadaka:'头高',Nakadaka:'中高',Odaka:'尾高'};
export function renderAccents(records=[]){
  if(!records.length)return '<section class="accent-section"><h3>音调</h3><p class="missing">暂无可确认对应的音调资料。</p></section>';
  // Equal patterns share a diagram; different sources/conditions stay visible.
  const groups=new Map(),notation=[];
  for(const a of records){
    const source=a.src==='kanjium'?{name:'Kanjium · Uros O.',url:'https://github.com/mifunetoshiro/kanjium'}:{name:'维基词典 · 东京式',url:'https://zh.wiktionary.org/wiki/'+encodeURIComponent(a.w)};
    if(!a.p?.length){notation.push({a,source});continue;}
    for(const p of a.p){
      if(!pitchLevels(morae(a.r).length,p.n).length)continue;
      const key=JSON.stringify([a.r,p.n,p.label||'']);
      if(!groups.has(key))groups.set(key,{r:a.r,n:p.n,label:p.label||'',words:new Set(),sources:new Map()});
      const g=groups.get(key);g.words.add(a.w);g.sources.set(source.name+'|'+source.url,source);
    }
  }
  const items=[...groups.values()].map(g=>`<div class="accent-card"><p class="accent-title"><span lang="ja">${esc(g.r)}</span> <b>${g.n}型 · ${pitchName(g.n,morae(g.r).length)}</b>${g.label?` <span class="badge">${esc(g.label)}</span>`:''}</p><div class="pitch-scroll">${pitchGraph(g.r,g.n)}</div><p class="labels">写法：${[...g.words].map(esc).join('、')} · ${[...g.sources.values()].map(s=>`<a href="${esc(s.url)}" target="_blank" rel="noopener">${s.name}</a>`).join(' / ')}</p></div>`);
  items.push(...notation.map(({a,source})=>`<div class="accent-card"><p lang="ja">${esc(a.w)}（${esc(a.r)}）</p><p class="source-notation">${esc(a.roman)} <span class="labels">${(a.kind||[]).map(k=>esc(kinds[k]||k)).join('・')}</span></p><p class="labels"><a href="${esc(source.url)}" target="_blank" rel="noopener">${source.name}</a> · 保留原标记</p></div>`));
  return `<section class="accent-section"><h3>音调 <small>词典形 · 保留来源中的不同读法</small></h3><div class="accent-grid">${items.slice(0,4).join('')}</div>${items.length>4?`<details><summary>其他音调与写法（${items.length-4}）</summary><div class="accent-grid">${items.slice(4).join('')}</div></details>`:''}<p class="labels pitch-help">数字表示第几拍后下降；0 型不下降。虚线示意接助词，句中语调和活用形式可能变化。</p></section>`;
}
function sentence(row,language,label,term=''){
  let text=esc(row.t);if(term&&row.t.includes(term))text=row.t.split(term).map(esc).join(`<mark>${esc(term)}</mark>`);
  return `<div class="example-line"><span class="example-language">${label}</span><p lang="${language}">${text}</p></div>`;
}
function credit(row,label){
  const id=String(row.id||'');if(!/^\d+$/.test(id))return '';
  return `<a href="https://tatoeba.org/en/sentences/show/${id}" target="_blank" rel="noopener">${label} #${id}${row.a?' · '+esc(row.a):' · Tatoeba 贡献者'}</a>`;
}
export function renderExamples(rows=[]){
  if(!rows.length)return '';
  const one=x=>`<div class="example-card">${sentence(x.j,'ja','日',x.term)}${(x.z||[]).map(z=>sentence(z,'zh','中')).join('')}${x.e?sentence(x.e,'en','英'):''}${x.z?.length?'':'<p class="labels no-translation">本句暂无直接对应的中文译文。</p>'}<p class="example-credit">Tatoeba · ${[credit(x.j,'日'),...(x.z||[]).map(z=>credit(z,'中')),x.e?credit(x.e,'英'):''].filter(Boolean).join(' / ')} · <a href="https://creativecommons.org/licenses/by/2.0/fr/" target="_blank" rel="noopener">CC BY 2.0 FR</a></p></div>`;
  return `<section class="sense-examples" aria-label="本义项例句"><p class="example-heading">例句 <span>JMdict 义项关联 · Tatoeba</span></p>${rows.slice(0,2).map(one).join('')}${rows.length>2?`<details><summary>更多例句</summary>${rows.slice(2).map(one).join('')}</details>`:''}</section>`;
}
