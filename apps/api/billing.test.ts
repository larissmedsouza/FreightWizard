// Run: npx tsx --test billing.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { analysisPolicy, getPlanLimits, isTrialExpired, isInternal, countMonthlyAnalyses, STARTER_MONTHLY_ANALYSES } from './billing';
import type { Db, QueryBuilder } from './overview';

const NOW = new Date('2026-10-08T12:00:00Z');

test('internal: unlimited, never expired, even with stale trial fields', () => {
  const sub = { plan: 'internal', status: 'active', trial_analyses_used: 999, trial_started_at: '2026-01-01T00:00:00Z' };
  assert.equal(isInternal(sub), true);
  assert.deepEqual(analysisPolicy(sub), { kind: 'unlimited' });
  assert.equal(isTrialExpired(sub, NOW), false);
  const l = getPlanLimits('internal');
  assert.equal(l.analyses, -1); assert.equal(l.shipments, -1); assert.equal(l.quotes, -1); assert.equal(l.users, -1);
  assert.equal(l.documents, true);
});

test('internal wins over a leftover expired status', () => {
  assert.deepEqual(analysisPolicy({ plan: 'internal', status: 'expired' }), { kind: 'unlimited' });
});

test('trial: allowed below 30, blocked at 30; expiry reason is specific', () => {
  assert.deepEqual(analysisPolicy({ plan: 'trial', status: 'trialing', trial_analyses_used: 29 }), { kind: 'trial', used: 29 });
  assert.deepEqual(analysisPolicy({ plan: 'trial', status: 'trialing', trial_analyses_used: 30 }), { kind: 'blocked', reason: 'trial_limit_reached' });
  assert.deepEqual(analysisPolicy({ plan: 'trial', status: 'expired', trial_analyses_used: 0 }), { kind: 'blocked', reason: 'trial_expired' });
  assert.equal(isTrialExpired({ plan: 'trial', trial_analyses_used: 0, trial_started_at: '2026-09-09T19:44:53Z' }, NOW), true); // 14 days passed
});

test('starter is monthly, paid plans unlimited, unknown plans unchanged (unlimited analyses)', () => {
  assert.deepEqual(analysisPolicy({ plan: 'starter', status: 'active' }), { kind: 'monthly', limit: 200 });
  assert.deepEqual(analysisPolicy({ plan: 'professional', status: 'active' }), { kind: 'unlimited' });
  assert.deepEqual(analysisPolicy({ plan: 'free', status: 'active' }), { kind: 'unlimited' }); // same as before this change
  assert.equal(getPlanLimits('free').shipments, 5);                                           // falls back to trial limits, as before
});

/** Minimal in-memory stand-in for the Supabase client (select/eq/in/gte). */
function fakeDb(rows: any[]): Db {
  return {
    from() {
      let r = [...rows];
      const qb: QueryBuilder = {
        select: () => qb,
        eq: (c, v) => { r = r.filter(x => x[c] === v); return qb; },
        in: (c, v) => { r = r.filter(x => v.includes(x[c])); return qb; },
        gte: (c, v) => { r = r.filter(x => x[c] != null && x[c] >= (v as any)); return qb; },
        then: (ok, bad) => Promise.resolve({ data: r, error: null }).then(ok, bad),
      };
      return qb;
    },
  };
}

test('starter monthly count is keyed by user ID (rows are stored by ID, not email)', async () => {
  const uid = '9ea04075-10e1-477f-b7f9-48909f1f5eaf';
  const thisMonth = (d: number) => new Date(Date.UTC(2026, 9, d)).toISOString();
  const rows = [
    ...Array.from({ length: STARTER_MONTHLY_ANALYSES }, (_, i) => ({ user_id: uid, intent: 'quote_request', created_at: thisMonth(1 + (i % 7)) })),
    { user_id: uid, intent: 'marketing', created_at: thisMonth(2) },                 // free label: not counted
    { user_id: uid, intent: 'quote_request', created_at: '2026-09-30T23:59:00Z' },  // last month: not counted
    { user_id: 'someone-else', intent: 'quote_request', created_at: thisMonth(3) },  // other user: not counted
  ];
  const db = fakeDb(rows);
  assert.equal(await countMonthlyAnalyses(db, uid, NOW), STARTER_MONTHLY_ANALYSES);
  // The old query filtered user_id by the account email and always found 0:
  assert.equal(await countMonthlyAnalyses(db, 'freightzard@gmail.com', NOW), 0);
  // At 200 the starter plan is blocked (the endpoint compares count >= limit).
  const policy = analysisPolicy({ plan: 'starter', status: 'active' });
  assert.ok(policy.kind === 'monthly' && (await countMonthlyAnalyses(db, uid, NOW)) >= policy.limit);
});
