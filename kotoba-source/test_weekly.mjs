import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import {gunzipSync} from 'node:zlib';
import {restoreState,ensureDay,rateWord,rateKanji,markMastered} from './dist/core.mjs';
const course=JSON.parse(fs.readFileSync(new URL('./dist/lesson.json',import.meta.url)));
const expectedDays=28,expectedWords=expectedDays*45,expectedKanji=expectedDays*5;
assert.equal(course.id,'week01-v1');
assert.equal(course.words.length,expectedWords);assert.equal(course.days.length,expectedDays);assert.equal(course.kanji.length,expectedKanji);
const ids=course.days.flatMap(d=>[...d.core,...d.reserve]);assert.equal(new Set(ids).size,expectedWords);
assert.equal(new Set([...course.words,...course.kanji].map(w=>w.id)).size,expectedWords+expectedKanji);
assert.equal(new Set(course.words.map(w=>w.word.normalize('NFKC'))).size,expectedWords);
assert.equal(new Set(course.kanji.map(w=>w.char)).size,expectedKanji);
assert.deepEqual(course.kanji.map(k=>k.id),Array.from({length:expectedKanji},(_,i)=>`joyo-${String(i+1).padStart(3,'0')}`));
assert.deepEqual(course.kanji.map(k=>k.order),Array.from({length:expectedKanji},(_,i)=>i+1));
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
// Match appended content to its retained synthesis audits. This catches
// later text/ruby edits that would otherwise leave stale audio under stable IDs.
const cleanReading=value=>String(value).normalize('NFKC').replace(/[ぁ-ゖ]/g,c=>String.fromCharCode(c.charCodeAt(0)+96)).replace(/[^ァ-ヶー]/g,'');
for(const [batch,startDay] of [['week03',15],['week04',22]]){
const audit=JSON.parse(fs.readFileSync(new URL(`./source-data/${batch}-audio-audit.json`,import.meta.url)));
const newWords=course.words.slice((startDay-1)*45,(startDay+6)*45),auditWords=new Map(audit.wordReadingsChecked.map(w=>[w.id,w]));
const auditFiles=new Map(audit.files.map(f=>[f.filename,f]));
assert.equal(audit.voiceLicense,'CC BY 3.0');assert.equal(audit.wordCount,315);assert.equal(audit.fileCount,630);
assert.equal(auditWords.size,315);assert.equal(auditFiles.size,630);
assert.deepEqual([...auditWords.keys()].sort(),newWords.map(w=>w.id).sort());
const provenance=audio.batches.find(b=>b.days[0]===startDay&&b.days[1]===startDay+6);
assert(provenance,`${batch}: missing batch provenance`);assert.equal(provenance.inputSha256,audit.lessonSha256);
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
}
// Verify the new lesson's source evidence against the shipped dictionary snapshot,
// including restricted spellings/readings and exact accent records.
const dictionaryManifest=JSON.parse(fs.readFileSync(new URL('./dist/dictionary/manifest.json',import.meta.url)));
const loadPack=id=>{
  const descriptor=dictionaryManifest.packs.find(p=>p.id===id);assert(descriptor,id);
  const bytes=fs.readFileSync(new URL('./dist/dictionary/'+descriptor.file,import.meta.url));
  assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'),descriptor.sha256);
  return new Map(JSON.parse(gunzipSync(bytes)).entries.map(e=>[String(e.id),e]));
};
const jmdict=loadPack('jmdict'),pitch=loadPack('pitch');
const norm=value=>String(value).normalize('NFKC').replace(/[ァ-ヶ]/g,c=>String.fromCharCode(c.charCodeAt(0)-96));
const matches=(entry,word,reading)=>{
  const writings=entry.k.map(k=>k.t);
  return (writings.includes(word)||entry.r.some(r=>r.t===word))&&entry.r.some(r=>norm(r.t)===norm(reading)&&(!r.k?.length||r.k.includes(word))&&(!r.n||!writings.includes(word)));
};
const priorLexemes=new Set();
const index=new Map();
for(const entry of jmdict.values())for(const form of [...entry.k,...entry.r]){
  if(!index.has(form.t))index.set(form.t,[]);index.get(form.t).push(entry);
}
for(const w of course.words.slice(0,945))for(const e of index.get(w.word)||[])if(matches(e,w.word,w.reading))priorLexemes.add(`${e.id}|${norm(w.reading)}`);
for(const w of course.words.slice(945)){
  assert.match(w.id,/^w04-[abc]\d{3}$/);
  const ev=w.sourceEvidence,e=jmdict.get(String(ev.jmdictId));assert(e,w.id);assert(matches(e,w.word,w.reading),w.id);
  const lexeme=`${e.id}|${norm(w.reading)}`;assert(!priorLexemes.has(lexeme),`${w.id}: duplicate lexeme/reading`);priorLexemes.add(lexeme);
  const glosses=ev.senseIndices.map(i=>{
    const s=e.s[i];assert(s,w.id);assert(!s.k?.length||s.k.includes(w.word));assert(!s.r?.length||s.r.includes(w.reading));
    return s.g.map(g=>g.t);
  });
  assert([JSON.stringify(glosses),JSON.stringify(glosses.flat())].includes(JSON.stringify(ev.glosses)),`${w.id}: sense evidence`);
  assert.equal(ev.license,'CC BY-SA 4.0');
  if(w.accent!==null)for(const record of w.accentEvidence.records){
    assert.equal(record.w,w.word);assert.equal(norm(record.r),norm(w.reading));assert.equal(record.src,'kanjium');
    assert((pitch.get(String(e.id))?.a||[]).some(r=>JSON.stringify(r)===JSON.stringify(record)),`${w.id}: unavailable accent evidence`);
    for(const pattern of record.p){assert.deepEqual(Object.keys(pattern),['n']);assert(w.accentAlternatives.includes(pattern.n));}
  }
}
for(const k of course.kanji.slice(105)){
  assert.equal(k.verification.officialRow[0][0],k.char);
  assert.equal(k.practice.verified,true);assert(k.referenceUrls.every(u=>new URL(u).protocol==='https:'));
  assert.equal(k.examples.length,2);assert.equal(k.verification.examples.length,2);
  k.examples.forEach(([word,reading],i)=>{
    const ev=k.verification.examples[i];assert.equal(ev.word,word);assert.equal(ev.reading,reading);assert.equal(ev.jmdictIds.length,1);
    const e=jmdict.get(String(ev.jmdictIds[0]));assert(e);assert(matches(e,word,reading));
    const glosses=ev.senseIndices.map(s=>{
      const sense=e.s[s];assert(!sense.k?.length||sense.k.includes(word));assert(!sense.r?.length||sense.r.includes(reading));return sense.g.map(g=>g.t);
    });
    assert.deepEqual(ev.glosses,glosses);
  });
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
