import test from 'node:test';
import assert from 'node:assert/strict';
import { fetchSiteConfig, resolveDeveloperToken } from '../token-config.mjs';

const now = 1800000000, origin = 'https://hierarchklay.github.io';
const fakeJWT = changes => {
  const enc = obj => Buffer.from(JSON.stringify(obj)).toString('base64url');
  return [enc({ alg: 'ES256', kid: 'KEY0000001' }), enc({ iss: 'TEAM000001', iat: now, exp: now + 2592000, origin: [origin], ...changes }), Buffer.alloc(64).toString('base64url')].join('.');
};
const resolve = options => resolveDeveloperToken({ origin, now, ...options });

test('new devices use the site token without local storage and rotations take precedence', async () => {
  const first = fakeJWT(), rotated = fakeJWT({ exp: now + 3600 });
  const fresh = await resolve({ fetchConfig: async () => ({ developerToken: first }), readLocal: () => { throw Error('storage blocked'); } });
  assert.equal(fresh.source, 'site');
  assert.equal(fresh.parsed.token, first);
  const next = await resolve({ fetchConfig: async () => ({ developerToken: rotated }), readLocal: () => first });
  assert.equal(next.parsed.token, rotated);
  assert.equal(next.source, 'site');
});

test('empty, missing, malformed, expired and wrong-origin shared configuration permit a valid local fallback', async () => {
  const local = fakeJWT();
  for (const value of [
    { developerToken: '' }, null, {}, { developerToken: 'not-a-token' },
    { developerToken: fakeJWT({ iat: now - 3600, exp: now - 1 }) },
    { developerToken: fakeJWT({ origin: ['https://other.example'] }) },
    { developerToken: '-----BEGIN PRIVATE KEY-----' },
  ]) {
    const result = await resolve({ fetchConfig: async () => value, readLocal: () => local });
    assert.equal(result.source, 'local');
    assert.equal(result.parsed.token, local);
    assert.notEqual(result.sharedState, 'ready');
  }
  const offline = await resolve({ fetchConfig: async () => { throw Error('network'); }, readLocal: () => local });
  assert.equal(offline.source, 'local');
});

test('unusable sources leave manual setup available without leaking errors or credentials', async () => {
  const result = await resolve({ fetchConfig: async () => { throw Error('sensitive transport detail'); }, readLocal: () => fakeJWT({ exp: now - 1, iat: now - 3600 }) });
  assert.equal(result.parsed, null);
  assert.equal(result.source, null);
  assert.doesNotMatch(result.notice, /sensitive|eyJ/);
  const empty = await resolve({ fetchConfig: async () => ({ developerToken: '' }), readLocal: () => null });
  assert.equal(empty.sharedState, 'empty');
  assert.equal(empty.parsed, null);
});

test('configuration requests bypass browser cache, have no credentials in URL, and fail safely', async () => {
  const result = await fetchSiteConfig(async (url, options) => {
    assert.equal(url.search, '');
    assert.ok(url.pathname.endsWith('/musickit-config.json'));
    assert.equal(options.cache, 'no-store');
    assert.equal(options.credentials, 'omit');
    assert.equal(options.redirect, 'error');
    assert.ok(options.signal instanceof AbortSignal);
    return { ok: true, text: async () => '{"developerToken":""}' };
  });
  assert.deepEqual(result, { developerToken: '' });
  await assert.rejects(fetchSiteConfig(async () => ({ ok: false })), /CONFIG_UNAVAILABLE/);
  await assert.rejects(fetchSiteConfig(async () => ({ ok: true, text: async () => 'x'.repeat(20001) })), /CONFIG_TOO_LARGE/);
  await assert.rejects(fetchSiteConfig(async () => ({ ok: true, text: async () => '<html>' })));
});
