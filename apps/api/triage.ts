// Email triage before AI analysis.
//  - isBulkMail: newsletters / marketing / automated mail, decided from headers
//    and the sender, so they can be labelled "Marketing" without a Claude call
//    or an analysis from the quota.
//  - freightScore: rough "is this a freight email?" score used to analyse the
//    most likely freight emails first in bulk runs.
// Pure functions: no I/O, covered by triage.test.ts.

export type Headers = Record<string, string>; // lower-cased header name -> value

export interface TriageInput {
  headers?: Headers;
  labels?: string[];        // Gmail labelIds
  from?: string;
  subject?: string;
  body?: string;
}

export interface BulkResult { bulk: boolean; reasons: string[] }

/** Lower-case header names; later duplicates win. */
export function headerMap(list: { name?: string | null; value?: string | null }[] | undefined): Headers {
  const out: Headers = {};
  for (const h of list || []) if (h?.name) out[h.name.toLowerCase()] = h.value || '';
  return out;
}

// Local parts used by automated senders. Matched against the address before @.
const AUTOMATED_LOCAL = /^(no[-_.]?reply|do[-_.]?not[-_.]?reply|noreply[-_.].*|.*[-_.]noreply|newsletters?|news|marketing|mailer[-_.]?daemon|notifications?|alerts?|updates|promo(tions)?)$/i;
// Sending subdomains typical of email-marketing platforms (e.g. team@m.ngrok.com).
const MARKETING_SUBDOMAIN = /@(m|mail|email|e|news|newsletter|info|mkt|marketing|campaign|go)\.[a-z0-9-]+\.[a-z.]+$/i;
// Headers set by marketing platforms (not by transactional relays like SES).
const ESP_HEADER = /^(x-mailchimp-|x-mc-user|x-campaign|x-campaignid|x-hs-cid|x-hubspot|x-sib-|x-mkt|x-marketo|x-klaviyo|x-customerio|x-cio-)/;

const CONTAINER_NO = /\b[A-Z]{3}U\s?\d{6}\s?\d\b/;
const FREIGHT_TERMS = /\b(b\/?l|mbl|hbl|awb|booking|bkg|eta|etd|vessel|voyage|pol|pod|fcl|lcl|teu|container|incoterms?|fob|cif|exw|dap|ddp|fca|cfr|freight|shipment|cargo|customs|clearance|quote|quotation|rate|pickup|delivery|consignee|shipper|port|reefer|pallets?|cbm|kgs?|ce mercante|afrmm)\b/gi;

function senderAddress(from = ''): string {
  const m = from.match(/<([^>]+)>/);
  return (m ? m[1] : from).trim().toLowerCase();
}

/** Strong freight signals: a container number, or three or more freight terms. */
export function hasFreightSignals(input: TriageInput): boolean {
  const text = `${input.subject || ''}\n${input.body || ''}`;
  if (CONTAINER_NO.test(text)) return true;
  return new Set((text.match(FREIGHT_TERMS) || []).map(t => t.toLowerCase())).size >= 3;
}

export function isBulkMail(input: TriageInput): BulkResult {
  const h = input.headers || {};
  const reasons: string[] = [];

  // Header evidence: always wins (newsletters often talk about shipments too).
  if (h['list-unsubscribe'] || h['list-unsubscribe-post']) reasons.push('List-Unsubscribe header');
  if (h['list-id']) reasons.push('List-Id header');
  if (/\b(bulk|list|junk)\b/i.test(h['precedence'] || '')) reasons.push(`Precedence: ${h['precedence']}`);
  if (Object.keys(h).some(k => ESP_HEADER.test(k))) reasons.push('Email-marketing platform headers');
  if ((input.labels || []).some(l => l === 'CATEGORY_PROMOTIONS' || l === 'CATEGORY_SOCIAL')) reasons.push('Gmail Promotions/Social category');
  if (reasons.length) return { bulk: true, reasons };

  // Sender evidence: weaker. A carrier's no-reply tracking notice is still a
  // freight email, so freight signals override it.
  const addr = senderAddress(input.from);
  const local = addr.split('@')[0] || '';
  if (AUTOMATED_LOCAL.test(local)) reasons.push(`Automated sender (${local}@)`);
  else if (MARKETING_SUBDOMAIN.test(addr)) reasons.push('Marketing sending domain');
  if (/^auto-(generated|replied)$/i.test(h['auto-submitted'] || '')) reasons.push(`Auto-Submitted: ${h['auto-submitted']}`);
  if (reasons.length && !hasFreightSignals(input)) return { bulk: true, reasons };

  return { bulk: false, reasons: [] };
}

/** Higher = more likely a freight email. Bulk mail always sorts last. */
export function freightScore(input: TriageInput): number {
  if (isBulkMail(input).bulk) return -1;
  const text = `${input.subject || ''}\n${input.body || ''}`;
  const terms = new Set((text.match(FREIGHT_TERMS) || []).map(t => t.toLowerCase())).size;
  return terms + (CONTAINER_NO.test(text) ? 3 : 0);
}

/** Analysis row stored for bulk mail instead of calling the AI. */
export function marketingAnalysis(reasons: string[]) {
  return {
    intent: 'marketing', priority: 'low', mode: null, pol: null, pod: null, incoterm: null,
    cargo_type: null, container_type: null, container_count: null, missing_info: [],
    summary: `Newsletter or marketing email (${reasons.join('; ')}). Not sent to AI; no analysis used.`,
    suggested_reply: '',
  };
}
