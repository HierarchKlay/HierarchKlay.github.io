// Real DOM events, with local course data and no browser/account/network access.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import {KANJI_PITCH} from './dist/kanji-pitch-data.mjs';
import {kanjiPitch,kanjiReading} from './dist/kanji-pitch.mjs';
const course=JSON.parse(fs.readFileSync(new URL('./dist/lesson.json',import.meta.url)));
const source=fs.readFileSync(new URL('./dist/dictionary/'+KANJI_PITCH.sourcePack.file,import.meta.url));
assert.equal(createHash('sha256').update(source).digest('hex'),KANJI_PITCH.sourcePack.sha256);
const sourceById=new Map(JSON.parse(gunzipSync(source)).entries.map(e=>[e.id,e.a]));
for(const [key,entry] of Object.entries(KANJI_PITCH.entries)){
  const [word,reading]=JSON.parse(key);
  for(const record of entry.records){
    assert.equal(record.w,word);assert.equal(record.r,reading);
    assert(sourceById.get(entry.id).some(r=>JSON.stringify(r)===JSON.stringify(record)));
  }
  for(const p of entry.patterns)assert(entry.records.some(r=>r.p.some(q=>JSON.stringify(q)===JSON.stringify(p))));
}
for(const k of course.kanji)for(const [word,reading] of k.examples)assert(kanjiPitch(word,reading),word);
assert.deepEqual(kanjiPitch('亜鉛','あえん').patterns,[{n:0},{n:1}]);
assert.deepEqual(kanjiPitch('亜鉛','アエン'),kanjiPitch('亜鉛','あえん'));
assert.equal(kanjiPitch('亜鉛','あえ'),undefined);
assert(kanjiReading('挨拶状','あいさつじょう').includes('音调未收录'));
assert(!kanjiReading('挨拶状','あいさつじょう').includes('0 型'));
assert(!kanjiReading('<img src=x onerror=evil>','<svg onload=evil>').includes('<svg'));
console.log('PASS exact source records, all notebook pairs, variants, kana normalization, missing data and escaping');

const {JSDOM}=await import(process.env.JSDOM_MODULE||'jsdom');
const dom=new JSDOM(fs.readFileSync(new URL('./dist/index.html',import.meta.url),'utf8'),{url:'https://hierarchklay.github.io/kotoba/'});
globalThis.window=dom.window;globalThis.document=dom.window.document;globalThis.location=dom.window.location;globalThis.localStorage=dom.window.localStorage;
Object.defineProperty(globalThis,'navigator',{value:{},configurable:true});
window.speechSynthesis={getVoices:()=>[],cancel(){},addEventListener(){}};
globalThis.fetch=async url=>({ok:true,json:async()=>String(url).includes('lesson.json')?course:{}});
let printed=0;window.print=()=>printed++;
const $=s=>document.querySelector(s),state=()=>JSON.parse(localStorage.getItem('kotoba.week01.v3'));
const dialog=$('#dictionaryDialog');dialog.showModal=()=>dialog.open=true;dialog.close=()=>{dialog.open=false;dialog.dispatchEvent(new dom.window.Event('close'));};
await import('./dist/app-v3.js');await import('./dist/dictionary-launcher.mjs');
for(const day of course.days){
  $(`[data-day="${day.id}"]`).click();$('[data-tab="kanji"]').click();
  const examples=day.kanji.flatMap(id=>course.kanji.find(k=>k.id===id).examples);
  const rows=[...document.querySelectorAll('.kanji-word')];assert.equal(rows.length,examples.length);
  rows.forEach((row,i)=>{assert.equal(row.querySelector('.kanji-reading>[lang="ja"]').textContent,examples[i][1]);assert(row.querySelector('.kanji-pitch'));});
}
$('[data-day="1"]').click();$('[data-tab="kanji"]').click();
const zinc=$('[data-dictionary="亜鉛"]');assert.equal(zinc.textContent,'0 / 1 型');assert(zinc.title.includes('Kanjium'));assert(zinc.title.includes('维基词典'));
const before=state();zinc.click();assert(dialog.open);assert.equal(new URL($('#dictionaryFrame').src).searchParams.get('q'),'亜鉛');assert.deepEqual(state(),before);
$('#closeDictionary').click();assert.equal(dialog.open,false);assert.equal($('#dictionaryFrame').src,'about:blank');
$('[data-kanji-quiz="lesson"]').click();assert(!$('.quiz-answer'));assert(!$('.quiz-card .kanji-pitch'));
$('#kanjiInput').value=course.kanji[0].practice.reading;
$('#kanjiReadingForm').dispatchEvent(new dom.window.Event('submit',{bubbles:true,cancelable:true}));
assert.equal($('.quiz-answer .kanji-pitch').textContent,'2 型');assert.equal(state().kanjiRatings[course.kanji[0].id],'known');
$('[data-action="print"]').click();assert.equal(printed,1);assert($('#printArea').textContent.includes('0 / 1 型'));assert(!$('#printArea [data-dictionary]'));
dom.window.close();console.log('PASS every lesson, adjacent kana/pitch, dictionary link, unchanged progress, hidden quiz answer and static printing');
