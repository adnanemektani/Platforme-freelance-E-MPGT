import type { PrismaService } from '../common/prisma.service.js';
import { appUrl } from '../modules/core/mail-templates.js';
import type { AuditService } from '../modules/core/audit.service.js';
import type { AuthService } from '../modules/auth/auth.service.js';

/**
 * Initialise (ou réactive) un compte d'administration E-MPGT sans mot de passe :
 * un lien à usage unique, valable 1 heure, permet de définir le mot de passe.
 * Aucun identifiant secret ni mot de passe n'est stocké dans le dépôt.
 */
export async function provisionAdmin(
  deps: { prisma: PrismaService; auth: AuthService; audit: AuditService },
  input: { email: string; firstName: string; lastName: string },
): Promise<{ userId: string; setupUrl: string; created: boolean }> {
  const email = input.email.trim().toLowerCase();
  return deps.prisma.$transaction(async (tx) => {
    let user = await tx.user.findUnique({ where: { email }, include: { roles: { where: { revokedAt: null } } } });
    let created = false;
    if (user && user.roles.some((r) => r.role === 'COMPANY' || r.role === 'FREELANCER')) {
      throw new Error('Cette adresse est utilisée par un compte entreprise ou freelance : utilisez une adresse dédiée à l’administration.');
    }
    if (!user) {
      // Écriture simple (sans include) : dans une transaction, les requêtes restent strictement séquentielles.
      const createdUser = await tx.user.create({
        data: { email, firstName: input.firstName, lastName: input.lastName, status: 'PENDING_VERIFICATION', passwordHash: null },
      });
      user = { ...createdUser, roles: [] };
      created = true;
    }
    await tx.userRole.upsert({
      where: { userId_role: { userId: user.id, role: 'PLATFORM_ADMIN' } },
      create: { userId: user.id, role: 'PLATFORM_ADMIN' },
      update: { revokedAt: null },
    });
    const token = await deps.auth.createAuthToken(tx, user.id, 'PASSWORD_RESET', 1);
    await deps.audit.record(tx, { kind: 'CLI', label: 'admin:create' }, {
      action: created ? 'cli.admin.create' : 'cli.admin.grant',
      entityType: 'User',
      entityId: user.id,
    });
    return { userId: user.id, created, setupUrl: appUrl(`/reinitialiser-mot-de-passe?token=${encodeURIComponent(token)}`) };
  });
}
