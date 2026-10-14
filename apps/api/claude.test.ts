// Run: npx tsx --test claude.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { replyText, CLAUDE_MAX_TOKENS } from './claude';

test('a reply that starts with a thinking block still yields its text (the FCL12345 bug)', () => {
  const message = { content: [{ type: 'thinking', thinking: '' } as any, { type: 'text', text: '{"intent":"tracking_inquiry"}' }] };
  assert.equal(replyText(message), '{"intent":"tracking_inquiry"}');
});

test('several text blocks are joined in order; non-text blocks are ignored', () => {
  const message = { content: [{ type: 'text', text: '{"a":' }, { type: 'redacted_thinking' } as any, { type: 'text', text: '1}' }] };
  assert.equal(replyText(message), '{"a":1}');
});

test('empty or missing content gives an empty string', () => {
  assert.equal(replyText({ content: [] }), '');
  assert.equal(replyText({ content: [{ type: 'thinking' }] as any }), '');
});

test('the output budget is large enough for thinking plus a full analysis', () => {
  assert.ok(CLAUDE_MAX_TOKENS >= 4096);
});

import { usageOf } from './claude';

test('usageOf: token counts incl. prompt-cache reads and writes', () => {
  assert.deepEqual(
    usageOf({ model: 'claude-sonnet-5', usage: { input_tokens: 412, output_tokens: 780, cache_read_input_tokens: 1530, cache_creation_input_tokens: 0 } }),
    { model: 'claude-sonnet-5', input_tokens: 412, output_tokens: 780, cache_read_tokens: 1530, cache_write_tokens: 0 },
  );
  // Older responses / no caching: missing fields count as 0
  assert.deepEqual(usageOf({ usage: { input_tokens: 1600, output_tokens: 700 } }),
    { model: 'claude-sonnet-5', input_tokens: 1600, output_tokens: 700, cache_read_tokens: 0, cache_write_tokens: 0 });
});
