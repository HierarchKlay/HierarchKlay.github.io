const MAX_TEXT = 200000;
const MAX_LINES = 2000;
const MAX_RESPONSE = 2000000;
const API = 'https://lrclib.net/api/';
const CLIENT = 'Hibi Uta v8 (https://hierarchklay.github.io/uta/)';
const normalize = value => typeof value === 'string' ? value.normalize('NFKC').toLocaleLowerCase('en').replace(/\s+/gu, '') : '';
const abortError = () => new DOMException('Lyrics request cancelled', 'AbortError');

/** Parse line timestamps. LRC's positive offset advances its timestamps; UI offset is separate. */
export function parseLRC(raw) {
  if (typeof raw !== 'string' || raw.length > MAX_TEXT) return [];
  const source = raw.replace(/^\uFEFF/, '').split(/\r?\n/);
  if (source.length > MAX_LINES) return [];
  let fileOffset = 0;
  for (const row of source) {
    const tag = /^\s*\[offset:([+-]?\d+)\]\s*$/i.exec(row);
    if (tag && Math.abs(Number(tag[1])) <= 86400000) fileOffset = Number(tag[1]) / 1000;
  }
  const grouped = new Map();
  let count = 0;
  for (const rawLine of source) {
    const row = rawLine.trimStart();
    const prefix = /^(?:\[\d{1,4}:\d{2}(?:[.:]\d{1,3})?\])+/.exec(row)?.[0];
    if (!prefix) continue;
    const text = row.slice(prefix.length).replace(/<\d{1,4}:\d{2}(?:\.\d{1,3})?>/g, '').trim();
    for (const match of prefix.matchAll(/\[(\d{1,4}):(\d{2})(?:[.:](\d{1,3}))?\]/g)) {
      if (++count > MAX_LINES) return [];
      const seconds = Number(match[2]);
      const time = Number(match[1]) * 60 + seconds + Number('0.' + (match[3] || '0'));
      if (seconds >= 60 || time > 86400) continue;
      const adjusted = Math.round(Math.max(0, time - fileOffset) * 1000) / 1000;
      const existing = grouped.get(adjusted) || [];
      if (text && !existing.includes(text)) existing.push(text);
      grouped.set(adjusted, existing);
    }
  }
  return [...grouped].sort(([a], [b]) => a - b).map(([time, parts]) => ({ time, text: parts.join('\n') }));
}

/** Positive offset displays lyrics later. Blank entries represent an instrumental interval. */
export function activeLineAt(lines, time, offset = 0) {
  if (!Array.isArray(lines) || !Number.isFinite(time) || !Number.isFinite(offset)) return -1;
  const position = time - offset;
  let low = 0, high = lines.length - 1, result = -1;
  while (low <= high) {
    const mid = (low + high) >>> 1;
    if (lines[mid].time <= position) { result = mid; low = mid + 1; }
    else high = mid - 1;
  }
  return result;
}

/** Only derive an end from the next supplied timestamp or actual track duration. */
export function lineRange(lines, index, duration, offset = 0) {
  if (!Array.isArray(lines) || !Number.isInteger(index) || index < 0 || index >= lines.length ||
      !lines[index].text || !Number.isFinite(duration) || duration <= 0 || !Number.isFinite(offset)) return null;
  const start = lines[index].time + offset;
  const end = index + 1 < lines.length ? lines[index + 1].time + offset : duration;
  if (!Number.isFinite(start) || !Number.isFinite(end)) return null;
  const a = Math.round(Math.max(0, start) * 1000) / 1000;
  const b = Math.round(Math.min(duration, end) * 1000) / 1000;
  return b - a >= 1 && a < duration ? { a, b } : null;
}

function names(primary, aliases) {
  return new Set([primary, ...(Array.isArray(aliases) ? aliases.slice(0, 5) : [])].map(normalize).filter(Boolean));
}
function normalizeRecord(record, playbackDuration) {
  if (!record || !Number.isSafeInteger(record.id) || record.id <= 0 ||
      !Number.isFinite(record.duration) || record.duration <= 0 ||
      typeof record.trackName !== 'string' || typeof record.artistName !== 'string') return null;
  const lines = parseLRC(record.syncedLyrics);
  // Allow only half a second for rounded duration metadata. An out-of-range
  // axis is a version/data mismatch; do not silently trim or retime its lines.
  if (lines.some(line => line.time > Math.min(record.duration, playbackDuration) + 0.5)) return null;
  const plainLines = typeof record.plainLyrics === 'string' && record.plainLyrics.length <= MAX_TEXT
    ? record.plainLyrics.split(/\r?\n/).slice(0, MAX_LINES).map(line => line.trim()).filter(Boolean) : [];
  const timed = lines.some(line => line.text);
  if (!timed && !plainLines.length && !record.instrumental) return null;
  return {
    id: record.id, title: record.trackName, artist: record.artistName,
    album: typeof record.albumName === 'string' ? record.albumName : '', duration: record.duration,
    lines: timed ? lines : [], plainLines,
    instrumental: record.instrumental === true && !timed && !plainLines.length,
  };
}

/** Conservative version matching: explicit aliases only, no fuzzy title or artist guesses. */
export function selectLyricsCandidate(records, metadata) {
  if (!Array.isArray(records) || !metadata || !Number.isFinite(metadata.duration) || metadata.duration <= 0) return null;
  const titles = names(metadata.title, metadata.titleAliases), artists = names(metadata.artist, metadata.artistAliases);
  const candidates = records.slice(0, 100).map(record => normalizeRecord(record, metadata.duration)).filter(record => record &&
    titles.has(normalize(record.title)) && artists.has(normalize(record.artist)) && Math.abs(record.duration - metadata.duration) <= 2);
  const rank = record => [record.lines.length ? 1 : 0, normalize(metadata.album) && normalize(record.album) === normalize(metadata.album) ? 1 : 0, -Math.abs(record.duration - metadata.duration)];
  const compare = (a, b) => { const ar = rank(a), br = rank(b); for (let i = 0; i < ar.length; i++) if (ar[i] !== br[i]) return br[i] - ar[i]; return a.id - b.id; };
  candidates.sort(compare);
  if (!candidates.length) return null;
  const first = candidates[0];
  const bestRank = JSON.stringify(rank(first));
  const content = record => JSON.stringify([record.lines, record.plainLines, record.instrumental]);
  const bestContent = content(first);
  if (candidates.some(record => JSON.stringify(rank(record)) === bestRank && content(record) !== bestContent)) return null;
  return first;
}

async function readJSON(response) {
  if (Number(response.headers?.get?.('content-length')) > MAX_RESPONSE) throw new Error('LYRICS_UNAVAILABLE');
  let raw;
  if (response.body?.getReader) {
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let size = 0; raw = '';
    try {
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        size += value.byteLength;
        if (size > MAX_RESPONSE) { await reader.cancel(); throw new Error('LYRICS_UNAVAILABLE'); }
        raw += decoder.decode(value, { stream: true });
      }
      raw += decoder.decode();
    } finally { reader.releaseLock(); }
  } else raw = await response.text();
  if (raw.length > MAX_RESPONSE) throw new Error('LYRICS_UNAVAILABLE');
  return JSON.parse(raw);
}

/** Fetch on demand. Results stay in caller memory; never send Apple credentials. */
export async function findLyrics(metadata, { signal, fetchImpl = globalThis.fetch } = {}) {
  if (!metadata || !normalize(metadata.title) || !normalize(metadata.artist) ||
      !Number.isFinite(metadata.duration) || metadata.duration < 1 || metadata.duration > 3600) return null;
  if (signal?.aborted) throw abortError();
  const controller = new AbortController();
  const cancel = () => controller.abort();
  signal?.addEventListener('abort', cancel, { once: true });
  const timeout = setTimeout(cancel, 18000);
  const collected = [];
  async function request(endpoint, params) {
    if (controller.signal.aborted) throw abortError();
    const url = new URL(endpoint, API);
    for (const [key, value] of Object.entries(params)) if (value !== undefined && value !== '') url.searchParams.set(key, String(value));
    const response = await fetchImpl(url.href, {
      signal: controller.signal, credentials: 'omit', redirect: 'error',
      headers: { Accept: 'application/json', 'Lrclib-Client': CLIENT },
    });
    if (response.status === 404) return;
    if (!response.ok) throw new Error(response.status === 429 ? 'LYRICS_RATE_LIMITED' : 'LYRICS_UNAVAILABLE');
    const value = await readJSON(response);
    for (const record of Array.isArray(value) ? value : [value]) if (!collected.some(item => item?.id === record?.id)) collected.push(record);
  }
  async function gap() {
    if (controller.signal.aborted) throw abortError();
    await new Promise(resolve => setTimeout(resolve, 250));
  }
  try {
    await request('get', { track_name: metadata.title, artist_name: metadata.artist, album_name: metadata.album, duration: metadata.duration });
    let selected = selectLyricsCandidate(collected, metadata);
    if (selected?.lines.length || selected?.instrumental) return selected;
    await gap();
    await request('search', { track_name: metadata.title, artist_name: metadata.artist });
    selected = selectLyricsCandidate(collected, metadata);
    if (selected?.lines.length || selected?.instrumental) return selected;
    const aliasTitle = metadata.titleAliases?.find(title => typeof title === 'string' && normalize(title) !== normalize(metadata.title));
    const aliasArtist = metadata.artistAliases?.find(artist => typeof artist === 'string' && normalize(artist) !== normalize(metadata.artist));
    if (aliasTitle || aliasArtist) {
      await gap();
      await request('search', { track_name: aliasTitle || metadata.title, artist_name: aliasArtist || metadata.artist });
    }
    return selectLyricsCandidate(collected, metadata);
  } catch (error) {
    if (signal?.aborted) throw abortError();
    if (error?.message === 'LYRICS_RATE_LIMITED') throw error;
    throw new Error('LYRICS_UNAVAILABLE');
  } finally {
    clearTimeout(timeout);
    signal?.removeEventListener('abort', cancel);
  }
}
