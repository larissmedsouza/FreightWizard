// Who is calling? Every non-public endpoint resolves the caller here.
//
// Accepted proof of identity, in order:
//   1. A Freightwizard login session (?session=… or body.sessionId) — the web app.
//   2. A Google ID token in `Authorization: Bearer …` — the Gmail add-on
//      (Apps Script: ScriptApp.getIdentityToken()). Verified with Google's
//      public keys; the audience must be one of GOOGLE_ADDON_CLIENT_IDS and
//      the email must be verified.
// A plain `userEmail` field is never accepted as identity.
//
// Pure logic with injected dependencies; covered by caller.test.ts.

export interface Caller {
  userId: string;
  email: string;
  via: 'session' | 'google_id_token';
  sessionId?: string;
}

export interface CallerDeps {
  getSession(sessionId: string): Promise<{ userId?: string | null; email: string } | null>;
  /** Returns the verified token payload, or null if the token is invalid/expired/wrong audience. */
  verifyGoogleIdToken(token: string): Promise<{ email?: string; email_verified?: boolean } | null>;
  getOrCreateUser(email: string): Promise<string | null>;
}

type Req = { query?: Record<string, unknown>; body?: Record<string, unknown>; headers?: Record<string, unknown> };

export async function resolveCaller(req: Req, deps: CallerDeps): Promise<Caller | null> {
  const sessionId = (req.query?.session ?? req.body?.sessionId ?? req.body?.session) as string | undefined;
  if (sessionId) {
    // A session was presented: it must be valid. Never fall back to another method.
    const s = await deps.getSession(String(sessionId));
    return s?.userId ? { userId: s.userId, email: s.email, via: 'session', sessionId: String(sessionId) } : null;
  }

  const auth = String(req.headers?.authorization ?? '');
  const m = /^Bearer\s+(\S+)$/i.exec(auth);
  if (m) {
    const payload = await deps.verifyGoogleIdToken(m[1]);
    if (!payload?.email || payload.email_verified !== true) return null;
    const email = payload.email.toLowerCase();
    const userId = await deps.getOrCreateUser(email);
    return userId ? { userId, email, via: 'google_id_token' } : null;
  }

  return null;
}
