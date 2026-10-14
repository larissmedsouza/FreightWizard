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

/** Token counts of one Claude call, stored with its activity row (email_activity). */
export interface Usage {
  model: string;
  input_tokens: number;
  output_tokens: number;
  /** Prompt-cache reads (billed at ~10% of input) and writes (~125% of input). */
  cache_read_tokens: number;
  cache_write_tokens: number;
}

type ApiUsage = { input_tokens?: number | null; output_tokens?: number | null; cache_read_input_tokens?: number | null; cache_creation_input_tokens?: number | null };

export function usageOf(message: { model?: string; usage?: ApiUsage | null }): Usage {
  const u = message.usage || {};
  return {
    model: message.model || CLAUDE_MODEL,
    input_tokens: u.input_tokens ?? 0,
    output_tokens: u.output_tokens ?? 0,
    cache_read_tokens: u.cache_read_input_tokens ?? 0,
    cache_write_tokens: u.cache_creation_input_tokens ?? 0,
  };
}
