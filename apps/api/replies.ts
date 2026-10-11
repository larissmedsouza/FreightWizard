// Reply status and drafts, read from the mailbox itself.
//
// An email counts as replied when its thread (Gmail threadId / Outlook
// conversationId) contains a message the user sent after it, wherever that
// reply was sent from (Freightwizard, Gmail, the add-on, Outlook, mobile).
// The reply time is the first such message; the response time is measured
// from when the email arrived. Once recorded, a reply is never removed: a
// send recorded by Freightwizard or the add-on counts even if it isn't in the
// thread (older replies were sent as new threads). A draft is the user's latest unsent draft in
// the thread written after the email.
//
// The Inbox, the Overview cards and GET /api/emails/waiting all go through
// this module, and email_analysis.replied_at / response_time_minutes store
// its result. Pure logic with an injected mailbox and store; covered by
// replies.test.ts.

export interface ThreadMessage {
  id: string;
  /** Received time for incoming mail, sent time for sent mail, last edit for drafts (ms). */
  at: number;
  /** Sent by the mailbox owner (and not a draft). */
  sent: boolean;
  draft: boolean;
}

export interface ReplyState {
  /** When the email arrived (ms), from the thread. */
  receivedAt: number;
  repliedAt: string | null;
  responseMinutes: number | null;
  draft: { id: string; at: string } | null;
}

/** Reply status of one email from its thread, or null if the email isn't in the thread. */
export function replyState(emailId: string, thread: ThreadMessage[]): ReplyState | null {
  const email = thread.find(m => m.id === emailId);
  if (!email) return null;
  const after = thread.filter(m => m.id !== emailId && m.at > email.at);
  const reply = after.filter(m => m.sent && !m.draft).sort((a, b) => a.at - b.at)[0];
  const draft = after.filter(m => m.draft).sort((a, b) => b.at - a.at)[0];
  return {
    receivedAt: email.at,
    repliedAt: reply ? new Date(reply.at).toISOString() : null,
    responseMinutes: reply ? Math.round((reply.at - email.at) / 60_000) : null,
    draft: draft ? { id: draft.id, at: new Date(draft.at).toISOString() } : null,
  };
}

// ---- Provider mappings ------------------------------------------------------

/** Gmail users.threads.get (any format): SENT and DRAFT come from the labels. */
export function fromGmailThread(messages: { id?: string | null; internalDate?: string | null; labelIds?: string[] | null }[]): ThreadMessage[] {
  return messages
    .filter(m => m.id && m.internalDate)
    .map(m => {
      const labels = m.labelIds || [];
      const draft = labels.includes('DRAFT');
      return { id: m.id!, at: Number(m.internalDate), sent: !draft && labels.includes('SENT'), draft };
    });
}

/** Outlook /me/messages filtered by conversationId. Sent = in Sent Items or from the mailbox's own address. */
export function fromOutlookConversation(
  messages: { id: string; from?: { emailAddress?: { address?: string } }; isDraft?: boolean; parentFolderId?: string; sentDateTime?: string; receivedDateTime?: string; lastModifiedDateTime?: string }[],
  opts: { userEmail: string; sentFolderId?: string | null },
): ThreadMessage[] {
  const me = opts.userEmail.toLowerCase();
  return messages.map(m => {
    const draft = !!m.isDraft;
    const fromMe = (m.from?.emailAddress?.address || '').toLowerCase() === me;
    const inSent = !!opts.sentFolderId && m.parentFolderId === opts.sentFolderId;
    const sent = !draft && (inSent || fromMe);
    const time = draft ? m.lastModifiedDateTime : sent ? (m.sentDateTime || m.receivedDateTime) : (m.receivedDateTime || m.sentDateTime);
    return { id: m.id, at: Date.parse(time || ''), sent, draft };
  }).filter(m => Number.isFinite(m.at));
}

// ---- Storing the result ------------------------------------------------------

export interface StoredReply { replied_at: string | null; response_time_minutes: number | null }

const sameTime = (a: string | null, b: string | null) =>
  a === b || (!!a && !!b && Date.parse(a) === Date.parse(b));

// A stored reply this much earlier than the thread's first reply is a separate,
// earlier send (e.g. one that started its own thread), not the same message
// recorded a moment after sending.
const SAME_SEND_MS = 60_000;

/**
 * The reply status to store: once recorded, a reply is never removed. The
 * thread's first reply sets the time, unless an earlier send was already
 * recorded (by Freightwizard or the add-on), which stays first.
 */
export function mergeReply(stored: StoredReply, state: Pick<ReplyState, 'repliedAt' | 'responseMinutes'> & { receivedAt?: number }): StoredReply {
  const kept = { replied_at: stored.replied_at, response_time_minutes: stored.response_time_minutes ?? null };
  if (!state.repliedAt) return kept;
  const storedAt = stored.replied_at ? Date.parse(stored.replied_at) : NaN;
  if (Number.isFinite(storedAt) && storedAt < Date.parse(state.repliedAt) - SAME_SEND_MS) {
    const minutes = kept.response_time_minutes ?? (state.receivedAt != null ? Math.max(0, Math.round((storedAt - state.receivedAt) / 60_000)) : null);
    return { replied_at: stored.replied_at, response_time_minutes: minutes };
  }
  return { replied_at: state.repliedAt, response_time_minutes: state.responseMinutes };
}

/** The update that brings a stored row in line with mergeReply, or null if it already is. */
export function replyPatch(stored: StoredReply, state: Pick<ReplyState, 'repliedAt' | 'responseMinutes'> & { receivedAt?: number }): StoredReply | null {
  const next = mergeReply(stored, state);
  if (sameTime(stored.replied_at, next.replied_at) && (stored.response_time_minutes ?? null) === next.response_time_minutes) return null;
  return next;
}

/**
 * Right after a reply was sent from Freightwizard, before the mailbox shows it:
 * the email is replied now, unless the mailbox already has an earlier reply.
 */
export function sentNowState(state: ReplyState, now: Date): ReplyState {
  if (state.repliedAt) return state;
  return { ...state, repliedAt: now.toISOString(), responseMinutes: Math.max(0, Math.round((now.getTime() - state.receivedAt) / 60_000)) };
}

// ---- Syncing analysed emails with the mailbox ---------------------------------

export interface Mailbox {
  /** Thread ID of one message, or null if it can't be read. */
  threadIdOf(messageId: string): Promise<string | null>;
  /** Every message in a thread, or null if the thread can't be read. */
  thread(threadId: string): Promise<ThreadMessage[] | null>;
}

export interface ReplyStore {
  /** Update one email_analysis row of this user. */
  save(emailId: string, patch: Partial<StoredReply> & { thread_id?: string }): Promise<void>;
  /** Record a newly found reply in email_activity (activity feed, leaderboard). */
  recordReplied(emailId: string, responseMinutes: number | null): Promise<void>;
}

export interface AnalysedRow extends StoredReply { email_id: string; thread_id?: string | null }

/** Caches threads for one request, so emails in the same thread cost one lookup. */
export function cachedMailbox(inner: Mailbox): Mailbox {
  const threads = new Map<string, Promise<ThreadMessage[] | null>>();
  return {
    threadIdOf: id => inner.threadIdOf(id),
    thread: id => {
      if (!threads.has(id)) threads.set(id, inner.thread(id).catch(() => null));
      return threads.get(id)!;
    },
  };
}

/**
 * Brings stored reply status in line with the mailbox for these rows and
 * returns each email's state. Rows whose thread can't be read are left as they
 * are (a lookup failure never clears a reply).
 */
export async function syncReplies(mailbox: Mailbox, store: ReplyStore, rows: AnalysedRow[], opts: { concurrency?: number } = {}): Promise<Map<string, ReplyState>> {
  const out = new Map<string, ReplyState>();
  const size = opts.concurrency || 8;
  for (let i = 0; i < rows.length; i += size) {
    await Promise.all(rows.slice(i, i + size).map(async row => {
      try {
        const threadId = row.thread_id || await mailbox.threadIdOf(row.email_id);
        if (!threadId) return;
        const thread = await mailbox.thread(threadId);
        const found = thread && replyState(row.email_id, thread);
        if (!found) return;
        const merged = mergeReply(row, found);
        out.set(row.email_id, { ...found, repliedAt: merged.replied_at, responseMinutes: merged.response_time_minutes });
        const patch = replyPatch(row, found);
        const update = { ...(patch || {}), ...(row.thread_id ? {} : { thread_id: threadId }) };
        if (Object.keys(update).length) await store.save(row.email_id, update);
        if (!row.replied_at && merged.replied_at) await store.recordReplied(row.email_id, merged.response_time_minutes);
      } catch {
        // One unreadable email must not stop the others.
      }
    }));
  }
  return out;
}
