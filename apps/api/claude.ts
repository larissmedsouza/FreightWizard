// Shared Claude settings and reply handling. Covered by claude.test.ts.

/** The one model ID used by every Claude call. Change it here. */
export const CLAUDE_MODEL = 'claude-sonnet-5';

/** Output budget for every call: thinking plus the answer must fit. 1024 was too small. */
export const CLAUDE_MAX_TOKENS = 4096;

type Block = { type: string; text?: string };

/**
 * Text of a Claude reply. A reply can start with a thinking block, so join
 * every text block instead of reading content[0].
 */
export function replyText(message: { content: Block[] }): string {
  return (message.content || []).map(b => (b.type === 'text' && typeof b.text === 'string' ? b.text : '')).join('');
}

/** Log replies that ran out of tokens, so truncation is visible in the API logs. */
export function warnIfTruncated(where: string, message: { stop_reason?: string | null; usage?: { output_tokens?: number } }) {
  if (message.stop_reason === 'max_tokens') {
    console.warn(`⚠️ ${where}: Claude reply hit max_tokens (${message.usage?.output_tokens} output tokens); result may be incomplete`);
  }
}
