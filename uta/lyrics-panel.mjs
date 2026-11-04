import { findLyrics, activeLineAt, lineRange } from './lyrics-core.mjs?v=8';
import { annotateLines } from './furigana.mjs?v=8';
import { formatTime } from './player-core.mjs?v=8';

const PREFS_KEY = 'hibi-uta-lyrics-preferences-v1';
const normalize = text => String(text || '').normalize('NFKC').toLowerCase().replace(/\s+/g, '');

// These are alternate catalog spellings of the same artist/track, not fuzzy matches.
function aliasesFor(title, artist) {
  const names = [
    { titles: ['なんもねえ', 'Nanmonee'], artists: ['忘れらんねえよ', 'Wasureranneyo'] },
    { titles: ['Rain'], artists: ['秦 基博', 'Motohiro Hata'] },
  ];
  const known = names.find(n => n.titles.some(t => normalize(t) === normalize(title)) && n.artists.some(a => normalize(a) === normalize(artist)));
  return known ? { titleAliases: known.titles.filter(t => normalize(t) !== normalize(title)), artistAliases: known.artists.filter(a => normalize(a) !== normalize(artist)) } : {};
}

export function initLyricsPanel({ playLine, stopLine }) {
  const $ = id => document.getElementById(id);
  let state = {}, identity = '', request = null, generation = 0, attempted = false;
  let record = null, rows = [], current = -1, selected = -1, following = true, offset = 0;
  let annotation = null, annotating = false, annotationGeneration = 0, queryDuration = 0;
  const cache = new Map();
  let prefs = { furigana: false, offsets: {} };
  try {
    const value = JSON.parse(localStorage.getItem(PREFS_KEY) || 'null');
    if (value) {
      prefs.furigana = value.furigana === true;
      for (const [key, valueOffset] of Object.entries(value.offsets || {}).slice(-100)) {
        if (typeof valueOffset === 'number' && Number.isFinite(valueOffset) && Math.abs(valueOffset) <= 10) prefs.offsets[key] = valueOffset;
      }
    }
  } catch {}
  $('lyrics-furigana').checked = prefs.furigana;
  const message = text => { $('lyrics-status').textContent = text; };
  function savePrefs() {
    try { localStorage.setItem(PREFS_KEY, JSON.stringify(prefs)); }
    catch { $('lyrics-reading-status').textContent = '此浏览器无法保存设置，本次页面仍可使用。'; }
  }
  function preferenceKey() { return identity + '|' + (record?.id || ''); }
  function reset() {
    request?.abort(); request = null; generation += 1; annotationGeneration += 1;
    record = null; rows = []; current = -1; selected = -1; following = true; offset = 0;
    attempted = false; annotation = null; annotating = false; queryDuration = 0;
    $('lyrics-lines').replaceChildren(); $('lyrics-lines').scrollTop = 0;
    $('lyrics-content').hidden = true; $('lyrics-source').hidden = true;
    $('lyrics-retry').hidden = true;
    $('lyrics-reading-status').textContent = prefs.furigana ? '' : '开启假名可帮助读出汉字；首次需下载约 18 MB 词典。';
    message('播放这首歌后，自动寻找对应版本的歌词。');
  }
  function drawText() {
    rows.forEach((row, i) => {
      const text = row.querySelector('.lyric-text');
      text.replaceChildren();
      if (!row.dataset.text) { text.textContent = '♪ 间奏'; return; }
      const parts = prefs.furigana && annotation ? annotation[i] : [{ text: row.dataset.text }];
      for (const part of parts || [{ text: row.dataset.text }]) {
        if (part.reading) {
          const ruby = document.createElement('ruby');
          ruby.append(document.createTextNode(part.text));
          const rt = document.createElement('rt'); rt.textContent = part.reading; ruby.append(rt); text.append(ruby);
        } else text.append(document.createTextNode(part.text));
      }
    });
    $('lyrics-lines').classList.toggle('with-furigana', prefs.furigana && !!annotation);
    centerCurrent();
  }
  async function addReadings() {
    drawText();
    if (!prefs.furigana || !record || annotation || annotating) return;
    const token = ++annotationGeneration;
    annotating = true;
    $('lyrics-reading-status').textContent = '正在准备假名…首次需下载约 18 MB 读音词典，歌曲可继续播放。';
    try {
      const value = await annotateLines(rows.map(row => row.dataset.text));
      if (token !== annotationGeneration) return;
      annotation = value;
      if (prefs.furigana) { drawText(); $('lyrics-reading-status').textContent = '自动注音可能与唱法不同，请以原唱为准。'; }
    } catch {
      if (token === annotationGeneration) $('lyrics-reading-status').textContent = '读音词典暂时未能载入。可关闭再开启假名重试，原文仍可练唱。';
    } finally { if (token === annotationGeneration) annotating = false; }
  }
  function showRecord(value) {
    record = value;
    if (!record) { message('暂未找到与这首歌时长一致的歌词。可以稍后重试，继续用 A / B 练习。'); $('lyrics-retry').hidden = false; return; }
    offset = prefs.offsets[preferenceKey()] || 0;
    const lines = record.lines.length ? record.lines : record.plainLines.map(text => ({ text }));
    $('lyrics-source').hidden = false;
    $('lyrics-source').textContent = '歌词来源：LRCLIB · #' + record.id;
    $('lyrics-source').href = 'https://lrclib.net/';
    if (!lines.length) { message(record.instrumental ? '此版本标记为纯音乐，没有演唱歌词。' : '此版本暂时没有歌词正文。'); return; }
    rows = lines.map((line, i) => {
      const row = document.createElement(record.lines.length && line.text ? 'button' : 'div');
      row.className = 'lyric-line'; row.dataset.text = line.text; row.lang = 'ja';
      if (row.tagName === 'BUTTON') {
        row.type = 'button';
        row.addEventListener('click', () => { selected = i; following = false; updateControls(); runLine('continue'); });
      }
      if (!line.text) row.classList.add('interlude');
      const time = document.createElement('span'); time.className = 'lyric-time'; time.setAttribute('aria-hidden', 'true');
      time.textContent = Number.isFinite(line.time) ? formatTime(line.time + offset) : String(i + 1).padStart(2, '0');
      const text = document.createElement('span'); text.className = 'lyric-text';
      row.append(time, text); return row;
    });
    $('lyrics-lines').replaceChildren(...rows);
    $('lyrics-content').hidden = false;
    $('lyrics-timing').hidden = !record.lines.length;
    $('lyrics-actions').hidden = !record.lines.length;
    $('lyrics-follow').hidden = !record.lines.length;
    message(record.lines.length ? '点一句，从这里连唱；也可以只听这句，或循环练。' : '找到了歌词，但还没有逐句时间轴。先看着原文跟唱。');
    drawText(); addReadings(); updateControls(); updatePosition(true);
  }
  async function lookup() {
    if (!state.loaded || !state.title || !state.artist || !(state.duration > 0)) return;
    attempted = true;
    queryDuration = state.catalogDuration || state.duration;
    const cacheKey = identity + '|' + queryDuration;
    const token = generation;
    request?.abort(); request = new AbortController();
    $('lyrics-retry').hidden = true;
    message('正在按歌名、歌手和歌曲时长查找歌词…');
    try {
      const value = cache.get(cacheKey) || await findLyrics({ title: state.title, artist: state.artist, album: state.album, duration: queryDuration, ...aliasesFor(state.title, state.artist) }, { signal: request.signal });
      if (token !== generation) return;
      if (value) cache.set(cacheKey, value);
      showRecord(value);
    } catch (error) {
      if (token !== generation || error?.name === 'AbortError') return;
      message('歌词暂时未能载入，歌曲可以继续播放。检查网络后再试一次。'); $('lyrics-retry').hidden = false;
    }
  }
  function chosen() { return selected >= 0 ? selected : current; }
  function updateControls() {
    const index = chosen();
    const hasLine = !!record?.lines[index]?.text && record.lines[index].time + offset < state.duration;
    const range = hasLine ? lineRange(record.lines, index, state.duration, offset) : null;
    const ready = state.loaded && state.authorized && !state.busy && !!record?.lines.length;
    rows.forEach((row, i) => { if (row.tagName === 'BUTTON') row.disabled = !ready || record.lines[i].time + offset >= state.duration; });
    $('lyrics-once').disabled = $('lyrics-loop').disabled = !ready || !range;
    $('lyrics-continue').disabled = !ready || !hasLine;
    $('lyrics-choice').textContent = selected >= 0 ? '已选第 ' + (index + 1) + ' 行' : hasLine ? '当前第 ' + (index + 1) + ' 行' : '随原唱慢慢进入';
    $('lyrics-follow').textContent = following ? '正在跟随' : '回到当前句';
    $('lyrics-follow').setAttribute('aria-pressed', String(following));
    $('lyrics-offset').textContent = offset === 0 ? '原始时间' : (offset > 0 ? '延后 ' : '提前 ') + Math.abs(offset).toFixed(1) + ' 秒';
    $('lyrics-earlier').disabled = offset <= -10 || state.busy;
    $('lyrics-later').disabled = offset >= 10 || state.busy;
    $('lyrics-offset-reset').disabled = offset === 0 || state.busy;
    rows.forEach((row, i) => row.classList.toggle('selected', selected === i));
  }
  function centerCurrent() {
    if (current < 0 || !following || document.visibilityState !== 'visible') return;
    const viewport = $('lyrics-lines'), row = rows[current];
    if (!row || viewport.getBoundingClientRect().height === 0) return;
    const top = row.offsetTop - (viewport.clientHeight - row.clientHeight) / 2;
    viewport.scrollTo({ top: Math.max(0, top), behavior: 'auto' });
  }
  function updatePosition(force = false) {
    const next = record?.lines.length && state.loaded ? activeLineAt(record.lines, state.time, offset) : -1;
    if (next !== current || force) {
      current = next;
      rows.forEach((row, i) => {
        row.classList.toggle('current', i === current);
        if (i === current) row.setAttribute('aria-current', 'true'); else row.removeAttribute('aria-current');
      });
      centerCurrent(); updateControls();
    }
  }
  async function runLine(mode) {
    const index = chosen(), line = record?.lines[index];
    if (!line?.text || state.busy || !state.loaded) return;
    const range = lineRange(record.lines, index, state.duration, offset);
    if (mode !== 'continue' && !range) return;
    const start = Math.max(0, line.time + offset);
    await playLine({ mode, a: start, b: range?.b, trackId: state.trackId, url: state.url });
  }
  function shiftOffset(delta) {
    stopLine();
    offset = delta === null ? 0 : Math.max(-10, Math.min(10, Math.round((offset + delta) * 10) / 10));
    prefs.offsets[preferenceKey()] = offset;
    const keys = Object.keys(prefs.offsets); if (keys.length > 100) delete prefs.offsets[keys[0]];
    savePrefs();
    rows.forEach((row, i) => { row.querySelector('.lyric-time').textContent = formatTime(Math.max(0, record.lines[i].time + offset)); });
    updateControls(); updatePosition(true);
  }
  $('lyrics-furigana').addEventListener('change', () => {
    prefs.furigana = $('lyrics-furigana').checked; savePrefs();
    $('lyrics-reading-status').textContent = prefs.furigana ? annotation ? '自动注音可能与唱法不同，请以原唱为准。' : '' : '已隐藏假名，试着凭记忆唱。';
    addReadings();
  });
  $('lyrics-retry').addEventListener('click', lookup);
  $('lyrics-once').addEventListener('click', () => runLine('once'));
  $('lyrics-loop').addEventListener('click', () => runLine('loop'));
  $('lyrics-continue').addEventListener('click', () => runLine('continue'));
  $('lyrics-follow').addEventListener('click', () => { following = true; selected = -1; centerCurrent(); updateControls(); });
  for (const type of ['touchstart', 'wheel', 'pointerdown', 'keydown']) $('lyrics-lines').addEventListener(type, () => { following = false; updateControls(); }, { passive: true });
  $('lyrics-earlier').addEventListener('click', () => shiftOffset(-0.2));
  $('lyrics-later').addEventListener('click', () => shiftOffset(0.2));
  $('lyrics-offset-reset').addEventListener('click', () => shiftOffset(null));
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') updatePosition(true); });
  return {
    update(nextState) {
      state = nextState;
      const nextIdentity = state.url + '|' + (state.trackId || '');
      if (nextIdentity !== identity) { identity = nextIdentity; reset(); }
      const duration = state.catalogDuration || state.duration;
      if (state.loaded && attempted && Math.abs(duration - queryDuration) > 0.5) reset();
      if (state.active && state.loaded && !attempted && state.duration > 0) lookup();
      updateControls(); updatePosition();
    },
  };
}
