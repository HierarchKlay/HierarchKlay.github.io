import { parseDeveloperToken } from './player-core.mjs?v=6';

// Only a public developer token belongs in this file. Never read a private key or user token.
export async function fetchSiteConfig(fetcher = globalThis.fetch) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);
  try {
    const response = await fetcher(new URL('./musickit-config.json', import.meta.url), {
      cache: 'no-store', credentials: 'omit', redirect: 'error', signal: controller.signal,
    });
    if (!response.ok) throw new Error('CONFIG_UNAVAILABLE');
    const text = await response.text();
    if (text.length > 20000) throw new Error('CONFIG_TOO_LARGE');
    return JSON.parse(text);
  } finally { clearTimeout(timeout); }
}

export async function resolveDeveloperToken({ fetchConfig = fetchSiteConfig, readLocal, origin, now }) {
  let sharedState = 'empty';
  let notice = '网站尚未设置共享令牌。配置一次后，其他设备会自动读取。';
  try {
    const config = await fetchConfig();
    if (!config || Array.isArray(config) || typeof config.developerToken !== 'string') throw new Error('CONFIG_INVALID');
    if (config.developerToken.trim()) {
      const parsed = parseDeveloperToken(config.developerToken, { origin, now });
      return { parsed, source: 'site', sharedState: 'ready', notice: '已读取网站共享令牌，各设备无需重复导入。' };
    }
  } catch {
    sharedState = 'unavailable';
    notice = '网站共享令牌暂不可用，请检查配置、有效期与网络；仍可使用本机令牌。';
  }
  try {
    const raw = readLocal?.();
    if (raw) {
      const parsed = parseDeveloperToken(raw, { origin, now });
      return { parsed, source: 'local', sharedState, notice: notice + ' 当前使用本机保存的令牌。' };
    }
  } catch {
    notice += ' 本机令牌也不可用，请更新共享配置或重新导入。';
  }
  return { parsed: null, source: null, sharedState, notice };
}
