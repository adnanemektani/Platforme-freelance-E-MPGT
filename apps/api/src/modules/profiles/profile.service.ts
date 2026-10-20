import { Injectable } from '@nestjs/common';
import type {
  AdminProfileListItem,
  AdminProfileView,
  AdminUpdateProfileInput,
  AvailabilityInput,
  AvailabilityStatusInput,
  CandidateProfileView,
  EducationInput,
  ExperienceInput,
  InviteProfileClaimInput,
  OwnProfileView,
  Page,
  PageQuery,
  ProfileLanguagesInput,
  ProfileOrigin,
  ProfileSkillsInput,
  ProfileValidationStatus,
  PublicationInput,
  PublicProfileListItem,
  PublicProfilesQuery,
  PublicProfileView,
  QualificationInput,
  UpdateProfileInput,
  VerifyDocumentInput,
} from '@empgt/contracts';
import type { Prisma } from '../../generated/prisma/client.js';
import { assertAllowed } from '../../common/actions.js';
import { randomToken, sha256Hex } from '../../common/crypto.js';
import { addDays, parseOptionalIsoDate } from '../../common/dates.js';
import { conflict, forbidden, notFound } from '../../common/errors.js';
import { dec } from '../../common/money.js';
import { pageArgs, toPage } from '../../common/pagination.js';
import { PrismaService, type Db } from '../../common/prisma.service.js';
import { slugify } from '../../common/text.js';
import type { Actor } from '../auth/actor.js';
import { AuditService } from '../core/audit.service.js';
import { MailService } from '../core/mail.service.js';
import { mailTemplates } from '../core/mail-templates.js';
import { NotificationService } from '../core/notification.service.js';
import { SettingsService } from '../core/settings.service.js';
import {
  profileInclude,
  toAdminListItem,
  toAdminView,
  toCandidateView,
  toOwnView,
  toPublicListItem,
  toPublicView,
  type ProfileFull,
} from './profile.mapper.js';
import { profileActions } from './profile.policy.js';
import { SkillsService } from './skills.service.js';

type Section = 'experiences' | 'educations' | 'qualifications' | 'availabilities';
type Mode = { kind: 'owner' } | { kind: 'admin'; reason?: string | null };

/** Conditions d'apparition dans le catalogue public. */
export const PUBLIC_PROFILE_WHERE: Prisma.FreelancerProfileWhereInput = {
  validationStatus: 'APPROVED',
  catalogVisibility: 'PUBLIC_ANONYMOUS',
  publicationConsentAt: { not: null },
  user: { status: 'ACTIVE' },
};

@Injectable()
export class ProfileService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly notifications: NotificationService,
    private readonly settings: SettingsService,
    private readonly skills: SkillsService,
    private readonly mail: MailService,
  ) {}

  // ── Chargement et contrôle d'accès ────────────────────────────────────────

  async load(profileId: string, db: Db = this.prisma): Promise<ProfileFull> {
    const profile = await db.freelancerProfile.findUnique({ where: { id: profileId }, include: profileInclude });
    if (!profile) throw notFound('Profil');
    return profile;
  }

  private ownProfileId(actor: Actor): string {
    if (!actor.isFreelancer || !actor.profileId) throw forbidden('Espace réservé aux freelances');
    return actor.profileId;
  }

  private counts(profile: ProfileFull) {
    return { skills: profile.skills.length, experiences: profile.experiences.length };
  }

  /** Profil modifiable par l'acteur : le sien (si son état le permet) ou un profil historique non rattaché (E-MPGT). */
  private async editable(actor: Actor, profileId: string | null, scope: 'general' | 'sections'): Promise<{ profile: ProfileFull; mode: Mode }> {
    if (actor.isAdmin && profileId) {
      const profile = await this.load(profileId);
      assertAllowed(profileActions(actor, profile, this.counts(profile)), scope === 'general' ? 'adminUpdate' : 'editSections');
      return { profile, mode: { kind: 'admin' } };
    }
    const profile = await this.load(this.ownProfileId(actor));
    assertAllowed(profileActions(actor, profile, this.counts(profile)), 'update');
    return { profile, mode: { kind: 'owner' } };
  }

  /**
   * Une correction humaine sur un profil importé ne sera jamais écrasée par un nouvel import ;
   * un champ renseigné par le freelance ou par E-MPGT n'est plus « à confirmer ».
   */
  private async lockFields(tx: Db, profile: ProfileFull, mode: Mode, fields: string[]): Promise<void> {
    if (fields.length === 0) return;
    const confirmed = new Set(fields.map((f) => (f.startsWith('rate') ? 'rates' : f)));
    if (mode.kind === 'owner') {
      if (profile.fieldsToConfirm.some((f) => confirmed.has(f))) {
        await tx.freelancerProfile.update({ where: { id: profile.id }, data: { fieldsToConfirm: profile.fieldsToConfirm.filter((f) => !confirmed.has(f)) } });
      }
      return;
    }
    if (profile.origin !== 'IMPORTED') return;
    const locked = new Set([...profile.importLockedFields, ...fields]);
    const toConfirm = profile.fieldsToConfirm.filter((f) => !confirmed.has(f));
    await tx.freelancerProfile.update({ where: { id: profile.id }, data: { importLockedFields: [...locked], fieldsToConfirm: toConfirm } });
  }

  private async view(actor: Actor, profileId: string): Promise<OwnProfileView> {
    const profile = await this.load(profileId);
    return actor.isAdmin ? toAdminView(profile, actor) : toOwnView(profile, actor);
  }

  private auditAction(mode: Mode, action: string): string {
    return mode.kind === 'admin' ? `admin.profile.${action}` : `profile.${action}`;
  }

  // ── Espace freelance ──────────────────────────────────────────────────────

  async getOwn(actor: Actor): Promise<OwnProfileView> {
    return toOwnView(await this.load(this.ownProfileId(actor)), actor);
  }

  async update(actor: Actor, input: UpdateProfileInput, profileId: string | null = null): Promise<OwnProfileView> {
    const { profile, mode } = await this.editable(actor, profileId, 'general');
    const data = Object.fromEntries(Object.entries(input).filter(([, v]) => v !== undefined)) as Record<string, unknown>;
    this.checkRates({ ...profile, ...data } as ProfileFull);
    await this.prisma.$transaction(async (tx) => {
      await tx.freelancerProfile.update({ where: { id: profile.id }, data: data as Prisma.FreelancerProfileUpdateInput });
      await this.lockFields(tx, profile, mode, Object.keys(data));
      await this.audit.record(tx, actor, {
        action: this.auditAction(mode, 'update'),
        entityType: 'FreelancerProfile',
        entityId: profile.id,
        metadata: { fields: Object.keys(data) },
      });
    });
    return this.view(actor, profile.id);
  }

  private checkRates(profile: Pick<ProfileFull, 'rateMin' | 'rateMax' | 'rateCurrency' | 'rateUnit'>): void {
    const min = profile.rateMin ? dec(profile.rateMin) : null;
    const max = profile.rateMax ? dec(profile.rateMax) : null;
    if (min && max && max.lt(min)) throw conflict('Le tarif maximal doit être supérieur ou égal au tarif minimal.');
    if ((min || max) && (!profile.rateCurrency || !profile.rateUnit)) {
      throw conflict('Précisez la devise et l’unité (heure ou jour) de vos préférences tarifaires.');
    }
  }

  async setSkills(actor: Actor, input: ProfileSkillsInput, profileId: string | null = null): Promise<OwnProfileView> {
    const { profile, mode } = await this.editable(actor, profileId, profileId ? 'sections' : 'general');
    await this.prisma.$transaction(async (tx) => {
      const ids = await this.skills.resolve(tx, input.skills);
      await tx.freelancerSkill.deleteMany({ where: { profileId: profile.id } });
      const seen = new Set<string>();
      for (const item of input.skills) {
        const skillId = ids.get(slugify(item.name));
        if (!skillId || seen.has(skillId)) continue;
        seen.add(skillId);
        await tx.freelancerSkill.create({
          data: { profileId: profile.id, skillId, level: item.level, yearsOfExperience: item.yearsOfExperience ?? null },
        });
      }
      await this.lockFields(tx, profile, mode, ['skills']);
      await this.touch(tx, profile.id);
      await this.audit.record(tx, actor, {
        action: this.auditAction(mode, 'skills_set'),
        entityType: 'FreelancerProfile',
        entityId: profile.id,
        metadata: { count: seen.size },
      });
    });
    return this.view(actor, profile.id);
  }

  async setLanguages(actor: Actor, input: ProfileLanguagesInput, profileId: string | null = null): Promise<OwnProfileView> {
    const { profile, mode } = await this.editable(actor, profileId, profileId ? 'sections' : 'general');
    await this.prisma.$transaction(async (tx) => {
      await tx.language.deleteMany({ where: { profileId: profile.id } });
      await tx.language.createMany({
        data: input.languages.map((l, position) => ({ profileId: profile.id, name: l.name, level: l.level, position })),
      });
      await this.lockFields(tx, profile, mode, ['languages']);
      await this.touch(tx, profile.id);
      await this.audit.record(tx, actor, { action: this.auditAction(mode, 'languages_set'), entityType: 'FreelancerProfile', entityId: profile.id });
    });
    return this.view(actor, profile.id);
  }

  /** Les rubriques enfants modifient la date de mise à jour du profil (signal « modifié depuis la validation »). */
  private async touch(tx: Db, profileId: string): Promise<void> {
    await tx.freelancerProfile.update({ where: { id: profileId }, data: { updatedAt: new Date() } });
  }

  async addItem(actor: Actor, section: Section, input: ExperienceInput | EducationInput | QualificationInput | AvailabilityInput, profileId: string | null = null) {
    const { profile, mode } = await this.editable(actor, profileId, profileId ? 'sections' : 'general');
    if (mode.kind === 'admin' && (section === 'qualifications' || section === 'availabilities')) {
      throw forbidden('Ces informations sont déclarées par le freelance lui-même.');
    }
    const data = this.sectionData(section, input, profile);
    await this.prisma.$transaction(async (tx) => {
      const created = await (tx[this.delegate(section)] as unknown as { create: (args: unknown) => Promise<{ id: string }> }).create({
        data: { ...data, profileId: profile.id },
      });
      await this.lockFields(tx, profile, mode, [section]);
      await this.touch(tx, profile.id);
      await this.audit.record(tx, actor, {
        action: this.auditAction(mode, `${section}_add`),
        entityType: 'FreelancerProfile',
        entityId: profile.id,
        metadata: { itemId: created.id },
      });
    });
    return this.view(actor, profile.id);
  }

  async updateItem(
    actor: Actor,
    section: Section,
    itemId: string,
    input: ExperienceInput | EducationInput | QualificationInput | AvailabilityInput,
    profileId: string | null = null,
  ) {
    const { profile, mode } = await this.editable(actor, profileId, profileId ? 'sections' : 'general');
    if (mode.kind === 'admin' && (section === 'qualifications' || section === 'availabilities')) {
      throw forbidden('Ces informations sont déclarées par le freelance lui-même.');
    }
    await this.assertItem(section, itemId, profile.id);
    const data = this.sectionData(section, input, profile);
    if (section === 'qualifications') Object.assign(data, { status: 'DECLARED', verifiedAt: null, verifiedById: null });
    await this.prisma.$transaction(async (tx) => {
      await (tx[this.delegate(section)] as unknown as { update: (args: unknown) => Promise<unknown> }).update({ where: { id: itemId }, data });
      await this.lockFields(tx, profile, mode, [section]);
      await this.touch(tx, profile.id);
      await this.audit.record(tx, actor, {
        action: this.auditAction(mode, `${section}_update`),
        entityType: 'FreelancerProfile',
        entityId: profile.id,
        metadata: { itemId },
      });
    });
    return this.view(actor, profile.id);
  }

  async removeItem(actor: Actor, section: Section, itemId: string, profileId: string | null = null) {
    const { profile, mode } = await this.editable(actor, profileId, profileId ? 'sections' : 'general');
    await this.assertItem(section, itemId, profile.id);
    await this.prisma.$transaction(async (tx) => {
      if (section === 'qualifications') {
        const docs = await tx.document.count({ where: { qualificationId: itemId, deletedAt: null } });
        if (docs > 0) throw conflict('Supprimez d’abord les justificatifs rattachés à cette qualification.');
      }
      await (tx[this.delegate(section)] as unknown as { delete: (args: unknown) => Promise<unknown> }).delete({ where: { id: itemId } });
      await this.lockFields(tx, profile, mode, [section]);
      await this.touch(tx, profile.id);
      await this.audit.record(tx, actor, {
        action: this.auditAction(mode, `${section}_remove`),
        entityType: 'FreelancerProfile',
        entityId: profile.id,
        metadata: { itemId },
      });
    });
    return this.view(actor, profile.id);
  }

  private delegate(section: Section): 'experience' | 'education' | 'qualification' | 'availability' {
    return ({ experiences: 'experience', educations: 'education', qualifications: 'qualification', availabilities: 'availability' } as const)[section];
  }

  private async assertItem(section: Section, itemId: string, profileId: string): Promise<void> {
    const delegate = this.prisma[this.delegate(section)] as unknown as { findFirst: (args: unknown) => Promise<unknown> };
    const item = await delegate.findFirst({ where: { id: itemId, profileId } });
    if (!item) throw notFound('Élément');
  }

  private sectionData(section: Section, input: unknown, profile: ProfileFull): Record<string, unknown> {
    if (section === 'experiences') {
      const e = input as ExperienceInput;
      if (e.startYear && e.endYear && e.endYear < e.startYear) throw conflict("L'année de fin précède l'année de début.");
      return {
        title: e.title,
        organization: e.organization,
        location: e.location,
        periodLabel: e.periodLabel,
        startYear: e.startYear ?? null,
        startMonth: e.startMonth ?? null,
        endYear: e.isCurrent ? null : (e.endYear ?? null),
        endMonth: e.isCurrent ? null : (e.endMonth ?? null),
        isCurrent: e.isCurrent,
        description: e.description,
        position: e.position ?? profile.experiences.length,
      };
    }
    if (section === 'educations') {
      const e = input as EducationInput;
      return {
        title: e.title,
        institution: e.institution,
        periodLabel: e.periodLabel,
        year: e.year ?? null,
        description: e.description,
        position: e.position ?? profile.educations.length,
      };
    }
    if (section === 'qualifications') {
      const q = input as QualificationInput;
      const obtainedAt = parseOptionalIsoDate(q.obtainedAt);
      const expiresAt = parseOptionalIsoDate(q.expiresAt);
      if (obtainedAt && expiresAt && expiresAt < obtainedAt) throw conflict("La date d'expiration précède la date d'obtention.");
      return { name: q.name, issuer: q.issuer, reference: q.reference, obtainedAt, expiresAt };
    }
    const a = input as AvailabilityInput;
    const startDate = parseOptionalIsoDate(a.startDate)!;
    const endDate = parseOptionalIsoDate(a.endDate);
    if (endDate && endDate < startDate) throw conflict('La date de fin précède la date de début.');
    if (a.kind === 'PARTIAL' && !a.daysPerWeek) throw conflict('Précisez le nombre de jours par semaine pour une disponibilité partielle.');
    return { kind: a.kind, startDate, endDate, daysPerWeek: a.daysPerWeek, note: a.note };
  }

  async setAvailabilityStatus(actor: Actor, input: AvailabilityStatusInput): Promise<OwnProfileView> {
    const { profile, mode } = await this.editable(actor, null, 'general');
    if (input.availabilityStatus === 'AVAILABLE_FROM' && !input.availableFrom) {
      throw conflict('Indiquez la date à partir de laquelle vous êtes disponible.');
    }
    await this.prisma.$transaction(async (tx) => {
      await tx.freelancerProfile.update({
        where: { id: profile.id },
        data: {
          availabilityStatus: input.availabilityStatus,
          availableFrom: input.availabilityStatus === 'AVAILABLE_FROM' ? parseOptionalIsoDate(input.availableFrom) : null,
          fieldsToConfirm: profile.fieldsToConfirm.filter((f) => f !== 'availabilityStatus'),
        },
      });
      await this.audit.record(tx, actor, {
        action: this.auditAction(mode, 'availability_status'),
        entityType: 'FreelancerProfile',
        entityId: profile.id,
        metadata: { availabilityStatus: input.availabilityStatus },
      });
    });
    return this.view(actor, profile.id);
  }

  async setPublication(actor: Actor, input: PublicationInput): Promise<OwnProfileView> {
    const profile = await this.load(this.ownProfileId(actor));
    if (input.catalogVisibility === 'PUBLIC_ANONYMOUS') {
      assertAllowed(profileActions(actor, profile, this.counts(profile)), 'publish');
      if (!input.consent) throw conflict('La publication dans le catalogue exige votre consentement explicite.');
    }
    await this.prisma.$transaction(async (tx) => {
      await tx.freelancerProfile.update({
        where: { id: profile.id },
        data: {
          catalogVisibility: input.catalogVisibility,
          publicationConsentAt: input.catalogVisibility === 'PUBLIC_ANONYMOUS' ? new Date() : null,
          fieldsToConfirm: profile.fieldsToConfirm.filter((f) => f !== 'publicationConsent'),
        },
      });
      await this.audit.record(tx, actor, {
        action: input.catalogVisibility === 'PUBLIC_ANONYMOUS' ? 'profile.publication_consent' : 'profile.publication_withdrawn',
        entityType: 'FreelancerProfile',
        entityId: profile.id,
      });
    });
    return this.getOwn(actor);
  }

  async submit(actor: Actor): Promise<OwnProfileView> {
    const profile = await this.load(this.ownProfileId(actor));
    assertAllowed(profileActions(actor, profile, this.counts(profile)), 'submit');
    const settings = await this.settings.get();
    const autoApprove = !settings.freelancerProfileApprovalRequired;
    await this.prisma.$transaction(async (tx) => {
      const updated = await tx.freelancerProfile.updateMany({
        where: { id: profile.id, validationStatus: { in: ['DRAFT', 'CHANGES_REQUESTED'] } },
        data: autoApprove
          ? { validationStatus: 'APPROVED', submittedAt: new Date(), reviewedAt: new Date(), validationNote: null }
          : { validationStatus: 'SUBMITTED', submittedAt: new Date() },
      });
      if (updated.count !== 1) throw conflict('Le profil a déjà été soumis.');
      await this.audit.record(tx, actor, {
        action: autoApprove ? 'profile.submit_auto_approved' : 'profile.submit',
        entityType: 'FreelancerProfile',
        entityId: profile.id,
        metadata: autoApprove ? { policy: 'freelancerProfileApprovalRequired=false' } : undefined,
      });
      if (!autoApprove) {
        await this.notifications.notifyAdmins(tx, {
          type: 'profile.submitted',
          title: 'Profil freelance à valider',
          body: `Le profil « ${profile.headline ?? 'sans titre'} » a été soumis à validation.`,
          link: `/admin/freelances/${profile.id}`,
          email: true,
        });
      }
    });
    return this.getOwn(actor);
  }

  // ── Administration ────────────────────────────────────────────────────────

  async adminList(
    query: PageQuery & { validationStatus?: ProfileValidationStatus; origin?: ProfileOrigin },
  ): Promise<Page<AdminProfileListItem>> {
    const where: Prisma.FreelancerProfileWhereInput = {
      ...(query.validationStatus ? { validationStatus: query.validationStatus } : {}),
      ...(query.origin ? { origin: query.origin } : {}),
      ...(query.q
        ? {
            OR: [
              { headline: { contains: query.q, mode: 'insensitive' } },
              { city: { contains: query.q, mode: 'insensitive' } },
              { user: { email: { contains: query.q, mode: 'insensitive' } } },
              { user: { lastName: { contains: query.q, mode: 'insensitive' } } },
              { skills: { some: { skill: { name: { contains: query.q, mode: 'insensitive' } } } } },
            ],
          }
        : {}),
    };
    const [items, total] = await Promise.all([
      this.prisma.freelancerProfile.findMany({
        where,
        ...pageArgs(query),
        orderBy: [{ submittedAt: { sort: 'desc', nulls: 'last' } }, { updatedAt: 'desc' }],
        include: { user: { select: { email: true, firstName: true, lastName: true, isDemo: true } } },
      }),
      this.prisma.freelancerProfile.count({ where }),
    ]);
    return toPage(items.map(toAdminListItem), total, query);
  }

  async adminGet(actor: Actor, profileId: string): Promise<AdminProfileView> {
    return toAdminView(await this.load(profileId), actor);
  }

  async adminUpdate(actor: Actor, profileId: string, input: AdminUpdateProfileInput): Promise<OwnProfileView> {
    const { reason, internalNotes, ...rest } = input;
    const profile = await this.load(profileId);
    assertAllowed(profileActions(actor, profile, this.counts(profile)), 'adminUpdate');
    const data = Object.fromEntries(Object.entries(rest).filter(([, v]) => v !== undefined)) as Record<string, unknown>;
    if (internalNotes !== undefined) data.internalNotes = internalNotes;
    this.checkRates({ ...profile, ...data } as ProfileFull);
    const changes = Object.fromEntries(
      Object.entries(data).map(([key, value]) => [key, { before: (profile as Record<string, unknown>)[key], after: value }]),
    );
    await this.prisma.$transaction(async (tx) => {
      await tx.freelancerProfile.update({ where: { id: profileId }, data: data as Prisma.FreelancerProfileUpdateInput });
      await this.lockFields(tx, profile, { kind: 'admin' }, Object.keys(data).filter((k) => k !== 'internalNotes'));
      await this.audit.record(tx, actor, { action: 'admin.profile.update', entityType: 'FreelancerProfile', entityId: profileId, reason, metadata: { changes } });
      if (profile.userId) {
        await this.notifications.notifyUsers(tx, [profile.userId], {
          type: 'profile.admin_updated',
          title: 'Votre profil a été modifié par E-MPGT',
          body: `E-MPGT a modifié votre profil. Motif : ${reason}`,
          link: '/freelance/profil',
          email: true,
        });
      }
    });
    return this.adminGet(actor, profileId);
  }

  async adminDecide(
    actor: Actor,
    profileId: string,
    decision: 'approve' | 'requestChanges' | 'reject' | 'suspend' | 'reactivate',
    reason: string | null,
  ): Promise<AdminProfileView> {
    const profile = await this.load(profileId);
    assertAllowed(profileActions(actor, profile, this.counts(profile)), decision);
    const now = new Date();
    const status = {
      approve: 'APPROVED',
      requestChanges: 'CHANGES_REQUESTED',
      reject: 'REJECTED',
      suspend: 'SUSPENDED',
      reactivate: profile.validationStatus === 'REJECTED' ? 'CHANGES_REQUESTED' : 'APPROVED',
    }[decision] as ProfileValidationStatus;
    const titles = {
      approve: ['Profil validé', 'E-MPGT a validé votre profil : vous pouvez candidater aux missions publiées.'],
      requestChanges: ['Corrections demandées', `E-MPGT demande des corrections sur votre profil : ${reason}`],
      reject: ['Profil refusé', `E-MPGT a refusé votre profil : ${reason}`],
      suspend: ['Profil suspendu', `Votre profil a été suspendu par E-MPGT : ${reason}`],
      reactivate: ['Profil réactivé', reason ? `Votre profil a été réactivé : ${reason}` : 'Votre profil a été réactivé.'],
    }[decision];
    await this.prisma.$transaction(async (tx) => {
      await tx.freelancerProfile.update({
        where: { id: profileId },
        data: {
          validationStatus: status,
          validationNote: decision === 'approve' ? reason : reason,
          reviewedAt: now,
          reviewedById: actor.userId,
          // Un profil suspendu ou refusé sort du catalogue public.
          ...(status !== 'APPROVED' ? { catalogVisibility: 'PRIVATE', publicationConsentAt: null } : {}),
        },
      });
      await this.audit.record(tx, actor, {
        action: `admin.profile.${decision}`,
        entityType: 'FreelancerProfile',
        entityId: profileId,
        reason,
        metadata: { before: profile.validationStatus, after: status },
      });
      if (profile.userId) {
        await this.notifications.notifyUsers(tx, [profile.userId], {
          type: `profile.${decision}`,
          title: titles[0]!,
          body: titles[1]!,
          link: '/freelance/profil',
          email: true,
        });
      }
    });
    return this.adminGet(actor, profileId);
  }

  async verifyQualification(actor: Actor, profileId: string, qualificationId: string, input: VerifyDocumentInput): Promise<AdminProfileView> {
    const qualification = await this.prisma.qualification.findFirst({ where: { id: qualificationId, profileId } });
    if (!qualification) throw notFound('Qualification');
    if (input.status === 'REJECTED' && !input.note) throw conflict('Un motif est obligatoire pour refuser une qualification.');
    await this.prisma.$transaction(async (tx) => {
      await tx.qualification.update({
        where: { id: qualificationId },
        data: {
          status: input.status,
          verificationNote: input.note,
          verifiedAt: new Date(),
          verifiedById: actor.userId,
          ...(input.expiresAt ? { expiresAt: parseOptionalIsoDate(input.expiresAt) } : {}),
        },
      });
      await this.audit.record(tx, actor, {
        action: `admin.qualification.${input.status.toLowerCase()}`,
        entityType: 'Qualification',
        entityId: qualificationId,
        reason: input.note,
      });
      await this.notifications.notifyProfileOwner(tx, profileId, {
        type: 'qualification.reviewed',
        title: input.status === 'VERIFIED' ? 'Qualification vérifiée' : 'Qualification refusée',
        body: `Votre qualification « ${qualification.name} » a été ${input.status === 'VERIFIED' ? 'vérifiée' : `refusée : ${input.note}`}.`,
        link: '/freelance/profil',
      });
    });
    return this.adminGet(actor, profileId);
  }

  /** Invitation explicite à rattacher un profil historique à un compte (aucun envoi automatique). */
  async inviteClaim(actor: Actor, profileId: string, input: InviteProfileClaimInput): Promise<AdminProfileView> {
    const profile = await this.load(profileId);
    assertAllowed(profileActions(actor, profile, this.counts(profile)), 'inviteClaim');
    const token = randomToken(32);
    await this.prisma.$transaction(async (tx) => {
      await tx.invitation.updateMany({
        where: { freelancerProfileId: profileId, status: 'PENDING' },
        data: { status: 'REVOKED', revokedAt: new Date() },
      });
      const invitation = await tx.invitation.create({
        data: {
          type: 'PROFILE_CLAIM',
          email: input.email,
          tokenHash: sha256Hex(token),
          freelancerProfileId: profileId,
          message: input.message,
          invitedById: actor.userId,
          expiresAt: addDays(new Date(), 7),
        },
      });
      await this.audit.record(tx, actor, {
        action: 'admin.profile.invite_claim',
        entityType: 'Invitation',
        entityId: invitation.id,
        metadata: { profileId },
      });
    });
    await this.mail.sendSafely(mailTemplates.profileClaimInvitation(input.email, profile.headline, token, input.message ?? null));
    return this.adminGet(actor, profileId);
  }

  // ── Vues pour les autres modules ──────────────────────────────────────────

  async candidateView(profileId: string): Promise<CandidateProfileView> {
    return toCandidateView(await this.load(profileId));
  }

  // ── Catalogue public ──────────────────────────────────────────────────────

  async publicList(query: PublicProfilesQuery): Promise<Page<PublicProfileListItem>> {
    const where: Prisma.FreelancerProfileWhereInput = {
      ...PUBLIC_PROFILE_WHERE,
      ...(query.availability ? { availabilityStatus: query.availability } : {}),
      ...(query.country ? { country: query.country.toUpperCase() } : {}),
      ...(query.skill ? { skills: { some: { skill: { slug: { contains: slugify(query.skill) } } } } } : {}),
      ...(query.q
        ? {
            OR: [
              { headline: { contains: query.q, mode: 'insensitive' } },
              { summary: { contains: query.q, mode: 'insensitive' } },
              { skills: { some: { skill: { name: { contains: query.q, mode: 'insensitive' } } } } },
            ],
          }
        : {}),
    };
    const [items, total] = await Promise.all([
      this.prisma.freelancerProfile.findMany({ where, ...pageArgs(query), orderBy: { reviewedAt: 'desc' }, include: profileInclude }),
      this.prisma.freelancerProfile.count({ where }),
    ]);
    return toPage(items.map(toPublicListItem), total, query);
  }

  async publicGet(profileId: string): Promise<PublicProfileView> {
    const profile = await this.prisma.freelancerProfile.findFirst({ where: { id: profileId, ...PUBLIC_PROFILE_WHERE }, include: profileInclude });
    if (!profile) throw notFound('Profil');
    return toPublicView(profile);
  }
}
