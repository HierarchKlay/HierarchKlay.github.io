export const normalize = value => String(value).normalize('NFKC').trim().toLowerCase().replace(/[ァ-ヶ]/g,c=>String.fromCharCode(c.charCodeAt(0)-0x60));
export function prepare(entries) {
  return entries.map(e=>({e, keys:[...e.k.map(k=>k.t),...e.r.map(r=>r.t)].map(normalize)}));
}
export function search(index, query, mode='prefix', limit=30) {
  const q=normalize(query).slice(0,80);
  if(!q)return {items:[],total:0};
  const english=/[a-z]/i.test(q), found=[];
  for(const {e,keys} of index){
    const exact=keys.includes(q);
    let score=exact?0:keys.some(k=>k.startsWith(q))?2:mode==='contains'&&keys.some(k=>k.includes(q))?4:99;
    if(english&&e.s.some(s=>s.g.some(g=>normalize(g.t).includes(q))))score=Math.min(score,6);
    if(mode==='exact'&&!exact&&!english)continue;
    if(score<99)found.push({e,score:score+(e.c?0:1)});
  }
  found.sort((a,b)=>a.score-b.score||Number(a.e.id)-Number(b.e.id));
  return {items:found.slice(0,limit).map(x=>x.e),total:found.length};
}
