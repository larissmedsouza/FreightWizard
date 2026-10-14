// Local code never reaches the production database by accident. Run: npx tsx --test db-guard.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { databaseGuard, projectRef, PRODUCTION_SUPABASE_REFS } from './db-guard';

const PROD = `https://${PRODUCTION_SUPABASE_REFS[0]}.supabase.co`;
const DEV = 'https://devprojectref123.supabase.co';
const local = { onVercel: false, keysFromFiles: new Set<string>(['SUPABASE_URL']) };

test('locally, the development project is allowed', () => {
  const r = databaseGuard({ SUPABASE_URL: DEV }, local);
  assert.deepEqual(r, { ok: true, ref: 'devprojectref123', production: false });
});

test('locally, the production project is refused', () => {
  const r = databaseGuard({ SUPABASE_URL: PROD }, local);
  assert.equal(r.ok, false);
  if (!r.ok) assert.match(r.message, /PRODUCTION database/);
});

test('a missing SUPABASE_URL is refused with a pointer to the setup', () => {
  const r = databaseGuard({}, local);
  assert.equal(r.ok, false);
  if (!r.ok) assert.match(r.message, /\.env\.development/);
});

test('the deliberate override works only from the shell, with the exact project ref', () => {
  const ref = PRODUCTION_SUPABASE_REFS[0];
  assert.equal(databaseGuard({ SUPABASE_URL: PROD, FW_ALLOW_PRODUCTION_DB: ref }, local).ok, true);
  assert.equal(databaseGuard({ SUPABASE_URL: PROD, FW_ALLOW_PRODUCTION_DB: 'yes' }, local).ok, false);
  const fromFile = databaseGuard({ SUPABASE_URL: PROD, FW_ALLOW_PRODUCTION_DB: ref }, { onVercel: false, keysFromFiles: new Set(['SUPABASE_URL', 'FW_ALLOW_PRODUCTION_DB']) });
  assert.equal(fromFile.ok, false);
  if (!fromFile.ok) assert.match(fromFile.message, /ignored/);
});

test('on Vercel the project environment decides', () => {
  assert.equal(databaseGuard({ SUPABASE_URL: PROD }, { onVercel: true, keysFromFiles: new Set() }).ok, true);
});

test('project ref parsing', () => {
  assert.equal(projectRef(PROD), PRODUCTION_SUPABASE_REFS[0]);
  assert.equal(projectRef('not a url'), null);
});
