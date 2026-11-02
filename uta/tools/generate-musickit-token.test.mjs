import test from 'node:test';
import assert from 'node:assert/strict';
import { generateKeyPairSync, verify } from 'node:crypto';
import { mkdtempSync, writeFileSync, readFileSync, statSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { makeToken, SITE_ORIGIN } from './generate-musickit-token.mjs';

// Ephemeral synthetic keys only; never use Apple account credentials in tests.
const { privateKey, publicKey } = generateKeyPairSync('ec', { namedCurve: 'prime256v1' });
const pem = privateKey.export({ type: 'pkcs8', format: 'pem' });
const values = { teamId: 'TEAM000001', keyId: 'KEY0000001', pem, now: 1800000000 };

test('JWT uses a verifiable ES256 signature and the intended origin and lifetime', () => {
  const { token } = makeToken(values);
  const [head, body, sig] = token.split('.');
  assert.deepEqual(JSON.parse(Buffer.from(head, 'base64url')), { alg: 'ES256', kid: values.keyId, typ: 'JWT' });
  assert.deepEqual(JSON.parse(Buffer.from(body, 'base64url')), {
    iss: values.teamId, iat: values.now, exp: values.now + 2592000, origin: [SITE_ORIGIN],
  });
  const signature = Buffer.from(sig, 'base64url');
  assert.equal(signature.length, 64);
  assert.ok(verify('sha256', Buffer.from(`${head}.${body}`), { key: publicKey, dsaEncoding: 'ieee-p1363' }, signature));
  assert.equal(verify('sha256', Buffer.from(`${head}.${body}tampered`), { key: publicKey, dsaEncoding: 'ieee-p1363' }, signature), false);
});

test('invalid IDs, malformed keys, and the wrong curve are rejected', () => {
  assert.throws(() => makeToken({ ...values, teamId: 'not-a-team' }), /Team ID/);
  assert.throws(() => makeToken({ ...values, keyId: 'short' }), /Key ID/);
  assert.throws(() => makeToken({ ...values, pem: 'not a key' }), /无法读取/);
  const wrong = generateKeyPairSync('ec', { namedCurve: 'secp384r1' }).privateKey.export({ type: 'pkcs8', format: 'pem' });
  assert.throws(() => makeToken({ ...values, pem: wrong }), /P-256/);
});

test('CLI writes a private file, does not print credentials, and never overwrites it', () => {
  const dir = mkdtempSync(join(tmpdir(), 'hibi-uta-token-test-'));
  try {
    const keyFile = join(dir, 'AuthKey_KEY0000001.p8');
    const output = join(dir, 'token.txt');
    writeFileSync(keyFile, pem, { mode: 0o600 });
    const script = fileURLToPath(new URL('./generate-musickit-token.mjs', import.meta.url));
    const args = [script, '--team-id', values.teamId, '--key-id', values.keyId, '--key-file', keyFile, '--output', output];
    const result = spawnSync(process.execPath, args, { encoding: 'utf8' });
    assert.equal(result.status, 0, result.stderr);
    const token = readFileSync(output, 'utf8').trim();
    assert.equal(token.split('.').length, 3);
    assert.equal(statSync(output).mode & 0o777, 0o600);
    assert.ok(!result.stdout.includes(token));
    assert.ok(!result.stdout.includes('PRIVATE KEY'));
    assert.ok(!result.stdout.includes(values.teamId));
    assert.equal(readFileSync(keyFile, 'utf8'), pem);
    const rerun = spawnSync(process.execPath, args, { encoding: 'utf8' });
    assert.equal(rerun.status, 1);
    assert.match(rerun.stderr, /已存在/);
    assert.equal(readFileSync(output, 'utf8').trim(), token);
    const mismatch = spawnSync(process.execPath, [script, '--team-id', values.teamId, '--key-id', 'OTHER00001', '--key-file', keyFile, '--output', join(dir, 'other.txt')], { encoding: 'utf8' });
    assert.equal(mismatch.status, 1);
    assert.match(mismatch.stderr, /不一致/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
