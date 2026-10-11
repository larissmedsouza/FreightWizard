// The user's mailbox (Gmail API / Microsoft Graph): reading threads for reply
// status, and sending replies and saving drafts inside the original thread, so
// they show up in Gmail/Outlook exactly like replies written there.
import { google } from 'googleapis';
import { fromGmailThread, fromOutlookConversation, type Mailbox } from './replies';

export interface MailSession {
  provider: 'google' | 'outlook';
  email: string;
  tokens: { access_token: string; refresh_token?: string; expiry_date?: number | null };
}

export interface MailConfig {
  google: { clientId?: string; clientSecret?: string; redirectUri: string };
  graphUrl: string;
}

export interface ReplyMessage {
  to: string;
  cc?: string;
  subject: string;
  body: string;
  /** Gmail threadId / Outlook conversationId of the email being answered. */
  threadId?: string | null;
  /** The email being answered (message ID). Without it the message starts a new thread. */
  replyToId?: string | null;
  /** Message ID of an existing draft to update instead of creating a new one. */
  draftId?: string | null;
}

const reSubject = (s: string) => (/^re:/i.test(s.trim()) ? s : `Re: ${s}`);
const addresses = (s?: string) => (s || '').split(/[,;]/).map(a => (a.match(/<(.+?)>/)?.[1] || a).trim()).filter(Boolean);

function gmail(session: MailSession, cfg: MailConfig) {
  const auth = new google.auth.OAuth2(cfg.google.clientId, cfg.google.clientSecret, cfg.google.redirectUri);
  auth.setCredentials(session.tokens as any);
  return google.gmail({ version: 'v1', auth });
}

async function graph(session: MailSession, cfg: MailConfig, path: string, init: { method?: string; body?: unknown } = {}): Promise<any> {
  const r = await fetch(`${cfg.graphUrl}${path}`, {
    method: init.method || 'GET',
    headers: { Authorization: `Bearer ${session.tokens.access_token}`, 'Content-Type': 'application/json' },
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
  });
  if (!r.ok) throw Object.assign(new Error(`Graph ${r.status} ${path.split('?')[0]}`), { status: r.status });
  return r.status === 202 || r.status === 204 ? null : r.json();
}

// ---- Reading -------------------------------------------------------------------

export function mailboxFor(session: MailSession, cfg: MailConfig): Mailbox {
  if (session.provider === 'outlook') {
    let sentFolder: Promise<string | null> | null = null;
    const sentFolderId = () => (sentFolder ||= graph(session, cfg, '/me/mailFolders/sentitems?$select=id').then(f => f?.id || null, () => null));
    return {
      threadIdOf: async id => (await graph(session, cfg, `/me/messages/${encodeURIComponent(id)}?$select=conversationId`).catch(() => null))?.conversationId || null,
      thread: async conversationId => {
        const filter = encodeURIComponent(`conversationId eq '${conversationId.replace(/'/g, "''")}'`);
        const data = await graph(session, cfg, `/me/messages?$filter=${filter}&$select=id,from,isDraft,parentFolderId,sentDateTime,receivedDateTime,lastModifiedDateTime&$top=100`);
        return fromOutlookConversation(data?.value || [], { userEmail: session.email, sentFolderId: await sentFolderId() });
      },
    };
  }
  const g = gmail(session, cfg);
  return {
    threadIdOf: async id => (await g.users.messages.get({ userId: 'me', id, format: 'minimal' }).catch(() => null))?.data.threadId || null,
    thread: async threadId => fromGmailThread((await g.users.threads.get({ userId: 'me', id: threadId, format: 'minimal' })).data.messages || []),
  };
}

export function gmailText(payload: any): string {
  if (!payload) return '';
  if (payload.mimeType === 'text/plain' && payload.body?.data) return Buffer.from(payload.body.data, 'base64').toString('utf-8');
  for (const part of payload.parts || []) {
    const t = gmailText(part);
    if (t) return t;
  }
  if (!payload.parts && payload.body?.data) return htmlToText(Buffer.from(payload.body.data, 'base64').toString('utf-8'));
  return '';
}

export function htmlToText(html: string): string {
  return html
    .replace(/<(style|head|script)[\s\S]*?<\/\1>/gi, '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|li|tr|h\d)>/gi, '\n')
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/g, ' ').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, '&')
    .replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n')
    .trim();
}

/** Plain text of a draft (message ID), or '' if it can't be read. */
export async function draftText(session: MailSession, cfg: MailConfig, draftId: string): Promise<string> {
  try {
    if (session.provider === 'outlook') {
      const m = await graph(session, cfg, `/me/messages/${encodeURIComponent(draftId)}?$select=body`);
      return m?.body?.contentType === 'html' ? htmlToText(m.body.content || '') : (m?.body?.content || '').trim();
    }
    const m = await gmail(session, cfg).users.messages.get({ userId: 'me', id: draftId, format: 'full' });
    return gmailText(m.data.payload).trim();
  } catch {
    return '';
  }
}

// ---- Writing -------------------------------------------------------------------

/** RFC 2822 message for the Gmail API, with the headers that keep it in the thread on both sides. */
export function gmailRaw(m: { to: string; cc?: string; subject: string; body: string; inReplyTo?: string; references?: string }): string {
  const enc = (s: string) => (/^[\x20-\x7e]*$/.test(s) ? s : `=?UTF-8?B?${Buffer.from(s, 'utf-8').toString('base64')}?=`);
  const refs = [m.references, m.inReplyTo].filter(Boolean).join(' ');
  const lines = [
    `To: ${m.to}`,
    ...(m.cc ? [`Cc: ${m.cc}`] : []),
    `Subject: ${enc(m.subject)}`,
    ...(m.inReplyTo ? [`In-Reply-To: ${m.inReplyTo}`] : []),
    ...(refs ? [`References: ${refs}`] : []),
    'MIME-Version: 1.0',
    'Content-Type: text/plain; charset=utf-8',
    'Content-Transfer-Encoding: base64',
    '',
    Buffer.from(m.body, 'utf-8').toString('base64'),
  ];
  return Buffer.from(lines.join('\r\n')).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function gmailUpsertDraft(session: MailSession, cfg: MailConfig, m: ReplyMessage): Promise<{ draftId: string; messageId: string }> {
  const g = gmail(session, cfg);
  let threadId = m.threadId || undefined;
  let inReplyTo: string | undefined;
  let references: string | undefined;
  if (m.replyToId) {
    const orig = await g.users.messages.get({ userId: 'me', id: m.replyToId, format: 'metadata', metadataHeaders: ['Message-ID', 'References'] }).catch(() => null);
    const h = (n: string) => orig?.data.payload?.headers?.find(x => x.name?.toLowerCase() === n.toLowerCase())?.value || undefined;
    inReplyTo = h('Message-ID');
    references = h('References');
    threadId = orig?.data.threadId || threadId;
  }
  const message = { raw: gmailRaw({ to: m.to, cc: m.cc, subject: reSubject(m.subject), body: m.body, inReplyTo, references }), threadId };

  // Gmail addresses drafts by draft ID; the inbox knows the draft's message ID.
  let existing: string | undefined;
  if (m.draftId) {
    const list = await g.users.drafts.list({ userId: 'me', maxResults: 500 });
    existing = list.data.drafts?.find(d => d.message?.id === m.draftId)?.id || undefined;
  }
  const res = existing
    ? await g.users.drafts.update({ userId: 'me', id: existing, requestBody: { id: existing, message } })
    : await g.users.drafts.create({ userId: 'me', requestBody: { message } });
  return { draftId: res.data.id!, messageId: res.data.message?.id || '' };
}

async function outlookUpsertDraft(session: MailSession, cfg: MailConfig, m: ReplyMessage): Promise<string> {
  const content = { body: { contentType: 'Text', content: m.body }, toRecipients: addresses(m.to).map(address => ({ emailAddress: { address } })), ccRecipients: addresses(m.cc).map(address => ({ emailAddress: { address } })) };
  if (m.draftId) {
    try {
      await graph(session, cfg, `/me/messages/${encodeURIComponent(m.draftId)}`, { method: 'PATCH', body: content });
      return m.draftId;
    } catch (e: any) {
      if (e.status !== 404) throw e; // draft was deleted or sent meanwhile: make a new one
    }
  }
  let id: string | null = null;
  if (m.replyToId) {
    // createReply keeps the draft in the email's conversation (sendMail would start a new one)
    id = (await graph(session, cfg, `/me/messages/${encodeURIComponent(m.replyToId)}/createReply`, { method: 'POST', body: {} }).catch((e: any) => { if (e.status !== 404) throw e; return null; }))?.id || null;
  }
  if (id) {
    await graph(session, cfg, `/me/messages/${encodeURIComponent(id)}`, { method: 'PATCH', body: content });
    return id;
  }
  return (await graph(session, cfg, '/me/messages', { method: 'POST', body: { ...content, subject: reSubject(m.subject) } })).id;
}

/** Saves (or updates) a reply draft in the thread. Returns the draft's message ID. */
export async function saveReplyDraft(session: MailSession, cfg: MailConfig, m: ReplyMessage): Promise<string> {
  if (session.provider === 'outlook') return outlookUpsertDraft(session, cfg, m);
  return (await gmailUpsertDraft(session, cfg, m)).messageId;
}

/** Sends a reply in the thread. A draft being edited is sent itself, so it leaves the Drafts folder. */
export async function sendReply(session: MailSession, cfg: MailConfig, m: ReplyMessage): Promise<void> {
  if (session.provider === 'outlook') {
    const id = await outlookUpsertDraft(session, cfg, m);
    await graph(session, cfg, `/me/messages/${encodeURIComponent(id)}/send`, { method: 'POST' });
    return;
  }
  const { draftId } = await gmailUpsertDraft(session, cfg, m);
  await gmail(session, cfg).users.drafts.send({ userId: 'me', requestBody: { id: draftId } });
}
