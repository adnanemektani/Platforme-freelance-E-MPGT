import type { RoleCode } from '@empgt/contracts';
import type { PrismaService } from '../common/prisma.service.js';
import type { Actor } from '../modules/auth/actor.js';

/** Acteur reconstruit pour les commandes d'exploitation (jeu de démonstration, tests). */
export async function actorFor(prisma: PrismaService, userId: string): Promise<Actor> {
  const user = await prisma.user.findUniqueOrThrow({
    where: { id: userId },
    include: {
      roles: { where: { revokedAt: null } },
      memberships: { where: { status: 'ACTIVE' }, take: 1 },
      freelancerProfile: { select: { id: true } },
    },
  });
  const roles = user.roles.map((r) => r.role as RoleCode);
  const membership = user.memberships[0];
  return {
    userId: user.id,
    sessionId: '00000000-0000-0000-0000-000000000000',
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
