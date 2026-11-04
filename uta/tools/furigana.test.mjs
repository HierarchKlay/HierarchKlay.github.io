import test from 'node:test';
import assert from 'node:assert/strict';
import { toHiragana, splitFurigana, annotateTokens, annotateLines } from '../furigana.mjs';

test('readings preserve okurigana and whole-kanji compound readings', () => {
  assert.equal(toHiragana('キャット・ミュージック'), 'きゃっと・みゅーじっく');
  assert.deepEqual(splitFurigana('取り戻す', 'トリモドス'), [{ text: '取', reading: 'と' }, { text: 'り' }, { text: '戻', reading: 'もど' }, { text: 'す' }]);
  assert.deepEqual(splitFurigana('お祝い', 'オイワイ'), [{ text: 'お' }, { text: '祝', reading: 'いわ' }, { text: 'い' }]);
  assert.deepEqual(splitFurigana('明後日', 'アサッテ'), [{ text: '明後日', reading: 'あさって' }]);
  assert.deepEqual(splitFurigana('時々', 'トキドキ'), [{ text: '時々', reading: 'ときどき' }]);
});

test('uncertain, malformed, and unknown readings stay plain', () => {
  assert.deepEqual(splitFurigana('漢あ字', 'カアアジ'), [{ text: '漢あ字' }]);
  assert.deepEqual(splitFurigana('食べる', 'タベルX'), [{ text: '食べる' }]);
  assert.deepEqual(splitFurigana('猫', '*'), [{ text: '猫' }]);
  assert.deepEqual(annotateTokens('猫', [{ surface_form: '猫', word_type: 'UNKNOWN', reading: 'ネコ' }]), [{ text: '猫' }]);
});

test('token conversion preserves punctuation, whitespace, and mismatched input', () => {
  const text = '  猫、猫!';
  const tokens = [{ surface_form: '猫', word_type: 'KNOWN', reading: 'ネコ' }, { surface_form: '、', word_type: 'KNOWN', reading: '、' }, { surface_form: '猫', word_type: 'KNOWN', reading: 'ネコ' }];
  const result = annotateTokens(text, tokens);
  assert.equal(result.map(token => token.text).join(''), text);
  assert.equal(result.filter(token => token.reading === 'ねこ').length, 2);
  assert.deepEqual(annotateTokens('猫', [{ surface_form: '犬', word_type: 'KNOWN', reading: 'イヌ' }]), [{ text: '猫' }]);
});

test('kana-only text never loads a worker; invalid input rejects', async () => {
  assert.deepEqual(await annotateLines(['こんにちは', '', '7co']), [[{ text: 'こんにちは' }], [{ text: '' }], [{ text: '7co' }]]);
  await assert.rejects(annotateLines([null]), /歌词过长/);
  await assert.rejects(annotateLines(['猫'.repeat(2001)]), /歌词过长/);
});
