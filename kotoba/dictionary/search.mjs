export const normalize=value=>String(value).normalize('NFKC').trim().toLowerCase().replace(/[ァ-ヶ]/g,c=>String.fromCharCode(c.charCodeAt(0)-0x60));
// Boundary-delimited strings keep the full-text index small enough for an offline worker.
const terms=strings=>'\x1f'+[...new Set(strings.flatMap(s=>[s,...s.split(/[；;，,、。]/)]).map(normalize).filter(Boolean))].join('\x1f')+'\x1f';
export function prepare(entries,translations=[],wiki=[],pitch=[],examples=[]){
  const all=entries.map(e=>({...e})),byid=new Map(all.map(e=>[e.id,e]));
  for(const t of translations){const e=byid.get(t.id);if(e)e.z=t.s;}
  for(const w of wiki){
    const e=byid.get(w.j);
    if(e)(e.w??=[]).push(w);
    else {const standalone={id:w.id,k:[{t:w.t}],r:w.r.map(t=>({t})),s:[],w:[w],c:false};all.push(standalone);byid.set(w.id,standalone);}
  }
  for(const p of pitch){const e=byid.get(p.id);if(e)e.accent=p.a;}
  for(const x of examples){const e=byid.get(x.id);if(e)e.examples=x.s;}
  return all.map(e=>({e,keys:[...new Set([...e.k,...e.r].map(x=>normalize(x.t)))],
    en:terms(e.s.flatMap(s=>s.g.flatMap(g=>[g.t,g.t.replace(/^to /,'').replace(/\s*\([^)]*\)/g,'')]))),
    zh:terms([...Object.values(e.z||{}).flatMap(s=>s.g),...(e.w||[]).flatMap(w=>w.s.flatMap(s=>s.g))])}));
}
function keyMatch(keys,q,mode){return keys.includes(q)?0:mode==='exact'?99:keys.some(k=>k.startsWith(q))?2:mode==='contains'&&keys.some(k=>k.includes(q))?4:99;}
function textMatch(text,q,mode){return text.includes('\x1f'+q+'\x1f')?0:mode==='exact'?99:text.includes('\x1f'+q)?2:mode==='contains'&&text.includes(q)?4:99;}
export function search(index,query,mode='prefix',limit=30,language='auto'){
  const q=normalize(query).slice(0,80);if(!q)return {items:[],total:0};
  const found=[],kana=/[ぁ-ゖ]/.test(q),han=/[\u3400-\u9fff]/.test(q),latin=/[a-z]/.test(q);
  for(const {e,keys,en,zh} of index){
    let score=99,via='ja';
    if(language==='auto'||language==='ja')score=keyMatch(keys,q,mode);
    if(language==='zh'||language==='auto'&&!kana&&han){const n=textMatch(zh,q,mode)+6;if(n<score){score=n;via='zh';}}
    if(language==='en'||language==='auto'&&latin){const n=textMatch(en,q,mode)+6;if(n<score){score=n;via='en';}}
    if(score<99)found.push({e,via,score:score+(e.c?0:1)});
  }
  found.sort((a,b)=>a.score-b.score||a.e.id.localeCompare(b.e.id));
  return {items:found.slice(0,limit).map(({e,via})=>({...e,via})),total:found.length};
}
