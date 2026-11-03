import { parseDeveloperToken, queueForURL, formatTime, boundedTime, SegmentLoop } from './player-core.mjs?v=6';
import { resolveDeveloperToken } from './token-config.mjs?v=6';

const TOKEN_KEY = 'hibi-uta-musickit-developer-token-v1';
const SDK_URL = 'https://js-cdn.music.apple.com/musickit/v3/musickit.js';
let sdkPromise;
function loadSDK() {
  if (window.MusicKit) return Promise.resolve(window.MusicKit);
  if (sdkPromise) return sdkPromise;
  sdkPromise = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    let timeout;
    const cleanup = () => { clearTimeout(timeout); document.removeEventListener('musickitloaded', ready); };
    const ready = () => { if (window.MusicKit) { cleanup(); resolve(window.MusicKit); } };
    const fail = () => { cleanup(); script.remove(); sdkPromise = null; reject(new Error('SDK_LOAD_FAILED')); };
    document.addEventListener('musickitloaded', ready);
    script.src = SDK_URL; script.async = true; script.addEventListener('load', ready); script.addEventListener('error', fail);
    timeout = setTimeout(fail, 25000);
    document.head.append(script);
  });
  return sdkPromise;
}

export function initMusicKitPlayer({ getURL, getSong, isActive, onBusy }) {
  const $ = id => document.getElementById(id);
  const loop = new SegmentLoop();
  let music = null, busy = false, connectedToken = '', expiresAt = 0, queuedURL = '', lastItemId = '';
  let lastSample = null, timeUpdates = 0, seekCount = 0;
  let tokenSource = '', configChecked = false;
  const status = (message, error = false) => { $('mk-status').textContent = message; $('mk-status').classList.toggle('error', error); };
  const localError = message => Object.assign(new Error(message), { local: true });
  function failure(error) {
    if (error?.local) return error.message;
    const code = String(error?.name || error?.code || '');
    if (error?.message === 'SDK_LOAD_FAILED') return 'MusicKit 脚本载入失败，请检查网络后重新连接。';
    if (code === 'NotAllowedError') return '浏览器需要直接点击才能播放，请再点一次「播放」。';
    if (code === 'AUTHORIZATION_ERROR') return 'Apple 授权未完成，请在 Safari 中重新点击授权。';
    return '操作未完成。请检查网络、令牌对应的 MusicKit 服务与中国区会员状态，再重试。';
  }
  function resetMeasurements() { lastSample = null; timeUpdates = 0; seekCount = 0; }
  function refresh() {
    const authorized = !!music?.isAuthorized;
    const selectedLoaded = !!music && queuedURL === getURL().href;
    const hasTime = selectedLoaded && Number.isFinite(music.currentPlaybackDuration) && music.currentPlaybackDuration > 0;
    const playing = selectedLoaded && !!music.isPlaying;
    $('mk-connection-state').textContent = !music ? (configChecked ? '等待连接' : '正在读取网站配置') : authorized ? 'Apple Music 已授权' : '已连接 · 等待 Apple 授权';
    $('mk-token-expiry').textContent = expiresAt ? (tokenSource === 'site' ? '网站共享' : '本机令牌') + ' · 到期：' + new Date(expiresAt * 1000).toLocaleDateString('zh-CN') : '共享配置会自动读取，也可手动导入 Mac 上生成的 .txt。';
    $('mk-connect').disabled = busy || !!music;
    $('mk-file').disabled = busy || !!music;
    $('mk-token').disabled = busy || !!music;
    $('mk-remember').disabled = busy || !!music;
    $('mk-authorize').disabled = busy || !music || authorized;
    $('mk-authorize').textContent = authorized ? '已授权' : '授权 Apple Music';
    $('mk-clear').disabled = busy;
    $('mk-clear').textContent = tokenSource === 'site' ? '重置本机授权' : '清除本机连接';
    $('mk-play').disabled = busy || !authorized;
    $('mk-play').textContent = playing ? '暂停' : selectedLoaded ? '播放' : '播放这首歌';
    for (const id of ['mk-back','mk-forward','mk-seek','mk-jump','mk-jump-time','mk-mark-a','mk-mark-b']) $(id).disabled = busy || !hasTime;
    $('mk-loop').disabled = busy || !hasTime || loop.a === null || loop.b === null;
    $('mk-loop').textContent = loop.enabled ? '停止循环' : '开始循环';
    $('mk-loop').setAttribute('aria-pressed', String(loop.enabled));
    $('mk-reset-loop').disabled = busy || loop.a === null;
    $('mk-a').textContent = loop.a === null ? '未标记' : formatTime(loop.a);
    $('mk-b').textContent = loop.b === null ? '未标记' : formatTime(loop.b);
    const time = selectedLoaded ? music.currentPlaybackTime : NaN;
    const duration = selectedLoaded ? music.currentPlaybackDuration : NaN;
    $('mk-time').textContent = formatTime(time);
    $('mk-duration').textContent = formatTime(duration);
    if (hasTime) {
      $('mk-seek').max = String(duration);
      if (document.activeElement !== $('mk-seek')) $('mk-seek').value = String(Number.isFinite(time) ? time : 0);
      $('mk-seek').setAttribute('aria-valuetext', formatTime(time) + ' / ' + formatTime(duration));
    } else { $('mk-seek').max = '100'; $('mk-seek').value = '0'; }
    $('mk-telemetry').textContent = `读取到 ${timeUpdates} 次进度变化 · 已完成 ${seekCount} 次跳转`;
    const item = selectedLoaded ? music.nowPlayingItem : null;
    $('mk-track-detail').textContent = item?.attributes?.name ? `正在播放的曲目：${item.attributes.name} — ${item.attributes.artistName || ''}` : '选一首歌，再开始播放。';
  }
  async function operation(task) {
    if (busy) return;
    busy = true; onBusy(true); refresh();
    try { return await task(); } catch (error) { status(failure(error), true); return false; }
    finally { busy = false; onBusy(false); refresh(); }
  }
  function ensureFresh() {
    if (!music) throw localError('请先连接 MusicKit。');
    if (expiresAt <= Date.now() / 1000) throw localError(tokenSource === 'site' ? '共享令牌已过期，请更新网站配置后刷新。' : '令牌已过期，请清除本机连接并导入新令牌。');
  }
  async function seek(time) {
    ensureFresh();
    if (queuedURL !== getURL().href) throw localError('请先播放当前选择的歌曲。');
    let target;
    try { target = boundedTime(time, music.currentPlaybackDuration); } catch (e) { throw localError(e.message); }
    await music.seekToTime(target); seekCount += 1; refresh();
  }
  function sample() {
    if (!music || !isActive()) return;
    const id = String(music.nowPlayingItem?.id || '');
    if (id && id !== lastItemId) { loop.reset(); lastItemId = id; lastSample = null; }
    const time = music.currentPlaybackTime;
    if (queuedURL === getURL().href && Number.isFinite(time) && time !== lastSample) { lastSample = time; timeUpdates += 1; }
    refresh();
    if (!busy) loop.tick({ time, playing: music.isPlaying, visible: document.visibilityState === 'visible' }, seek)
      .catch(error => { status('选段循环已停止。' + failure(error), true); refresh(); });
  }
  async function connect(raw) {
    let parsed;
    try { parsed = parseDeveloperToken(raw, { origin: location.origin }); }
    catch (e) { status(e.message, true); $('mk-token').value = ''; $('mk-file').value = ''; return; }
    $('mk-token').value = ''; $('mk-file').value = '';
    await operation(() => initialize(parsed, 'local'));
  }
  async function initialize(parsed, source) {
      status('正在连接 MusicKit…');
      const kit = await loadSDK();
      await kit.configure({ developerToken: parsed.token, app: { name: '日々うた', build: '6' }, storefrontId: 'cn' });
      music = kit.getInstance();
      if (!music) throw localError('MusicKit 初始化未完成，请重新连接。');
      connectedToken = parsed.token; expiresAt = parsed.expiresAt; tokenSource = source;
      for (const name of ['playbackTimeDidChange','playbackStateDidChange','playbackDurationDidChange','nowPlayingItemDidChange','authorizationStatusDidChange']) music.addEventListener(name, sample);
      music.addEventListener('mediaPlaybackError', () => { loop.enabled = false; status('Apple 播放出错，请确认歌曲在当前会员地区可用后重试。', true); refresh(); });
      let stored = false;
      try {
        if (source === 'site') localStorage.removeItem(TOKEN_KEY);
        else if ($('mk-remember').checked) { localStorage.setItem(TOKEN_KEY, parsed.token); stored = true; }
        else localStorage.removeItem(TOKEN_KEY);
      } catch { /* Continue with a session-only token. */ }
      $('mk-setup').open = false;
      if (source === 'local') $('mk-config-status').textContent = '当前使用本机令牌。手动导入不会同步到其他设备。';
      status((music.isAuthorized ? '已连接，可以播放歌曲。' : '已连接，请点击「授权 Apple Music」。') + (source === 'site' || stored ? '' : '令牌仅在本次页面使用。'));
  }
  async function bootstrap() {
    return operation(async () => {
      status('正在读取网站共享配置…');
      const result = await resolveDeveloperToken({ readLocal: () => localStorage.getItem(TOKEN_KEY), origin: location.origin });
      configChecked = true;
      $('mk-config-status').textContent = result.notice;
      if (result.parsed) await initialize(result.parsed, result.source);
      else { $('mk-setup').open = true; status('请设置网站共享令牌，或在此浏览器导入令牌。'); }
    });
  }
  $('mk-token-form').addEventListener('submit', event => { event.preventDefault(); if (!music && !busy) connect($('mk-token').value); });
  $('mk-file').addEventListener('change', async () => {
    const file = $('mk-file').files[0];
    if (!file || busy || music) return;
    if (/\.p8$/i.test(file.name)) { status('请选择生成的令牌 .txt 文件，.p8 私钥留在 Mac 上。', true); $('mk-file').value = ''; return; }
    if (file.size > 16384) { status('文件过大，请选择生成的令牌 .txt 文件。', true); $('mk-file').value = ''; return; }
    try { await connect(await file.text()); } catch { status('无法读取文件，请重新选择。', true); }
  });
  $('mk-authorize').addEventListener('click', () => operation(async () => {
    ensureFresh(); status('请在 Apple 弹出的窗口中完成授权…');
    await music.authorize(); // Called directly from this click; never after a separate setup request.
    status(music.isAuthorized ? '授权成功，可以播放歌曲。' : '授权未完成或已取消，请再次点击授权。', !music.isAuthorized);
  }));
  $('mk-clear').addEventListener('click', () => operation(async () => {
    loop.reset();
    try { localStorage.removeItem(TOKEN_KEY); } catch { /* Session token will be dropped on reload. */ }
    // Always allow local reset, including after an SDK/network failure.
    if (music) {
      try { await music.stop(); } catch {}
      try { await music.unauthorize(); } catch {}
    }
    connectedToken = ''; location.reload();
  }));
  $('mk-play').addEventListener('click', () => operation(async () => {
    ensureFresh();
    if (!music.isAuthorized) throw localError('请先授权 Apple Music。');
    if (queuedURL !== getURL().href) {
      loop.reset(); resetMeasurements(); lastItemId = '';
      const url = getURL().href;
      status('正在载入 ' + getSong().title + '…');
      await music.setQueue({ ...queueForURL(url), startPlaying: false });
      queuedURL = url;
      await music.play();
    } else if (music.isPlaying) await music.pause();
    else await music.play();
    status(music.isPlaying ? '正在播放。可拖动进度条，或试试前后跳转。' : '已载入或暂停；点击「播放」开始听。');
    sample();
  }));
  const jump = time => operation(async () => { await seek(time); status('已完成跳转，请听一下是否到达预期位置。'); });
  $('mk-back').addEventListener('click', () => jump(music.currentPlaybackTime - 5));
  $('mk-forward').addEventListener('click', () => jump(music.currentPlaybackTime + 5));
  $('mk-seek').addEventListener('change', () => jump(Number($('mk-seek').value)));
  $('mk-jump-form').addEventListener('submit', event => { event.preventDefault(); if (!$('mk-jump-time').value.trim()) return; jump(Number($('mk-jump-time').value)); });
  for (const [id, method] of [['mk-mark-a','markA'],['mk-mark-b','markB']]) $(id).addEventListener('click', () => {
    try { loop[method](music.currentPlaybackTime); status('已标记 ' + (method === 'markA' ? '起点 A' : '终点 B') + '。'); }
    catch (e) { status(e.message, true); } refresh();
  });
  $('mk-loop').addEventListener('click', () => operation(async () => {
    if (loop.enabled) { loop.enabled = false; status('已停止选段循环。'); return; }
    try { loop.start(); } catch (e) { throw localError(e.message); }
    try { await seek(loop.a); await music.play(); status('选段循环已开启，请保持此页面在前台。'); }
    catch (e) { loop.enabled = false; throw e; }
  }));
  $('mk-reset-loop').addEventListener('click', () => { loop.reset(); refresh(); status('已清除 A / B 标记。'); });
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState !== 'visible' && loop.enabled) { loop.enabled = false; status('页面进入后台，已关闭选段循环。返回后可重新开启。'); }
    sample();
  });
  // Poll only the SDK's actual position to refresh the visible UI; never advance an independent clock.
  setInterval(() => { if (document.visibilityState === 'visible') sample(); }, 500);
  refresh();
  if (isActive()) bootstrap();
  return {
    async suspend() {
      return operation(async () => {
        loop.reset();
        if (music) await music.pause();
        return true;
      });
    },
    async selectionChanged() {
      return operation(async () => {
        if (music) await music.stop();
        queuedURL = ''; lastItemId = ''; loop.reset(); resetMeasurements();
        if (music) status('已停止上一首。点击「播放这首歌」开始。');
        return true;
      });
    },
    async activate() {
      if (!music) await bootstrap();
      refresh();
    },
    refresh,
    get connected() { return !!connectedToken; },
  };
}
