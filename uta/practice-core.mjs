import { queueForURL } from './player-core.mjs?v=7';

export const LISTEN_MODES = ['single', 'repeat', 'playlist'];
export function parseTime(raw) {
  const value = String(raw).trim();
  if (!/^(?:\d+:)?\d+(?:\.\d+)?$/.test(value)) throw new Error('时间请填秒数或 分:秒，例如 42.5 或 1:08。');
  const parts = value.split(':').map(Number);
  if (parts.length === 2 && parts[1] >= 60) throw new Error('冒号后的秒数应小于 60。');
  const seconds = parts.length === 2 ? parts[0] * 60 + parts[1] : parts[0];
  if (!Number.isFinite(seconds) || seconds < 0 || seconds > 86400) throw new Error('时间超出范围。');
  return seconds;
}

export function validateRange(a, b, duration = Infinity) {
  if (!Number.isFinite(a) || !Number.isFinite(b) || a < 0 || b - a < 1) throw new Error('起点不能小于 0，终点至少晚 1 秒。');
  if (b > duration) throw new Error('终点超过歌曲时长，请调整后再试。');
  return { a: Math.round(a * 100) / 100, b: Math.round(b * 100) / 100 };
}

export function chooseAlbumSong(response, title) {
  const data = response?.data?.data ?? response?.data;
  const tracks = Array.isArray(data) ? data[0]?.relationships?.tracks?.data : null;
  if (!Array.isArray(tracks)) throw new Error('无法读取专辑曲目，请使用这首歌的单曲分享链接。');
  const songs = tracks.filter(t => t.type === 'songs' && /^\d+$/.test(String(t.id)));
  const normalize = s => String(s || '').normalize('NFKC').toLowerCase().replace(/\s/g, '');
  const matches = songs.filter(t => normalize(t.attributes?.name) === normalize(title));
  if (matches.length === 1) return String(matches[0].id);
  if (songs.length === 1) return String(songs[0].id);
  throw new Error('专辑中未找到唯一匹配的歌曲，请改用含歌曲编号的单曲链接。');
}

export async function buildQueuePlan(songs, selectedKey, mode, resolveSong) {
  const index = songs.findIndex(s => s.key === selectedKey);
  if (index < 0 || !LISTEN_MODES.includes(mode)) throw new Error('播放选择无效。');
  const ordered = mode === 'playlist' ? [...songs.slice(index), ...songs.slice(0, index)] : [songs[index]];
  return Promise.all(ordered.map(async song => {
    const parsed = queueForURL(song.url);
    const id = parsed.song || await resolveSong(song, parsed.album);
    if (!/^\d+$/.test(String(id))) throw new Error('歌曲编号无效。');
    return { key: song.key, url: song.url, id: String(id) };
  }));
}

export function sanitizePractice(raw) {
  const result = { mode: LISTEN_MODES.includes(raw?.mode) ? raw.mode : 'single', clips: [] };
  if (!Array.isArray(raw?.clips)) return result;
  const seen = new Set();
  for (const clip of raw.clips.slice(0, 300)) {
    try {
      if (!clip || typeof clip.id !== 'string' || !/^[\w-]{1,80}$/.test(clip.id) || seen.has(clip.id)) continue;
      if (typeof clip.url !== 'string' || !/^\d+$/.test(clip.trackId)) continue;
      queueForURL(clip.url);
      const range = validateRange(clip.a, clip.b, 86400);
      result.clips.push({ id: clip.id, url: new URL(clip.url).href, trackId: clip.trackId, name: String(clip.name || '练习片段').slice(0, 60), ...range });
      seen.add(clip.id);
    } catch { /* Keep valid entries when a saved item is damaged. */ }
  }
  return result;
}

export function upsertClip(clips, input) {
  const item = sanitizePractice({ clips: [input] }).clips[0];
  if (!item) throw new Error('片段信息不完整，请重新播放歌曲后标记。');
  const match = clips.findIndex(c => c.id === item.id || (c.url === item.url && c.trackId === item.trackId && c.a === item.a && c.b === item.b));
  const next = [...clips];
  if (match >= 0) next[match] = { ...item, id: clips[match].id };
  else {
    if (next.length >= 300) throw new Error('已保存 300 个片段，请先整理一些旧片段。');
    next.push(item);
  }
  return next;
}
