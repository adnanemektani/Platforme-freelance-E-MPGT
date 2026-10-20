import { AsyncLocalStorage } from 'node:async_hooks';
import { randomUUID } from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';

interface RequestContext {
  requestId: string;
}

const storage = new AsyncLocalStorage<RequestContext>();

export function currentRequestId(): string | undefined {
  return storage.getStore()?.requestId;
}

const VALID_ID = /^[\w.-]{8,100}$/;

/** Identifiant de requête : repris de X-Request-Id s'il est valide, sinon généré. */
export function requestContextMiddleware(req: Request, res: Response, next: NextFunction): void {
  const incoming = req.header('x-request-id');
  const requestId = incoming && VALID_ID.test(incoming) ? incoming : randomUUID();
  (req as Request & { requestId?: string }).requestId = requestId;
  res.setHeader('X-Request-Id', requestId);
  storage.run({ requestId }, () => next());
}
