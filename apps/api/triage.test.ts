// Run: npx tsx --test triage.test.ts
// Header combinations below are taken from real inbox messages.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isBulkMail, freightScore, headerMap, hasFreightSignals } from './triage';

const fcl = {
  headers: headerMap([{ name: 'From', value: 'Larissa Souza <larissmedsouza@gmail.com>' }, { name: 'Subject', value: 'Ocean shipment- FCL12345' }]),
  from: 'Larissa Souza <larissmedsouza@gmail.com>',
  subject: 'Ocean shipment- FCL12345',
  body: 'Please send follow up for the shipment rotterdam to santos sao paulo. Container: FCL12345 Best Regards, Larissa Souza.',
};

test('a personal freight email is not bulk', () => {
  assert.deepEqual(isBulkMail(fcl), { bulk: false, reasons: [] });
  assert.ok(freightScore(fcl) > 0);
});

test('List-Unsubscribe marks newsletters, even when they mention shipments', () => {
  const r = isBulkMail({
    headers: headerMap([{ name: 'List-Unsubscribe', value: '<mailto:u@shipsgo.com>' }]),
    from: 'Shipsgo <hello@shipsgo.com>', subject: 'Shipment Departed I Sample Notification',
    body: 'Container MSKU1234565 departed. Vessel ETA updated.',
  });
  assert.equal(r.bulk, true);
  assert.deepEqual(r.reasons, ['List-Unsubscribe header']);
});

test('Precedence: bulk and marketing-platform headers', () => {
  const r = isBulkMail({ headers: headerMap([{ name: 'Precedence', value: 'bulk' }, { name: 'X-HS-Cid', value: 'x' }]), from: '"Joel @ ngrok" <team@m.ngrok.com>' });
  assert.equal(r.bulk, true);
  assert.ok(r.reasons.includes('Precedence: bulk'));
  assert.ok(r.reasons.includes('Email-marketing platform headers'));
});

test('Gmail Promotions category', () => {
  assert.equal(isBulkMail({ labels: ['INBOX', 'CATEGORY_PROMOTIONS'], from: 'a@b.com' }).bulk, true);
});

test('automated senders without freight content are bulk', () => {
  assert.equal(isBulkMail({ from: 'Google <noreply-accounts@google.com>', subject: 'You shared some Google Account data with Stripe' }).bulk, true);
  assert.equal(isBulkMail({ from: 'Stripe <notifications@stripe.com>', subject: 'A new passkey has been added' }).bulk, true);
  assert.equal(isBulkMail({ from: 'News <info@news.example.com>', subject: 'Our autumn update' }).bulk, true);
});

test('a carrier no-reply tracking notice is still freight', () => {
  const carrier = { from: 'Maersk <no-reply@maersk.com>', subject: 'Arrival notice MSKU 482019 3', body: 'Vessel MAERSK EINDHOVEN, ETA Rotterdam 14 Oct. B/L 248119.' };
  assert.equal(hasFreightSignals(carrier), true);
  assert.equal(isBulkMail(carrier).bulk, false);
});

test('Feedback-ID / SES alone is not a marketing signal (forwarders use SES too)', () => {
  assert.equal(isBulkMail({ headers: headerMap([{ name: 'Feedback-ID', value: '1' }, { name: 'X-SES-Outgoing', value: '1' }]), from: 'Ops <ops@forwarder.com>', subject: 'Booking confirmation' }).bulk, false);
});

test('bulk run order: freight first, bulk last', () => {
  const emails = [
    { id: 'news', headers: headerMap([{ name: 'List-Unsubscribe', value: 'x' }]), from: 'hello@shipsgo.com', subject: 'Track your first shipment' },
    { id: 'hello', from: 'Kees <kees@client.nl>', subject: 'Hello', body: 'Lunch on Friday?' },
    { id: 'fcl', ...fcl },
  ];
  const order = [...emails].sort((a, b) => freightScore(b) - freightScore(a)).map(e => e.id);
  assert.deepEqual(order, ['fcl', 'hello', 'news']);
});
