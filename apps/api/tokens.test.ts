// Mailbox token refresh. Run: npx tsx --test tokens.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { tokenManager, needsRefresh, refreshFailure, ReconnectError, REFRESH_MARGIN_MS, type TokenDeps, type TokenSession, type MailTokens } from './tokens';

const NOW = Date.parse('2026-10-12T15:00:00Z');

function setup(opts: { refresh?: TokenDeps['refresh'] } = {}) {
  const calls: string[] = [];
  const saved: Record<string, MailTokens> = {};
  let n = 0;
  const deps: TokenDeps = {
    refresh: opts.refresh || (async (provider, rt) => { calls.push(`${provider}:${rt}`); n++; return { access_token: `new-${n}`, refresh_token: provider === 'outlook' ? `rt-${n}` : undefined, expires_in: 3600 }; }),
    save: async (id, t) => { saved[id] = t; },
    now: () => NOW,
  };
  return { tm: tokenManager(deps), calls, saved };
}
const session = (over: Partial<MailTokens> = {}, provider: 'google' | 'outlook' = 'outlook'): TokenSession =>
  ({ sessionId: 's1', provider, tokens: { access_token: 'old', refresh_token: 'rt-0', expiry_date: NOW + 3600_000, ...over } });

test('a token valid for more than 5 minutes is used as is', async () => {
  const { tm, calls } = setup();
  assert.equal(await tm.fresh(session()), 'old');
  assert.deepEqual(calls, []);
  assert.equal(needsRefresh({ access_token: 'x', expiry_date: NOW + REFRESH_MARGIN_MS + 1 }, NOW), false);
  assert.equal(needsRefresh({ access_token: 'x', expiry_date: NOW + REFRESH_MARGIN_MS }, NOW), true);
});

test('Outlook: refreshed before expiry, the rotated refresh token is stored', async () => {
  const { tm, calls, saved } = setup();
  const s = session({ expiry_date: NOW + 60_000 });
  assert.equal(await tm.fresh(s), 'new-1');
  assert.deepEqual(calls, ['outlook:rt-0']);
  assert.deepEqual(saved.s1, { access_token: 'new-1', refresh_token: 'rt-1', expiry_date: NOW + 3600_000 });
  assert.equal(s.tokens.refresh_token, 'rt-1'); // the session in memory follows
});

test('Gmail: an expired token is refreshed and the existing refresh token kept', async () => {
  const { tm, saved } = setup();
  const s = session({ expiry_date: NOW - 86_400_000 }, 'google');
  assert.equal(await tm.fresh(s), 'new-1');
  assert.equal(saved.s1.refresh_token, 'rt-0');
});

test('no refresh token (Outlook sessions from before offline_access): reconnect', async () => {
  const { tm } = setup();
  await assert.rejects(tm.fresh(session({ refresh_token: null, expiry_date: NOW - 1 })), (e: any) => e instanceof ReconnectError && e.provider === 'outlook');
});

test('a refused refresh token means reconnect; a provider outage does not', async () => {
  assert.ok(refreshFailure('outlook', 400, { error: 'invalid_grant' }) instanceof ReconnectError);
  assert.ok(refreshFailure('google', 400, { error: 'invalid_grant' }) instanceof ReconnectError);
  assert.ok(!(refreshFailure('outlook', 503, null) instanceof ReconnectError));
  const { tm } = setup({ refresh: async () => { throw refreshFailure('outlook', 400, { error: 'invalid_grant' }); } });
  await assert.rejects(tm.fresh(session({ expiry_date: NOW - 1 })), ReconnectError);
});

test('on 401 the token is refreshed once and the call retried', async () => {
  const { tm, calls } = setup();
  const seen: string[] = [];
  const r = await tm.withRetry(session(), async (token) => { seen.push(token); return new Response(null, { status: token === 'old' ? 401 : 200 }); });
  assert.equal(r.status, 200);
  assert.deepEqual(seen, ['old', 'new-1']);
  assert.equal(calls.length, 1);
  // A second 401 is returned, not retried forever
  const again = await tm.withRetry(session(), async () => new Response(null, { status: 401 }));
  assert.equal(again.status, 401);
});

test('parallel requests share one refresh', async () => {
  const { tm, calls } = setup();
  const s1 = session({ expiry_date: NOW - 1 }), s2 = session({ expiry_date: NOW - 1 });
  const [a, b] = await Promise.all([tm.fresh(s1), tm.fresh(s2)]);
  assert.equal(a, b);
  assert.equal(calls.length, 1);
});
