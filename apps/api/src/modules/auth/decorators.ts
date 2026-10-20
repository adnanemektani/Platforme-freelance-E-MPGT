import { createParamDecorator, type ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { RoleCode } from '@empgt/contracts';
import type { Request } from 'express';
import type { Actor } from './actor.js';
import { unauthorized } from '../../common/errors.js';

/** Route accessible sans session. */
export const Public = Reflector.createDecorator<boolean>({ transform: () => true });

/** Rôles autorisés (au moins un). */
export const Roles = Reflector.createDecorator<RoleCode[]>();

/** Route authentifiée par jeton machine (API d'intégration) : exemptée de session et de CSRF. */
export const MachineAuth = Reflector.createDecorator<boolean>({ transform: () => true });

export type AuthenticatedRequest = Request & { actor?: Actor; sessionToken?: string; requestId?: string };

export const CurrentActor = createParamDecorator((_data: unknown, ctx: ExecutionContext): Actor => {
  const request = ctx.switchToHttp().getRequest<AuthenticatedRequest>();
  if (!request.actor) throw unauthorized();
  return request.actor;
});

/** Acteur facultatif (routes publiques enrichies si une session existe). */
export const OptionalActor = createParamDecorator((_data: unknown, ctx: ExecutionContext): Actor | null => {
  return ctx.switchToHttp().getRequest<AuthenticatedRequest>().actor ?? null;
});
