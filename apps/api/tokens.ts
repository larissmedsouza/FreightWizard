// Mailbox access tokens (Gmail and Outlook): refreshed before they expire and
// once more if the provider still answers 401. When the refresh token is
// missing or refused, the user has to sign in again: ReconnectError, which the
// API turns into { reason: 'reconnect_mailbox' } and the Inbox into a
// "Reconnect Outlook / Gmail" message.
//
// Outlook only issues a refresh token when the login asks for offline_access;
// sessions created before that scope was added have none and must reconnect
// once. Pure logic with injected dependencies; covered by tokens.test.ts.

export type Provider = 'google' | 'outlook';

export interface MailTokens {
  access_token: string;
  refresh_token?: string | null;
  /** ms since epoch */
  expiry_date?: number | null;
}

export interface TokenSession {
  sessionId: string;
  provider: Provider;
  tokens: MailTokens;
}

/** Refresh this long before the access token expires. */
export const REFRESH_MARGIN_MS = 5 * 60_000;

export class ReconnectError extends Error {
  constructor(public provider: Provider, reason: string) {
    super(`${provider === 'outlook' ? 'Outlook' : 'Gmail'} needs to be reconnected: ${reason}`);
    this.name = 'ReconnectError';
  }
}

export interface RefreshResponse { access_token: string; refresh_token?: string; expires_in?: number }

export interface TokenDeps {
  /** Calls the provider's token endpoint. Throws ReconnectError when the refresh token is refused. */
  refresh(provider: Provider, refreshToken: string): Promise<RefreshResponse>;
  /** Stores the new tokens on the session row. */
  save(sessionId: string, tokens: MailTokens): Promise<void>;
  now(): number;
}

export function needsRefresh(tokens: MailTokens, now: number): boolean {
  if (!tokens.access_token) return true;
  return tokens.expiry_date != null && tokens.expiry_date - REFRESH_MARGIN_MS <= now;
}

export function tokenManager(deps: TokenDeps) {
  // One refresh per session at a time: parallel requests share it.
  const inflight = new Map<string, Promise<MailTokens>>();

  async function refreshNow(session: TokenSession): Promise<MailTokens> {
    const refreshToken = session.tokens.refresh_token;
    if (!refreshToken) throw new ReconnectError(session.provider, 'no refresh token stored');
    const r = await deps.refresh(session.provider, refreshToken);
    const tokens: MailTokens = {
      access_token: r.access_token,
      // Microsoft rotates refresh tokens; Google keeps the old one
      refresh_token: r.refresh_token || refreshToken,
      expiry_date: deps.now() + (r.expires_in ?? 3600) * 1000,
    };
    await deps.save(session.sessionId, tokens);
    return tokens;
  }

  /** A usable access token for this session, refreshed first when it is (nearly) expired or `force` is set. */
  async function fresh(session: TokenSession, opts: { force?: boolean } = {}): Promise<string> {
    if (!opts.force && !needsRefresh(session.tokens, deps.now())) return session.tokens.access_token;
    let p = inflight.get(session.sessionId);
    if (!p) {
      p = refreshNow(session).finally(() => inflight.delete(session.sessionId));
      inflight.set(session.sessionId, p);
    }
    session.tokens = await p;
    return session.tokens.access_token;
  }

  /** Runs a provider call; on 401 refreshes once and retries. */
  async function withRetry(session: TokenSession, call: (accessToken: string) => Promise<Response>): Promise<Response> {
    const first = await call(await fresh(session));
    if (first.status !== 401) return first;
    return call(await fresh(session, { force: true }));
  }

  return { fresh, withRetry };
}

/** Maps a token-endpoint error to ReconnectError when signing in again is the only fix. */
export function refreshFailure(provider: Provider, status: number, body: { error?: string; error_description?: string } | null): Error {
  // invalid_grant: revoked, expired or (Google testing apps) older than 7 days
  if (status === 400 || status === 401 || body?.error === 'invalid_grant') {
    return new ReconnectError(provider, body?.error || `HTTP ${status}`);
  }
  return new Error(`Token refresh failed for ${provider}: HTTP ${status} ${body?.error || ''}`.trim());
}
