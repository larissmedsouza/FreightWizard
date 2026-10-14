// Local code never reaches the production database by accident. Run: npx tsx --test db-guard.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { databaseGuard, projectRef, sessionContext, sessionIdAllowed, PRODUCTION_SUPABASE_REFS } from './db-guard';

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

// ---- The ?session=dev-* shortcut (seed.sql) ----------------------------------------
// The server runs exactly this: sessionContext(process.env, databaseGuard(...)) and
// rejects a disallowed session ID in getSession before any database lookup.
const allowedFor = (env: Record<string, string | undefined>, sessionId: string) => {
  const onVercel = !!env.VERCEL;
  const check = databaseGuard(env, { onVercel, keysFromFiles: new Set(['SUPABASE_URL']) });
  return sessionIdAllowed(sessionId, sessionContext(env, check));
};

test('production rejects dev-* sessions: the Vercel production API (VERCEL set, production database)', () => {
  for (const id of ['dev-owner', 'dev-agent', 'dev-solo', 'dev-anything']) {
    assert.equal(allowedFor({ VERCEL: '1', VERCEL_ENV: 'production', SUPABASE_URL: PROD }, id), false, id);
  }
});

test('production rejects dev-* sessions: local code with the deliberate production override', () => {
  const env = { SUPABASE_URL: PROD, FW_ALLOW_PRODUCTION_DB: PRODUCTION_SUPABASE_REFS[0] };
  assert.equal(databaseGuard(env, local).ok, true); // the override lets it start...
  assert.equal(allowedFor(env, 'dev-owner'), false); // ...but never with the shortcut
});

test('dev-* sessions are rejected on any Vercel deployment, even one pointed at the dev project', () => {
  assert.equal(allowedFor({ VERCEL: '1', VERCEL_ENV: 'preview', SUPABASE_URL: DEV }, 'dev-owner'), false);
});

test('dev-* sessions are rejected when the database is unknown (guard failed)', () => {
  assert.equal(allowedFor({}, 'dev-owner'), false);
  assert.equal(allowedFor({ VERCEL: '1' }, 'dev-owner'), false);
});

test('dev-* sessions work only locally against the development project', () => {
  assert.equal(allowedFor({ SUPABASE_URL: DEV }, 'dev-owner'), true);
});

test('real session IDs (random base36, no dash) are never affected', () => {
  const real = Math.random().toString(36).substring(2, 15);
  assert.ok(!real.includes('-'));
  for (const env of [{ SUPABASE_URL: DEV }, { VERCEL: '1', SUPABASE_URL: PROD }]) assert.equal(allowedFor(env, real), true);
});
