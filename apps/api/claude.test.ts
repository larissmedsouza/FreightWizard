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
