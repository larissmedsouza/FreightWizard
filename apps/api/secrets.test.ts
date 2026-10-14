// Secrets and OAuth tokens at rest. Run: npx tsx --test secrets.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { makeCipher, isEncrypted, sealToken, openToken, legacyTokenUpdates } from './secrets';

const KEY = randomBytes(32).toString('hex');
const local = makeCipher(KEY, { onVercel: false });

test('tokens are stored encrypted and read back', () => {
  const sealed = sealToken(local, 'ya29.access-token')!;
  assert.ok(isEncrypted(sealed));
  assert.ok(!sealed.includes('ya29'));
  assert.equal(openToken(local, sealed), 'ya29.access-token');
  assert.notEqual(sealToken(local, 'same'), sealToken(local, 'same')); // random IV
});

test('legacy plain-text tokens are read as they are', () => {
  assert.equal(openToken(local, 'ya29.plain'), 'ya29.plain');
  assert.equal(openToken(local, null), null);
  assert.equal(sealToken(local, null), null);
});

test('an encrypted token is never encrypted twice', () => {
  const once = sealToken(local, 'tok')!;
  assert.equal(sealToken(local, once), once);
});

test('a token encrypted with another key reads as missing (user signs in again), never as garbage', () => {
  const other = makeCipher(randomBytes(32).toString('hex'), { onVercel: false });
  assert.equal(openToken(local, sealToken(other, 'tok')), null);
});

test('on Vercel without INTEGRATION_ENCRYPTION_KEY tokens are not "encrypted" with the public dev key', () => {
  const noKey = makeCipher(undefined, { onVercel: true });
  assert.equal(noKey.usingFallback, true);
  assert.equal(noKey.tokensEncrypted, false);
  assert.equal(sealToken(noKey, 'tok'), 'tok');
  assert.deepEqual(legacyTokenUpdates(noKey, [{ session_id: 's', access_token: 'tok', refresh_token: null }]), []);
  // Locally the dev key is fine (development data only)
  assert.equal(makeCipher(undefined, { onVercel: false }).tokensEncrypted, true);
});

test('a malformed key is refused at startup', () => {
  assert.throws(() => makeCipher('abcd', { onVercel: true }), /64 hex chars/);
});

test('migration: only rows with plain-text tokens, matched on their current values', () => {
  const enc = sealToken(local, 'already')!;
  const updates = legacyTokenUpdates(local, [
    { session_id: 'a', access_token: 'plain-a', refresh_token: 'plain-r' },
    { session_id: 'b', access_token: enc, refresh_token: null },
    { session_id: 'c', access_token: null, refresh_token: null },
    { session_id: 'd', access_token: enc, refresh_token: 'plain-r2' },
  ]);
  assert.deepEqual(updates.map(u => u.session_id), ['a', 'd']);
  const a = updates[0];
  assert.deepEqual(a.match, { access_token: 'plain-a', refresh_token: 'plain-r' });
  assert.equal(openToken(local, a.set.access_token), 'plain-a');
  assert.equal(openToken(local, a.set.refresh_token), 'plain-r');
  assert.equal(updates[1].set.access_token, enc); // already encrypted stays the same
  assert.equal(legacyTokenUpdates(local, []).length, 0);
});

test('integration secrets keep the stored format (JSON iv/data/tag)', () => {
  const v = JSON.parse(local.encrypt('serpro-secret'));
  assert.deepEqual(Object.keys(v).sort(), ['data', 'iv', 'tag']);
  assert.equal(local.decrypt(JSON.stringify(v)), 'serpro-secret');
});
