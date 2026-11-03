import test from 'node:test';
import assert from 'node:assert/strict';
import { parseTime, validateRange, chooseAlbumSong, buildQueuePlan, sanitizePractice, upsertClip } from '../practice-core.mjs';
import { SegmentLoop } from '../player-core.mjs';

test('time editing accepts seconds and mm:ss, rejects ambiguous and out-of-song ranges', () => {
  assert.equal(parseTime('1:08.5'), 68.5);
  assert.equal(parseTime('42.5'), 42.5);
  for (const value of ['', '-1', '1:60', '1:2:3', 'Infinity', 'NaN']) assert.throws(() => parseTime(value));
  assert.deepEqual(validateRange(1.234, 5.678, 10), { a: 1.23, b: 5.68 });
  for (const range of [[-1, 10], [5, 5.5], [5, 11], [NaN, 8]]) assert.throws(() => validateRange(...range, 10));
});

test('album resolution chooses the named song rather than the first album track', () => {
  const tracks = [{ type: 'songs', id: '11', attributes: { name: 'Another song' } }, { type: 'songs', id: '12', attributes: { name: 'ＲＡＩＮ' } }];
  const response = { data: { data: [{ relationships: { tracks: { data: tracks } } }] } };
  assert.equal(chooseAlbumSong(response, 'Rain'), '12');
  assert.throws(() => chooseAlbumSong(response, 'not present'), /唯一/);
  tracks.push({ ...tracks[1], id: '13' });
  assert.throws(() => chooseAlbumSong(response, 'Rain'), /唯一/);
  assert.throws(() => chooseAlbumSong({ data: [] }, 'Rain'), /专辑/);
});

test('continuous queue starts at selected song and includes each track once; single mode does not load other albums', async () => {
  const songs = [
    { key: 'rain', url: 'https://music.apple.com/cn/album/10?i=11' },
    { key: 'next', url: 'https://music.apple.com/cn/album/20' },
    { key: 'last', url: 'https://music.apple.com/cn/song/31' },
  ];
  const calls = [];
  const resolve = async (song, album) => { calls.push(album); return '21'; };
  const plan = await buildQueuePlan(songs, 'next', 'playlist', resolve);
  assert.deepEqual(plan.map(x => x.id), ['21', '31', '11']);
  assert.deepEqual(plan.map(x => x.key), ['next', 'last', 'rain']);
  assert.deepEqual(calls, ['20']);
  calls.length = 0;
  assert.equal((await buildQueuePlan(songs, 'rain', 'repeat', resolve)).length, 1);
  assert.deepEqual(calls, []);
  await assert.rejects(buildQueuePlan(songs, 'missing', 'playlist', resolve));
  await assert.rejects(buildQueuePlan(songs, 'next', 'playlist', async () => { throw Error('unavailable'); }));
});

const clip = { id: 'clip-1', url: 'https://music.apple.com/cn/song/11', trackId: '11', name: '副歌换气', a: 10, b: 20 };
test('saved practice data keeps only valid bounded records, drops credentials, and deduplicates saves', () => {
  const clean = sanitizePractice({ mode: 'playlist', developerToken: 'should-not-survive', clips: [clip, { ...clip }, { ...clip, id: 'bad', a: -1 }, { ...clip, id: 'evil', url: 'https://other.example' }] });
  assert.deepEqual(clean, { mode: 'playlist', clips: [clip] });
  assert.deepEqual(sanitizePractice(null), { mode: 'single', clips: [] });
  const updated = upsertClip(clean.clips, { ...clip, id: 'new-id', name: '新名字' });
  assert.equal(updated.length, 1); assert.equal(updated[0].id, clip.id); assert.equal(updated[0].name, '新名字');
  assert.equal(upsertClip(updated, { ...clip, id: 'next-id', trackId: '22' }).length, 2);
});

test('one-pass segment pauses once at its end and does not seek back', async () => {
  const loop = new SegmentLoop(); loop.markA(10); loop.markB(20); loop.start({ once: true });
  const actions = [];
  const seek = async t => actions.push(['seek', t]), pause = async () => actions.push(['pause']);
  assert.equal(await loop.tick({ time: 21, playing: true, visible: false }, seek, pause), false);
  assert.equal(await loop.tick({ time: 19, playing: true, visible: true }, seek, pause), false);
  assert.equal(await loop.tick({ time: 20, playing: true, visible: true }, seek, pause), true);
  assert.equal(await loop.tick({ time: 21, playing: true, visible: true }, seek, pause), false);
  assert.deepEqual(actions, [['pause']]); assert.equal(loop.enabled, false); assert.equal(loop.passes, 1);
});

test('repeat count changes only after completed seeks, and stale operations cannot count for a new selection', async () => {
  const loop = new SegmentLoop(); loop.markA(1); loop.markB(5); loop.start();
  let finish;
  const pending = loop.tick({ time: 5, playing: true, visible: true }, () => new Promise(resolve => { finish = resolve; }));
  assert.equal(loop.passes, 0);
  loop.reset(); loop.markA(20); loop.markB(25); finish(); await pending;
  assert.equal(loop.passes, 0); assert.equal(loop.a, 20);
  loop.start(); await loop.tick({ time: 25, playing: true, visible: true }, async () => {});
  assert.equal(loop.passes, 1);
});
