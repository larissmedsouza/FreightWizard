// Run: npx tsx --test results.test.ts
// Proves one user can't read another user's analysis results, and that a
// caller needs real proof of identity (session or verified Google ID token).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { findResultForCaller } from './results';
import { resolveCaller, type Caller, type CallerDeps } from './caller';
import type { Db, QueryBuilder } from './overview';

function fakeDb(tables: Record<string, any[]>): Db {
  return {
    from(table: string) {
      let rows = [...(tables[table] || [])];
      const qb: QueryBuilder = {
        select: () => qb,
        eq: (c, v) => { rows = rows.filter(r => r[c] === v); return qb; },
        in: (c, v) => { rows = rows.filter(r => v.includes(r[c])); return qb; },
        gte: (c, v) => { rows = rows.filter(r => r[c] != null && r[c] >= (v as any)); return qb; },
        then: (ok, bad) => Promise.resolve({ data: rows, error: null }).then(ok, bad),
      };
      return qb;
    },
  };
}

const alice: Caller = { userId: 'u-alice', email: 'alice@a.com', via: 'session' };
const bob: Caller = { userId: 'u-bob', email: 'bob@b.com', via: 'google_id_token' };

const db = fakeDb({
  email_analysis: [
    { email_id: 'm-alice', user_id: 'u-alice', intent: 'quote_request', priority: 'high', summary: 'Alice secret', suggested_reply: 'Dear Alice customer' },
  ],
  analysis_queue: [
    { email_id: 'q-alice', user_email: 'alice@a.com', status: 'done', result: { intent: 'booking_confirmation', summary: 'Alice queued secret' } },
    { email_id: 'q-alice-pending', user_email: 'alice@a.com', status: 'pending', result: null, created_at: new Date().toISOString() },
    { email_id: 'q-alice-stuck', user_email: 'alice@a.com', status: 'pending', result: null, created_at: new Date(Date.now() - 10 * 60 * 1000).toISOString() },
  ],
});

test('a user reads their own saved and queued results', async () => {
  const saved = await findResultForCaller(db, alice, 'm-alice');
  assert.equal(saved.status, 'ready');
  assert.equal((saved as any).analysis.summary, 'Alice secret');
  const queued = await findResultForCaller(db, alice, 'q-alice');
  assert.equal((queued as any).analysis.summary, 'Alice queued secret');
  assert.deepEqual(await findResultForCaller(db, alice, 'q-alice-pending'), { status: 'processing' });
});

test("another user can't read them, even with the exact email IDs", async () => {
  assert.deepEqual(await findResultForCaller(db, bob, 'm-alice'), { status: 'not_found' });
  assert.deepEqual(await findResultForCaller(db, bob, 'q-alice'), { status: 'not_found' });
  assert.deepEqual(await findResultForCaller(db, bob, 'q-alice-pending'), { status: 'not_found' });
});

const deps: CallerDeps = {
  getSession: async (sid) => (sid === 'good-session' ? { userId: 'u-alice', email: 'alice@a.com' } : null),
  verifyGoogleIdToken: async (t) =>
    t === 'valid-token' ? { email: 'Bob@B.com', email_verified: true }
    : t === 'unverified-email-token' ? { email: 'eve@e.com', email_verified: false }
    : null,
  getOrCreateUser: async (email) => (email === 'bob@b.com' ? 'u-bob' : null),
};

test('identity: valid session or verified Google ID token only', async () => {
  assert.deepEqual(await resolveCaller({ query: { session: 'good-session' } }, deps), { userId: 'u-alice', email: 'alice@a.com', via: 'session', sessionId: 'good-session' });
  assert.deepEqual(await resolveCaller({ headers: { authorization: 'Bearer valid-token' } }, deps), { userId: 'u-bob', email: 'bob@b.com', via: 'google_id_token' });
});

test('identity: claimed emails, bad tokens and bad sessions are rejected', async () => {
  assert.equal(await resolveCaller({ body: { userEmail: 'alice@a.com', source: 'gmail_addon' } }, deps), null); // the old add-on "identity"
  assert.equal(await resolveCaller({ query: { emailId: 'm-alice' } }, deps), null);                          // nothing at all
  assert.equal(await resolveCaller({ headers: { authorization: 'Bearer forged' } }, deps), null);
  assert.equal(await resolveCaller({ headers: { authorization: 'Bearer unverified-email-token' } }, deps), null);
  // An invalid session never falls back to a token
  assert.equal(await resolveCaller({ query: { session: 'stale' }, headers: { authorization: 'Bearer valid-token' } }, deps), null);
});

test('a job pending for over 5 minutes is reported as an error so it gets retried', async () => {
  assert.deepEqual(await findResultForCaller(db, alice, 'q-alice-stuck'), { status: 'error' });
  assert.deepEqual(await findResultForCaller(db, alice, 'q-alice-pending'), { status: 'processing' }); // recent: still processing
  assert.deepEqual(await findResultForCaller(db, bob, 'q-alice-stuck'), { status: 'not_found' });  // still scoped to the owner
});
