import { Injectable } from '@nestjs/common';
import type {
  AdminUserListItem,
  AuditEventView,
  AuditListQuery,
  ContactRequestInput,
  ContactRequestView,
  MessageResponse,
  Page,
  PageQuery,
  RoleCode,
  UserListQuery,
} from '@empgt/contracts';
import type { Prisma } from '../../generated/prisma/client.js';
import { check, visibleActions } from '../../common/actions.js';
import { toIso } from '../../common/dates.js';
import { conflict, notFound } from '../../common/errors.js';
import { pageArgs, toPage } from '../../common/pagination.js';
import { PrismaService } from '../../common/prisma.service.js';
import { fullName } from '../../common/text.js';
import { env } from '../../config/env.js';
import type { Actor } from '../auth/actor.js';
import { AuthService } from '../auth/auth.service.js';
import { SessionService } from '../auth/session.service.js';
import { AuditService } from '../core/audit.service.js';
import { MailService } from '../core/mail.service.js';
import { mailTemplates } from '../core/mail-templates.js';
import { NotificationService } from '../core/notification.service.js';

@Injectable()
export class AdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly sessions: SessionService,
    private readonly auth: AuthService,
    private readonly mail: MailService,
    private readonly notifications: NotificationService,
  ) {}

  // ── Utilisateurs ──────────────────────────────────────────────────────────

  async users(actor: Actor, query: UserListQuery): Promise<Page<AdminUserListItem>> {
    const where: Prisma.UserWhereInput = {
      ...(query.status ? { status: query.status } : {}),
      ...(query.role ? { roles: { some: { role: query.role, revokedAt: null } } } : {}),
      ...(query.q
        ? {
            OR: [
              { email: { contains: query.q, mode: 'insensitive' } },
              { lastName: { contains: query.q, mode: 'insensitive' } },
              { firstName: { contains: query.q, mode: 'insensitive' } },
            ],
          }
        : {}),
    };
    const [items, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        ...pageArgs(query),
        orderBy: { createdAt: 'desc' },
        include: {
          roles: { where: { revokedAt: null } },
          memberships: { where: { status: 'ACTIVE' }, include: { company: { select: { legalName: true } } }, take: 1 },
          freelancerProfile: { select: { id: true } },
        },
      }),
      this.prisma.user.count({ where }),
    ]);
    return toPage(
      items.map((u) => {
        const roles = u.roles.map((r) => r.role as RoleCode);
        const self = u.id === actor.userId;
        const admin = roles.includes('PLATFORM_ADMIN');
        return {
          id: u.id,
          email: u.email,
          firstName: u.firstName,
          lastName: u.lastName,
          roles,
          status: u.status,
          emailVerified: Boolean(u.emailVerifiedAt),
          companyName: u.memberships[0]?.company.legalName ?? null,
          profileId: u.freelancerProfile?.id ?? null,
          lastLoginAt: toIso(u.lastLoginAt),
          createdAt: toIso(u.createdAt),
          isDemo: u.isDemo,
          actions: visibleActions([
            check('suspend', [
              [!self, 'Vous ne pouvez pas suspendre votre propre compte'],
              [!admin, "Un compte d'administration se gère en ligne de commande"],
              [u.status === 'ACTIVE' || u.status === 'PENDING_VERIFICATION', 'Compte déjà suspendu ou désactivé'],
            ]),
            check('reactivate', [[u.status === 'SUSPENDED', "Le compte n'est pas suspendu"]]),
            check('resendVerification', [[u.status === 'PENDING_VERIFICATION', 'Adresse déjà vérifiée']]),
          ]),
        };
      }),
      total,
      query,
    );
  }

  async setUserStatus(actor: Actor, userId: string, decision: 'suspend' | 'reactivate', reason: string): Promise<MessageResponse> {
    const user = await this.prisma.user.findUnique({ where: { id: userId }, include: { roles: { where: { revokedAt: null } } } });
    if (!user) throw notFound('Utilisateur');
    if (user.id === actor.userId) throw conflict('Vous ne pouvez pas modifier l’état de votre propre compte.');
    if (user.roles.some((r) => r.role === 'PLATFORM_ADMIN')) throw conflict("Un compte d'administration se gère en ligne de commande.");
    if (decision === 'suspend' && user.status !== 'ACTIVE' && user.status !== 'PENDING_VERIFICATION') throw conflict('Compte déjà suspendu ou désactivé.');
    if (decision === 'reactivate' && user.status !== 'SUSPENDED') throw conflict("Le compte n'est pas suspendu.");
    await this.prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: userId },
        data: decision === 'suspend' ? { status: 'SUSPENDED', statusReason: reason } : { status: user.emailVerifiedAt ? 'ACTIVE' : 'PENDING_VERIFICATION', statusReason: null },
      });
      if (decision === 'suspend') await this.sessions.revokeAllForUser(userId, 'suspended', undefined, tx);
      await this.audit.record(tx, actor, { action: `admin.user.${decision}`, entityType: 'User', entityId: userId, reason, metadata: { before: user.status } });
    });
    if (decision === 'suspend') {
      await this.mail.sendSafely(mailTemplates.notification(user.email, 'Compte suspendu', `Votre compte a été suspendu par E-MPGT. Motif : ${reason}`, null));
    }
    return { message: decision === 'suspend' ? 'Compte suspendu.' : 'Compte réactivé.' };
  }

  async resendVerification(actor: Actor, userId: string): Promise<MessageResponse> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw notFound('Utilisateur');
    if (user.status !== 'PENDING_VERIFICATION') throw conflict('Adresse déjà vérifiée.');
    await this.auth.resendVerification(user.email);
    await this.audit.record(this.prisma, actor, { action: 'admin.user.resend_verification', entityType: 'User', entityId: userId });
    return { message: 'E-mail de vérification renvoyé.' };
  }

  // ── Audit ─────────────────────────────────────────────────────────────────

  async auditEvents(query: AuditListQuery): Promise<Page<AuditEventView>> {
    const where: Prisma.AuditEventWhereInput = {
      ...(query.entityType ? { entityType: query.entityType } : {}),
      ...(query.entityId ? { entityId: query.entityId } : {}),
      ...(query.actorUserId ? { actorUserId: query.actorUserId } : {}),
      ...(query.action ? { action: { contains: query.action } } : {}),
      ...(query.from || query.to ? { occurredAt: { ...(query.from ? { gte: new Date(query.from) } : {}), ...(query.to ? { lte: new Date(query.to) } : {}) } } : {}),
      ...(query.q ? { OR: [{ action: { contains: query.q } }, { reason: { contains: query.q, mode: 'insensitive' } }, { entityId: query.q }] } : {}),
    };
    const [items, total] = await Promise.all([
      this.prisma.auditEvent.findMany({ where, ...pageArgs(query), orderBy: { id: 'desc' }, include: { actor: { select: { firstName: true, lastName: true, email: true } } } }),
      this.prisma.auditEvent.count({ where }),
    ]);
    return toPage(
      items.map((e) => ({
        id: e.id.toString(),
        occurredAt: toIso(e.occurredAt),
        actorType: e.actorType,
        actorUserId: e.actorUserId,
        actorName: e.actor ? `${fullName(e.actor.firstName, e.actor.lastName)} <${e.actor.email}>` : null,
        actorRoles: e.actorRoles,
        action: e.action,
        entityType: e.entityType,
        entityId: e.entityId,
        reason: e.reason,
        metadata: e.metadata,
        requestId: e.requestId,
      })),
      total,
      query,
    );
  }

  // ── Demandes de contact ───────────────────────────────────────────────────

  async createContactRequest(input: ContactRequestInput): Promise<MessageResponse> {
    if (input.website) return { message: 'Merci, votre message a bien été envoyé.' };
    await this.prisma.$transaction(async (tx) => {
      const request = await tx.contactRequest.create({
        data: { name: input.name, email: input.email, organization: input.organization, audience: input.audience, subject: input.subject, message: input.message },
      });
      await this.audit.record(tx, null, { action: 'contact.request', entityType: 'ContactRequest', entityId: request.id });
      await this.notifications.notifyAdmins(tx, {
        type: 'contact.request',
        title: 'Nouvelle demande de contact',
        body: `${input.name} (${input.audience}) : ${input.subject}`,
        link: '/admin/contact',
        email: true,
      });
    });
    for (const to of (env().ADMIN_ALERT_EMAILS ?? '').split(',').map((s) => s.trim()).filter(Boolean)) {
      await this.mail.sendSafely(mailTemplates.adminAlert(to, 'Nouvelle demande de contact', `${input.name} — ${input.subject}`, '/admin/contact'));
    }
    return { message: 'Merci, votre message a bien été envoyé. E-MPGT vous répondra dans les meilleurs délais.' };
  }

  async contactRequests(query: PageQuery): Promise<Page<ContactRequestView>> {
    const [items, total] = await Promise.all([
      this.prisma.contactRequest.findMany({ ...pageArgs(query), orderBy: [{ status: 'asc' }, { createdAt: 'desc' }] }),
      this.prisma.contactRequest.count(),
    ]);
    return toPage(
      items.map((r) => ({
        id: r.id,
        name: r.name,
        email: r.email,
        organization: r.organization,
        audience: r.audience,
        subject: r.subject,
        message: r.message,
        status: r.status,
        createdAt: toIso(r.createdAt),
        handledAt: toIso(r.handledAt),
      })),
      total,
      query,
    );
  }

  async handleContactRequest(actor: Actor, id: string): Promise<MessageResponse> {
    const request = await this.prisma.contactRequest.findUnique({ where: { id } });
    if (!request) throw notFound('Demande');
    await this.prisma.$transaction(async (tx) => {
      await tx.contactRequest.update({ where: { id }, data: { status: 'HANDLED', handledAt: new Date(), handledById: actor.userId } });
      await this.audit.record(tx, actor, { action: 'admin.contact.handled', entityType: 'ContactRequest', entityId: id });
    });
    return { message: 'Demande marquée comme traitée.' };
  }
}
