import { type CanActivate, type ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { forbidden, unauthorized } from '../../common/errors.js';
import { sessionCookieName } from './cookies.js';
import { MachineAuth, Public, Roles, type AuthenticatedRequest } from './decorators.js';
import { SessionService } from './session.service.js';

/**
 * Garde global : résout la session à partir du cookie, puis applique
 * @Public() et @Roles(). Les contrôles fins (organisation, objet) sont faits
 * par les politiques de chaque module.
 */
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly sessions: SessionService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    if (context.getType() !== 'http') return true;
    const targets = [context.getHandler(), context.getClass()];
    if (this.reflector.getAllAndOverride(MachineAuth, targets)) return true;

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const token = (request.cookies as Record<string, string> | undefined)?.[sessionCookieName()];
    if (token && token.length <= 100) {
      const actor = await this.sessions.resolve(token);
      if (actor) {
        request.actor = actor;
        request.sessionToken = token;
      }
    }

    if (this.reflector.getAllAndOverride(Public, targets)) return true;
    if (!request.actor) throw unauthorized('Session expirée ou absente : veuillez vous reconnecter');

    const roles = this.reflector.getAllAndOverride(Roles, targets);
    if (roles && roles.length > 0 && !roles.some((role) => request.actor!.roles.includes(role))) {
      throw forbidden();
    }
    return true;
  }
}
