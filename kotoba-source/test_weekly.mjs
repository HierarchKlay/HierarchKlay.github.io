import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import {restoreState,ensureDay,rateWord,rateKanji,markMastered} from './dist/core.mjs';
const course=JSON.parse(fs.readFileSync(new URL('./dist/lesson.json',import.meta.url)));
const expectedDays=21,expectedWords=expectedDays*45,expectedKanji=expectedDays*5;
assert.equal(course.id,'week01-v1');
assert.equal(course.words.length,expectedWords);assert.equal(course.days.length,expectedDays);assert.equal(course.kanji.length,expectedKanji);
const ids=course.days.flatMap(d=>[...d.core,...d.reserve]);assert.equal(new Set(ids).size,expectedWords);
assert.equal(new Set([...course.words,...course.kanji].map(w=>w.id)).size,expectedWords+expectedKanji);
assert.equal(new Set(course.words.map(w=>w.word.normalize('NFKC'))).size,expectedWords);
assert.equal(new Set(course.kanji.map(w=>w.char)).size,expectedKanji);
assert.deepEqual([...ids].sort(),course.words.map(w=>w.id).sort(),'every word belongs to exactly one lesson');
assert.deepEqual(course.days.flatMap(d=>d.kanji).sort(),course.kanji.map(k=>k.id).sort(),'every kanji belongs to exactly one lesson');
for(const [i,d] of course.days.entries()){
  assert.equal(d.id,String(i+1));assert.equal(d.number,i+1);
  assert.equal(d.core.length,35);assert.equal(d.reserve.length,10);assert.equal(d.kanji.length,5);
  for(const id of d.kanji)assert.equal(course.kanji.find(k=>k.id===id).day,d.number);
}
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
assert.equal(Object.keys(audio.clips).length,expectedWords*2);
assert.equal(audio.files.length,expectedDays);
assert.deepEqual(audio.files.map(f=>f.file).sort(),course.days.map(d=>`day-${String(d.number).padStart(2,'0')}.mp3`).sort());
for(const day of course.days)for(const id of [...day.core,...day.reserve])for(const key of [id,id+'-example']){
  assert.equal(audio.clips[key]?.file,`day-${String(day.number).padStart(2,'0')}.mp3`,`${key}: wrong lesson sprite`);
}
for(const f of audio.files){
  const path=new URL('./dist/audio/'+f.file,import.meta.url),bytes=fs.readFileSync(path);
  assert.equal(bytes.length,f.bytes);assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'),f.sha256);
  const clips=Object.values(audio.clips).filter(c=>c.file===f.file).sort((a,b)=>a.start-b.start);
  assert.equal(clips.length,90);
  for(let i=0;i<clips.length;i++){assert(clips[i].end>clips[i].start);assert(clips[i].end<=f.duration+0.001);if(i)assert(clips[i].start>=clips[i-1].end-0.000001);}
}
for(const w of course.words)for(const key of [w.id,w.id+'-example'])assert(audio.clips[key],key);
// Match the newly published content to its retained synthesis audit. This catches
// later text/ruby edits that would otherwise leave stale audio under stable IDs.
const audit=JSON.parse(fs.readFileSync(new URL('./source-data/week03-audio-audit.json',import.meta.url)));
const newWords=course.words.slice(14*45),auditWords=new Map(audit.wordReadingsChecked.map(w=>[w.id,w]));
const auditFiles=new Map(audit.files.map(f=>[f.filename,f]));
assert.equal(audit.voiceLicense,'CC BY 3.0');assert.equal(audit.wordCount,315);assert.equal(audit.fileCount,630);
assert.equal(auditWords.size,315);assert.equal(auditFiles.size,630);
const cleanReading=value=>String(value).normalize('NFKC').replace(/[ぁ-ゖ]/g,c=>String.fromCharCode(c.charCodeAt(0)+96)).replace(/[^ァ-ヶー]/g,'');
for(const w of newWords){
  const checked=auditWords.get(w.id);assert(checked,w.id);
  const sentence=w.example.map(t=>t[0]).join(''),reading=w.example.map(t=>t[1]||t[0]).join('');
  assert.equal(checked.word,w.word);assert.equal(checked.expected,w.reading);assert.equal(checked.sentenceExpected,reading);
  assert.equal(cleanReading(checked.frontend),cleanReading(w.reading));
  assert.equal(cleanReading(checked.sentenceFrontend),cleanReading(reading));
  for(const [key,text] of [[w.id,w.word],[w.id+'-example',sentence]]){
    const file=auditFiles.get(key+'.mp3');assert(file,key);assert.equal(file.sourceText,text);
    assert(file.durationSeconds>=0.15);assert(file.decodedRMS>=0.002);assert(file.decodedPeak<1);
    assert.equal(file.sampleRate,24000);assert.equal(file.channels,1);assert.match(file.sha256,/^[a-f0-9]{64}$/);
  }
}
const prev=process.env.KOTOBA_PREVIOUS_COURSE?JSON.parse(fs.readFileSync(process.env.KOTOBA_PREVIOUS_COURSE)):null;
if(prev){
  assert.equal(prev.id,course.id);
  for(const key of ['words','days','kanji'])assert.deepEqual(course[key].slice(0,prev[key].length),prev[key],`changed original ${key}`);
  for(const [id,clip] of Object.entries(prev.audio.clips))assert.deepEqual(audio.clips[id],clip);
  for(const file of prev.audio.files)assert.deepEqual(audio.files.find(f=>f.file===file.file),file);
  const state=restoreState(null,prev);ensureDay(state,prev,'7');
  rateWord(state,prev.days[6].core[0],'known','2026-10-17');rateKanji(state,prev.kanji[34].id,'known','2026-10-17');
  markMastered(state,prev,prev.days[6].core[2]);
  const lastOld=prev.days.at(-1);ensureDay(state,prev,lastOld.id);state.selectedDay=lastOld.id;
  rateWord(state,lastOld.core[0],'familiar','2026-10-22');rateKanji(state,lastOld.kanji.at(-1),'again','2026-10-22');
  markMastered(state,prev,lastOld.core[2]);const restored=restoreState(JSON.parse(JSON.stringify(state)),course);
  assert.equal(restored.selectedDay,lastOld.id);
  for(const key of ['ratings','reviews','kanjiRatings','kanjiReviews','mastered','events','days'])assert.deepEqual(restored[key],state[key],key);
  for(const day of course.days.slice(prev.days.length)){ensureDay(restored,course,day.id);assert.equal(restored.days[day.id].order.length,35);}
  for(const [id,day] of Object.entries(state.days))assert.deepEqual(restored.days[id],day,'opening new lessons preserves old replacements/focus');
  for(const key of ['ratings','reviews','kanjiRatings','kanjiReviews','mastered','events'])assert.deepEqual(restored[key],state[key],key);
  console.log('PASS original content, sprites, opened lesson and vocabulary/kanji progress preserved');
}
console.log(`PASS ${expectedDays} lessons / ${expectedWords} words / ${expectedKanji} independent kanji / ${expectedWords*2} audio clips, evidence, synthesis audit and media checks`);
