// Compares the analysis prompt before caching (fixtures/) with the current one
// (prompts.ts) on real emails. Claude varies a little from run to run, so each
// prompt runs twice: a field counts as changed only if before-vs-after agrees
// less often than before-vs-before.
//
//   npx tsx scripts/compare-prompts.ts <session id> [max emails]
//
// Needs the local API (for the inbox) and ANTHROPIC_API_KEY in ../../.env.
// Costs about 4 analyses per email.
import Anthropic from '@anthropic-ai/sdk';
import dotenv from 'dotenv';
import fs from 'node:fs';
import path from 'node:path';
import { ANALYSIS_SYSTEM, analysisUserMessage } from '../prompts';
import { CLAUDE_MODEL, CLAUDE_MAX_TOKENS, replyText, usageOf } from '../claude';

dotenv.config({ path: path.resolve(__dirname, '../../../.env') });
const [sessionId, maxArg] = process.argv.slice(2);
if (!sessionId) { console.error('usage: npx tsx scripts/compare-prompts.ts <session id> [max emails]'); process.exit(1); }
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const before = fs.readFileSync(path.join(__dirname, '../fixtures/analysis-prompt-before-caching.txt'), 'utf8').replace(/\r\n/g, '\n');

const FIELDS = ['intent', 'priority', 'mode', 'pol', 'pod', 'incoterm', 'container_type', 'container_count', 'missing_info', 'identifiers', 'mercante_ids', 'status_hint', 'hs_code'] as const;
const norm = (v: unknown) => (v === null || v === undefined || v === '' ? null : String(v).trim().toLowerCase());
function fields(a: any): Record<(typeof FIELDS)[number], string> {
  const ids = a?.shipment_identifiers || {}, me = a?.mercante_entities || {};
  const pick = (o: any, keys: string[]) => JSON.stringify(keys.map(k => norm(o[k])));
  return {
    intent: String(norm(a?.intent)), priority: String(norm(a?.priority)), mode: String(norm(a?.mode)),
    pol: String(norm(a?.pol)), pod: String(norm(a?.pod)), incoterm: String(norm(a?.incoterm)),
    container_type: String(norm(a?.container_type)), container_count: String(norm(a?.container_count)),
    missing_info: String((a?.missing_info || []).length), // free text differs run to run; compare how many
    identifiers: pick(ids, ['reference', 'booking_number', 'container_number', 'bl_number']),
    mercante_ids: pick(me, ['ce_number', 'bl_number', 'container_number', 'importer_cnpj']),
    status_hint: String(norm(a?.shipment_status_hint)), hs_code: String(norm(a?.hs_code)),
  };
}
const parse = (text: string) => { const m = text.match(/\{[\s\S]*\}/); try { return m ? JSON.parse(m[0]) : null; } catch { return null; } };

async function runBefore(e: any) {
  const content = before
    .replace("${language === 'pt' ? 'Brazilian Portuguese' : language === 'nl' ? 'Dutch' : 'English'}", 'English')
    .replace('${subject}', e.subject).replace('${from}', e.from).replace('${body}', e.body);
  const m = await anthropic.messages.create({ model: CLAUDE_MODEL, max_tokens: CLAUDE_MAX_TOKENS, messages: [{ role: 'user', content }] });
  return { a: parse(replyText(m)), u: usageOf(m) };
}
async function runAfter(e: any) {
  const m = await anthropic.messages.create({ model: CLAUDE_MODEL, max_tokens: CLAUDE_MAX_TOKENS, system: ANALYSIS_SYSTEM, messages: [{ role: 'user', content: analysisUserMessage({ language: 'en', subject: e.subject, from: e.from, body: e.body }) }] });
  return { a: parse(replyText(m)), u: usageOf(m) };
}

(async () => {
  const inbox = await (await fetch(`http://localhost:3001/api/emails?session=${sessionId}`)).json();
  if (!inbox.emails) throw new Error(`Inbox not loaded: ${JSON.stringify(inbox)}`);
  const emails = inbox.emails.filter((e: any) => !e.triage?.bulk).slice(0, Number(maxArg) || 12);
  console.log(`${emails.length} non-marketing emails\n`);
  const agree = { bb: Object.fromEntries(FIELDS.map(f => [f, 0])), ba: Object.fromEntries(FIELDS.map(f => [f, 0])) };
  const usages: ReturnType<typeof usageOf>[] = [];
  const changed: string[] = [];
  let n = 0;
  for (const e of emails) {
    const [b1, b2, a1, a2] = [await runBefore(e), await runBefore(e), await runAfter(e), await runAfter(e)];
    usages.push(a1.u, a2.u);
    if (!b1.a || !b2.a || !a1.a || !a2.a) { console.log(`✗ unparseable reply for "${e.subject}"`); continue; }
    n++;
    const [fb1, fb2, fa1, fa2] = [b1.a, b2.a, a1.a, a2.a].map(fields);
    const row: string[] = [];
    for (const f of FIELDS) {
      if (fb1[f] === fb2[f]) agree.bb[f]++;
      const ba = (fa1[f] === fb1[f] || fa1[f] === fb2[f]) && (fa2[f] === fb1[f] || fa2[f] === fb2[f]);
      if (ba) agree.ba[f]++;
      else { row.push(`${f}: before ${fb1[f]} / ${fb2[f]}, after ${fa1[f]} / ${fa2[f]}`); }
    }
    console.log(`${row.length ? '≠' : '='} ${e.subject.slice(0, 60)}${row.length ? '\n    ' + row.join('\n    ') : ''}`);
    if (row.length) changed.push(e.subject);
  }
  console.log(`\nField agreement over ${n} emails (before vs before | after vs before):`);
  for (const f of FIELDS) console.log(`  ${f.padEnd(16)} ${agree.bb[f]}/${n} | ${agree.ba[f]}/${n}`);
  const sum = (k: keyof ReturnType<typeof usageOf>) => usages.reduce((s, u) => s + (u[k] as number), 0);
  console.log(`\nCached prompt, ${usages.length} calls: cache writes ${sum('cache_write_tokens')}, cache reads ${sum('cache_read_tokens')}, uncached input ${sum('input_tokens')}, output ${sum('output_tokens')}`);
})().catch(e => { console.error(e); process.exit(1); });
