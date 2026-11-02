import test from 'node:test';
import assert from 'node:assert/strict';
import { parseDeveloperToken, queueForURL, formatTime, boundedTime, SegmentLoop } from '../player-core.mjs';

const now = 1800000000;
const origin = 'https://hierarchklay.github.io';
const fakeJWT = changes => {
  const enc = obj => Buffer.from(JSON.stringify(obj)).toString('base64url');
  return [enc({alg:'ES256',kid:'KEY0000001'}), enc({iss:'TEAM000001',iat:now,exp:now+2592000,origin:[origin],...changes}), Buffer.alloc(64).toString('base64url')].join('.');
};

test('token parser validates structure, date, and origin without claiming signature verification', () => {
  const token=fakeJWT();
  assert.equal(parseDeveloperToken('\n'+token+'\n',{origin,now}).token,token);
  assert.throws(()=>parseDeveloperToken('-----BEGIN PRIVATE KEY-----',{origin,now}),/私钥/);
  assert.throws(()=>parseDeveloperToken('invalid',{origin,now}),/格式/);
  assert.throws(()=>parseDeveloperToken(fakeJWT({exp:now-1,iat:now-3600}),{origin,now}),/过期/);
  assert.throws(()=>parseDeveloperToken(fakeJWT(),{origin:'https://other.example',now}),/域名/);
  assert.throws(()=>parseDeveloperToken(fakeJWT({iat:now+600}),{origin,now}),/未来/);
  assert.throws(()=>parseDeveloperToken(fakeJWT({origin:'https://hierarchklay.github.io'}),{origin,now}),/域名/);
});

test('official song and album links produce the correct queue type', () => {
  assert.deepEqual(queueForURL('https://music.apple.com/cn/album/1801540012?i=1801540626'),{song:'1801540626'});
  assert.deepEqual(queueForURL('https://music.apple.com/cn/album/6781555396'),{album:'6781555396'});
  assert.deepEqual(queueForURL('https://music.apple.com/cn/song/title/123'),{song:'123'});
  for(const url of ['https://evil.example/cn/song/123','https://music.apple.com@evil.example/cn/song/123','https://music.apple.com/cn/album/123?i=no']) assert.throws(()=>queueForURL(url));
});

test('seek positions are bounded to the current track and unknown times stay unknown', () => {
  assert.equal(boundedTime(-5,120),0);
  assert.equal(boundedTime(130,120),119.95);
  assert.throws(()=>boundedTime(30,NaN));
  assert.equal(formatTime(NaN),'—:—');
  assert.equal(formatTime(null),'—:—');
  assert.equal(formatTime(65.9),'1:05');
});

test('A/B loop only seeks on actual foreground playback at B and avoids overlapping seeks', async () => {
  const loop=new SegmentLoop();
  assert.throws(()=>loop.markB(20),/先标记/);
  loop.markA(10); assert.throws(()=>loop.markB(10.5),/1 秒/);
  loop.markB(20); loop.start();
  const calls=[]; let finish;
  const seek=async t=>{calls.push(t);await new Promise(resolve=>{finish=resolve;});};
  assert.equal(await loop.tick({time:19,playing:true,visible:true},seek),false);
  assert.equal(await loop.tick({time:20,playing:false,visible:true},seek),false);
  assert.equal(await loop.tick({time:20,playing:true,visible:false},seek),false);
  const pending=loop.tick({time:20,playing:true,visible:true},seek);
  assert.equal(await loop.tick({time:20.5,playing:true,visible:true},seek),false);
  assert.deepEqual(calls,[10]);finish();await pending;
  loop.reset();assert.equal(loop.enabled,false);assert.equal(loop.a,null);
});

test('failed automatic seek disables the loop',async()=>{
  const loop=new SegmentLoop();loop.markA(5);loop.markB(10);loop.start();
  await assert.rejects(loop.tick({time:10,playing:true,visible:true},async()=>{throw Error('network');}));
  assert.equal(loop.enabled,false);assert.equal(loop.seeking,false);
});
