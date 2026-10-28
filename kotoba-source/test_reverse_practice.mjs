import assert from 'node:assert/strict';
import fs from 'node:fs';
import {mixedQuizModes} from './dist/quiz-modes.mjs';
import {restoreState,ensureDay,rateWord,dayStamp,activity} from './dist/core.mjs';

const course=JSON.parse(fs.readFileSync(new URL('./dist/lesson.json',import.meta.url)));
let seed=7341;const random=()=>((seed=(seed*1664525+1013904223)>>>0)/2**32);
for(const hasAudio of [true,false])for(let size=0;size<=10;size++)for(let round=0;round<20;round++){
  const words=Array.from({length:size},(_,i)=>({word:round%2&&i%2?'かな':'漢字'}));
  const before=structuredClone(words),types=mixedQuizModes(words,hasAudio,random);
  assert.deepEqual(words,before);assert.equal(types.length,size);
  assert.equal(types.filter(t=>t==='reverse').length,Math.ceil(size*.6));
  assert(hasAudio||!types.includes('listen'));
  types.forEach((t,i)=>assert(t!=='reading'||words[i].word==='漢字'));
}
const full=mixedQuizModes(Array.from({length:10},()=>({word:'漢字'})),true,random);
for(const type of ['recall','reading','cloze','listen'])assert.equal(full.filter(t=>t===type).length,1);
console.log('PASS 60% recall allocation, short queues, no audio, kana-only prompts and no word-list mutation');

const {JSDOM}=await import(process.env.JSDOM_MODULE||'jsdom');
const dom=new JSDOM(fs.readFileSync(new URL('./dist/index.html',import.meta.url),'utf8'),{url:'https://example.test/kotoba/'});
globalThis.window=dom.window;globalThis.document=dom.window.document;globalThis.localStorage=dom.window.localStorage;
window.speechSynthesis={getVoices:()=>[],cancel(){},addEventListener(){}};
globalThis.fetch=async url=>({ok:true,json:async()=>String(url).includes('lesson.json')?course:{}});
let played='';globalThis.Audio=class{constructor(url){played=url;this.currentTime=0;}addEventListener(){}play(){return Promise.resolve();}pause(){}};
const initial=restoreState(null,course),old=course.days[0].core.slice(0,7);
ensureDay(initial,course,'1');for(const id of old)rateWord(initial,id,'again',dayStamp());
initial.selectedDay='2';ensureDay(initial,course,'2');
localStorage.setItem('kotoba.week01.v3',JSON.stringify(initial));
const $=s=>document.querySelector(s),state=()=>JSON.parse(localStorage.getItem('kotoba.week01.v3'));
await import('./dist/app-v3.js');
$('[data-tab="review"]').click();
assert($('.practice-focus').textContent.includes('6 题'));
assert($('[data-quiz="reverse"]').textContent.includes('强化'));
const stateBefore=state();$('[data-quiz="mixed"]').click();assert.deepEqual(state(),stateBefore);
const seen=[],eventsStart=state().events.length;let reverseCount=0,missed;
for(let i=0;i<10;i++){
  const reverse=!!$('.quiz-word.chinese');
  if(reverse){
    reverseCount++;assert(!$('.quiz-options'));assert(!$('.quiz-answer'));
    assert(!$('.quiz-card [lang="ja"]'));assert(!$('.quiz-card [data-action="quiz-speak"]'));
  }
  const priorEvents=state().events.length;
  if($('[data-action="quiz-show"]')){
    $('[data-action="quiz-show"]').click();assert.equal(state().events.length,priorEvents);
    if(reverse){assert($('.reverse-answer-tools').textContent.includes('音调'));$('[data-action="quiz-speak"]').click();assert(played.startsWith('audio/'));}
    const fail=reverse&&!missed;
    $(`[data-self="${fail?'wrong':'right'}"]`).click();
    if(fail)missed=state().events.at(-1).id;
  }else if($('#readingForm')){
    $('#readingInput').value='わからない';$('#readingForm').dispatchEvent(new dom.window.Event('submit',{bubbles:true,cancelable:true}));
  }else $('[data-choice]').click();
  const answer=$('.quiz-answer>p[lang="ja"]').textContent;
  const word=course.words.find(w=>answer===w.word+' · '+w.reading);assert(word);
  seen.push(word.id);assert.equal(state().events.length,priorEvents+1);
  $('[data-action="quiz-next"]').click();
}
assert.equal(reverseCount,6);assert.equal(new Set(seen).size,10);
assert.deepEqual(seen.slice(0,7),old);assert(!state().mastered[missed]);
assert.equal(state().ratings[missed],'again');assert.equal(state().reviews[missed].due,dayStamp());
const mixedEvents=state().events.slice(eventsStart);
assert.equal(mixedEvents.filter(e=>e.mode==='reverse').length,6);
assert(mixedEvents.filter(e=>e.mode==='reverse').every(e=>!e.objective));
assert.equal(activity(state()).at(-1).tests,3);
assert($('[data-quiz="mixed"]').textContent.includes('再来一组'));

// A dedicated recall round stays dedicated on continuation, without an extra setting.
$('[data-go="review"]').click();$('[data-quiz-source="lesson"]').click();$('[data-quiz="reverse"]').click();
for(let i=0;i<10;i++){
  assert($('.quiz-word.chinese'));assert(!$('.quiz-options'));assert(!$('.quiz-answer'));
  $('[data-action="quiz-show"]').click();$('[data-self="right"]').click();$('[data-action="quiz-next"]').click();
}
assert($('[data-quiz="reverse"]').textContent.includes('再来一组'));assert(!$('[data-quiz="mixed"]'));
$('[data-quiz="reverse"]').click();assert($('.quiz-word.chinese'));assert(!$('.quiz-answer'));
dom.window.close();console.log('PASS mixed 6/10 recall, due priority, hidden answers, self-rating statistics, missed-word review and dedicated continuation');
