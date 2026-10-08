// Run: npx tsx --test billing.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { analysisPolicy, getPlanLimits, isTrialExpired, isInternal } from './billing';

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
