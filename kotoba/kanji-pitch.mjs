import {KANJI_PITCH} from './kanji-pitch-data.mjs';

const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const kana=s=>String(s).normalize('NFKC').replace(/[ァ-ヶ]/g,c=>String.fromCharCode(c.charCodeAt(0)-0x60));
const patterns=xs=>xs.map(p=>`${p.n} 型${p.label?`（${p.label}）`:''}`).join(' / ');

export function kanjiPitch(word,reading){
  return KANJI_PITCH.entries[JSON.stringify([word,kana(reading)])];
}

export function kanjiReading(word,reading,interactive=true){
  const entry=kanjiPitch(word,reading),known=entry?.patterns?.length;
  const label=known?(entry.patterns.some(p=>p.label)?patterns(entry.patterns):entry.patterns.map(p=>p.n).join(' / ')+' 型'):'音调未收录';
  const evidence=known?entry.records.filter(r=>r.p?.length).map(r=>`${r.src==='kanjium'?'Kanjium · Uros O.':'维基词典'}：${patterns(r.p)}`).join('；'):'暂无此写法与读音的可确认音调记录，不代表没有音调。';
  const badge=known&&interactive
    ?`<a class="kanji-pitch" href="dictionary/index.html?q=${encodeURIComponent(word)}" data-dictionary="${esc(word)}" title="${esc(evidence)}" aria-label="${esc(word)}，音调 ${esc(label)}；查看词典与来源">${esc(label)}</a>`
    :`<span class="kanji-pitch${known?'':' is-missing'}" title="${esc(evidence)}">${esc(label)}</span>`;
  return `<span class="kanji-reading"><span lang="ja">${esc(reading)}</span>${badge}</span>`;
}

export const kanjiPitchNote='<p class="small-note kanji-pitch-note">假名旁为整词音调：0 型表示平板；其他数字表示第几拍后下降，多种读法以 / 分隔。点击数字可查词典与来源。资料：<a href="https://github.com/mifunetoshiro/kanjium" target="_blank" rel="noopener">Kanjium · Uros O.</a> / <a href="https://zh.wiktionary.org/" target="_blank" rel="noopener">维基词典贡献者</a>，<a href="dictionary/LICENSE.txt" target="_blank" rel="noopener">CC BY-SA 4.0</a>。</p>';
