import type { CookieOptions, Response } from 'express';
import { env } from '../../config/env.js';
import { hmac, randomToken, safeEqual } from '../../common/crypto.js';

// Cookies de session : HttpOnly, SameSite=Lax, Secure + préfixe __Host- en production.
// Le jeton CSRF est signé (HMAC) et doublé dans un cookie HttpOnly ; le frontend le
// reçoit dans le corps de /auth/csrf et /auth/me puis le renvoie dans l'en-tête X-CSRF-Token.

export function sessionCookieName(): string {
  return env().COOKIE_SECURE ? '__Host-empgt_session' : 'empgt_session';
}

export function csrfCookieName(): string {
  return env().COOKIE_SECURE ? '__Host-empgt_csrf' : 'empgt_csrf';
}

function baseOptions(): CookieOptions {
  return { httpOnly: true, sameSite: 'lax', secure: env().COOKIE_SECURE, path: '/' };
}

export function setSessionCookie(res: Response, token: string, expiresAt: Date): void {
  res.cookie(sessionCookieName(), token, { ...baseOptions(), expires: expiresAt });
}

export function clearSessionCookie(res: Response): void {
  res.clearCookie(sessionCookieName(), baseOptions());
}

export function createCsrfToken(): string {
  const nonce = randomToken(24);
  return `${nonce}.${hmac(env().APP_SECRET, `csrf:${nonce}`)}`;
}

export function isValidCsrfToken(token: string | undefined): token is string {
  if (!token) return false;
  const [nonce, signature, extra] = token.split('.');
  if (!nonce || !signature || extra !== undefined) return false;
  return safeEqual(signature, hmac(env().APP_SECRET, `csrf:${nonce}`));
}

export function setCsrfCookie(res: Response, token: string): void {
  res.cookie(csrfCookieName(), token, { ...baseOptions(), maxAge: 1000 * 60 * 60 * 24 * 7 });
}
