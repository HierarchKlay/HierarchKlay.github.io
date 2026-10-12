const eventMeta=()=>({eventId:globalThis.crypto?.randomUUID?.()||Date.now().toString(36)+'-'+Math.random().toString(36).slice(2),at:new Date().toISOString()});
export const RATINGS = ['again','familiar','known'];
export function shuffled(ids, random=Math.random){
  const out=[...ids];
  for(let i=out.length-1;i>0;i--){const j=Math.floor(random()*(i+1));[out[i],out[j]]=[out[j],out[i]];}
  if(out.length>1 && out.every((id,i)=>id===ids[i]))out.push(out.shift());
  return out;
}
export function dayStamp(now=new Date()){return new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Shanghai',year:'numeric',month:'2-digit',day:'2-digit'}).format(now);}
export function afterDays(stamp,n){const d=new Date(stamp+'T12:00:00+08:00');d.setUTCDate(d.getUTCDate()+n);return dayStamp(d);}
export function restoreState(raw,course){
  const o=raw&&typeof raw==='object'?raw:{},ids=new Set(course.words.map(w=>w.id));
  const ratings=Object.fromEntries(Object.entries(o.ratings||{}).filter(([id,v])=>ids.has(id)&&RATINGS.includes(v)));
  const mastered=Object.fromEntries(Object.entries(o.mastered||{}).filter(([id,v])=>ids.has(id)&&v===true));
  const reviews=Object.fromEntries(Object.entries(o.reviews||{}).filter(([id,v])=>ids.has(id)&&v&&/^\d{4}-\d{2}-\d{2}$/.test(v.due)).map(([id,v])=>[id,{due:v.due,level:Math.max(0,Math.min(6,Number(v.level)||0)),lastReviewed:typeof v.lastReviewed==='string'?v.lastReviewed:null}]));
  const days={},used=new Set();
  for(const day of course.days){const a=o.days?.[day.id];if(!a||!Array.isArray(a.order))continue;const order=[...new Set(a.order)].filter(id=>ids.has(id)&&!used.has(id));order.forEach(id=>used.add(id));days[day.id]={order:order.slice(0,course.dailyGoal),focus:a.focus};}
  const kids=new Set((course.kanji||[]).map(k=>k.id));
  const kanjiRatings=Object.fromEntries(Object.entries(o.kanjiRatings||{}).filter(([id,v])=>kids.has(id)&&RATINGS.includes(v)));
  const kanjiReviews=Object.fromEntries(Object.entries(o.kanjiReviews||{}).filter(([id,v])=>kids.has(id)&&v&&/^\d{4}-\d{2}-\d{2}$/.test(v.due)).map(([id,v])=>[id,{due:v.due,level:Math.max(0,Math.min(6,Number(v.level)||0)),lastReviewed:v.lastReviewed||null}]));
  const events=(Array.isArray(o.events)?o.events:[]).filter(e=>e&&/^\d{4}-\d{2}-\d{2}$/.test(e.date)&&['word','kanji'].includes(e.kind)&&(e.kind==='word'?ids:kids).has(e.id)&&RATINGS.includes(e.rating)).map(e=>({...((typeof e.eventId==='string'&&e.eventId.length<4096)?{eventId:e.eventId}:{}),...(typeof e.at==='string'?{at:e.at}:{}),date:e.date,kind:e.kind,id:e.id,rating:e.rating,first:e.first===true,objective:e.objective===true,correct:e.correct===true,mode:String(e.mode||'self')}));
  return {version:4,selectedDay:course.days.some(d=>d.id===o.selectedDay)?o.selectedDay:course.days[0].id,days,ratings,mastered,reviews,kanjiRatings,kanjiReviews,events,furigana:o.furigana!==false};
}
export function ensureDay(state,course,dayId){
  const day=course.days.find(d=>d.id===dayId);if(!day)throw new Error('Unknown day');
  if(!state.days[dayId])state.days[dayId]={order:[...day.core],focus:day.core[0]};
  const entry=state.days[dayId];
  const usedElsewhere=new Set(Object.entries(state.days).filter(([key])=>key!==dayId).flatMap(([,d])=>d.order));
  const candidates=[...new Set([...day.reserve,...course.days.flatMap(d=>d.reserve)])].filter(id=>!state.mastered[id]&&!usedElsewhere.has(id)&&!state.ratings[id]);
  const added=[],seen=new Set(),order=[];
  const take=()=>{const id=candidates.find(x=>!seen.has(x)&&!entry.order.includes(x));if(id){seen.add(id);added.push(id);}return id;};
  for(const id of entry.order){if(state.mastered[id]){const next=take();if(next)order.push(next);}else if(!seen.has(id)&&!usedElsewhere.has(id)){order.push(id);seen.add(id);}}
  while(order.length<course.dailyGoal){const next=take();if(!next)break;order.push(next);}
  entry.order=order.slice(0,course.dailyGoal);if(!entry.order.includes(entry.focus))entry.focus=entry.order[0]||null;
  return {added,missing:course.dailyGoal-entry.order.length};
}
export function markMastered(state,course,id){state.mastered[id]=true;delete state.reviews[id];const result={};for(const dayId of Object.keys(state.days))result[dayId]=ensureDay(state,course,dayId);return result;}
export function restoreMastered(state,id,today=dayStamp()){delete state.mastered[id];state.ratings[id]='again';state.reviews[id]={due:today,level:0};}
export const INTERVALS=[0,1,3,7,14,30,60];
function schedule(prior,value,today){
  const canAdvance=!prior||(!prior.lastReviewed||prior.lastReviewed!==today)&&prior.due<=today;
  const level=value==='known'?Math.min(6,Math.max(1,(prior?.level||0)+(canAdvance?1:0))):0;
  const wait=value==='again'?0:value==='familiar'?1:INTERVALS[level];
  return {due:afterDays(today,wait),level,lastReviewed:today};
}
export function rateWord(state,id,value,today=dayStamp(),meta={}){
  if(state.mastered[id]||!RATINGS.includes(value))return;
  const first=!state.ratings[id];state.reviews[id]=schedule(state.reviews[id],value,today);state.ratings[id]=value;
  state.events.push({...eventMeta(),date:today,kind:'word',id,rating:value,first,mode:meta.mode||'self',objective:meta.objective===true,correct:meta.correct===true});
}
export function dueIds(state,today=dayStamp()){return Object.keys(state.ratings).filter(id=>!state.mastered[id]&&(!state.reviews[id]||state.reviews[id].due<=today)).sort((a,b)=>(state.reviews[a]?.due||'').localeCompare(state.reviews[b]?.due||''));}
export function rateKanji(state,id,value,today=dayStamp(),meta={}){if(!RATINGS.includes(value))return;const first=!state.kanjiRatings[id];state.kanjiReviews[id]=schedule(state.kanjiReviews[id],value,today);state.kanjiRatings[id]=value;state.events.push({...eventMeta(),date:today,kind:'kanji',id,rating:value,first,mode:meta.mode||'self',objective:meta.objective===true,correct:meta.correct===true});}
export function dueKanjiIds(state,today=dayStamp()){return Object.keys(state.kanjiRatings).filter(id=>!state.kanjiReviews[id]||state.kanjiReviews[id].due<=today).sort((a,b)=>(state.kanjiReviews[a]?.due||'').localeCompare(state.kanjiReviews[b]?.due||''));}
export function quizPool(state,current,source='daily',today=dayStamp(),limit=10){
  const due=dueIds(state,today),eligible=current.filter(id=>!state.mastered[id]);
  if(source==='due')return due.slice(0,limit);
  if(source==='lesson')return shuffled(eligible).slice(0,limit);
  const old=due.filter(id=>!eligible.includes(id));
  // Up to 70% old words first; all overdue words stay available in the dedicated queue.
  const chosen=old.slice(0,Math.min(7,limit));
  for(const id of [...due,...shuffled(eligible)]){if(!chosen.includes(id))chosen.push(id);if(chosen.length>=limit)break;}
  return chosen.slice(0,limit);
}
export function activity(state,today=dayStamp()){
  const firstDates=new Map();for(const e of state.events)if(e.kind==='word'&&e.first&&(!firstDates.has(e.id)||e.date<firstDates.get(e.id)))firstDates.set(e.id,e.date);
  return Array.from({length:7},(_,i)=>{const date=afterDays(today,i-6),events=state.events.filter(e=>e.date===date),objective=events.filter(e=>e.objective);return {date,words:new Set(events.filter(e=>e.kind==='word').map(e=>e.id)).size,kanji:new Set(events.filter(e=>e.kind==='kanji').map(e=>e.id)).size,newWords:new Set(events.filter(e=>e.kind==='word'&&e.first&&firstDates.get(e.id)===date).map(e=>e.id)).size,tests:objective.length,correct:objective.filter(e=>e.correct).length};});
}
export function normalizeKana(value){return String(value).normalize('NFKC').trim().replace(/\s/g,'').replace(/[ァ-ヶ]/g,ch=>String.fromCharCode(ch.charCodeAt(0)-0x60));}
export function checkReading(input,reading){return normalizeKana(input)===normalizeKana(reading);}
export function reserveLeft(state,course){const used=new Set(Object.values(state.days).flatMap(d=>d.order));return course.days.flatMap(d=>d.reserve).filter(id=>!state.mastered[id]&&!used.has(id)&&!state.ratings[id]).length;}
export function counts(ratings,ids){return {seen:ids.filter(id=>RATINGS.includes(ratings[id])).length,known:ids.filter(id=>ratings[id]==='known').length,review:ids.filter(id=>['again','familiar'].includes(ratings[id])).length};}
export function pitchLevels(mora,accent){return mora.map((_,i)=>accent===1?(i===0?1:0):(i===0?0:(accent===0||i<accent?1:0)));}
