import { HttpException, HttpStatus, Injectable, Logger } from '@nestjs/common';
import type {
  AcceptInvitationInput,
  ChangePasswordInput,
  InvitationPreview,
  LoginInput,
  MeResponse,
  MessageResponse,
  RegisterCompanyInput,
  RegisterFreelancerInput,
  RoleCode,
  SessionInfo,
  SessionUser,
  UpdateMeInput,
} from '@empgt/contracts';
import type { Request, Response } from 'express';
import type { AuthTokenType } from '../../generated/prisma/client.js';
import { env } from '../../config/env.js';
import { randomToken, sha256Hex } from '../../common/crypto.js';
import { addHours, toIso } from '../../common/dates.js';
import { conflict, forbidden, notFound, unauthorized } from '../../common/errors.js';
import { PrismaService, type Db } from '../../common/prisma.service.js';
import { AuditService } from '../core/audit.service.js';
import { MailService } from '../core/mail.service.js';
import { mailTemplates } from '../core/mail-templates.js';
import { NotificationService } from '../core/notification.service.js';
import type { Actor } from './actor.js';
import {
  clearSessionCookie,
  createCsrfToken,
  csrfCookieName,
  isValidCsrfToken,
  setCsrfCookie,
  setSessionCookie,
} from './cookies.js';
import { PasswordService } from './password.service.js';
import { SessionService } from './session.service.js';

const GENERIC_REGISTRATION =
  'Si cette adresse peut être utilisée, un e-mail de confirmation vient de vous être envoyé. Pensez à vérifier vos courriers indésirables.';
const GENERIC_RESET =
  'Si un compte existe pour cette adresse, un e-mail de réinitialisation vient d’être envoyé.';

@Injectable()
export class AuthService {
  private readonly logger = new Logger('Auth');

  constructor(
    private readonly prisma: PrismaService,
    private readonly passwords: PasswordService,
    private readonly sessions: SessionService,
    private readonly audit: AuditService,
    private readonly mail: MailService,
    private readonly notifications: NotificationService,
  ) {}

  // ── Jetons à usage unique ─────────────────────────────────────────────────

  async createAuthToken(db: Db, userId: string, type: AuthTokenType, ttlHours: number): Promise<string> {
    // Un seul lien valide à la fois par usage : les précédents sont invalidés.
    await db.authToken.updateMany({ where: { userId, type, usedAt: null }, data: { usedAt: new Date() } });
    const token = randomToken(32);
    await db.authToken.create({
      data: { userId, type, tokenHash: sha256Hex(token), expiresAt: addHours(new Date(), ttlHours) },
    });
    return token;
  }

  private async consumeAuthToken(db: Db, token: string, type: AuthTokenType) {
    const record = await db.authToken.findUnique({ where: { tokenHash: sha256Hex(token) }, include: { user: true } });
    if (!record || record.type !== type || record.usedAt || record.expiresAt <= new Date()) {
      throw conflict('Ce lien est invalide ou a expiré. Demandez-en un nouveau.');
    }
    const updated = await db.authToken.updateMany({ where: { id: record.id, usedAt: null }, data: { usedAt: new Date() } });
    if (updated.count !== 1) throw conflict('Ce lien a déjà été utilisé.');
    return record;
  }

  // ── Inscription ───────────────────────────────────────────────────────────

  async registerCompany(input: RegisterCompanyInput): Promise<MessageResponse> {
    return this.register(input, 'COMPANY', async (tx, userId) => {
      const company = await tx.company.create({
        data: { legalName: input.companyName, country: input.country },
      });
      await tx.companyMembership.create({ data: { companyId: company.id, userId, role: 'OWNER' } });
      return { companyId: company.id };
    });
  }

  async registerFreelancer(input: RegisterFreelancerInput): Promise<MessageResponse> {
    return this.register(input, 'FREELANCER', async (tx, userId) => {
      const profile = await tx.freelancerProfile.create({ data: { userId, origin: 'SELF_REGISTERED' } });
      await tx.paymentConfiguration.create({ data: { profileId: profile.id } });
      return { profileId: profile.id };
    });
  }

  private async register(
    input: RegisterFreelancerInput,
    role: Exclude<RoleCode, 'PLATFORM_ADMIN'>,
    createSpace: (tx: Db, userId: string) => Promise<Record<string, string>>,
  ): Promise<MessageResponse> {
    const existing = await this.prisma.user.findUnique({ where: { email: input.email } });
    if (existing) {
      // Réponse identique pour ne pas révéler l'existence d'un compte.
      await this.mail.sendSafely(mailTemplates.accountAlreadyExists(existing.email));
      return { message: GENERIC_REGISTRATION };
    }
    const passwordHash = await this.passwords.hash(input.password);
    const { user, token } = await this.prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          email: input.email,
          passwordHash,
          firstName: input.firstName,
          lastName: input.lastName,
          phone: input.phone,
          roles: { create: { role } },
        },
      });
      const space = await createSpace(tx, user.id);
      const token = await this.createAuthToken(tx, user.id, 'EMAIL_VERIFICATION', 24);
      await this.audit.record(tx, null, {
        action: 'user.register',
        entityType: 'User',
        entityId: user.id,
        metadata: { role, ...space },
      });
      return { user, token };
    });
    await this.mail.sendSafely(mailTemplates.verifyEmail(user.email, user.firstName, token));
    return { message: GENERIC_REGISTRATION };
  }

  async verifyEmail(token: string): Promise<MessageResponse> {
    await this.prisma.$transaction(async (tx) => {
      const record = await this.consumeAuthToken(tx, token, 'EMAIL_VERIFICATION');
      if (record.user.status === 'SUSPENDED' || record.user.status === 'DISABLED') {
        throw forbidden('Ce compte est suspendu : contactez E-MPGT.');
      }
      await tx.user.update({
        where: { id: record.userId },
        data: { emailVerifiedAt: record.user.emailVerifiedAt ?? new Date(), status: 'ACTIVE' },
      });
      await this.audit.record(tx, null, { action: 'user.email_verified', entityType: 'User', entityId: record.userId });
    });
    return { message: 'Adresse e-mail confirmée. Vous pouvez vous connecter.' };
  }

  async resendVerification(email: string): Promise<MessageResponse> {
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (user && user.status === 'PENDING_VERIFICATION') {
      const token = await this.createAuthToken(this.prisma, user.id, 'EMAIL_VERIFICATION', 24);
      await this.mail.sendSafely(mailTemplates.verifyEmail(user.email, user.firstName, token));
    }
    return { message: GENERIC_REGISTRATION };
  }

  // ── Connexion ─────────────────────────────────────────────────────────────

  async login(input: LoginInput, req: Request, res: Response): Promise<MeResponse> {
    const user = await this.prisma.user.findUnique({ where: { email: input.email } });
    if (user?.lockedUntil && user.lockedUntil > new Date()) {
      throw new HttpException(
        'Compte temporairement verrouillé après plusieurs échecs. Réessayez plus tard ou réinitialisez votre mot de passe.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
    const valid = await this.passwords.verify(user?.passwordHash ?? null, input.password);
    if (!user || !valid) {
      if (user) {
        const failures = user.failedLoginCount + 1;
        const lock = failures >= env().LOGIN_MAX_FAILURES;
        await this.prisma.$transaction(async (tx) => {
          await tx.user.update({
            where: { id: user.id },
            data: {
              failedLoginCount: lock ? 0 : failures,
              lockedUntil: lock ? new Date(Date.now() + env().LOGIN_LOCK_MINUTES * 60_000) : user.lockedUntil,
            },
          });
          await this.audit.record(tx, null, {
            action: lock ? 'auth.account_locked' : 'auth.login_failed',
            entityType: 'User',
            entityId: user.id,
          });
        });
      }
      throw unauthorized('Adresse e-mail ou mot de passe incorrect');
    }
    if (user.status === 'PENDING_VERIFICATION') {
      throw forbidden('Adresse e-mail non confirmée : utilisez le lien reçu par e-mail ou demandez-en un nouveau.');
    }
    if (user.status !== 'ACTIVE') {
      throw forbidden('Ce compte est suspendu ou désactivé : contactez E-MPGT.');
    }
    const { token, expiresAt } = await this.prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: user.id },
        data: { failedLoginCount: 0, lockedUntil: null, lastLoginAt: new Date() },
      });
      await this.audit.record(tx, null, { action: 'auth.login', entityType: 'User', entityId: user.id });
      return this.sessions.create(user.id, req, tx);
    });
    setSessionCookie(res, token, expiresAt);
    const actor = await this.sessions.resolve(token);
    if (!actor) throw unauthorized();
    return this.me(actor, req, res);
  }

  async logout(actor: Actor, res: Response): Promise<MessageResponse> {
    await this.sessions.revoke(actor.sessionId, 'logout');
    clearSessionCookie(res);
    return { message: 'Vous êtes déconnecté.' };
  }

  /** Jeton CSRF : réutilise celui du cookie s'il est valide, sinon en émet un nouveau. */
  csrf(req: Request, res: Response): string {
    const existing = (req.cookies as Record<string, string> | undefined)?.[csrfCookieName()];
    if (isValidCsrfToken(existing)) return existing;
    const token = createCsrfToken();
    setCsrfCookie(res, token);
    return token;
  }

  async me(actor: Actor, req: Request, res: Response): Promise<MeResponse> {
    const [user, unreadNotifications] = await Promise.all([this.sessionUser(actor.userId), this.prisma.notification.count({ where: { userId: actor.userId, readAt: null } })]);
    return { user, csrfToken: this.csrf(req, res), unreadNotifications };
  }

  async sessionUser(userId: string): Promise<SessionUser> {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      include: {
        roles: { where: { revokedAt: null } },
        memberships: { where: { status: 'ACTIVE' }, include: { company: true }, take: 1 },
        freelancerProfile: { select: { id: true, headline: true, validationStatus: true } },
      },
    });
    const roles = user.roles.map((r) => r.role as RoleCode);
    const membership = user.memberships[0];
    return {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      phone: user.phone,
      status: user.status,
      emailVerified: Boolean(user.emailVerifiedAt),
      roles,
      space: roles.includes('PLATFORM_ADMIN') ? 'admin' : roles.includes('COMPANY') ? 'company' : 'freelancer',
      isDemo: user.isDemo,
      company: membership
        ? {
            id: membership.company.id,
            legalName: membership.company.legalName,
            verificationStatus: membership.company.verificationStatus,
            status: membership.company.status,
            membershipRole: membership.role,
          }
        : null,
      freelancerProfile: user.freelancerProfile,
    };
  }

  async updateMe(actor: Actor, input: UpdateMeInput): Promise<SessionUser> {
    await this.prisma.user.update({
      where: { id: actor.userId },
      data: {
        ...(input.firstName ? { firstName: input.firstName } : {}),
        ...(input.lastName ? { lastName: input.lastName } : {}),
        ...(input.phone !== undefined ? { phone: input.phone } : {}),
      },
    });
    return this.sessionUser(actor.userId);
  }

  // ── Mot de passe ──────────────────────────────────────────────────────────

  async forgotPassword(email: string): Promise<MessageResponse> {
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (user && (user.status === 'ACTIVE' || user.status === 'PENDING_VERIFICATION')) {
      const token = await this.createAuthToken(this.prisma, user.id, 'PASSWORD_RESET', 1);
      await this.mail.sendSafely(mailTemplates.resetPassword(user.email, user.firstName, token));
      await this.audit.record(this.prisma, null, { action: 'auth.password_reset_requested', entityType: 'User', entityId: user.id });
    }
    return { message: GENERIC_RESET };
  }

  async resetPassword(token: string, password: string): Promise<MessageResponse> {
    const passwordHash = await this.passwords.hash(password);
    const user = await this.prisma.$transaction(async (tx) => {
      const record = await this.consumeAuthToken(tx, token, 'PASSWORD_RESET');
      if (record.user.status === 'SUSPENDED' || record.user.status === 'DISABLED') {
        throw forbidden('Ce compte est suspendu : contactez E-MPGT.');
      }
      // Le lien reçu par e-mail prouve aussi la maîtrise de l'adresse.
      await tx.user.update({
        where: { id: record.userId },
        data: {
          passwordHash,
          failedLoginCount: 0,
          lockedUntil: null,
          emailVerifiedAt: record.user.emailVerifiedAt ?? new Date(),
          status: 'ACTIVE',
        },
      });
      await this.sessions.revokeAllForUser(record.userId, 'password_reset', undefined, tx);
      await this.audit.record(tx, null, { action: 'auth.password_reset', entityType: 'User', entityId: record.userId });
      return record.user;
    });
    await this.mail.sendSafely(mailTemplates.passwordChanged(user.email, user.firstName));
    return { message: 'Mot de passe enregistré. Vous pouvez vous connecter.' };
  }

  async changePassword(actor: Actor, input: ChangePasswordInput): Promise<MessageResponse> {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: actor.userId } });
    if (!(await this.passwords.verify(user.passwordHash, input.currentPassword))) {
      throw conflict('Le mot de passe actuel est incorrect.');
    }
    const passwordHash = await this.passwords.hash(input.newPassword);
    await this.prisma.$transaction(async (tx) => {
      await tx.user.update({ where: { id: actor.userId }, data: { passwordHash } });
      await this.sessions.revokeAllForUser(actor.userId, 'password_change', actor.sessionId, tx);
      await this.audit.record(tx, actor, { action: 'auth.password_change', entityType: 'User', entityId: actor.userId });
    });
    await this.mail.sendSafely(mailTemplates.passwordChanged(user.email, user.firstName));
    return { message: 'Mot de passe modifié. Vos autres sessions ont été fermées.' };
  }

  async listSessions(actor: Actor): Promise<SessionInfo[]> {
    const sessions = await this.prisma.session.findMany({
      where: { userId: actor.userId, revokedAt: null, expiresAt: { gt: new Date() } },
      orderBy: { lastSeenAt: 'desc' },
    });
    return sessions.map((s) => ({
      id: s.id,
      createdAt: toIso(s.createdAt),
      lastSeenAt: toIso(s.lastSeenAt),
      expiresAt: toIso(s.expiresAt),
      userAgent: s.userAgent,
      ipPrefix: s.ipPrefix,
      current: s.id === actor.sessionId,
    }));
  }

  async revokeSession(actor: Actor, sessionId: string): Promise<MessageResponse> {
    const session = await this.prisma.session.findFirst({ where: { id: sessionId, userId: actor.userId } });
    if (!session) throw notFound('Session');
    await this.sessions.revoke(session.id, 'user_revoked');
    return { message: 'Session fermée.' };
  }

  // ── Invitations ───────────────────────────────────────────────────────────

  private async findValidInvitation(db: Db, token: string) {
    const invitation = await db.invitation.findUnique({
      where: { tokenHash: sha256Hex(token) },
      include: { company: true, freelancerProfile: true },
    });
    if (!invitation || invitation.status !== 'PENDING') throw conflict('Cette invitation est invalide ou n’est plus active.');
    if (invitation.expiresAt <= new Date()) throw conflict('Cette invitation a expiré : demandez-en une nouvelle.');
    return invitation;
  }

  async previewInvitation(token: string): Promise<InvitationPreview> {
    const invitation = await this.findValidInvitation(this.prisma, token);
    const account = await this.prisma.user.findUnique({ where: { email: invitation.email }, select: { id: true } });
    return {
      type: invitation.type,
      email: invitation.email,
      companyName: invitation.company?.legalName ?? null,
      profileHeadline: invitation.freelancerProfile?.headline ?? null,
      accountExists: Boolean(account),
      expiresAt: toIso(invitation.expiresAt),
    };
  }

  async acceptInvitation(input: AcceptInvitationInput, actor: Actor | null, req: Request, res: Response): Promise<MeResponse> {
    const passwordHash = input.password ? await this.passwords.hash(input.password) : null;
    const result = await this.prisma.$transaction(async (tx) => {
      const invitation = await this.findValidInvitation(tx, input.token);
      const existing = await tx.user.findUnique({
        where: { email: invitation.email },
        include: { memberships: { where: { status: 'ACTIVE' } }, freelancerProfile: true, roles: { where: { revokedAt: null } } },
      });
      let userId: string;
      let createdAccount = false;
      if (existing) {
        if (!actor || actor.userId !== existing.id) {
          throw conflict('Un compte existe déjà pour cette adresse : connectez-vous avec celui-ci, puis rouvrez le lien d’invitation.');
        }
        userId = existing.id;
      } else {
        if (!passwordHash || !input.firstName || !input.lastName || input.acceptTerms !== true) {
          throw conflict('Renseignez vos nom, prénom et mot de passe, et acceptez les conditions d’utilisation.');
        }
        const role: RoleCode = invitation.type === 'COMPANY_MEMBER' ? 'COMPANY' : 'FREELANCER';
        // L'invitation reçue par e-mail prouve la maîtrise de l'adresse : compte activé directement.
        const user = await tx.user.create({
          data: {
            email: invitation.email,
            passwordHash,
            firstName: input.firstName,
            lastName: input.lastName,
            status: 'ACTIVE',
            emailVerifiedAt: new Date(),
            roles: { create: { role, grantedById: invitation.invitedById } },
          },
        });
        userId = user.id;
        createdAccount = true;
      }

      if (invitation.type === 'COMPANY_MEMBER') {
        if (!invitation.companyId) throw conflict('Invitation incomplète.');
        if (existing) {
          const roles = existing.roles.map((r) => r.role);
          if (roles.includes('FREELANCER') || roles.includes('PLATFORM_ADMIN')) {
            throw conflict('Ce compte ne peut pas rejoindre une organisation entreprise.');
          }
          if (existing.memberships.some((m) => m.companyId !== invitation.companyId)) {
            throw conflict('Ce compte est déjà rattaché à une autre organisation (une seule en V1).');
          }
        }
        await tx.companyMembership.upsert({
          where: { companyId_userId: { companyId: invitation.companyId, userId } },
          create: { companyId: invitation.companyId, userId, role: invitation.companyRole ?? 'MEMBER' },
          update: { status: 'ACTIVE', role: invitation.companyRole ?? 'MEMBER', revokedAt: null },
        });
        if (existing && !existing.roles.some((r) => r.role === 'COMPANY')) {
          await tx.userRole.create({ data: { userId, role: 'COMPANY', grantedById: invitation.invitedById } });
        }
      } else {
        const profile = invitation.freelancerProfile;
        if (!profile || profile.userId) throw conflict('Ce profil est déjà rattaché à un compte.');
        if (existing) {
          if (existing.freelancerProfile) {
            throw conflict('Votre compte possède déjà un profil : contactez E-MPGT pour rapprocher les deux profils.');
          }
          if (existing.roles.some((r) => r.role !== 'FREELANCER')) throw conflict('Ce compte ne peut pas détenir un profil freelance.');
        }
        await tx.freelancerProfile.update({
          where: { id: profile.id },
          // Le freelance relit et soumet lui-même son profil : rien n'est publié sans son accord.
          data: {
            userId,
            validationStatus: 'DRAFT',
            catalogVisibility: 'PRIVATE',
            publicationConsentAt: null,
            fieldsToConfirm: profile.fieldsToConfirm.filter((f) => f !== 'identity' && f !== 'email'),
          },
        });
        await tx.paymentConfiguration.upsert({ where: { profileId: profile.id }, create: { profileId: profile.id }, update: {} });
        if (existing && !existing.roles.some((r) => r.role === 'FREELANCER')) {
          await tx.userRole.create({ data: { userId, role: 'FREELANCER', grantedById: invitation.invitedById } });
        }
      }

      await tx.invitation.update({
        where: { id: invitation.id },
        data: { status: 'ACCEPTED', acceptedAt: new Date(), acceptedById: userId },
      });
      await this.audit.record(tx, actor, {
        action: 'invitation.accept',
        entityType: 'Invitation',
        entityId: invitation.id,
        metadata: { type: invitation.type, userId, createdAccount, companyId: invitation.companyId, profileId: invitation.freelancerProfileId },
      });
      await this.notifications.notifyUsers(tx, [invitation.invitedById], {
        type: 'invitation.accepted',
        title: 'Invitation acceptée',
        body: `L’invitation envoyée à ${invitation.email} a été acceptée.`,
        link: invitation.type === 'COMPANY_MEMBER' ? '/entreprise/organisation' : `/admin/freelances/${invitation.freelancerProfileId}`,
      });
      const session = createdAccount ? await this.sessions.create(userId, req, tx) : null;
      return { userId, session };
    });

    if (result.session) setSessionCookie(res, result.session.token, result.session.expiresAt);
    // L'acteur est rechargé pour refléter le nouveau rattachement (organisation ou profil).
    const current = result.session
      ? await this.sessions.resolve(result.session.token)
      : actor && (await this.sessions.resolveBySessionId(actor.sessionId));
    if (!current) throw unauthorized();
    return this.me(current, req, res);
  }
}
