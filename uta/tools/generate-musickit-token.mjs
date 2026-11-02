#!/usr/bin/env node
// Local-only MusicKit signing helper. Node.js 22+; no npm packages or network calls.
import { createPrivateKey, createPublicKey, sign, verify } from 'node:crypto';
import { mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { basename, join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createInterface } from 'node:readline/promises';
import { execFileSync } from 'node:child_process';
import { parseArgs } from 'node:util';

export const SITE_ORIGIN = 'https://hierarchklay.github.io';
const TOKEN_SECONDS = 30 * 24 * 60 * 60;

function validateId(value, name) {
  const id = value.trim();
  if (!/^[A-Z0-9]{10}$/.test(id)) {
    throw new Error(`${name} 应为 10 位大写字母或数字，请重新核对。`);
  }
  return id;
}

export function makeToken({ teamId, keyId, pem, now = Math.floor(Date.now() / 1000) }) {
  const team = validateId(teamId, 'Team ID');
  const kid = validateId(keyId, 'Key ID');
  if (!Number.isSafeInteger(now) || now <= 0) throw new Error('系统时间无效。');
  let key;
  try {
    key = createPrivateKey(pem);
  } catch {
    throw new Error('无法读取私钥，请选择 Apple 下载的原始 .p8 文件。');
  }
  if (key.asymmetricKeyType !== 'ec' || key.asymmetricKeyDetails?.namedCurve !== 'prime256v1') {
    throw new Error('需要 Apple MusicKit 的 P-256 椭圆曲线私钥。');
  }
  const header = { alg: 'ES256', kid, typ: 'JWT' };
  const payload = { iss: team, iat: now, exp: now + TOKEN_SECONDS, origin: [SITE_ORIGIN] };
  const encode = value => Buffer.from(JSON.stringify(value)).toString('base64url');
  const signingInput = `${encode(header)}.${encode(payload)}`;
  // JWT ES256 requires the 64-byte R || S format, not OpenSSL's default DER format.
  const signature = sign('sha256', Buffer.from(signingInput), { key, dsaEncoding: 'ieee-p1363' });
  if (signature.length !== 64 || !verify('sha256', Buffer.from(signingInput),
    { key: createPublicKey(key), dsaEncoding: 'ieee-p1363' }, signature)) {
    throw new Error('本地签名校验失败，未保存令牌。');
  }
  return { token: `${signingInput}.${signature.toString('base64url')}`, expiresAt: payload.exp };
}

function selectKeyOnMac() {
  try {
    return execFileSync('/usr/bin/osascript', ['-e',
      'POSIX path of (choose file with prompt "选择 Apple 下载的 MusicKit .p8 密钥文件")'],
    { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
  } catch {
    throw new Error('已取消选择，或无法打开文件窗口。可重新运行并添加 --key-file 后跟带引号的文件路径。');
  }
}

async function main() {
  const { values } = parseArgs({ options: {
    'team-id': { type: 'string' }, 'key-id': { type: 'string' },
    'key-file': { type: 'string' }, output: { type: 'string' },
    help: { type: 'boolean', short: 'h' },
  } });
  if (values.help) {
    console.log('用法：node generate-musickit-token.mjs');
    console.log('Mac：交互输入 Team ID / Key ID，再在文件窗口选择 .p8。');
    console.log('可选：--team-id ID --key-id ID --key-file "/路径/AuthKey.p8" --output "/路径/token.txt"');
    return;
  }
  let teamId = values['team-id'];
  let keyId = values['key-id'];
  if (!teamId || !keyId) {
    if (!process.stdin.isTTY) throw new Error('请在终端直接运行脚本，或使用 --team-id 与 --key-id。');
    const rl = createInterface({ input: process.stdin, output: process.stdout });
    try {
      teamId ||= await rl.question('Team ID（10 位）：');
      keyId ||= await rl.question('Key ID（10 位）：');
    } finally {
      rl.close();
    }
  }
  teamId = validateId(teamId, 'Team ID');
  keyId = validateId(keyId, 'Key ID');
  let keyPath = values['key-file'];
  if (!keyPath) {
    if (process.platform !== 'darwin') throw new Error('请用 --key-file 指定 .p8 文件路径。');
    console.log('请在文件选择窗口中选择 .p8 密钥。');
    keyPath = selectKeyOnMac();
  }
  const keyInfo = statSync(keyPath);
  if (!keyInfo.isFile() || keyInfo.size > 16384) throw new Error('所选文件不是有效的 .p8 私钥文件。');
  const fileKeyId = basename(keyPath).match(/(?:^|_)AuthKey_([A-Z0-9]{10})\.p8$/)?.[1];
  if (fileKeyId && fileKeyId !== keyId) throw new Error('输入的 Key ID 与密钥文件名不一致，请核对。');
  const { token, expiresAt } = makeToken({ teamId, keyId, pem: readFileSync(keyPath) });
  let outputPath;
  if (values.output) {
    outputPath = resolve(values.output);
  } else {
    const dir = process.platform === 'darwin'
      ? join(homedir(), 'Library', 'Application Support', 'Hibi Uta')
      : join(homedir(), '.hibi-uta');
    mkdirSync(dir, { recursive: true, mode: 0o700 });
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    outputPath = join(dir, `musickit-developer-token-${stamp}.txt`);
  }
  // Exclusive create prevents overwriting a key, existing token, or symlink target.
  writeFileSync(outputPath, token + '\n', { flag: 'wx', mode: 0o600 });
  console.log('\n令牌已生成，本地签名校验通过。');
  console.log(`有效期至：${new Date(expiresAt * 1000).toLocaleString()}`);
  console.log(`网站来源：${SITE_ORIGIN}`);
  console.log(`已保存：${outputPath}`);
  console.log('尚未向 Apple 验证账户权限；稍后通过网站测试。');
  console.log('不用发送令牌正文或 .p8 文件，只需告知生成成功。');
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main().catch(error => {
    const common = {
      ENOENT: '找不到密钥文件或输出目录，请检查路径。',
      EACCES: '无法访问文件，请检查终端的文件访问权限。',
      EEXIST: '目标文件已存在，未覆盖；请使用新文件名。',
    };
    console.error(`未完成：${common[error.code] || error.message}`);
    process.exitCode = 1;
  });
}
