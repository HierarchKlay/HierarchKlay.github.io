// Headless DOM stub integration checks. This is not browser/layout verification.
import assert from 'node:assert/strict';
import fs from 'node:fs';
const course=JSON.parse(fs.readFileSync(new URL('./dist/lesson.json',import.meta.url),'utf8'));
const listeners={},els=new Map(),store=new Map();
class Element {constructor(){this.innerHTML='';this.textContent='';this.style={};this.dataset={};this.hidden=false;this.open=false;this.classList={add(){},remove(){},toggle(){},contains(){return false;}};}setAttribute(){}removeAttribute(){}addEventListener(){}querySelectorAll(){return [];}showModal(){this.open=true;}close(){this.open=false;}}
globalThis.document={querySelector(s){if(!els.has(s))els.set(s,new Element());return els.get(s);},querySelectorAll(){return [];},addEventListener(type,fn){(listeners[type]??=[]).push(fn);},hidden:false};
globalThis.window={speechSynthesis:{getVoices:()=>[],cancel(){},addEventListener(){}},confirm:()=>true,print(){}};
globalThis.localStorage={getItem:k=>store.get(k)||null,setItem:(k,v)=>store.set(k,v)};
globalThis.fetch=async()=>({ok:true,json:async()=>course});
const click=async dataset=>{const el=new Element();el.dataset=dataset;for(const f of listeners.click)await f({target:{closest:()=>el},preventDefault(){}});};
const html=()=>els.get('#workspace').innerHTML;
const state=()=>JSON.parse(store.get('kotoba.week01.v3'));
await import('./dist/app-v3.js');
assert(html().includes('完全掌握 · 自动补位'));assert.equal(state().days['1'].order.length,35);
assert(!html().includes('用一句话记住它'));assert(html().includes('例句'));
let prior=state().days['1'].order[0];await click({action:'master'});assert(state().mastered[prior]);assert.equal(state().days['1'].order.length,35);assert(!state().days['1'].order.includes(prior));assert(html().includes('完全掌握'));
await click({action:'reveal'});assert(html().includes('concealed'));assert(!html().match(/class="kana" lang="ja">[^<]+</));
await click({tab:'list'});await click({scope:'mastered'});assert(html().includes('vocabGrid'));assert(els.get('#vocabGrid').innerHTML.includes('恢复到待复习'));
await click({restore:prior});assert(!state().mastered[prior]);assert(state().reviews[prior]);
await click({day:'2'});assert.equal(state().selectedDay,'2');assert.equal(state().days['2'].order.length,35);
await click({tab:'kanji'});assert(html().includes('汉字手帖'));assert.equal((html().match(/class="kanji-card"/g)||[]).length,5);assert(!html().includes('汉字小注</p>'));
await click({tab:'review'});assert(html().includes('混合练习'));assert(html().includes('只练到期'));if(course.audio)assert(!html().includes('data-quiz="listen" disabled'));
await click({quiz:'reading'});assert(html().includes('readingForm'));const match=html().match(/<h2 class="quiz-word" lang="ja">([^<]+)<\/h2>/);const word=course.words.find(w=>w.word===match[1]);els.set('#readingInput',new Element());els.get('#readingInput').value=word.reading;
for(const fn of listeners.submit)fn({target:{id:'readingForm'},preventDefault(){}});assert(html().includes('答对了'));assert.equal(state().ratings[word.id],'known');
await click({action:'quiz-next'});assert(html().includes('2 / 10'));
await click({quiz:'cloze'});assert(html().includes('目标词读音'));const options=[...html().matchAll(/data-choice="([^"]+)"/g)].map(m=>m[1]);assert.equal(options.length,4);assert.equal(new Set(options).size,4);assert(!options.some(id=>state().mastered[id]));
await click({quiz:'mixed'});for(let i=0;i<10;i++){
  if(html().includes('data-action="quiz-show"')){await click({action:'quiz-show'});await click({self:'right'});}
  else if(html().includes('readingForm')){els.get('#readingInput').value='xxxx';for(const f of listeners.submit)f({target:{id:'readingForm'},preventDefault(){}});}
  else {const id=html().match(/data-choice="([^"]+)"/)[1];await click({choice:id});}
  await click({action:'quiz-next'});
}
assert(html().includes('这一组，完成了'));
await click({tab:'study'});await click({jump:state().days['2'].order.at(-1)});await click({rating:'known'});assert(html().includes('class="layout"')); // Last position is not fake completion.

await click({tab:'kanji'});const kid=course.days[1].kanji[0];await click({kanjiRate:kid,value:'known'});assert(state().kanjiReviews[kid]);await click({kanjiQuiz:'lesson'});assert(html().includes('kanjiReadingForm'));const km=html().match(/<h2 class="quiz-word" lang="ja">([^<]+)/);const k=course.kanji.find(k=>k.practice.word===km[1]);els.set('#kanjiInput',new Element());els.get('#kanjiInput').value=k.practice.reading;
for(const fn of listeners.submit)fn({target:{id:'kanjiReadingForm'},preventDefault(){}});assert(html().includes('已记下'));assert.equal(state().kanjiRatings[k.id],'known');
await click({tab:'stats'});assert(html().includes('近 7 天学习量'));assert(html().includes('客观题正确率'));assert(state().events.length>0);
await click({tab:'review'});await click({quizSource:'due'});assert(html().includes('data-quiz-source="due"'));
console.log('PASS app integration: load, compact card, master/refill, restore, days, kanji, reading, cloze, mixed, progress');

assert(els.get("#cloudStatus").textContent.includes("待接入"));assert(els.get("#askSubmit").disabled);console.log("PASS unconfigured cloud remains clearly disabled; local study still works");
