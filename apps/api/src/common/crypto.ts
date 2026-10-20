import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

/** Jeton aléatoire opaque (256 bits), encodé en base64url. */
export function randomToken(bytes = 32): string {
  return randomBytes(bytes).toString('base64url');
}

export function sha256Hex(value: string | Buffer): string {
  return createHash('sha256').update(value).digest('hex');
}

export function hmac(secret: string, value: string): string {
  return createHmac('sha256', secret).update(value).digest('base64url');
}

export function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}

/** Sérialisation JSON canonique (clés triées) pour calculer une empreinte stable. */
export function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, v]) => v !== undefined)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${canonicalJson(v)}`).join(',')}}`;
}

/** Tronque une adresse IP (/24 en IPv4, /48 en IPv6) : minimisation des données personnelles. */
export function ipPrefix(ip: string | undefined | null): string | null {
  if (!ip) return null;
  const clean = ip.replace(/^::ffff:/, '');
  if (/^\d+\.\d+\.\d+\.\d+$/.test(clean)) return clean.split('.').slice(0, 3).join('.') + '.0/24';
  if (clean.includes(':')) return clean.split(':').slice(0, 3).join(':') + '::/48';
  return null;
}
