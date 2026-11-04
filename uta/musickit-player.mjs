import { initLyricsPanel } from './lyrics-panel.mjs?v=8';
import { parseDeveloperToken, formatTime, boundedTime, SegmentLoop } from './player-core.mjs?v=8';
import { resolveDeveloperToken } from './token-config.mjs?v=8';
import { parseTime, validateRange, chooseAlbumSong, buildQueuePlan, sanitizePractice, upsertClip } from './practice-core.mjs?v=8';

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

export function initMusicKitPlayer({ getURL, getSong, getSongs, onTrackChange, isActive, onBusy }) {
  const $ = id => document.getElementById(id);
  const loop = new SegmentLoop();
  let music = null, busy = false, connectedToken = '', expiresAt = 0, queuedURL = '', lastItemId = '';
  let lastSample = null, timeUpdates = 0, seekCount = 0;
  let tokenSource = '', configChecked = false;
  const PRACTICE_KEY = 'hibi-uta-practice-v1';
  let practice = sanitizePractice(null);
  try { practice = sanitizePractice(JSON.parse(localStorage.getItem(PRACTICE_KEY) || 'null')); } catch {}
  let plan = [], settingQueue = false, clipsRenderKey = '', deletedClip = null;
  const songIds = new Map();
  $('mk-listen-mode').value = practice.mode;
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
  const lyrics = initLyricsPanel({
    playLine: ({ mode, a, b, trackId, url }) => operation(async () => {
      ensureFresh();
      if (!music.isAuthorized || queuedURL !== url || getURL().href !== url || String(music.nowPlayingItem?.id || '') !== trackId) throw localError('歌曲已改变，请等待当前歌曲的歌词载入。');
      stopSegment();
      if (mode === 'continue') {
        loop.reset(); updateRangeFields(); await seek(a); await music.play();
        status('从这一句继续跟唱。');
      } else {
        try { validateRange(a, b, music.currentPlaybackDuration); } catch (e) { throw localError(e.message); }
        loop.markA(a); loop.markB(b); updateRangeFields(); await startSegment(mode === 'once');
      }
      sample();
    }),
    stopLine: () => { if (!busy && !loop.seeking) { stopSegment(); refresh(); } },
  });
  function resetMeasurements() { lastSample = null; timeUpdates = 0; seekCount = 0; }
  function refresh() {
    const locked = busy || loop.seeking;
    const authorized = !!music?.isAuthorized;
    const selectedLoaded = !!music && queuedURL === getURL().href;
    const hasTime = selectedLoaded && Number.isFinite(music.currentPlaybackDuration) && music.currentPlaybackDuration > 0;
    const playing = selectedLoaded && !!music.isPlaying;
    $('mk-connection-state').textContent = !music ? (configChecked ? '等待连接' : '正在读取网站配置') : authorized ? 'Apple Music 已授权' : '已连接 · 等待 Apple 授权';
    $('mk-token-expiry').textContent = expiresAt ? (tokenSource === 'site' ? '网站共享' : '本机令牌') + ' · 到期：' + new Date(expiresAt * 1000).toLocaleDateString('zh-CN') : '共享配置会自动读取，也可手动导入 Mac 上生成的 .txt。';
    $('mk-connect').disabled = locked || !!music;
    $('mk-file').disabled = locked || !!music;
    $('mk-token').disabled = locked || !!music;
    $('mk-remember').disabled = locked || !!music;
    $('mk-authorize').disabled = locked || !music || authorized;
    $('mk-auth-actions').hidden = authorized;
    $('mk-authorize').textContent = authorized ? '已授权' : '授权 Apple Music';
    $('mk-clear').disabled = locked;
    $('mk-clear').textContent = tokenSource === 'site' ? '重置本机授权' : '清除本机连接';
    $('mk-play').disabled = locked || !authorized;
    $('mk-play').textContent = playing ? '暂停' : selectedLoaded ? '播放' : '播放这首歌';
    for (const id of ['mk-back','mk-forward','mk-seek','mk-jump','mk-jump-time','mk-mark-a','mk-mark-b','mk-restart','mk-range-a','mk-range-b','mk-apply-range','mini-back']) $(id).disabled = locked || !hasTime;
    $('mk-loop').disabled = locked || !hasTime || loop.a === null || loop.b === null;
    $('mk-loop').textContent = loop.enabled && !loop.once ? '停止循环' : '循环练';
    $('mk-loop').setAttribute('aria-pressed', String(loop.enabled && !loop.once));
    $('mk-reset-loop').disabled = locked || loop.a === null;
    $('mk-a').textContent = loop.a === null ? '未标记' : formatTime(loop.a);
    $('mk-b').textContent = loop.b === null ? '未标记' : formatTime(loop.b);
    $('mk-once').disabled = $('mk-loop').disabled;
    $('mk-save-clip').disabled = $('mk-loop').disabled;
    $('mk-listen-mode').disabled = locked;
    $('mk-previous').disabled = $('mk-next').disabled = locked || !authorized || plan.length < 2;
    $('mk-queue-note').textContent = practice.mode === 'playlist' ? '从当前歌曲起，三首依次播放并循环。' : practice.mode === 'repeat' ? '反复听这首歌，熟悉每一次发音与换气。' : '完整听完这一首后停止。';
    $('mk-practice-state').textContent = loop.enabled ? (loop.once ? '正在听这个片段，结束后暂停。' : `循环练习中 · 已完成 ${loop.passes} 遍`) : loop.a !== null && loop.b !== null ? `已选 ${formatTime(loop.a)} — ${formatTime(loop.b)}${loop.passes ? ' · 已完成 ' + loop.passes + ' 遍' : ''}` : '还没有选定片段。';
    $('mini-player').hidden = !isActive() || !authorized;
    $('mini-title').textContent = getSong().title;
    $('mini-state').textContent = playing ? '正在播放' : selectedLoaded ? '已暂停' : '点播放开始';
    $('mini-play').disabled = locked || !authorized;
    $('mini-play').textContent = playing ? '暂停' : '播放';
    renderClips(authorized, locked);
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
    lyrics.update({
      active: isActive(), loaded: selectedLoaded && !settingQueue, authorized, busy: locked,
      url: getURL().href, trackId: selectedLoaded ? String(item?.id || '') : '', time, duration,
      catalogDuration: Number(item?.attributes?.durationInMillis) > 0 ? Number(item.attributes.durationInMillis) / 1000 : 0,
      title: item?.attributes?.name || '', artist: item?.attributes?.artistName || '', album: item?.attributes?.albumName || '',
    });
  }
  async function operation(task) {
    if (busy || loop.seeking) return;
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
  function syncRepeatMode() {
    if (!music) return;
    const modes = window.MusicKit.PlayerRepeatMode;
    music.repeatMode = loop.enabled ? modes.none : practice.mode === 'repeat' ? modes.one : practice.mode === 'playlist' ? modes.all : modes.none;
  }
  function stopSegment() { loop.enabled = false; syncRepeatMode(); }
  function updateRangeFields() {
    $('mk-range-a').value = loop.a === null ? '' : String(loop.a);
    $('mk-range-b').value = loop.b === null ? '' : String(loop.b);
  }
  function sample() {
    if (!music || !isActive() || settingQueue) return;
    const id = String(music.nowPlayingItem?.id || '');
    if (id && id !== lastItemId) {
      loop.reset(); lastItemId = id; lastSample = null; updateRangeFields(); syncRepeatMode();
      const current = plan.find(item => item.id === id);
      if (current) { queuedURL = current.url; onTrackChange(current.key); }
    }
    const time = music.currentPlaybackTime;
    if (queuedURL === getURL().href && Number.isFinite(time) && time !== lastSample) { lastSample = time; timeUpdates += 1; }
    refresh();
    const states = window.MusicKit.PlaybackStates;
    const ended = !!states && ((states.ended !== undefined && music.playbackState === states.ended) || (states.completed !== undefined && music.playbackState === states.completed)) && queuedURL === getURL().href && id === lastItemId;
    if (!busy) loop.tick({ time, playing: music.isPlaying, ended, visible: document.visibilityState === 'visible' }, async (target, details) => {
      await seek(target);
      if (details.ended) await music.play();
    }, async () => {
      await music.pause(); status('这一遍听完了。准备好后，再听一次。');
    }).then(completed => { if (completed) { syncRepeatMode(); refresh(); } })
      .catch(error => { syncRepeatMode(); status('片段练习已停止。' + failure(error), true); refresh(); });
  }
  function savePractice() {
    try { localStorage.setItem(PRACTICE_KEY, JSON.stringify(practice)); return true; }
    catch { return false; }
  }
  function renderClips(authorized, locked) {
    const clips = practice.clips.filter(c => c.url === getURL().href);
    const key = getURL().href + JSON.stringify(clips);
    if (key !== clipsRenderKey) {
      clipsRenderKey = key;
      $('mk-clips').replaceChildren();
      for (const clip of clips) {
        const row = document.createElement('article'); row.className = 'saved-clip'; row.dataset.clip = clip.id;
        const heading = document.createElement('div'); heading.className = 'clip-title';
        const title = document.createElement('strong'); title.textContent = clip.name;
        const time = document.createElement('span'); time.textContent = formatTime(clip.a) + ' — ' + formatTime(clip.b);
        heading.append(title, time);
        const actions = document.createElement('div'); actions.className = 'clip-actions';
        for (const [label, once] of [['听一遍', true], ['循环练', false]]) {
          const button = document.createElement('button'); button.type = 'button'; button.className = 'secondary clip-play'; button.textContent = label;
          button.setAttribute('aria-label', label + '：' + clip.name);
          button.addEventListener('click', () => operation(async () => {
            ensureFresh();
            if (queuedURL !== getURL().href) await loadQueue();
            if (String(music.nowPlayingItem?.id || '') !== clip.trackId) throw localError('歌曲版本已改变，请重新标记片段。');
            try { validateRange(clip.a, clip.b, music.currentPlaybackDuration); } catch (e) { throw localError(e.message); }
            loop.markA(clip.a); loop.markB(clip.b); updateRangeFields();
            await startSegment(once);
          }));
          actions.append(button);
        }
        const remove = document.createElement('button'); remove.type = 'button'; remove.className = 'text-button clip-delete'; remove.textContent = '移除'; remove.setAttribute('aria-label', '移除片段：' + clip.name);
        remove.addEventListener('click', () => {
          deletedClip = clip; practice.clips = practice.clips.filter(c => c.id !== clip.id);
          const stored = savePractice(); $('mk-undo-delete').hidden = false; refresh();
          status(stored ? '片段已移除，可以撤销。' : '本次已移除，但浏览器无法保存修改。');
        });
        actions.append(remove); row.append(heading, actions); $('mk-clips').append(row);
      }
      $('mk-clip-count').textContent = String(clips.length);
      $('mk-clips-empty').hidden = clips.length > 0;
    }
    $('mk-clips').querySelectorAll('.clip-play').forEach(button => { button.disabled = locked || !authorized; });
    $('mk-clips').querySelectorAll('.saved-clip').forEach(row => {
      const clip = clips.find(c => c.id === row.dataset.clip);
      row.classList.toggle('active', !!clip && loop.enabled && clip.a === loop.a && clip.b === loop.b);
    });
  }
  async function loadQueue({ position = 0 } = {}) {
    ensureFresh();
    if (!music.isAuthorized) throw localError('请先授权 Apple Music。');
    let next;
    try {
      next = await buildQueuePlan(getSongs(), getSong().key, practice.mode, async (song, albumId) => {
        if (songIds.has(song.url)) return songIds.get(song.url);
        const region = new URL(song.url).pathname.split('/')[1];
        const response = await music.api.music(`/v1/catalog/${region}/albums/${albumId}`, { include: 'tracks' });
        const id = chooseAlbumSong(response, song.title); songIds.set(song.url, id); return id;
      });
    } catch { throw localError('歌曲队列未能载入，请检查网络或换用单曲链接。也可以切回「这首听一遍」。'); }
    settingQueue = true;
    try {
      loop.reset(); resetMeasurements(); updateRangeFields();
      await music.setQueue({ songs: next.map(item => item.id), startPlaying: false });
      plan = next; queuedURL = next[0].url; lastItemId = '';
      music.shuffleMode = window.MusicKit.PlayerShuffleMode.off;
      syncRepeatMode();
      if (position > 0) await music.seekToTime(position);
    } catch (e) { queuedURL = ''; plan = []; throw e; }
    finally { settingQueue = false; }
    sample();
  }
  async function startSegment(once) {
    // A native playlist can advance before a foreground timer observes the end.
    // At that boundary, constrain the queue before starting the segment.
    let isolatedEnd = false;
    if (plan.length > 1 && loop.b >= music.currentPlaybackDuration - 0.05) {
      const a = loop.a, b = loop.b, previous = practice.mode;
      practice.mode = 'single';
      try { await loadQueue(); loop.markA(a); loop.markB(b); updateRangeFields(); isolatedEnd = true; savePractice(); }
      catch (error) { practice.mode = previous; syncRepeatMode(); throw error; }
      $('mk-listen-mode').value = practice.mode;
    }
    try { loop.start({ once }); } catch (e) { throw localError(e.message); }
    syncRepeatMode();
    try { await seek(loop.a); await music.play(); status((isolatedEnd ? '末句练习已切回单曲播放。' : '') + (once ? '听完选段后暂停。请保持页面在前台。' : '正在循环这个片段，请保持页面在前台。')); }
    catch (e) { stopSegment(); throw e; }
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
      await kit.configure({ developerToken: parsed.token, app: { name: '日々うた', build: '8' }, storefrontId: 'cn' });
      music = kit.getInstance();
      if (!music) throw localError('MusicKit 初始化未完成，请重新连接。');
      connectedToken = parsed.token; expiresAt = parsed.expiresAt; tokenSource = source; syncRepeatMode();
      for (const name of ['playbackTimeDidChange','playbackStateDidChange','playbackDurationDidChange','nowPlayingItemDidChange','authorizationStatusDidChange']) music.addEventListener(name, sample);
      music.addEventListener('mediaPlaybackError', () => { stopSegment(); status('Apple 播放出错，请确认歌曲在当前会员地区可用后重试。', true); refresh(); });
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
  const play = () => operation(async () => {
    ensureFresh();
    if (!music.isAuthorized) throw localError('请先授权 Apple Music。');
    if (queuedURL !== getURL().href) {
      status('正在载入 ' + getSong().title + '…'); await loadQueue(); await music.play();
    } else if (music.isPlaying) await music.pause();
    else await music.play();
    status(music.isPlaying ? '正在播放，跟着原唱慢慢唱。' : '已暂停，准备好后继续。'); sample();
  });
  $('mk-play').addEventListener('click', play);
  $('mini-play').addEventListener('click', play);
  $('mk-listen-mode').addEventListener('change', () => operation(async () => {
    const previous = practice.mode, next = $('mk-listen-mode').value;
    const loaded = !!music && queuedURL === getURL().href, playing = !!music?.isPlaying;
    const position = loaded && Number.isFinite(music.currentPlaybackTime) ? music.currentPlaybackTime : 0;
    practice.mode = next; stopSegment();
    try {
      if (loaded && (previous === 'playlist' || next === 'playlist') && next !== previous) {
        await loadQueue({ position }); if (playing) await music.play();
      } else syncRepeatMode();
      const stored = savePractice(); status('已切换听歌方式。' + (stored ? '' : '此浏览器无法保存偏好。'));
    } catch (e) { practice.mode = previous; $('mk-listen-mode').value = previous; syncRepeatMode(); throw e; }
  }));
  for (const [id, delta] of [['mk-previous', -1], ['mk-next', 1]]) $(id).addEventListener('click', () => operation(async () => {
    ensureFresh(); if (plan.length < 2) return;
    stopSegment(); loop.reset(); updateRangeFields();
    const index = plan.findIndex(item => item.id === String(music.nowPlayingItem?.id || ''));
    await music.changeToMediaAtIndex((Math.max(0, index) + delta + plan.length) % plan.length); sample();
    status('正在播放 ' + getSong().title + '。');
  }));
  const jump = time => operation(async () => { stopSegment(); await seek(time); status('已跳转，可以继续跟唱。'); });
  $('mk-back').addEventListener('click', () => jump(music.currentPlaybackTime - 5));
  $('mini-back').addEventListener('click', () => jump(music.currentPlaybackTime - 5));
  $('mk-forward').addEventListener('click', () => jump(music.currentPlaybackTime + 5));
  $('mk-restart').addEventListener('click', () => jump(0));
  $('mk-seek').addEventListener('change', () => jump(Number($('mk-seek').value)));
  $('mk-jump-form').addEventListener('submit', event => { event.preventDefault(); if (!$('mk-jump-time').value.trim()) return; jump(Number($('mk-jump-time').value)); });
  for (const [id, method] of [['mk-mark-a', 'markA'], ['mk-mark-b', 'markB']]) $(id).addEventListener('click', () => {
    try { stopSegment(); loop[method](music.currentPlaybackTime); updateRangeFields(); status('已标记 ' + (method === 'markA' ? '起点 A' : '终点 B') + '。'); }
    catch (e) { status(e.message, true); } refresh();
  });
  $('mk-range-form').addEventListener('submit', event => {
    event.preventDefault();
    try {
      const { a, b } = validateRange(parseTime($('mk-range-a').value), parseTime($('mk-range-b').value), music.currentPlaybackDuration);
      stopSegment(); loop.markA(a); loop.markB(b); updateRangeFields(); status('选段时间已调整。');
    } catch (e) { status(e.message, true); } refresh();
  });
  $('mk-once').addEventListener('click', () => operation(() => startSegment(true)));
  $('mk-loop').addEventListener('click', () => operation(async () => {
    if (loop.enabled && !loop.once) { stopSegment(); status('已停止片段循环，继续完整听。'); return; }
    await startSegment(false);
  }));
  $('mk-reset-loop').addEventListener('click', () => { stopSegment(); loop.reset(); updateRangeFields(); refresh(); status('已清除 A / B 标记。'); });
  $('mk-save-clip-form').addEventListener('submit', event => {
    event.preventDefault();
    try {
      const range = validateRange(loop.a, loop.b, music.currentPlaybackDuration);
      practice.clips = upsertClip(practice.clips, { id: globalThis.crypto?.randomUUID?.() || Date.now().toString(36) + '-' + Math.random().toString(36).slice(2), url: getURL().href, trackId: String(music.nowPlayingItem?.id || ''), name: $('mk-clip-name').value.trim() || '练习片段 ' + formatTime(range.a), ...range });
      const stored = savePractice(); $('mk-clip-name').value = ''; refresh();
      status(stored ? '片段已保存，下次打开这首歌还在。' : '片段保留在当前页面；此浏览器无法保存，关闭后会丢失。', !stored);
    } catch (e) { status(e.message, true); }
  });
  $('mk-undo-delete').addEventListener('click', () => {
    if (!deletedClip) return;
    try { practice.clips = upsertClip(practice.clips, deletedClip); deletedClip = null; $('mk-undo-delete').hidden = true; const stored = savePractice(); refresh(); status(stored ? '片段已恢复。' : '本次已恢复，但浏览器无法保存修改。'); }
    catch (e) { status(e.message, true); }
  });
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState !== 'visible' && loop.enabled) { stopSegment(); status('已切回整首播放。片段练习需回到页面后重新开启。'); }
    sample();
  });
  // Poll only the SDK's actual position to refresh the visible UI; never advance an independent clock.
  setInterval(() => { if (document.visibilityState === 'visible') sample(); }, 500);
  refresh();
  if (isActive()) bootstrap();
  return {
    async suspend() {
      return operation(async () => {
        stopSegment(); loop.reset(); updateRangeFields();
        if (music) await music.pause();
        return true;
      });
    },
    async selectionChanged() {
      return operation(async () => {
        if (music) await music.stop();
        queuedURL = ''; lastItemId = ''; plan = []; stopSegment(); loop.reset(); updateRangeFields(); resetMeasurements();
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
