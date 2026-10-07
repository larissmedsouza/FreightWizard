// Scope isolation test for GET /api/overview's data logic.
// Run: npx tsx --test overview.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildOverview, listWaitingEmails, type Db, type QueryBuilder } from './overview';
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
    { session_id: 'sA1', user_id: 'alice' }, { session_id: 'sA2', user_id: 'alice' }, { session_id: 'sB1', user_id: 'bob' },
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
    { user_id: 'alice', email_id: 'm1', priority: 'urgent', replied_at: null, created_at: daysFromNow(-2) },
    { user_id: 'alice', email_id: 'm2', priority: 'medium', replied_at: null, created_at: daysFromNow(-4) },
    { user_id: 'bob', priority: 'low', replied_at: null, created_at: daysFromNow(-5) },
    { user_id: 'bob', priority: 'high', replied_at: daysFromNow(-1), created_at: daysFromNow(-3), response_time_minutes: 40 },
    { user_id: 'alice', priority: 'high', replied_at: null, created_at: daysFromNow(-45) }, // outside 30 days
    { user_id: 'carol', priority: 'urgent', replied_at: null, created_at: daysFromNow(-1) },
    { user_id: 'carol', priority: 'medium', replied_at: daysFromNow(-2), created_at: daysFromNow(-2), response_time_minutes: 10 },
  ],
  quotes: [
    { id: 'q1', session_id: 'sA1', status: 'sent', sell_rate: 1000, currency: 'USD' },
    { id: 'q4', session_id: 'sA2', status: 'sent', sell_rate: 700, currency: 'USD' }, // alice, other login session
    { id: 'q2', session_id: 'sB1', status: 'sent', sell_rate: 500, currency: 'EUR' },
    { id: 'q3', session_id: 'sC1', status: 'sent', sell_rate: 9999, currency: 'USD' },
  ],
  rate_cards: [
    { id: 'r1', session_id: 'sA1', is_active: true, validity_end: daysFromNow(10).slice(0, 10) },
    { id: 'r2', session_id: 'sC1', is_active: true, validity_end: daysFromNow(5).slice(0, 10) },
    { id: 'r3', session_id: 'sC1', is_active: true, validity_end: daysFromNow(6).slice(0, 10) },
  ],
});

const me = (user: string, sessionId: string) => buildOverview(db, user, { mode: 'me', sessionId, now: NOW });
const team = (user: string, sessionId: string) => buildOverview(db, user, { mode: 'team', sessionId, now: NOW });

test('me (default): same scope as the linked pages', async () => {
  const o = await me('alice', 'sA1');
  assert.equal(o.scope.mode, 'me');
  assert.equal(o.scope.hasTeam, true);
  assert.equal(o.kpis.activeShipments, 1);          // a1 only: /api/shipments is user_id-scoped
  assert.equal(o.kpis.bookings, 1);
  assert.equal(o.kpis.inTransit, 0);                // bob's b1 excluded
  assert.equal(o.kpis.arriving7d, 1);
  assert.equal(o.kpis.inboxWaiting30d, 2);          // m1 + m2; 45-day-old one excluded
  assert.equal(o.kpis.urgentHighWaiting30d, 1);
  assert.equal(o.kpis.avgReplyMinutes30d, null);    // alice has no replies
  // quotes and rates follow the current session, like /api/quotes and /api/rates
  assert.deepEqual(o.kpis.quotesAwaiting, { count: 1, valueByCurrency: { USD: 1000 } });
  assert.equal(o.kpis.ratesExpiring30d, 1);
  assert.equal(o.kpis.aiSuggestions, 1);
  assert.deepEqual(o.suggestions.map(s => s.id), ['a2']);
  assert.ok(o.shipments.every(s => s.mine));
});

test('me: another login session of the same user sees that session quotes', async () => {
  const o = await me('alice', 'sA2');
  assert.deepEqual(o.kpis.quotesAwaiting, { count: 1, valueByCurrency: { USD: 700 } });
  assert.equal(o.kpis.ratesExpiring30d, 0);
  assert.equal(o.kpis.activeShipments, 1);          // user-keyed data unchanged
});

test('team: team A sees only team A records', async () => {
  const o = await team('alice', 'sA1');
  assert.equal(o.scope.mode, 'team');
  assert.equal(o.scope.name, 'Rotterdam Desk');
  assert.equal(o.scope.members, 2);
  assert.equal(o.kpis.activeShipments, 2);          // a1 + b1, not carol's or dave's
  assert.equal(o.kpis.inTransit, 1);
  assert.equal(o.kpis.atDestination, 0);            // carol's is excluded
  assert.equal(o.kpis.arriving7d, 1);
  assert.equal(o.kpis.inboxWaiting30d, 3);          // m1 + m2 + bob's low
  assert.equal(o.kpis.urgentHighWaiting30d, 1);
  assert.equal(o.kpis.avgReplyMinutes30d, 40);
  assert.deepEqual(o.kpis.quotesAwaiting, { count: 3, valueByCurrency: { USD: 1700, EUR: 500 } }); // all members' sessions
  assert.equal(o.kpis.ratesExpiring30d, 1);
  assert.equal(o.kpis.aiSuggestions, 2);            // a2 + b2 (team count)
  assert.equal(o.kpis.myAiSuggestions, 1);
  assert.deepEqual(o.suggestions.map(s => s.id), ['a2']); // strip stays your own queue
});

test('team: second team (B) gets only its own counts', async () => {
  const o = await team('carol', 'sC1');
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

test('user without a team: team request falls back to me', async () => {
  const o = await team('dave', 'sD1');
  assert.equal(o.scope.kind, 'user');
  assert.equal(o.scope.mode, 'me');
  assert.equal(o.scope.hasTeam, false);
  assert.equal(o.kpis.activeShipments, 1);
  assert.equal(o.kpis.inboxWaiting30d, 0);
  assert.equal(o.kpis.avgReplyMinutes30d, null);    // no data -> null, not 0
  assert.deepEqual(o.kpis.quotesAwaiting, { count: 0, valueByCurrency: {} });
});

test('inbox view list matches the card count', async () => {
  for (const [user, sid] of [['alice', 'sA1'], ['bob', 'sB1'], ['carol', 'sC1'], ['dave', 'sD1']]) {
    const o = await me(user, sid);
    const awaiting = await listWaitingEmails(db, user, 'awaiting', NOW);
    const urgent = await listWaitingEmails(db, user, 'urgent', NOW);
    assert.equal(awaiting.length, o.kpis.inboxWaiting30d, `${user} awaiting`);
    assert.equal(urgent.length, o.kpis.urgentHighWaiting30d, `${user} urgent`);
    assert.ok(awaiting.every(e => e.user_id === user && !e.replied_at));
  }
  const a = await listWaitingEmails(db, 'alice', 'awaiting', NOW);
  assert.deepEqual(a.map(e => e.email_id), ['m1', 'm2']); // newest first, own only
});

test('port codes only when both ends resolve', async () => {
  const o = await team('alice', 'sA1');
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
