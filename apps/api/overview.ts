// Operations Overview: read-only counts in one of two scopes.
//   'me'   (default) - exactly the scope of the pages the cards link to, so a
//          card's number matches what the click shows:
//            shipments, email_analysis -> user_id (as /api/shipments, /api/emails)
//            quotes, rate_cards        -> the current session_id (as /api/quotes, /api/rates)
//   'team' - every member of the user's team (profiles.team_id, same as
//          /api/team/leaderboard) and all of their sessions. No list page shows
//          this scope, so team cards are not links. Users without a team fall
//          back to 'me'.
// The database client is injected so the logic can be tested without Supabase.
import { portCode } from './ports';

type Result<T> = { data: T[] | null; error: unknown };
// Minimal subset of the Supabase query builder this module uses.
export interface QueryBuilder<T = any> extends PromiseLike<Result<T>> {
  select(columns: string): QueryBuilder<T>;
  eq(column: string, value: unknown): QueryBuilder<T>;
  in(column: string, values: unknown[]): QueryBuilder<T>;
  gte(column: string, value: unknown): QueryBuilder<T>;
}
export interface Db { from(table: string): QueryBuilder }

const CLOSED_STATUSES = new Set(['delivered', 'closed', 'cancelled']);
const DAY = 86_400_000;

export type OverviewMode = 'me' | 'team';
export interface OverviewScope { kind: 'team' | 'user'; mode: OverviewMode; hasTeam: boolean; name: string | null; members: number; userIds: string[]; sessionIds: string[] }

export async function resolveScope(db: Db, userId: string, mode: OverviewMode = 'me', sessionId?: string): Promise<OverviewScope> {
  const { data: profiles } = await db.from('profiles').select('id, team_id').eq('id', userId);
  const teamId = profiles?.[0]?.team_id || null;

  let userIds = [userId];
  let name: string | null = null;
  if (teamId) {
    const { data: members } = await db.from('profiles').select('id').eq('team_id', teamId);
    userIds = Array.from(new Set([userId, ...(members || []).map((m: any) => m.id)]));
    const { data: teams } = await db.from('teams').select('id, name').eq('id', teamId);
    name = teams?.[0]?.name || null;
  }

  const hasTeam = !!teamId;
  if (mode === 'me' || !hasTeam) {
    return { kind: hasTeam ? 'team' : 'user', mode: 'me', hasTeam, name, members: userIds.length, userIds: [userId], sessionIds: sessionId ? [sessionId] : [] };
  }

  const { data: sessions } = await db.from('gmail_sessions').select('session_id, user_id').in('user_id', userIds);
  const sessionIds = Array.from(new Set((sessions || []).map((s: any) => s.session_id).filter(Boolean)));

  return { kind: 'team', mode: 'team', hasTeam, name, members: userIds.length, userIds, sessionIds };
}

// ---- Inbox: analysed emails still waiting for a reply ----------------------
// One definition shared by the Overview cards and GET /api/emails/waiting, so
// the card count and the Inbox list cannot drift apart.
export type WaitingView = 'awaiting' | 'urgent';
// Newsletters labelled 'marketing' (triage.ts) are not customer mail.
const isWaiting = (e: any, view: WaitingView) =>
  !e.replied_at && e.intent !== 'marketing' && (view === 'awaiting' || ['urgent', 'high'].includes(String(e.priority || '').toLowerCase()));

/** The current user's analysed, unreplied emails from the last 30 days (newest first). */
export async function listWaitingEmails(db: Db, userId: string, view: WaitingView, now: Date = new Date()) {
  const ago30 = new Date(now.getTime() - 30 * DAY).toISOString();
  const { data } = await db.from('email_analysis').select('*').eq('user_id', userId).gte('created_at', ago30);
  return ((data || []) as any[])
    .filter(e => isWaiting(e, view))
    .sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)));
}

const dateOnly = (d: Date) => d.toISOString().slice(0, 10);

export async function buildOverview(db: Db, userId: string, opts: { mode?: OverviewMode; sessionId?: string; now?: Date } = {}) {
  const now = opts.now || new Date();
  const scope = await resolveScope(db, userId, opts.mode || 'me', opts.sessionId);
  const today = dateOnly(now);
  const in7 = dateOnly(new Date(now.getTime() + 7 * DAY));
  const in30 = dateOnly(new Date(now.getTime() + 30 * DAY));
  const ago30 = new Date(now.getTime() - 30 * DAY).toISOString();

  const [shipRes, emailRes, repliedRes, quoteRes, rateRes] = await Promise.all([
    db.from('shipments').select('id, user_id, approved, status, reference, customer, origin, destination, mode, eta, t49_pod_eta, created_at, email_subject, update_target_id').in('user_id', scope.userIds),
    db.from('email_analysis').select('user_id, intent, priority, replied_at, created_at').in('user_id', scope.userIds).gte('created_at', ago30),
    db.from('email_analysis').select('user_id, replied_at, response_time_minutes').in('user_id', scope.userIds).gte('replied_at', ago30),
    scope.sessionIds.length ? db.from('quotes').select('id, session_id, status, sell_rate, currency').in('session_id', scope.sessionIds) : Promise.resolve({ data: [], error: null }),
    scope.sessionIds.length ? db.from('rate_cards').select('id, session_id, is_active, validity_end').in('session_id', scope.sessionIds) : Promise.resolve({ data: [], error: null }),
  ]);

  const shipments = (shipRes.data || []) as any[];
  const approved = shipments.filter(s => s.approved);
  const active = approved.filter(s => !CLOSED_STATUSES.has(s.status));
  const etaOf = (s: any): string | null => (s.t49_pod_eta || s.eta || null) && String(s.t49_pod_eta || s.eta).slice(0, 10);

  const recentEmails = (emailRes.data || []) as any[];
  const repliedRecent = ((repliedRes.data || []) as any[]).filter(e => typeof e.response_time_minutes === 'number');

  const quotes = (quoteRes.data || []) as any[];
  const sentQuotes = quotes.filter(q => q.status === 'sent');
  const quoteValue: Record<string, number> = {};
  for (const q of sentQuotes) {
    const cur = q.currency || 'USD';
    quoteValue[cur] = (quoteValue[cur] || 0) + (Number(q.sell_rate) || 0);
  }

  const rates = (rateRes.data || []) as any[];

  // AI suggestions: Approve only works on your own suggestions
  // (POST /api/shipments/:id/approve checks ownership), so the strip is always
  // the current user's review queue. The count follows the scope.
  const pending = shipments.filter(s => !s.approved);
  const myPending = pending
    .filter(s => s.user_id === userId)
    .sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)));

  const row = (s: any) => {
    const originCode = portCode(s.origin);
    const destinationCode = portCode(s.destination);
    const both = originCode && destinationCode;
    return {
      id: s.id, reference: s.reference, customer: s.customer, origin: s.origin, destination: s.destination,
      originCode: both ? originCode : null, destinationCode: both ? destinationCode : null,
      mode: s.mode, status: s.status, eta: etaOf(s), mine: s.user_id === userId,
    };
  };

  const upcoming = [...active].sort((a, b) => {
    const ea = etaOf(a), eb = etaOf(b);
    if (ea && eb) return ea.localeCompare(eb);
    return ea ? -1 : eb ? 1 : 0;
  });

  return {
    generatedAt: now.toISOString(),
    scope: { kind: scope.kind, mode: scope.mode, hasTeam: scope.hasTeam, name: scope.name, members: scope.members },
    kpis: {
      activeShipments: active.length,
      arriving7d: active.filter(s => { const e = etaOf(s); return !!e && e >= today && e <= in7; }).length,
      inboxWaiting30d: recentEmails.filter(e => isWaiting(e, 'awaiting')).length,
      urgentHighWaiting30d: recentEmails.filter(e => isWaiting(e, 'urgent')).length,
      avgReplyMinutes30d: repliedRecent.length
        ? Math.round(repliedRecent.reduce((sum, e) => sum + e.response_time_minutes, 0) / repliedRecent.length)
        : null,
      aiSuggestions: pending.length,
      myAiSuggestions: myPending.length,
      bookings: approved.filter(s => s.status === 'booked').length,
      inTransit: approved.filter(s => s.status === 'in_transit').length,
      atDestination: approved.filter(s => s.status === 'at_destination').length,
      quotesAwaiting: { count: sentQuotes.length, valueByCurrency: quoteValue },
      ratesExpiring30d: rates.filter(r => r.is_active && r.validity_end && r.validity_end >= today && r.validity_end <= in30).length,
    },
    suggestions: myPending.slice(0, 3).map(s => ({ ...row(s), emailSubject: s.email_subject || null, isUpdate: !!s.update_target_id })),
    shipments: upcoming.slice(0, 8).map(row),
  };
}
