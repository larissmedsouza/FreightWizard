// The cached analysis prompt says exactly what the prompt before caching said.
// Run: npx tsx --test prompts.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { ANALYSIS_INSTRUCTIONS, ANALYSIS_SYSTEM, analysisUserMessage } from './prompts';

// The /api/analyze prompt template as it was before caching (2026-10-14), with its ${...} placeholders.
const before = fs.readFileSync(path.join(__dirname, 'fixtures/analysis-prompt-before-caching.txt'), 'utf8').replace(/\r\n/g, '\n');
const renderBefore = (language: string, subject: string, from: string, body: string) =>
  before
    .replace("${language === 'pt' ? 'Brazilian Portuguese' : language === 'nl' ? 'Dutch' : 'English'}", language === 'pt' ? 'Brazilian Portuguese' : language === 'nl' ? 'Dutch' : 'English')
    .replace('${subject}', subject).replace('${from}', from).replace('${body}', body);

const email = { subject: 'RFQ 2x40HC Santos → Rotterdam', from: 'marta@agro.test', body: 'Hi,\nplease quote 2x40HC.\nThanks' };

test('every line of the old prompt is sent, and nothing else', () => {
  for (const language of ['en', 'pt', 'nl']) {
    const old = renderBefore(language, email.subject, email.from, email.body);
    const now = ANALYSIS_INSTRUCTIONS + '\n' + analysisUserMessage({ language, ...email });
    const lines = (s: string) => s.split('\n').map(l => l.trimEnd()).filter(Boolean).sort();
    assert.deepEqual(lines(now), lines(old), language);
  }
});

test('the cached part has no per-email or per-language content', () => {
  assert.ok(!ANALYSIS_INSTRUCTIONS.includes('${'));
  assert.ok(!/Email Subject:|Respond with summary and suggested_reply in/.test(ANALYSIS_INSTRUCTIONS));
  assert.deepEqual(ANALYSIS_SYSTEM[0].cache_control, { type: 'ephemeral' });
  assert.equal(ANALYSIS_SYSTEM[0].text, ANALYSIS_INSTRUCTIONS);
});

test('the user message carries the language and the email', () => {
  const m = analysisUserMessage({ language: 'pt', ...email });
  assert.match(m, /in Brazilian Portuguese\./);
  assert.match(m, /Email Subject: RFQ 2x40HC/);
  assert.match(analysisUserMessage({ ...email }), /in English\./);
});
