// Which Supabase project may this process use?
//
// Locally the API must run against the development project. It refuses to
// start when SUPABASE_URL points at production, so local code can't read or
// write real customer data by accident. On Vercel the project's own
// environment variables decide.
//
// Deliberate exception (e.g. a one-off production fix): set
// FW_ALLOW_PRODUCTION_DB to the production project ref in the shell for that
// one command. It is ignored when it comes from an env file, so it can't be
// left switched on. Covered by db-guard.test.ts.

/** Production Supabase project refs (the subdomain of SUPABASE_URL). Not secret. */
export const PRODUCTION_SUPABASE_REFS = ['gctiartkhikyjgdrrfgt'];

export type GuardResult =
  | { ok: true; ref: string; production: boolean }
  | { ok: false; message: string };

/** Session IDs of the seeded fake accounts (supabase/seed.sql): ?session=dev-owner. */
export const DEV_SESSION_PREFIX = 'dev-';

/**
 * The dev-* session shortcut works only when the API runs locally against the
 * development project; on Vercel or against production such an ID is rejected
 * before any database lookup. Real session IDs never contain a '-'.
 */
export function sessionIdAllowed(sessionId: string, ctx: { onVercel: boolean; production: boolean }): boolean {
  if (!sessionId.startsWith(DEV_SESSION_PREFIX)) return true;
  return !ctx.onVercel && !ctx.production;
}

/** Where this process runs, for sessionIdAllowed. A failed guard counts as production. */
export function sessionContext(env: Record<string, string | undefined>, check: GuardResult): { onVercel: boolean; production: boolean } {
  return { onVercel: !!env.VERCEL, production: 'ref' in check ? check.production : true };
}

export function projectRef(url: string | undefined): string | null {
  try { return new URL(url || '').hostname.split('.')[0] || null; } catch { return null; }
}

export function databaseGuard(env: Record<string, string | undefined>, opts: { onVercel: boolean; keysFromFiles: Set<string> }): GuardResult {
  const ref = projectRef(env.SUPABASE_URL);
  if (!ref) return { ok: false, message: 'SUPABASE_URL is not set. Locally it comes from .env.development (see apps/api/README.md).' };
  const production = PRODUCTION_SUPABASE_REFS.includes(ref);
  if (opts.onVercel || !production) return { ok: true, ref, production };

  const override = env.FW_ALLOW_PRODUCTION_DB;
  if (override === ref && !opts.keysFromFiles.has('FW_ALLOW_PRODUCTION_DB')) return { ok: true, ref, production };

  return {
    ok: false,
    message: [
      `Refusing to start: SUPABASE_URL points at the PRODUCTION database (${ref}).`,
      'Local code runs against the development project: put its URL and keys in .env.development',
      '(see apps/api/README.md) and remove the production SUPABASE_* values from .env.',
      opts.keysFromFiles.has('FW_ALLOW_PRODUCTION_DB')
        ? 'FW_ALLOW_PRODUCTION_DB was found in an env file and is ignored there; set it in the shell for one command only.'
        : 'For a deliberate one-off run against production, set FW_ALLOW_PRODUCTION_DB=<project ref> in the shell for that command.',
    ].join('\n'),
  };
}
