import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

/** AES-256-GCM for OAuth tokens at rest. TOKEN_ENCRYPTION_KEY = 32 bytes, base64. */
function key(): Buffer {
  const k = Buffer.from(process.env.TOKEN_ENCRYPTION_KEY ?? '', 'base64');
  if (k.length !== 32) throw new Error('TOKEN_ENCRYPTION_KEY must be 32 bytes base64');
  return k;
}

export function encrypt(plain: string): string {
  const iv = randomBytes(12);
  const c = createCipheriv('aes-256-gcm', key(), iv);
  const enc = Buffer.concat([c.update(plain, 'utf8'), c.final()]);
  return [iv, c.getAuthTag(), enc].map((b) => b.toString('base64')).join('.');
}

export function decrypt(payload: string): string {
  const [iv, tag, enc] = payload.split('.').map((s) => Buffer.from(s, 'base64'));
  const d = createDecipheriv('aes-256-gcm', key(), iv!);
  d.setAuthTag(tag!);
  return Buffer.concat([d.update(enc!), d.final()]).toString('utf8');
}
