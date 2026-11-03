// Pure helpers: never send or log credentials.
export function parseDeveloperToken(raw, { origin, now = Math.floor(Date.now() / 1000) } = {}) {
  if (typeof raw !== 'string') throw new Error('请导入生成的令牌 .txt 文件，或粘贴令牌。');
  if (/PRIVATE KEY|BEGIN .*KEY/.test(raw)) throw new Error('这是私钥，不是令牌。请保留 .p8，选择脚本生成的 .txt 文件。');
  const token = raw.trim();
  if (token.length > 16384 || !/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(token)) {
    throw new Error('令牌格式不正确，请使用脚本生成的 .txt 文件。');
  }
  const parts = token.split('.');
  const decode = part => {
    const text = atob(part.replace(/-/g, '+').replace(/_/g, '/'));
    return JSON.parse(new TextDecoder().decode(Uint8Array.from(text, c => c.charCodeAt(0))));
  };
  let header, claims, signature;
  try { header = decode(parts[0]); claims = decode(parts[1]); signature = atob(parts[2].replace(/-/g, '+').replace(/_/g, '/')); }
  catch { throw new Error('无法解析令牌，请重新选择脚本生成的文件。'); }
  if (!header || !claims || header.alg !== 'ES256' || !/^[A-Z0-9]{10}$/.test(header.kid || '') ||
      !/^[A-Z0-9]{10}$/.test(claims.iss || '') || signature.length !== 64) {
    throw new Error('请使用 MusicKit 开发者令牌。');
  }
  if (!Number.isSafeInteger(claims.exp) || !Number.isSafeInteger(claims.iat) || claims.exp <= claims.iat ||
      claims.exp - claims.iat > 15777000) throw new Error('令牌的有效期格式不正确。');
  if (claims.exp <= now) throw new Error('令牌已过期，请在 Mac 上重新运行生成脚本。');
  if (claims.iat > now + 300) throw new Error('令牌签发时间在未来，请检查 Mac 与当前设备的系统时间。');
  if (claims.origin !== undefined && (!Array.isArray(claims.origin) || !claims.origin.every(v => typeof v === 'string') ||
      (origin && !claims.origin.includes(origin)))) {
    throw new Error('令牌的域名与当前页面不匹配，请在 https://hierarchklay.github.io/uta/ 打开。');
  }
  return { token, expiresAt: claims.exp };
}

export function queueForURL(raw) {
  const u = new URL(raw);
  if (u.protocol !== 'https:' || u.hostname !== 'music.apple.com' || u.username || u.password || u.port) throw new Error('需要 Apple Music 官方歌曲链接。');
  const match = u.pathname.match(/^\/([a-z]{2})\/(album|song)\/(?:[^/]+\/)?(\d+)\/?$/);
  if (!match) throw new Error('当前链接不是歌曲或专辑。');
  const songId = u.searchParams.get('i');
  if (songId && !/^\d+$/.test(songId)) throw new Error('歌曲编号无效。');
  return songId ? { song: songId } : { [match[2]]: match[3] };
}

export function formatTime(value) {
  if (!Number.isFinite(value) || value < 0) return '—:—';
  return Math.floor(value / 60) + ':' + String(Math.floor(value % 60)).padStart(2, '0');
}

export function boundedTime(value, duration) {
  if (!Number.isFinite(value) || !Number.isFinite(duration) || duration <= 0) throw new Error('等待歌曲载入后再跳转。');
  return Math.max(0, Math.min(value, Math.max(0, duration - 0.05)));
}

export class SegmentLoop {
  constructor() { this.reset(); }
  reset() { this.a = null; this.b = null; this.enabled = false; this.seeking = false; this.once = false; this.passes = 0; this.generation = (this.generation || 0) + 1; }
  markA(time) {
    if (!Number.isFinite(time) || time < 0) throw new Error('等待歌曲载入后再标记。');
    this.reset(); this.a = time;
  }
  markB(time) {
    if (this.a === null) throw new Error('请先标记起点 A。');
    if (!Number.isFinite(time) || time < this.a + 1) throw new Error('终点 B 至少要比起点 A 晚 1 秒。');
    this.b = time; this.enabled = false;
  }
  start({ once = false } = {}) {
    if (this.a === null || this.b === null) throw new Error('请先标记 A 和 B。');
    this.enabled = true; this.once = once; this.passes = 0;
  }
  async tick({ time, playing, visible }, seek, pause) {
    if (!this.enabled || this.seeking || !playing || !visible || !Number.isFinite(time) || time < this.b) return false;
    const generation = this.generation;
    this.seeking = true;
    try {
      if (this.once) { this.enabled = false; await pause(); }
      else await seek(this.a);
      if (generation === this.generation) this.passes += 1;
      return true;
    }
    catch (error) { if (generation === this.generation) this.enabled = false; throw error; }
    finally { if (generation === this.generation) this.seeking = false; }
  }
}
