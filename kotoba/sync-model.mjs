// Per-item last-write-wins registers, plus an append-only practice log.
// Local navigation remains local. No whole-device snapshot overwrites another.
export const emptyDocument=()=>({version:1,clock:0,records:{},events:{}});
const copy=x=>JSON.parse(JSON.stringify(x));
const same=(a,b)=>JSON.stringify(a??null)===JSON.stringify(b??null);
export function snapshot(state){
  const out={};
  for(const id of new Set([...Object.keys(state.ratings),...Object.keys(state.reviews),...Object.keys(state.mastered)]))
    out['word:'+id]={rating:state.ratings[id]||null,review:state.reviews[id]||null,mastered:state.mastered[id]===true};
  for(const id of new Set([...Object.keys(state.kanjiRatings),...Object.keys(state.kanjiReviews)]))
    out['kanji:'+id]={rating:state.kanjiRatings[id]||null,review:state.kanjiReviews[id]||null};
  for(const [id,d] of Object.entries(state.days))out['day:'+id]={order:d.order};
  return copy(out);
}
export function identifyEvents(events){
  const seen=new Map();
  for(const e of events){
    if(e.eventId)continue;
    // Identical legacy backups on two devices deduplicate deterministically.
    const key=JSON.stringify(e),n=seen.get(key)||0;seen.set(key,n+1);
    e.eventId='legacy:'+encodeURIComponent(key)+':'+n;
  }
}
export function capture(doc,before,state,actor,now=Date.now()){
  const after=snapshot(state),keys=new Set([...Object.keys(before||{}),...Object.keys(after)]);
  for(const key of keys){
    if(before&&!same(before[key],after[key])){
      doc.clock=Math.max(doc.clock+1,now);
      doc.records[key]={at:doc.clock,actor,value:after[key]??null};
    }else if(!doc.records[key]&&after[key]){
      // Historic imports have no trustworthy action time and cannot overwrite a newer action.
      doc.records[key]={at:0,actor,value:after[key]};
    }
  }
  identifyEvents(state.events);
  for(const e of state.events)doc.events[e.eventId]=copy(e);
  return after;
}
export function mergeDocuments(a,b){
  const out=copy(a);
  for(const [key,r] of Object.entries(b.records||{})){
    if(!r||!Number.isSafeInteger(r.at)||r.at<0||typeof r.actor!=='string')continue;
    const old=out.records[key];
    if(!old||r.at>old.at||(r.at===old.at&&r.actor>old.actor))out.records[key]=copy(r);
    out.clock=Math.max(out.clock,r.at);
  }
  for(const [key,e] of Object.entries(b.events||{}))if(!out.events[key])out.events[key]=copy(e);
  return out;
}
export function applyDocument(doc,state){
  const next=copy(state);
  next.ratings={};next.reviews={};next.mastered={};next.kanjiRatings={};next.kanjiReviews={};next.days={};
  for(const [key,{value:v}] of Object.entries(doc.records)){
    if(!v)continue;
    const p=key.indexOf(':'),kind=key.slice(0,p),id=key.slice(p+1);
    if(kind==='word'){
      if(v.rating)next.ratings[id]=v.rating;
      if(v.mastered)next.mastered[id]=true;
      if(v.review&&!v.mastered)next.reviews[id]=v.review;
    }else if(kind==='kanji'){
      if(v.rating)next.kanjiRatings[id]=v.rating;
      if(v.review)next.kanjiReviews[id]=v.review;
    }else if(kind==='day')next.days[id]={order:v.order,focus:state.days[id]?.focus};
  }
  next.events=Object.values(doc.events).sort((a,b)=>a.date.localeCompare(b.date)||(a.at||'').localeCompare(b.at||'')||a.eventId.localeCompare(b.eventId));
  return next;
}
