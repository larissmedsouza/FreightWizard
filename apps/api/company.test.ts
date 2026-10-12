// Company profile storage rules. Run: npx tsx --test company.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cleanProfileInput, mergeProfile, toApi, companyOwner, type CompanyProfileRow } from './company';
import type { Db, QueryBuilder } from './overview';

const NOW = new Date('2026-10-12T10:00:00Z');
const input = (over: Record<string, unknown> = {}) => {
  const r = cleanProfileInput({ country: 'NL', legalName: 'Voorbeeld B.V.', identifiers: {}, ...over });
  if (!r.ok) throw new Error(r.error);
  return r.value;
};

test('input: country code required, identifier keys and phone checked', () => {
  assert.equal(cleanProfileInput({ country: 'Netherlands' }).ok, false);
  assert.equal(cleanProfileInput({ country: 'NL', identifiers: { NL: { 'bad key': 'x' } } }).ok, false);
  assert.equal(cleanProfileInput({ country: 'NL', phoneNumber: '+31 <script>' }).ok, false);
  assert.equal(cleanProfileInput({ country: 'NL', contactEmail: 'not-an-email' }).ok, false);
  const ok = cleanProfileInput({ country: 'nl', identifiers: { NL: { vat: ' NL123456789B01 ' } }, phoneCountry: 'nl', phoneNumber: '10 123 4567' });
  assert.ok(ok.ok);
  if (ok.ok) {
    assert.equal(ok.value.country, 'NL');
    assert.equal(ok.value.identifiers.NL.vat, 'NL123456789B01');
    assert.equal(ok.value.phoneCountry, 'NL');
  }
});

test('changing country keeps the other countries\' identifiers', () => {
  const nl = mergeProfile(null, input({ identifiers: { NL: { vat: 'NL123456789B01', eori: 'NL123456789', reg: '12345678' } } }), 'u1', 'u1', NOW);
  // Now the company switches to Portugal and only sends Portuguese fields
  const pt = mergeProfile(nl, input({ country: 'PT', identifiers: { PT: { vat: 'PT501234560' } } }), 'u1', 'u1', NOW);
  assert.equal(pt.country, 'PT');
  assert.deepEqual(pt.identifiers, { NL: { vat: 'NL123456789B01', eori: 'NL123456789', reg: '12345678' }, PT: { vat: 'PT501234560' } });
  // And back: the Dutch values are still there
  assert.equal(toApi(mergeProfile(pt, input({ country: 'NL' }), 'u1', 'u1', NOW)).identifiers.NL.reg, '12345678');
});

test('only an explicit empty value removes an identifier', () => {
  const a = mergeProfile(null, input({ identifiers: { NL: { vat: 'NL123456789B01', reg: '12345678' } } }), 'u1', 'u1', NOW);
  const b = mergeProfile(a, input({ identifiers: { NL: { vat: '' } } }), 'u1', 'u1', NOW);
  assert.deepEqual(b.identifiers, { NL: { reg: '12345678' } });
  const c = mergeProfile(b, input({ identifiers: { NL: { reg: '' } } }), 'u1', 'u1', NOW);
  assert.deepEqual(c.identifiers, {});
});

test('a register check is dropped when its number changes, kept otherwise', () => {
  const stored: CompanyProfileRow = {
    ...mergeProfile(null, input({ identifiers: { NL: { vat: 'NL123456789B01', eori: 'NL123456789' } } }), 'u1', 'u1', NOW),
    verifications: { 'NL.vat': { status: 'valid' }, 'NL.eori': { status: 'valid' } },
  };
  const next = mergeProfile(stored, input({ identifiers: { NL: { vat: 'NL999999999B01', eori: 'NL123456789' } } }), 'u1', 'u1', NOW);
  assert.deepEqual(next.verifications, { 'NL.eori': { status: 'valid' } });
});

test('org_id survives saves (set by multi-team phase 1)', () => {
  const stored = { ...mergeProfile(null, input(), 'u1', 'u1', NOW), org_id: 'org-1' };
  assert.equal(mergeProfile(stored, input(), 'u1', 'u2', NOW).org_id, 'org-1');
});

function fakeDb(tables: Record<string, any[]>): Db {
  return {
    from(table: string) {
      let rows = [...(tables[table] || [])];
      const qb: QueryBuilder = {
        select: () => qb,
        eq: (c, v) => { rows = rows.filter(r => r[c] === v); return qb; },
        in: (c, v) => { rows = rows.filter(r => v.includes(r[c])); return qb; },
        gte: () => qb,
        then: (ok, bad) => Promise.resolve({ data: rows, error: null }).then(ok, bad),
      };
      return qb;
    },
  };
}

test('the profile belongs to the company: team members share the manager\'s, only managers edit', async () => {
  const db = fakeDb({
    profiles: [
      { id: 'boss', team_id: 't1', role: 'manager' }, { id: 'member', team_id: 't1', role: 'employee' },
      { id: 'solo', team_id: null, role: null },
    ],
    teams: [{ id: 't1', name: 'Rotterdam Desk', manager_id: 'boss' }],
  });
  assert.deepEqual(await companyOwner(db, 'boss'), { ownerUserId: 'boss', canEdit: true, teamName: 'Rotterdam Desk' });
  assert.deepEqual(await companyOwner(db, 'member'), { ownerUserId: 'boss', canEdit: false, teamName: 'Rotterdam Desk' });
  assert.deepEqual(await companyOwner(db, 'solo'), { ownerUserId: 'solo', canEdit: true, teamName: null });
});
