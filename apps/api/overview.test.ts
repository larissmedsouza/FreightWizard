// Scope isolation test for GET /api/overview's data logic.
// Run: npx tsx --test overview.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildOverview, type Db, type QueryBuilder } from './overview';
import { portCode } from './ports';

/** In-memory stand-in for the Supabase client: supports select/eq/in/gte. */
function fakeDb(tables: Record<string, any[]>): Db {
  return {
    from(table: string) {
      let rows = [...(tables[table] || [])];
      const qb: QueryBuilder = {
        select: () => qb,
        eq: (col, val) => { rows = rows.filter(r => r[col] === val); return qb; },
        in: (col, vals) => { rows = rows.filter(r => vals.includes(r[col])); return qb; },
        gte: (col, val) => { rows = rows.filter(r => r[col] != null && r[col] >= (val as any)); return qb; },
        then: (resolve, reject) => Promise.resolve({ data: rows, error: null }).then(resolve, reject),
      };
      return qb;
    },
  };
}

const NOW = new Date('2026-10-07T09:00:00Z');
const daysFromNow = (d: number) => new Date(NOW.getTime() + d * 86_400_000).toISOString();

// Team A: alice + bob. Team B: carol. Dave: no team.
const db = fakeDb({
  profiles: [
    { id: 'alice', team_id: 'teamA' }, { id: 'bob', team_id: 'teamA' },
    { id: 'carol', team_id: 'teamB' }, { id: 'dave', team_id: null },
  ],
  teams: [{ id: 'teamA', name: 'Rotterdam Desk' }, { id: 'teamB', name: 'Santos Desk' }],
  gmail_sessions: [
    { session_id: 'sA1', user_id: 'alice' }, { session_id: 'sB1', user_id: 'bob' },
    { session_id: 'sC1', user_id: 'carol' }, { session_id: 'sD1', user_id: 'dave' },
  ],
  shipments: [
    { id: 'a1', user_id: 'alice', approved: true, status: 'booked', origin: 'Santos, BR', destination: 'Rotterdam, NL', eta: daysFromNow(3).slice(0, 10) },
    { id: 'b1', user_id: 'bob', approved: true, status: 'in_transit', origin: 'Shanghai', destination: 'Somewhere Else', eta: daysFromNow(20).slice(0, 10) },
    { id: 'b2', user_id: 'bob', approved: false, status: 'booked', created_at: daysFromNow(-1) },
    { id: 'a2', user_id: 'alice', approved: false, status: 'inquiry', created_at: daysFromNow(-2) },
    { id: 'c1', user_id: 'carol', approved: true, status: 'at_destination', eta: daysFromNow(-1).slice(0, 10) },
    { id: 'c2', user_id: 'carol', approved: true, status: 'delivered' },
    { id: 'd1', user_id: 'dave', approved: true, status: 'booked' },
  ],
  email_analysis: [
    { user_id: 'alice', priority: 'urgent', replied_at: null, created_at: daysFromNow(-2) },
    { user_id: 'bob', priority: 'low', replied_at: null, created_at: daysFromNow(-5) },
    { user_id: 'bob', priority: 'high', replied_at: daysFromNow(-1), created_at: daysFromNow(-3), response_time_minutes: 40 },
    { user_id: 'alice', priority: 'high', replied_at: null, created_at: daysFromNow(-45) }, // outside 30 days
    { user_id: 'carol', priority: 'urgent', replied_at: null, created_at: daysFromNow(-1) },
    { user_id: 'carol', priority: 'medium', replied_at: daysFromNow(-2), created_at: daysFromNow(-2), response_time_minutes: 10 },
  ],
  quotes: [
    { id: 'q1', session_id: 'sA1', status: 'sent', sell_rate: 1000, currency: 'USD' },
    { id: 'q2', session_id: 'sB1', status: 'sent', sell_rate: 500, currency: 'EUR' },
    { id: 'q3', session_id: 'sC1', status: 'sent', sell_rate: 9999, currency: 'USD' },
  ],
  rate_cards: [
    { id: 'r1', session_id: 'sA1', is_active: true, validity_end: daysFromNow(10).slice(0, 10) },
    { id: 'r2', session_id: 'sC1', is_active: true, validity_end: daysFromNow(5).slice(0, 10) },
    { id: 'r3', session_id: 'sC1', is_active: true, validity_end: daysFromNow(6).slice(0, 10) },
  ],
});

test('team A sees only team A records', async () => {
  const o = await buildOverview(db, 'alice', NOW);
  assert.equal(o.scope.kind, 'team');
  assert.equal(o.scope.name, 'Rotterdam Desk');
  assert.equal(o.scope.members, 2);
  assert.equal(o.kpis.activeShipments, 2);          // a1 + b1, not carol's or dave's
  assert.equal(o.kpis.bookings, 1);
  assert.equal(o.kpis.inTransit, 1);
  assert.equal(o.kpis.atDestination, 0);            // carol's is excluded
  assert.equal(o.kpis.arriving7d, 1);               // a1 only (b1 is 20 days out)
  assert.equal(o.kpis.inboxWaiting30d, 2);          // alice urgent + bob low (45-day-old one excluded)
  assert.equal(o.kpis.urgentHighWaiting30d, 1);
  assert.equal(o.kpis.avgReplyMinutes30d, 40);
  assert.deepEqual(o.kpis.quotesAwaiting, { count: 2, valueByCurrency: { USD: 1000, EUR: 500 } });
  assert.equal(o.kpis.ratesExpiring30d, 1);
  assert.equal(o.kpis.aiSuggestions, 1);            // only alice's own pending (Approve is owner-only)
  assert.deepEqual(o.suggestions.map(s => s.id), ['a2']);
});

test('team B (second team) gets only its own counts', async () => {
  const o = await buildOverview(db, 'carol', NOW);
  assert.equal(o.scope.name, 'Santos Desk');
  assert.equal(o.scope.members, 1);
  assert.equal(o.kpis.activeShipments, 1);          // c1 (c2 delivered)
  assert.equal(o.kpis.bookings, 0);
  assert.equal(o.kpis.atDestination, 1);
  assert.equal(o.kpis.inboxWaiting30d, 1);
  assert.equal(o.kpis.urgentHighWaiting30d, 1);
  assert.equal(o.kpis.avgReplyMinutes30d, 10);
  assert.deepEqual(o.kpis.quotesAwaiting, { count: 1, valueByCurrency: { USD: 9999 } });
  assert.equal(o.kpis.ratesExpiring30d, 2);
  assert.equal(o.kpis.aiSuggestions, 0);
  assert.ok(o.shipments.every(s => s.id.startsWith('c')));
});

test('user without a team is scoped to themselves', async () => {
  const o = await buildOverview(db, 'dave', NOW);
  assert.equal(o.scope.kind, 'user');
  assert.equal(o.kpis.activeShipments, 1);
  assert.equal(o.kpis.inboxWaiting30d, 0);
  assert.equal(o.kpis.avgReplyMinutes30d, null);    // no data -> null, not 0
  assert.deepEqual(o.kpis.quotesAwaiting, { count: 0, valueByCurrency: {} });
});

test('port codes only when both ends resolve', async () => {
  const o = await buildOverview(db, 'alice', NOW);
  const a1 = o.shipments.find(s => s.id === 'a1')!;
  assert.equal(a1.originCode, 'BRSSZ');
  assert.equal(a1.destinationCode, 'NLRTM');
  const b1 = o.shipments.find(s => s.id === 'b1')!;
  assert.equal(b1.originCode, null);                // Shanghai resolves, destination does not -> no codes
  assert.equal(b1.destinationCode, null);
  assert.equal(portCode('BRSSZ'), 'BRSSZ');
  assert.equal(portCode('Hamburg, DE'), 'DEHAM');
  assert.equal(portCode('Venlo'), null);            // not in the table -> no guess
});
