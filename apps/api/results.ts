// Analysis results for the Gmail add-on (queue + polling), always scoped to
// the caller. Before this, /api/analysis-result and /api/queue-analysis
// looked rows up by email ID alone, so anyone with an email ID could read
// another user's analysis (summary, suggested reply).
// Covered by results.test.ts.
import type { Db } from './overview';
import type { Caller } from './caller';

const pick = (a: any) => ({
  intent: a.intent, priority: a.priority, mode: a.mode,
  pol: a.pol, pod: a.pod, incoterm: a.incoterm,
  cargo_type: a.cargo_type, container_type: a.container_type,
  container_count: a.container_count, missing_info: a.missing_info,
  summary: a.summary, suggested_reply: a.suggested_reply,
});

export type ResultLookup =
  | { status: 'ready'; analysis: any }
  | { status: 'processing' }
  | { status: 'error' }
  | { status: 'not_found' };

/** A queued job still pending after this long was cut off (e.g. a function timeout) and can be retried. */
export const STALE_QUEUE_MS = 5 * 60 * 1000;

/** The caller's own analysis of an email: saved analysis first, then their queue entry. */
export async function findResultForCaller(db: Db, caller: Caller, emailId: string, now: Date = new Date()): Promise<ResultLookup> {
  const { data: saved } = await db.from('email_analysis').select('*').eq('email_id', emailId).eq('user_id', caller.userId);
  if (saved && saved.length) return { status: 'ready', analysis: pick(saved[0]) };

  const { data: queued } = await db.from('analysis_queue').select('status, result, user_email, created_at').eq('email_id', emailId).eq('user_email', caller.email);
  const q = queued?.[0];
  if (!q) return { status: 'not_found' };
  if (q.status === 'done') return { status: 'ready', analysis: q.result };
  if (q.status === 'error') return { status: 'error' };
  // Stuck: the background analysis never finished. Report it as an error so
  // the next queue request retries it instead of polling forever.
  if (q.created_at && now.getTime() - new Date(q.created_at).getTime() > STALE_QUEUE_MS) return { status: 'error' };
  return { status: 'processing' };
}
