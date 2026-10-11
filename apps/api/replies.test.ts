// Reply status from the mailbox (replies.ts).
// Run: npx tsx --test replies.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  replyState, fromGmailThread, fromOutlookConversation, replyPatch, sentNowState,
  syncReplies, cachedMailbox, type Mailbox, type ThreadMessage, type ReplyStore,
} from './replies';

const T0 = Date.parse('2026-10-10T08:00:00Z');
const min = (n: number) => T0 + n * 60_000;

test('a reply after the email marks it replied, with the response time from arrival', () => {
  const thread: ThreadMessage[] = [
    { id: 'in1', at: min(0), sent: false, draft: false },
    { id: 'out1', at: min(45), sent: true, draft: false },
    { id: 'out2', at: min(90), sent: true, draft: false },
  ];
  const s = replyState('in1', thread)!;
  assert.equal(s.repliedAt, new Date(min(45)).toISOString()); // the first reply counts
  assert.equal(s.responseMinutes, 45);
  assert.equal(s.draft, null);
});

test('a sent message before the email is not a reply to it', () => {
  // Thread: we wrote first, the customer answered; their answer is still waiting.
  const thread: ThreadMessage[] = [
    { id: 'out0', at: min(0), sent: true, draft: false },
    { id: 'in1', at: min(30), sent: false, draft: false },
  ];
  assert.equal(replyState('in1', thread)!.repliedAt, null);
});

test('a draft is not a reply; the latest draft after the email is reported', () => {
  const thread: ThreadMessage[] = [
    { id: 'in1', at: min(0), sent: false, draft: false },
    { id: 'd1', at: min(10), sent: false, draft: true },
    { id: 'd2', at: min(20), sent: false, draft: true },
  ];
  const s = replyState('in1', thread)!;
  assert.equal(s.repliedAt, null);
  assert.deepEqual(s.draft, { id: 'd2', at: new Date(min(20)).toISOString() });
});

test('an email missing from its thread has no state (deleted / moved)', () => {
  assert.equal(replyState('gone', [{ id: 'x', at: min(0), sent: false, draft: false }]), null);
});

test('Gmail: SENT label = sent, DRAFT label = draft (never both)', () => {
  const msgs = fromGmailThread([
    { id: 'in1', internalDate: String(min(0)), labelIds: ['INBOX', 'UNREAD'] },
    { id: 'out1', internalDate: String(min(5)), labelIds: ['SENT'] },
    { id: 'd1', internalDate: String(min(6)), labelIds: ['DRAFT', 'SENT'] },
  ]);
  assert.deepEqual(msgs.map(m => [m.id, m.sent, m.draft]), [['in1', false, false], ['out1', true, false], ['d1', false, true]]);
});

test('Outlook: sent = in Sent Items or from my address; drafts use their last edit time', () => {
  const msgs = fromOutlookConversation([
    { id: 'in1', from: { emailAddress: { address: 'customer@x.com' } }, receivedDateTime: new Date(min(0)).toISOString(), parentFolderId: 'INBOX' },
    { id: 'out1', from: { emailAddress: { address: 'Me@Outlook.com' } }, sentDateTime: new Date(min(12)).toISOString(), parentFolderId: 'ARCHIVE' },
    { id: 'out2', from: { emailAddress: { address: 'alias@company.com' } }, sentDateTime: new Date(min(20)).toISOString(), parentFolderId: 'SENT' },
    { id: 'd1', from: { emailAddress: { address: 'me@outlook.com' } }, isDraft: true, lastModifiedDateTime: new Date(min(30)).toISOString(), parentFolderId: 'DRAFTS' },
  ], { userEmail: 'me@outlook.com', sentFolderId: 'SENT' });
  assert.deepEqual(msgs.map(m => [m.id, m.sent, m.draft]), [['in1', false, false], ['out1', true, false], ['out2', true, false], ['d1', false, true]]);
  const s = replyState('in1', msgs)!;
  assert.equal(s.responseMinutes, 12);
  assert.equal(s.draft?.id, 'd1');
});

test('replyPatch: no write when the row already matches the mailbox', () => {
  const at = new Date(min(45)).toISOString();
  assert.equal(replyPatch({ replied_at: at.replace('Z', '+00:00').replace('.000', ''), response_time_minutes: 45 }, { repliedAt: at, responseMinutes: 45 }), null);
  assert.deepEqual(replyPatch({ replied_at: null, response_time_minutes: null }, { repliedAt: at, responseMinutes: 45 }), { replied_at: at, response_time_minutes: 45 });
  // A wrong stored time (old first-seen based value) is corrected
  assert.deepEqual(replyPatch({ replied_at: at, response_time_minutes: 300657 }, { repliedAt: at, responseMinutes: 45 }), { replied_at: at, response_time_minutes: 45 });
  // The mailbox has no reply: a stored reply is cleared
  assert.deepEqual(replyPatch({ replied_at: at, response_time_minutes: 45 }, { repliedAt: null, responseMinutes: null }), { replied_at: null, response_time_minutes: null });
});

test('sentNowState: just sent from Freightwizard counts as replied now, an earlier reply wins', () => {
  const base = { receivedAt: min(0), repliedAt: null, responseMinutes: null, draft: null };
  const s = sentNowState(base, new Date(min(30)));
  assert.equal(s.responseMinutes, 30);
  const earlier = { ...base, repliedAt: new Date(min(10)).toISOString(), responseMinutes: 10 };
  assert.equal(sentNowState(earlier, new Date(min(30))).responseMinutes, 10);
});

// ---- syncReplies -----------------------------------------------------------

function fakeMailbox(threads: Record<string, ThreadMessage[]>, threadOf: Record<string, string>, calls: string[] = []): Mailbox {
  return {
    threadIdOf: async id => { calls.push(`msg:${id}`); return threadOf[id] || null; },
    thread: async id => { calls.push(`thread:${id}`); if (id === 'broken') throw new Error('500'); return threads[id] || null; },
  };
}
function fakeStore() {
  const saved: Record<string, any> = {};
  const activity: [string, number | null][] = [];
  const store: ReplyStore = {
    save: async (id, patch) => { saved[id] = { ...(saved[id] || {}), ...patch }; },
    recordReplied: async (id, m) => { activity.push([id, m]); },
  };
  return { store, saved, activity };
}

const threads: Record<string, ThreadMessage[]> = {
  // Replied from Gmail / mobile / another client: only the mailbox knows
  tA: [{ id: 'a', at: min(0), sent: false, draft: false }, { id: 'a-re', at: min(15), sent: true, draft: false }],
  // Draft saved in Gmail, nothing sent
  tB: [{ id: 'b', at: min(0), sent: false, draft: false }, { id: 'b-dr', at: min(5), sent: false, draft: true }],
  // Two emails in one thread, one reply after both
  tC: [{ id: 'c1', at: min(0), sent: false, draft: false }, { id: 'c2', at: min(10), sent: false, draft: false }, { id: 'c-re', at: min(70), sent: true, draft: false }],
};

test('syncReplies: replies sent anywhere are stored once, with mailbox times and thread IDs', async () => {
  const calls: string[] = [];
  const mailbox = cachedMailbox(fakeMailbox(threads, { a: 'tA', b: 'tB' }, calls));
  const { store, saved, activity } = fakeStore();
  const states = await syncReplies(mailbox, store, [
    { email_id: 'a', thread_id: null, replied_at: null, response_time_minutes: null },
    { email_id: 'b', thread_id: null, replied_at: null, response_time_minutes: null },
    { email_id: 'c1', thread_id: 'tC', replied_at: null, response_time_minutes: null },
    { email_id: 'c2', thread_id: 'tC', replied_at: null, response_time_minutes: null },
  ]);

  assert.deepEqual(saved.a, { replied_at: new Date(min(15)).toISOString(), response_time_minutes: 15, thread_id: 'tA' });
  assert.deepEqual(saved.b, { thread_id: 'tB' }); // a draft is not a reply
  assert.equal(states.get('b')?.draft?.id, 'b-dr');
  assert.equal(saved.c1.response_time_minutes, 70);
  assert.equal(saved.c2.response_time_minutes, 60);
  assert.deepEqual(activity.sort(), [['a', 15], ['c1', 70], ['c2', 60]]);
  assert.equal(calls.filter(c => c === 'thread:tC').length, 1, 'one lookup per thread');
});

test('syncReplies: nothing is written when the row already matches; a failed lookup changes nothing', async () => {
  const mailbox = cachedMailbox(fakeMailbox(threads, {}));
  const { store, saved, activity } = fakeStore();
  const replied = new Date(min(15)).toISOString();
  await syncReplies(mailbox, store, [
    { email_id: 'a', thread_id: 'tA', replied_at: replied, response_time_minutes: 15 },
    { email_id: 'x', thread_id: 'broken', replied_at: replied, response_time_minutes: 5 },
    { email_id: 'y', thread_id: 'missing', replied_at: replied, response_time_minutes: 5 },
    { email_id: 'z', thread_id: null, replied_at: null, response_time_minutes: null }, // message not found
  ]);
  assert.deepEqual(saved, {});
  assert.deepEqual(activity, []);
});

// ---- Overview counts follow the mailbox ------------------------------------

import { buildOverview, listWaitingEmails, type Db, type QueryBuilder } from './overview';

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

test('Overview: replies sent outside Freightwizard leave "not replied" and set the average reply time', async () => {
  const NOW = new Date(min(24 * 60));
  const created = new Date(min(0)).toISOString();
  const email_analysis = [
    // Replied from Gmail on the phone, 30 minutes after arrival
    { user_id: 'u', email_id: 'e1', thread_id: null, priority: 'urgent', intent: 'quote_request', replied_at: null, response_time_minutes: null, created_at: created },
    // Only a draft: still waiting
    { user_id: 'u', email_id: 'e2', thread_id: null, priority: 'high', intent: 'booking_confirmation', replied_at: null, response_time_minutes: null, created_at: created },
    // Replied in Outlook after 90 minutes
    { user_id: 'u', email_id: 'e3', thread_id: null, priority: 'medium', intent: 'tracking_inquiry', replied_at: null, response_time_minutes: null, created_at: created },
    // Old first-seen based value, corrected from the thread (10 minutes)
    { user_id: 'u', email_id: 'e4', thread_id: null, priority: 'low', intent: 'quote_request', replied_at: new Date(min(10)).toISOString(), response_time_minutes: 300657, created_at: created },
    // Newsletter: never waiting
    { user_id: 'u', email_id: 'nl', thread_id: null, priority: 'low', intent: 'marketing', replied_at: null, response_time_minutes: null, created_at: created },
  ];
  const db = fakeDb({ profiles: [{ id: 'u', team_id: null }], email_analysis });
  const before = (await buildOverview(db, 'u', { now: NOW })).kpis;
  assert.equal(before.inboxWaiting30d, 3);
  assert.equal(before.urgentHighWaiting30d, 2);

  const msg = (id: string, at: number, sent = false, draft = false): ThreadMessage => ({ id, at, sent, draft });
  const mailbox = cachedMailbox(fakeMailbox({
    t1: [msg('e1', min(0)), msg('r1', min(30), true)],
    t2: [msg('e2', min(0)), msg('d2', min(5), false, true)],
    t3: [msg('e3', min(0)), msg('r3', min(90), true)],
    t4: [msg('e4', min(0)), msg('r4', min(10), true)],
  }, { e1: 't1', e2: 't2', e3: 't3', e4: 't4' }));
  const store: ReplyStore = {
    save: async (id, patch) => { Object.assign(email_analysis.find(r => r.email_id === id)!, patch); },
    recordReplied: async () => {},
  };
  await syncReplies(mailbox, store, email_analysis.filter(r => r.intent !== 'marketing'));

  const after = (await buildOverview(db, 'u', { now: NOW })).kpis;
  assert.equal(after.inboxWaiting30d, 1, 'only e2 (draft, not sent) still waits');
  assert.equal(after.urgentHighWaiting30d, 1);
  assert.equal(after.avgReplyMinutes30d, Math.round((30 + 90 + 10) / 3));
  // The Inbox list opened from the card shows exactly the counted emails
  assert.deepEqual((await listWaitingEmails(db, 'u', 'awaiting', NOW)).map(r => r.email_id), ['e2']);
});
