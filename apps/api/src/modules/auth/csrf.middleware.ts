import { ForbiddenException } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';
import { env } from '../../config/env.js';
import { safeEqual } from '../../common/crypto.js';
import { csrfCookieName, isValidCsrfToken } from './cookies.js';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);
// Routes authentifiées par jeton machine ou signature : pas de cookie, donc pas de CSRF.
const EXEMPT_PREFIXES = ['/api/v1/integration', '/api/v1/webhooks'];

function allowedOrigins(): Set<string> {
  const origins = new Set([new URL(env().APP_ORIGIN).origin]);
  if (env().APP_ENV !== 'production') {
    origins.add('http://localhost:3000');
    origins.add('http://127.0.0.1:3000');
    origins.add('http://localhost:8080');
  }
  return origins;
}

/** Protection CSRF : jeton signé « double soumission » + contrôle de l'en-tête Origin. */
export function csrfMiddleware(req: Request, _res: Response, next: NextFunction): void {
  if (SAFE_METHODS.has(req.method) || EXEMPT_PREFIXES.some((prefix) => req.path.startsWith(prefix))) {
    return next();
  }
  const origin = req.header('origin');
  if (origin && !allowedOrigins().has(origin)) {
    return next(new ForbiddenException('Origine de la requête non autorisée'));
  }
  const header = req.header('x-csrf-token');
  const cookie = (req.cookies as Record<string, string> | undefined)?.[csrfCookieName()];
  if (!isValidCsrfToken(header) || !cookie || !safeEqual(header, cookie)) {
    return next(new ForbiddenException('Jeton de sécurité (CSRF) manquant ou expiré : rechargez la page'));
  }
  next();
}
