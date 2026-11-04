/* Lazy Kuromoji 0.1.2 / IPADIC worker. Text stays in this browser.
 * Upstream: https://github.com/takuyaa/kuromoji.js (Apache-2.0)
 * Dictionary notices: https://cdn.jsdelivr.net/npm/kuromoji@0.1.2/NOTICE.md
 */
'use strict';
const ROOT = 'https://cdn.jsdelivr.net/npm/kuromoji@0.1.2/';
const PREFIX = '/hibi-uta-kuromoji-dictionary/';

// Kuromoji uses path.join, which normalizes https:// to https:/. Give it a
// local prefix and map only its fixed dictionary filenames to the pinned CDN.
const NativeXHR = self.XMLHttpRequest;
const FILES = new Set(['base.dat.gz', 'check.dat.gz', 'tid.dat.gz', 'tid_pos.dat.gz', 'tid_map.dat.gz', 'cc.dat.gz', 'unk.dat.gz', 'unk_pos.dat.gz', 'unk_map.dat.gz', 'unk_char.dat.gz', 'unk_compat.dat.gz', 'unk_invoke.dat.gz']);
self.XMLHttpRequest = class extends NativeXHR {
  constructor() { super(); this.addEventListener('timeout', () => this.onerror?.(new Event('error'))); }
  open(method, url, ...args) {
    const filename = String(url).slice(PREFIX.length);
    if (method !== 'GET' || !String(url).startsWith(PREFIX) || !FILES.has(filename)) throw new Error('Unexpected dictionary request');
    super.open('GET', ROOT + 'dict/' + filename, ...args);
    this.timeout = 75000;
    this.withCredentials = false;
  }
};
let tokenizerPromise;
function tokenizer() {
  if (!tokenizerPromise) tokenizerPromise = new Promise((resolve, reject) => {
    try {
      importScripts(ROOT + 'build/kuromoji.js');
      self.kuromoji.builder({ dicPath: PREFIX }).build((error, ready) => error ? reject(new Error('Dictionary unavailable')) : resolve(ready));
    } catch { reject(new Error('Dictionary unavailable')); }
  });
  return tokenizerPromise;
}
self.onmessage = async ({ data }) => {
  const id = data?.id;
  try {
    const lines = data?.lines;
    if (!Number.isInteger(id) || !Array.isArray(lines) || lines.length > 500 || lines.some(line => typeof line !== 'string' || line.length > 2000) || lines.reduce((n, line) => n + line.length, 0) > 100000) throw new Error('Invalid input');
    const ready = await tokenizer();
    const tokens = lines.map(line => ready.tokenize(line).map(({ surface_form, word_type, reading }) => ({ surface_form, word_type, reading })));
    self.postMessage({ id, tokens });
  } catch { self.postMessage({ id, error: true }); }
};
