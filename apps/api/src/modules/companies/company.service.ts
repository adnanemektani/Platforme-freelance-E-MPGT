import { Injectable } from '@nestjs/common';
import type {
  AdminCompanyListItem,
  AdminCompanyView,
  CompanyContactInput,
  CompanyView,
  InviteMemberInput,
  Page,
  PageQuery,
  UpdateCompanyInput,
} from '@empgt/contracts';
import type { CompanyVerificationStatus, CompanyStatus, Prisma } from '../../generated/prisma/client.js';
import { assertAllowed, visibleActions } from '../../common/actions.js';
import { randomToken, sha256Hex } from '../../common/crypto.js';
import { addDays, toIso } from '../../common/dates.js';
import { conflict, forbidden, notFound } from '../../common/errors.js';
import { pageArgs, toPage } from '../../common/pagination.js';
import { PrismaService } from '../../common/prisma.service.js';
import { fullName } from '../../common/text.js';
import { isCompanyMember, isCompanyOwner, type Actor } from '../auth/actor.js';
import { AuditService } from '../core/audit.service.js';
import { MailService } from '../core/mail.service.js';
import { mailTemplates } from '../core/mail-templates.js';
import { NotificationService } from '../core/notification.service.js';
import { companyActions, companyPending, LOCKED_WHEN_VERIFIED, missingForVerification } from './company.policy.js';

const companyInclude = {
  contacts: { orderBy: { createdAt: 'asc' } },
  memberships: { include: { user: true }, orderBy: { createdAt: 'asc' } },
  invitations: { where: { type: 'COMPANY_MEMBER' }, orderBy: { createdAt: 'desc' }, take: 20 },
} satisfies Prisma.CompanyInclude;

type CompanyFull = Prisma.CompanyGetPayload<{ include: typeof companyInclude }>;

@Injectable()
export class CompanyService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly notifications: NotificationService,
    private readonly mail: MailService,
  ) {}

  // ── Lecture ───────────────────────────────────────────────────────────────

  private async load(companyId: string): Promise<CompanyFull> {
    const company = await this.prisma.company.findUnique({ where: { id: companyId }, include: companyInclude });
    if (!company) throw notFound('Entreprise');
    return company;
  }

  private requireMemberCompanyId(actor: Actor): string {
    if (!actor.isCompany || !actor.companyId) throw forbidden('Espace réservé aux entreprises');
    return actor.companyId;
  }

  toView(company: CompanyFull, actor: Actor): CompanyView {
    const owner = actor.isAdmin || isCompanyOwner(actor, company.id);
    const actions = companyActions(actor, company, company.contacts.length);
    return {
      id: company.id,
      legalName: company.legalName,
      tradeName: company.tradeName,
      legalForm: company.legalForm,
      registrationNumber: company.registrationNumber,
      registrationType: company.registrationType,
      vatNumber: company.vatNumber,
      addressLine1: company.addressLine1,
      addressLine2: company.addressLine2,
      postalCode: company.postalCode,
      city: company.city,
      country: company.country,
      sector: company.sector,
      sizeRange: company.sizeRange,
      website: company.website,
      description: company.description,
      verificationStatus: company.verificationStatus,
      verificationNote: company.verificationNote,
      verificationSubmittedAt: toIso(company.verificationSubmittedAt),
      verifiedAt: toIso(company.verifiedAt),
      status: company.status,
      statusReason: company.statusReason,
      isDemo: company.isDemo,
      createdAt: toIso(company.createdAt),
      contacts: company.contacts.map((c) => ({
        id: c.id,
        kind: c.kind,
        fullName: c.fullName,
        jobTitle: c.jobTitle,
        email: c.email,
        phone: c.phone,
      })),
      members: company.memberships.map((m) => ({
        membershipId: m.id,
        userId: m.userId,
        firstName: m.user.firstName,
        lastName: m.user.lastName,
        email: m.user.email,
        role: m.role,
        status: m.status,
        since: toIso(m.createdAt),
      })),
      invitations: owner
        ? company.invitations.map((i) => ({
            id: i.id,
            email: i.email,
            role: i.companyRole,
            status: i.status === 'PENDING' && i.expiresAt <= new Date() ? 'EXPIRED' : i.status,
            expiresAt: toIso(i.expiresAt),
            createdAt: toIso(i.createdAt),
          }))
        : [],
      missingForVerification: missingForVerification(company, company.contacts.length),
      lockedFields: company.verificationStatus === 'VERIFIED' ? [...LOCKED_WHEN_VERIFIED] : [],
      actions: visibleActions(actions),
      pending: actor.isAdmin ? [] : companyPending(company),
    };
  }

  async getOwn(actor: Actor): Promise<CompanyView> {
    return this.toView(await this.load(this.requireMemberCompanyId(actor)), actor);
  }

  // ── Espace entreprise ─────────────────────────────────────────────────────

  async updateOwn(actor: Actor, input: UpdateCompanyInput): Promise<CompanyView> {
    const companyId = this.requireMemberCompanyId(actor);
    const company = await this.load(companyId);
    assertAllowed(companyActions(actor, company, company.contacts.length), 'update');
    const data = this.cleanUpdate(input);
    if (company.verificationStatus === 'VERIFIED') {
      const changedLocked = LOCKED_WHEN_VERIFIED.filter((field) => field in data && data[field] !== company[field]);
      if (changedLocked.length > 0) {
        throw conflict(
          "L'identité légale d'une entreprise vérifiée (raison sociale, forme, immatriculation, pays) ne peut être modifiée que par E-MPGT : contactez-nous.",
        );
      }
    }
    await this.prisma.$transaction(async (tx) => {
      await tx.company.update({ where: { id: companyId }, data });
      await this.audit.record(tx, actor, {
        action: 'company.update',
        entityType: 'Company',
        entityId: companyId,
        metadata: { fields: Object.keys(data) },
      });
    });
    return this.getOwn(actor);
  }

  private cleanUpdate(input: UpdateCompanyInput): Prisma.CompanyUpdateInput & Record<string, unknown> {
    return Object.fromEntries(Object.entries(input).filter(([, value]) => value !== undefined)) as Prisma.CompanyUpdateInput &
      Record<string, unknown>;
  }

  async submitVerification(actor: Actor): Promise<CompanyView> {
    const companyId = this.requireMemberCompanyId(actor);
    const company = await this.load(companyId);
    assertAllowed(companyActions(actor, company, company.contacts.length), 'submitVerification');
    await this.prisma.$transaction(async (tx) => {
      const updated = await tx.company.updateMany({
        where: { id: companyId, verificationStatus: { in: ['NOT_SUBMITTED', 'CHANGES_REQUESTED'] } },
        data: { verificationStatus: 'PENDING', verificationSubmittedAt: new Date() },
      });
      if (updated.count !== 1) throw conflict('La vérification a déjà été demandée.');
      await this.audit.record(tx, actor, { action: 'company.submit_verification', entityType: 'Company', entityId: companyId });
      await this.notifications.notifyAdmins(tx, {
        type: 'company.verification_requested',
        title: 'Entreprise à vérifier',
        body: `L'entreprise « ${company.legalName} » demande sa vérification.`,
        link: `/admin/entreprises/${companyId}`,
        email: true,
      });
    });
    return this.getOwn(actor);
  }

  async addContact(actor: Actor, input: CompanyContactInput): Promise<CompanyView> {
    const companyId = this.requireMemberCompanyId(actor);
    const company = await this.load(companyId);
    assertAllowed(companyActions(actor, company, company.contacts.length), 'manageContacts');
    if (company.contacts.length >= 20) throw conflict('20 contacts maximum.');
    await this.prisma.$transaction(async (tx) => {
      const contact = await tx.companyContact.create({ data: { ...input, companyId } });
      await this.audit.record(tx, actor, { action: 'company.contact_add', entityType: 'CompanyContact', entityId: contact.id });
    });
    return this.getOwn(actor);
  }

  async updateContact(actor: Actor, contactId: string, input: CompanyContactInput): Promise<CompanyView> {
    const companyId = this.requireMemberCompanyId(actor);
    const company = await this.load(companyId);
    assertAllowed(companyActions(actor, company, company.contacts.length), 'manageContacts');
    const contact = company.contacts.find((c) => c.id === contactId);
    if (!contact) throw notFound('Contact');
    await this.prisma.$transaction(async (tx) => {
      await tx.companyContact.update({ where: { id: contactId }, data: input });
      await this.audit.record(tx, actor, { action: 'company.contact_update', entityType: 'CompanyContact', entityId: contactId });
    });
    return this.getOwn(actor);
  }

  async removeContact(actor: Actor, contactId: string): Promise<CompanyView> {
    const companyId = this.requireMemberCompanyId(actor);
    const company = await this.load(companyId);
    assertAllowed(companyActions(actor, company, company.contacts.length), 'manageContacts');
    if (!company.contacts.some((c) => c.id === contactId)) throw notFound('Contact');
    await this.prisma.$transaction(async (tx) => {
      await tx.companyContact.delete({ where: { id: contactId } });
      await this.audit.record(tx, actor, { action: 'company.contact_remove', entityType: 'CompanyContact', entityId: contactId });
    });
    return this.getOwn(actor);
  }

  async inviteMember(actor: Actor, input: InviteMemberInput): Promise<CompanyView> {
    const companyId = this.requireMemberCompanyId(actor);
    const company = await this.load(companyId);
    assertAllowed(companyActions(actor, company, company.contacts.length), 'inviteMember');
    if (company.memberships.some((m) => m.status === 'ACTIVE' && m.user.email === input.email)) {
      throw conflict('Cette personne est déjà membre de l’organisation.');
    }
    const token = randomToken(32);
    await this.prisma.$transaction(async (tx) => {
      // Une seule invitation active par adresse et par organisation.
      await tx.invitation.updateMany({
        where: { companyId, email: input.email, status: 'PENDING' },
        data: { status: 'REVOKED', revokedAt: new Date() },
      });
      const invitation = await tx.invitation.create({
        data: {
          type: 'COMPANY_MEMBER',
          email: input.email,
          tokenHash: sha256Hex(token),
          companyId,
          companyRole: input.role,
          message: input.message,
          invitedById: actor.userId,
          expiresAt: addDays(new Date(), 7),
        },
      });
      await this.audit.record(tx, actor, {
        action: 'company.invite_member',
        entityType: 'Invitation',
        entityId: invitation.id,
        metadata: { companyId, role: input.role },
      });
    });
    await this.mail.sendSafely(
      mailTemplates.companyInvitation(input.email, company.legalName, fullName(actor.firstName, actor.lastName), token, input.message ?? null),
    );
    return this.getOwn(actor);
  }

  async revokeInvitation(actor: Actor, invitationId: string): Promise<CompanyView> {
    const companyId = this.requireMemberCompanyId(actor);
    if (!isCompanyOwner(actor, companyId)) throw forbidden("Seul le responsable de l'organisation gère les invitations");
    const invitation = await this.prisma.invitation.findFirst({ where: { id: invitationId, companyId } });
    if (!invitation) throw notFound('Invitation');
    if (invitation.status !== 'PENDING') throw conflict('Cette invitation n’est plus active.');
    await this.prisma.$transaction(async (tx) => {
      await tx.invitation.update({ where: { id: invitationId }, data: { status: 'REVOKED', revokedAt: new Date() } });
      await this.audit.record(tx, actor, { action: 'company.invitation_revoke', entityType: 'Invitation', entityId: invitationId });
    });
    return this.getOwn(actor);
  }

  async removeMember(actor: Actor, membershipId: string): Promise<CompanyView> {
    const companyId = this.requireMemberCompanyId(actor);
    if (!isCompanyOwner(actor, companyId)) throw forbidden("Seul le responsable de l'organisation gère les membres");
    const company = await this.load(companyId);
    const membership = company.memberships.find((m) => m.id === membershipId && m.status === 'ACTIVE');
    if (!membership) throw notFound('Membre');
    const activeOwners = company.memberships.filter((m) => m.status === 'ACTIVE' && m.role === 'OWNER');
    if (membership.role === 'OWNER' && activeOwners.length <= 1) {
      throw conflict("L'organisation doit conserver au moins un responsable.");
    }
    await this.prisma.$transaction(async (tx) => {
      await tx.companyMembership.update({ where: { id: membershipId }, data: { status: 'REVOKED', revokedAt: new Date() } });
      await tx.session.updateMany({
        where: { userId: membership.userId, revokedAt: null },
        data: { revokedAt: new Date(), revokedReason: 'membership_revoked' },
      });
      await this.audit.record(tx, actor, {
        action: 'company.member_remove',
        entityType: 'CompanyMembership',
        entityId: membershipId,
        metadata: { userId: membership.userId },
      });
    });
    return this.getOwn(actor);
  }

  // ── Administration ────────────────────────────────────────────────────────

  async adminList(
    query: PageQuery & { verificationStatus?: CompanyVerificationStatus; status?: CompanyStatus },
  ): Promise<Page<AdminCompanyListItem>> {
    const where: Prisma.CompanyWhereInput = {
      ...(query.verificationStatus ? { verificationStatus: query.verificationStatus } : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(query.q
        ? {
            OR: [
              { legalName: { contains: query.q, mode: 'insensitive' } },
              { tradeName: { contains: query.q, mode: 'insensitive' } },
              { registrationNumber: { contains: query.q, mode: 'insensitive' } },
              { city: { contains: query.q, mode: 'insensitive' } },
            ],
          }
        : {}),
    };
    const [items, total] = await Promise.all([
      this.prisma.company.findMany({
        where,
        ...pageArgs(query),
        orderBy: [{ verificationSubmittedAt: { sort: 'desc', nulls: 'last' } }, { createdAt: 'desc' }],
        include: {
          memberships: { where: { role: 'OWNER', status: 'ACTIVE' }, include: { user: { select: { email: true } } }, take: 1 },
          _count: { select: { missions: true } },
        },
      }),
      this.prisma.company.count({ where }),
    ]);
    return toPage(
      items.map((c) => ({
        id: c.id,
        legalName: c.legalName,
        country: c.country,
        city: c.city,
        verificationStatus: c.verificationStatus,
        status: c.status,
        ownerEmail: c.memberships[0]?.user.email ?? null,
        missions: c._count.missions,
        isDemo: c.isDemo,
        createdAt: toIso(c.createdAt),
        verificationSubmittedAt: toIso(c.verificationSubmittedAt),
      })),
      total,
      query,
    );
  }

  async adminGet(actor: Actor, companyId: string): Promise<AdminCompanyView> {
    const company = await this.load(companyId);
    const [missions, publishedMissions, activeContracts] = await Promise.all([
      this.prisma.mission.count({ where: { companyId } }),
      this.prisma.mission.count({ where: { companyId, publicationStatus: 'PUBLISHED' } }),
      this.prisma.contract.count({ where: { companyId, status: 'ACTIVE' } }),
    ]);
    return {
      ...this.toView(company, actor),
      internalNotes: company.internalNotes,
      stats: { missions, publishedMissions, activeContracts },
    };
  }

  async adminUpdate(actor: Actor, companyId: string, input: UpdateCompanyInput & { internalNotes?: string | null; reason: string }) {
    const company = await this.load(companyId);
    const { reason, ...rest } = input;
    const data = this.cleanUpdate(rest);
    const changes = Object.fromEntries(
      Object.entries(data)
        .filter(([key, value]) => (company as Record<string, unknown>)[key] !== value)
        .map(([key, value]) => [key, { before: (company as Record<string, unknown>)[key], after: value }]),
    );
    await this.prisma.$transaction(async (tx) => {
      await tx.company.update({ where: { id: companyId }, data });
      await this.audit.record(tx, actor, { action: 'admin.company.update', entityType: 'Company', entityId: companyId, reason, metadata: { changes } });
    });
    return this.adminGet(actor, companyId);
  }

  async adminDecide(
    actor: Actor,
    companyId: string,
    decision: 'verify' | 'requestChanges' | 'reject' | 'suspend' | 'reactivate',
    reason: string | null,
  ): Promise<AdminCompanyView> {
    const company = await this.load(companyId);
    assertAllowed(companyActions(actor, company, company.contacts.length), decision);
    const now = new Date();
    const data: Prisma.CompanyUpdateInput = {
      verify: { verificationStatus: 'VERIFIED' as const, verifiedAt: now, verifiedById: actor.userId, verificationNote: reason },
      requestChanges: { verificationStatus: 'CHANGES_REQUESTED' as const, verificationNote: reason },
      reject: { verificationStatus: 'REJECTED' as const, verificationNote: reason },
      suspend: { status: 'SUSPENDED' as const, statusReason: reason },
      reactivate: { status: 'ACTIVE' as const, statusReason: null },
    }[decision];
    const messages: Record<typeof decision, { title: string; body: string }> = {
      verify: {
        title: 'Entreprise vérifiée',
        body: `E-MPGT a vérifié votre entreprise « ${company.legalName} ». Vos missions validées peuvent désormais être publiées.`,
      },
      requestChanges: { title: 'Compléments demandés', body: `E-MPGT demande des compléments pour vérifier votre entreprise : ${reason}` },
      reject: { title: 'Vérification refusée', body: `La vérification de votre entreprise a été refusée : ${reason}` },
      suspend: { title: 'Entreprise suspendue', body: `Votre organisation a été suspendue par E-MPGT : ${reason}` },
      reactivate: { title: 'Entreprise réactivée', body: 'Votre organisation a été réactivée par E-MPGT.' },
    };
    await this.prisma.$transaction(async (tx) => {
      await tx.company.update({ where: { id: companyId }, data });
      await this.audit.record(tx, actor, {
        action: `admin.company.${decision}`,
        entityType: 'Company',
        entityId: companyId,
        reason,
        metadata: { before: { verificationStatus: company.verificationStatus, status: company.status } },
      });
      await this.notifications.notifyCompany(tx, companyId, {
        type: `company.${decision}`,
        ...messages[decision],
        link: '/entreprise/organisation',
        email: true,
      });
    });
    return this.adminGet(actor, companyId);
  }

  /** Accès en lecture d'une organisation : membre ou administrateur uniquement. */
  assertCanRead(actor: Actor, companyId: string): void {
    if (!actor.isAdmin && !isCompanyMember(actor, companyId)) throw notFound('Entreprise');
  }
}
