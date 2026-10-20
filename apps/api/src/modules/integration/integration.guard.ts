import { type CanActivate, type ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { IntegrationScope } from '@empgt/contracts';
import type { Request } from 'express';
import type { IntegrationClient } from '../../generated/prisma/client.js';
import { safeEqual, sha256Hex } from '../../common/crypto.js';
import { disabledFeature, forbidden } from '../../common/errors.js';
import { PrismaService } from '../../common/prisma.service.js';
import { SettingsService } from '../core/settings.service.js';

export const RequireScope = Reflector.createDecorator<IntegrationScope | 'ANY'>();

export const TOKEN_PATTERN = /^empgt_int_([a-f0-9]{12})_([A-Za-z0-9_-]{40,})$/;

export type IntegrationRequest = Request & { integrationClient?: IntegrationClient };

/**
 * Authentification machine de l'API d'intégration : jeton porteur, comparé à son condensat,
 * révocable et à durée de vie optionnelle ; chaque route exige un domaine (scope) autorisé
 * à la fois pour le client ET dans la politique de partage d'E-MPGT (décision D-16).
 */
@Injectable()
export class IntegrationGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
    private readonly settings: SettingsService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<IntegrationRequest>();
    const header = request.header('authorization') ?? '';
    const token = header.startsWith('Bearer ') ? header.slice(7).trim() : '';
    const match = TOKEN_PATTERN.exec(token);
    if (!match) throw new UnauthorizedException('Jeton d’intégration absent ou mal formé');
    const client = await this.prisma.integrationClient.findUnique({ where: { tokenPrefix: match[1]! } });
    if (!client || !safeEqual(client.tokenHash, sha256Hex(token))) throw new UnauthorizedException('Jeton d’intégration invalide');
    if (client.revokedAt) throw new UnauthorizedException('Jeton d’intégration révoqué');
    if (client.expiresAt && client.expiresAt <= new Date()) throw new UnauthorizedException('Jeton d’intégration expiré');

    const scope = this.reflector.getAllAndOverride(RequireScope, [context.getHandler(), context.getClass()]);
    const settings = await this.settings.get();
    if (scope && scope !== 'ANY') {
      if (!client.scopes.includes(scope)) throw forbidden(`Ce client n’est pas autorisé pour le domaine ${scope}`);
      if (!settings.integrationEnabledScopes.includes(scope)) {
        throw disabledFeature(`Partage du domaine ${scope} désactivé : décision E-MPGT attendue sur les données partageables avec le Knowledge Graph (D-16).`);
      }
    } else if (settings.integrationEnabledScopes.length === 0) {
      throw disabledFeature('API d’intégration désactivée : aucun domaine de partage n’a été validé par E-MPGT (décision D-16).');
    }

    if (!client.lastUsedAt || Date.now() - client.lastUsedAt.getTime() > 60_000) {
      await this.prisma.integrationClient.update({ where: { id: client.id }, data: { lastUsedAt: new Date() } });
    }
    request.integrationClient = client;
    return true;
  }
}
