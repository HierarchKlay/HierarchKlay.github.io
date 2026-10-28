// Actual DOM events with mocked audio/network; not browser rendering or real account access.
import assert from 'node:assert/strict';
import fs from 'node:fs';
const {JSDOM}=await import(process.env.JSDOM_MODULE||'jsdom');
const course=JSON.parse(fs.readFileSync(new URL('./dist/lesson.json',import.meta.url)));
const dom=new JSDOM(fs.readFileSync(new URL('./dist/index.html',import.meta.url),'utf8'),{url:'https://hierarchklay.github.io/kotoba/'});
globalThis.window=dom.window;globalThis.document=dom.window.document;globalThis.localStorage=dom.window.localStorage;
window.speechSynthesis={getVoices:()=>[],cancel(){},addEventListener(){}};
globalThis.fetch=async url=>({ok:true,json:async()=>String(url).includes('lesson.json')?course:{}});
let played;
globalThis.Audio=class {constructor(url){played=url;this.currentTime=0;}addEventListener(){}play(){return Promise.resolve();}pause(){}};
const $=s=>document.querySelector(s),state=()=>JSON.parse(localStorage.getItem('kotoba.week01.v3'));
await import('./dist/app-v3.js');
assert.equal(course.days.length,28);
assert.equal(document.querySelectorAll('[data-day]').length,course.days.length);
for(let day=8;day<=course.days.length;day++){
  $(`[data-day="${day}"]`).click();assert.equal(state().selectedDay,String(day));
  assert.equal(document.querySelectorAll('.index-item').length,35);
  const first=course.words.find(w=>w.id===course.days[day-1].core[0]);
  assert.equal($('.word').textContent,first.word);
  $('[data-action="speak"]').click();assert.equal(played,`audio/day-${String(day).padStart(2,'0')}.mp3`);
  $('[data-action="speak-example"]').click();assert.equal(played,`audio/day-${String(day).padStart(2,'0')}.mp3`);
  if(day>=22){
    $('[data-tab="review"]').click();$('[data-quiz-source="lesson"]').click();$('[data-quiz="reverse"]').click();
    assert($('.quiz-word.chinese'));assert(!$('.quiz-card [lang="ja"]'));assert(!$('.quiz-card [data-action="quiz-speak"]'));
    const before=state();$('[data-action="quiz-show"]').click();assert.deepEqual(state(),before,'reveal must not record success');
    assert($('.reverse-answer-tools'));$('[data-action="quiz-speak"]').click();assert.equal(played,`audio/day-${String(day).padStart(2,'0')}.mp3`);
    $('[data-self="right"]').click();const event=state().events.at(-1);
    assert(course.days[day-1].core.includes(event.id));assert.equal(event.mode,'reverse');assert.equal(event.objective,false);
  }
  $('[data-tab="kanji"]').click();assert.equal(document.querySelectorAll('.kanji-card').length,5);
  $('[data-kanji-quiz="lesson"]').click();const k=course.kanji.find(k=>k.id===course.days[day-1].kanji[0]);
  $('#kanjiInput').value=k.practice.reading;
  $('#kanjiReadingForm').dispatchEvent(new dom.window.Event('submit',{bubbles:true,cancelable:true}));
  assert.equal(state().kanjiRatings[k.id],'known');
  $('[data-tab="study"]').click();
}
const lastDay=course.days.at(-1),before=state().days[lastDay.id].order;
$('[data-action="master"]').click();assert(state().mastered[before[0]]);assert.equal(state().days[lastDay.id].order.length,35);
assert(state().days[lastDay.id].order.includes(lastDay.reserve[0]));
$('[data-day="1"]').click();assert.equal(state().selectedDay,'1');
dom.window.close();console.log('PASS real DOM: all new lessons, 35-card indexes, sprite paths, hidden Chinese-to-Japanese recall, independent kanji submit, refill and navigation');
