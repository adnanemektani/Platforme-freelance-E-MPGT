import { Injectable } from '@nestjs/common';
import type { RoleCode } from '@empgt/contracts';
import type { Request } from 'express';
import type { Prisma } from '../../generated/prisma/client.js';
import { env } from '../../config/env.js';
import { ipPrefix, randomToken, sha256Hex } from '../../common/crypto.js';
import { addHours } from '../../common/dates.js';
import { PrismaService, type Db } from '../../common/prisma.service.js';
import type { Actor } from './actor.js';

const TOUCH_INTERVAL_MS = 5 * 60 * 1000;

const sessionInclude = {
  user: {
    include: {
      roles: { where: { revokedAt: null }, select: { role: true } },
      memberships: { where: { status: 'ACTIVE' }, select: { companyId: true, role: true }, take: 1 },
      freelancerProfile: { select: { id: true } },
    },
  },
} satisfies Prisma.SessionInclude;

type SessionWithUser = Prisma.SessionGetPayload<{ include: typeof sessionInclude }>;

@Injectable()
export class SessionService {
  constructor(private readonly prisma: PrismaService) {}

  async create(userId: string, req: Request, db: Db = this.prisma): Promise<{ token: string; expiresAt: Date }> {
    const token = randomToken(32);
    const roles = await db.userRole.findMany({ where: { userId, revokedAt: null }, select: { role: true } });
    // Les sessions d'administration ont une durée de vie absolue plus courte (12 h).
    const ttl = roles.some((r) => r.role === 'PLATFORM_ADMIN') ? Math.min(12, env().SESSION_TTL_HOURS) : env().SESSION_TTL_HOURS;
    const expiresAt = addHours(new Date(), ttl);
    await db.session.create({
      data: {
        tokenHash: sha256Hex(token),
        userId,
        expiresAt,
        ipPrefix: ipPrefix(req.ip),
        userAgent: req.header('user-agent')?.slice(0, 300) ?? null,
      },
    });
    return { token, expiresAt };
  }

  /** Valide un jeton de session et construit l'acteur ; null si invalide, expiré ou révoqué. */
  async resolve(token: string): Promise<Actor | null> {
    const session = await this.prisma.session.findUnique({ where: { tokenHash: sha256Hex(token) }, include: sessionInclude });
    return this.toActor(session);
  }

  async resolveBySessionId(sessionId: string): Promise<Actor | null> {
    const session = await this.prisma.session.findUnique({ where: { id: sessionId }, include: sessionInclude });
    return this.toActor(session);
  }

  private async toActor(session: SessionWithUser | null): Promise<Actor | null> {
    if (!session || session.revokedAt) return null;
    const now = new Date();
    const idleLimit = addHours(session.lastSeenAt, env().SESSION_IDLE_HOURS);
    if (session.expiresAt <= now || idleLimit <= now) return null;
    const user = session.user;
    if (user.status !== 'ACTIVE') return null;

    if (now.getTime() - session.lastSeenAt.getTime() > TOUCH_INTERVAL_MS) {
      await this.prisma.session.update({ where: { id: session.id }, data: { lastSeenAt: now } });
    }

    const roles = user.roles.map((r) => r.role as RoleCode);
    const membership = user.memberships[0];
    return {
      userId: user.id,
      sessionId: session.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      roles,
      isAdmin: roles.includes('PLATFORM_ADMIN'),
      isCompany: roles.includes('COMPANY') && Boolean(membership),
      isFreelancer: roles.includes('FREELANCER') && Boolean(user.freelancerProfile),
      companyId: membership?.companyId ?? null,
      companyRole: membership?.role ?? null,
      profileId: user.freelancerProfile?.id ?? null,
    };
  }

  async revoke(sessionId: string, reason: string): Promise<void> {
    await this.prisma.session.updateMany({
      where: { id: sessionId, revokedAt: null },
      data: { revokedAt: new Date(), revokedReason: reason },
    });
  }

  async revokeAllForUser(userId: string, reason: string, exceptSessionId?: string, db: Db = this.prisma): Promise<number> {
    const result = await db.session.updateMany({
      where: { userId, revokedAt: null, ...(exceptSessionId ? { NOT: { id: exceptSessionId } } : {}) },
      data: { revokedAt: new Date(), revokedReason: reason },
    });
    return result.count;
  }
}
