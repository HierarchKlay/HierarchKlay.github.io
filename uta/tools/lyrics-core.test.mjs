import test from 'node:test';
import assert from 'node:assert/strict';
import { parseLRC, activeLineAt, lineRange, selectLyricsCandidate, findLyrics } from '../lyrics-core.mjs';

// Original test text, not song lyrics.
const metadata = { title: '練習', artist: 'テスト', album: '学習', duration: 120 };
const record = (overrides = {}) => ({ id: 1, trackName: '練習', artistName: 'テスト', albumName: '学習', duration: 120, syncedLyrics: '[00:10.50]声を出す\n[00:20.00]\n[00:30.00]もう一度', plainLyrics: '声を出す\nもう一度', instrumental: false, ...overrides });

test('LRC: offsets, repeated lines, interludes, invalid timestamps and input bounds', () => {
  const lines = parseLRC('[ar:テスト]\n[offset:500]\n[00:20.0][00:10.50]声を出す\n[00:20.00]もう一度\n[00:25.00]\n[00:60.00]invalid\n[00:30.00] <00:30.00>練習');
  assert.deepEqual(lines, [{ time: 10, text: '声を出す' }, { time: 19.5, text: '声を出す\nもう一度' }, { time: 24.5, text: '' }, { time: 29.5, text: '練習' }]);
  assert.deepEqual(parseLRC('a'.repeat(200001)), []);
  assert.deepEqual(parseLRC('[00:01]声\n'.repeat(2001)), []);
  assert.deepEqual(parseLRC('[00:59.999]声\n[not time]x'), [{ time: 59.999, text: '声' }]);
});

test('Timeline uses real time, blanks and reversible display delay, without invented ends', () => {
  const lines = parseLRC(record().syncedLyrics);
  assert.equal(activeLineAt(lines, 9), -1);
  assert.equal(activeLineAt(lines, 10.5), 0);
  assert.equal(activeLineAt(lines, 21), 1);
  assert.equal(activeLineAt(lines, 10.5, 1), -1);
  assert.equal(activeLineAt(lines, 11.5, 1), 0);
  assert.equal(activeLineAt(lines, NaN), -1);
  assert.deepEqual(lineRange(lines, 0, 120, 1), { a: 11.5, b: 21 });
  assert.equal(lineRange(lines, 1, 120), null);
  assert.deepEqual(lineRange(lines, 2, 120), { a: 30, b: 120 });
  assert.equal(lineRange(lines, 2, NaN), null);
  assert.equal(lineRange(lines, 2, 30.5), null);
});

test('Matching rejects wrong singers, versions and ambiguous timelines', () => {
  assert.equal(selectLyricsCandidate([record({ duration: 90 })], metadata), null);
  assert.equal(selectLyricsCandidate([record({ trackName: '練習 Live' })], metadata), null);
  assert.equal(selectLyricsCandidate([record({ artistName: '他人' })], metadata), null);
  assert.equal(selectLyricsCandidate([record(), record({ id: 2, syncedLyrics: '[00:11.00]声を出す' })], metadata), null);
  assert.equal(selectLyricsCandidate([record({ id: 2, albumName: '別盤' }), record()], metadata).id, 1);
  assert.equal(selectLyricsCandidate([record({ artistName: ' テスト ', duration: 122 })], metadata).id, 1);
  assert.equal(selectLyricsCandidate([record({ duration: 122.01 })], metadata), null);
});

test('Only explicit aliases match; unsynced lyrics remain unsynced', () => {
  const roman = record({ trackName: 'Renshu', artistName: 'Test', syncedLyrics: null });
  assert.equal(selectLyricsCandidate([roman], metadata), null);
  const selected = selectLyricsCandidate([roman], { ...metadata, titleAliases: ['Renshu'], artistAliases: ['Test'] });
  assert.equal(selected.lines.length, 0);
  assert.equal(selected.plainLines.length, 2);
});

test('All equally ranked candidates must agree, including candidates after duplicate records', () => {
  const divergent = record({ id: 3, syncedLyrics: '[00:11.00]声を出す' });
  assert.equal(selectLyricsCandidate([record(), record({ id: 2 }), divergent], metadata), null);
  assert.equal(selectLyricsCandidate([record(), record({ id: 2 }), { ...divergent, albumName: '別盤' }], metadata).id, 1);
  assert.equal(selectLyricsCandidate([record(), record({ id: 2 }), record({ id: 3 })], metadata).id, 1);
});

test('Timeline must fit both record and playback durations, allowing only 0.5 seconds of rounding', () => {
  assert.equal(selectLyricsCandidate([record({ syncedLyrics: '[02:00.60]声を出す' })], metadata), null);
  assert.equal(selectLyricsCandidate([record({ duration: 119, syncedLyrics: '[02:00.00]声を出す' })], metadata), null);
  assert.equal(selectLyricsCandidate([record({ duration: 122, syncedLyrics: '[02:01.00]声を出す' })], metadata), null);
  const roundedEnd = record({ syncedLyrics: '[00:10]声を出す\n[02:00.50]' });
  assert.equal(selectLyricsCandidate([roundedEnd], metadata).lines.length, 2);
  assert.equal(selectLyricsCandidate([record({ syncedLyrics: '[offset:-1000]\n[02:00.00]声を出す' })], metadata), null);
});

test('Fetch identifies client, excludes credentials, falls back to explicit aliases only', async () => {
  const calls = [];
  const result = await findLyrics({ ...metadata, titleAliases: ['Renshu'], artistAliases: ['Test'] }, { fetchImpl: async (url, options) => {
    calls.push({ url: new URL(url), options });
    return new Response(JSON.stringify(calls.length === 3 ? [record({ trackName: 'Renshu', artistName: 'Test' })] : []), { status: 200 });
  } });
  assert.equal(result.id, 1);
  assert.equal(calls.length, 3);
  assert.equal(calls[0].url.pathname, '/api/get');
  assert.equal(calls[2].url.searchParams.get('track_name'), 'Renshu');
  assert.equal(calls[0].options.credentials, 'omit');
  assert.equal(calls[0].options.redirect, 'error');
  assert.match(calls[0].options.headers['Lrclib-Client'], /Hibi Uta/);
  assert.equal('Authorization' in calls[0].options.headers, false);
});

test('Fetch returns exact timed result immediately and reports bounded static failures', async () => {
  let count = 0;
  const result = await findLyrics(metadata, { fetchImpl: async () => { count++; return new Response(JSON.stringify(record())); } });
  assert.equal(result.lines.length, 3); assert.equal(count, 1);
  await assert.rejects(findLyrics(metadata, { fetchImpl: async () => { throw new Error('secret transport details'); } }), { message: 'LYRICS_UNAVAILABLE' });
  await assert.rejects(findLyrics(metadata, { fetchImpl: async () => new Response('', { status: 429 }) }), { message: 'LYRICS_RATE_LIMITED' });
  await assert.rejects(findLyrics(metadata, { fetchImpl: async () => new Response('x'.repeat(2000001)) }), { message: 'LYRICS_UNAVAILABLE' });
  const controller = new AbortController(); controller.abort();
  await assert.rejects(findLyrics(metadata, { signal: controller.signal, fetchImpl: () => assert.fail('should not fetch') }), { name: 'AbortError' });
});
