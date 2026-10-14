// Secrets at rest: AES-256-GCM with INTEGRATION_ENCRYPTION_KEY (64 hex chars).
// Stored as JSON {"iv","data","tag"} (hex), the format integration secrets
// have always used.
//
// Mailbox OAuth tokens (gmail_sessions.access_token / refresh_token) use the
// same cipher. Rows written before encryption hold plain text: they are read
// as is and re-encrypted by the background migration (legacyTokenUpdates).
// Tokens are never encrypted with the built-in development key on Vercel: if
// the real key is missing there, tokens stay as they were and the API says so
// (status endpoint, startup log) instead of pretending to protect them.
// Pure logic; covered by secrets.test.ts.
import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

const DEV_FALLBACK_KEY = Buffer.from('freightwizard-dev-key-32bytes!!!'.padEnd(32).slice(0, 32));

export interface Cipher {
  /** True when INTEGRATION_ENCRYPTION_KEY is missing and the public development key is used. */
  usingFallback: boolean;
  /** Mailbox tokens are encrypted (real key, or the dev key off Vercel). */
  tokensEncrypted: boolean;
  encrypt(plaintext: string): string;
  /** '' when the value can't be decrypted (wrong key, corrupt). */
  decrypt(ciphertext: string): string;
}

export function makeCipher(keyHex: string | undefined, opts: { onVercel: boolean }): Cipher {
  let key = DEV_FALLBACK_KEY;
  if (keyHex) {
    key = Buffer.from(keyHex, 'hex');
    if (key.length !== 32) throw new Error('INTEGRATION_ENCRYPTION_KEY must be 64 hex chars (32 bytes)');
  }
  const usingFallback = !keyHex;
  return {
    usingFallback,
    tokensEncrypted: !(usingFallback && opts.onVercel),
    encrypt(plaintext) {
      const iv = randomBytes(12);
      const cipher = createCipheriv('aes-256-gcm', key, iv);
      const data = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
      return JSON.stringify({ iv: iv.toString('hex'), data: data.toString('hex'), tag: cipher.getAuthTag().toString('hex') });
    },
    decrypt(ciphertext) {
      try {
        const { iv, data, tag } = JSON.parse(ciphertext);
        const decipher = createDecipheriv('aes-256-gcm', key, Buffer.from(iv, 'hex'));
        decipher.setAuthTag(Buffer.from(tag, 'hex'));
        return Buffer.concat([decipher.update(Buffer.from(data, 'hex')), decipher.final()]).toString('utf8');
      } catch {
        return '';
      }
    },
  };
}

/** An encrypted value (JSON with iv, data, tag), as opposed to a plain-text token. */
export function isEncrypted(value: unknown): value is string {
  if (typeof value !== 'string' || !value.startsWith('{')) return false;
  try {
    const v = JSON.parse(value);
    return typeof v?.iv === 'string' && typeof v?.data === 'string' && typeof v?.tag === 'string';
  } catch {
    return false;
  }
}

/** For writing a token: encrypted unless token encryption is off; null stays null. */
export function sealToken(cipher: Cipher, token: string | null | undefined): string | null {
  if (!token) return null;
  if (!cipher.tokensEncrypted || isEncrypted(token)) return token;
  return cipher.encrypt(token);
}

/** For reading a token: decrypted, or the legacy plain-text value as is. Undecryptable → null (sign in again). */
export function openToken(cipher: Cipher, stored: string | null | undefined): string | null {
  if (!stored) return null;
  if (!isEncrypted(stored)) return stored;
  return cipher.decrypt(stored) || null;
}

export interface SessionTokenRow { session_id: string; access_token: string | null; refresh_token: string | null }
export interface TokenUpdate {
  session_id: string;
  /** Only update while the row still holds these values (a refresh in between wins). */
  match: { access_token: string | null; refresh_token: string | null };
  set: { access_token: string | null; refresh_token: string | null };
}

/** The updates that encrypt plain-text tokens; rows already encrypted (or empty) are skipped. */
export function legacyTokenUpdates(cipher: Cipher, rows: SessionTokenRow[]): TokenUpdate[] {
  if (!cipher.tokensEncrypted) return [];
  const plain = (v: string | null) => !!v && !isEncrypted(v);
  return rows
    .filter(r => plain(r.access_token) || plain(r.refresh_token))
    .map(r => ({
      session_id: r.session_id,
      match: { access_token: r.access_token, refresh_token: r.refresh_token },
      set: { access_token: sealToken(cipher, r.access_token), refresh_token: sealToken(cipher, r.refresh_token) },
    }));
}
