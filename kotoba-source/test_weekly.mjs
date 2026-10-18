import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import {restoreState,ensureDay,rateWord,rateKanji,markMastered} from './dist/core.mjs';
const course=JSON.parse(fs.readFileSync(new URL('./dist/lesson.json',import.meta.url)));
assert.equal(course.id,'week01-v1');
assert.equal(course.words.length,630);assert.equal(course.days.length,14);assert.equal(course.kanji.length,70);
const ids=course.days.flatMap(d=>[...d.core,...d.reserve]);assert.equal(new Set(ids).size,630);
assert.equal(new Set([...course.words,...course.kanji].map(w=>w.id)).size,700);
assert.equal(new Set(course.words.map(w=>w.word.normalize('NFKC'))).size,630);
assert.equal(new Set(course.kanji.map(w=>w.char)).size,70);
for(const d of course.days){assert.equal(d.core.length,35);assert.equal(d.reserve.length,10);assert.equal(d.kanji.length,5);}
for(const w of course.words.slice(315)){
  for(const key of ['word','reading','meaning','category','translation','tip','kanjiNote'])assert(w[key],`${w.id}: ${key}`);
  assert(w.sourceEvidence.jmdictId);assert(w.sourceEvidence.senseIndices.length);
  for(const url of [w.sourceEvidence.url,w.sourceEvidence.entryUrl,w.accentUrl].filter(Boolean))assert.equal(new URL(url).protocol,'https:');
  const s=w.example.map(t=>t[0]).join('');assert.equal(s,w.cloze.before+w.cloze.answer+w.cloze.after);
  assert.equal(s.split(w.cloze.answer).length,2);
  assert(w.accent===null||(Number.isInteger(w.accent)&&w.accent>=0&&w.accent<=w.mora.length));
  if(w.accent!==null){assert(w.accentEvidence.records.length);assert(w.accentAlternatives.includes(w.accent));}
  for(const t of w.example)if(/[一-鿿]/u.test(t[0]))assert(t[1],`${w.id} missing ruby`);
}
const audio=course.audio;
assert.equal(Object.keys(audio.clips).length,1260);
assert.equal(audio.files.length,14);
for(const f of audio.files){
  const path=new URL('./dist/audio/'+f.file,import.meta.url),bytes=fs.readFileSync(path);
  assert.equal(bytes.length,f.bytes);assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'),f.sha256);
  const clips=Object.values(audio.clips).filter(c=>c.file===f.file).sort((a,b)=>a.start-b.start);
  assert.equal(clips.length,90);
  for(let i=0;i<clips.length;i++){assert(clips[i].end>clips[i].start);assert(clips[i].end<=f.duration+0.001);if(i)assert(clips[i].start>=clips[i-1].end-0.000001);}
}
for(const w of course.words)for(const key of [w.id,w.id+'-example'])assert(audio.clips[key],key);
const prev=process.env.KOTOBA_PREVIOUS_COURSE?JSON.parse(fs.readFileSync(process.env.KOTOBA_PREVIOUS_COURSE)):null;
if(prev){
  assert.equal(prev.id,course.id);
  for(const key of ['words','days','kanji'])assert.deepEqual(course[key].slice(0,prev[key].length),prev[key],`changed original ${key}`);
  for(const [id,clip] of Object.entries(prev.audio.clips))assert.deepEqual(audio.clips[id],clip);
  for(const file of prev.audio.files)assert.deepEqual(audio.files.find(f=>f.file===file.file),file);
  const state=restoreState(null,prev);ensureDay(state,prev,'7');
  rateWord(state,prev.days[6].core[0],'known','2026-10-17');rateKanji(state,prev.kanji[34].id,'known','2026-10-17');
  markMastered(state,prev,prev.days[6].core[2]);const restored=restoreState(JSON.parse(JSON.stringify(state)),course);
  for(const key of ['ratings','reviews','kanjiRatings','kanjiReviews','mastered','events','days'])assert.deepEqual(restored[key],state[key],key);
  ensureDay(restored,course,'14');assert.equal(restored.days['14'].order.length,35);
  console.log('PASS original content, sprites, opened lesson and vocabulary/kanji progress preserved');
}
console.log('PASS 14 lessons / 630 words / 70 independent kanji / 1260 audio clips, evidence and media checks');
