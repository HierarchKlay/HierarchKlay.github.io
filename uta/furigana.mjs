// Readings come from Kuromoji/IPADIC, never from guessed character mappings.
const KANJI = /[\p{Script=Han}々〆]/u;
const KANJI_RUN = /([\p{Script=Han}々〆]+)/u;
const READING = /^[\p{Script=Hiragana}\p{Script=Katakana}ー]+$/u;

export function toHiragana(text) {
  return String(text).normalize('NFC').replace(/[ァ-ヶ]/g, char => String.fromCharCode(char.charCodeAt(0) - 0x60));
}

// Keep kana outside ruby. If the kana alignment has several possible answers,
// leave the word unchanged rather than assign an uncertain reading to a kanji.
export function splitFurigana(surface, rawReading) {
  const text = String(surface || '');
  if (!text || !KANJI.test(text) || typeof rawReading !== 'string' || !READING.test(rawReading)) return [{ text }];
  const reading = toHiragana(rawReading);
  const parts = text.split(KANJI_RUN).filter(Boolean);
  const answers = [];
  let budget = 4000;
  function align(index, position, result) {
    if (--budget < 0) return;
    if (answers.length > 1) return;
    if (index === parts.length) {
      if (position === reading.length) answers.push(result);
      return;
    }
    const part = parts[index];
    if (!KANJI.test(part)) {
      const kana = toHiragana(part);
      if (reading.startsWith(kana, position)) align(index + 1, position + kana.length, [...result, { text: part }]);
      return;
    }
    if (index === parts.length - 1) {
      if (position < reading.length) align(index + 1, reading.length, [...result, { text: part, reading: reading.slice(position) }]);
      return;
    }
    const nextKana = toHiragana(parts[index + 1]);
    for (let end = position + 1; end < reading.length; end++) {
      if (reading.startsWith(nextKana, end)) align(index + 1, end, [...result, { text: part, reading: reading.slice(position, end) }]);
    }
  }
  align(0, 0, []);
  return budget >= 0 && answers.length === 1 ? answers[0] : [{ text }];
}

export function annotateTokens(text, tokens) {
  if (!Array.isArray(tokens)) return [{ text }];
  const result = [];
  let position = 0;
  for (const token of tokens) {
    const surface = token?.surface_form;
    if (typeof surface !== 'string' || !surface) continue;
    const found = text.indexOf(surface, position);
    if (found < position) return [{ text }];
    if (found > position) result.push({ text: text.slice(position, found) });
    result.push(...(token.word_type === 'KNOWN' ? splitFurigana(surface, token.reading) : [{ text: surface }]));
    position = found + surface.length;
  }
  if (position < text.length) result.push({ text: text.slice(position) });
  return result.length ? result : [{ text }];
}

const cache = new Map();
const pending = new Map();
let worker = null;
let sequence = 0;
const failure = () => new Error('读音词典未能载入，请检查网络后重新开启假名。');

function releaseWorker() {
  worker?.terminate(); worker = null;
  for (const request of pending.values()) { clearTimeout(request.timer); request.reject(failure()); }
  pending.clear();
}

function getWorker() {
  if (worker) return worker;
  if (typeof Worker === 'undefined') throw failure();
  worker = new Worker(new URL('./furigana-worker.js?v=8', import.meta.url));
  worker.onerror = event => { event.preventDefault(); releaseWorker(); };
  worker.onmessageerror = () => releaseWorker();
  worker.onmessage = ({ data }) => {
    const request = pending.get(data?.id);
    if (!request) return;
    clearTimeout(request.timer); pending.delete(data.id);
    if (data.error || !Array.isArray(data.tokens) || data.tokens.length !== request.lines.length) {
      request.reject(failure()); releaseWorker(); return;
    }
    const result = request.lines.map((line, index) => annotateTokens(line, data.tokens[index]));
    request.lines.forEach((line, index) => {
      cache.set(line, result[index]);
      if (cache.size > 1000) cache.delete(cache.keys().next().value);
    });
    request.resolve();
  };
  return worker;
}

/** Lazy, browser-local analysis; no lyric text is sent to the CDN. */
export async function annotateLines(lines) {
  if (!Array.isArray(lines) || lines.length > 500 || lines.some(line => typeof line !== 'string' || line.length > 2000) || lines.reduce((n, line) => n + line.length, 0) > 100000) {
    throw new Error('歌词过长，无法生成假名。');
  }
  const missing = [...new Set(lines.filter(line => KANJI.test(line) && !cache.has(line)))];
  if (missing.length) await new Promise((resolve, reject) => {
    let current;
    try { current = getWorker(); } catch { reject(failure()); return; }
    const id = ++sequence;
    const timer = setTimeout(releaseWorker, 90000);
    pending.set(id, { lines: missing, resolve, reject, timer });
    try { current.postMessage({ id, lines: missing }); }
    catch { releaseWorker(); }
  });
  return lines.map(line => (cache.get(line) || [{ text: line }]).map(token => ({ ...token })));
}
