import { Injectable } from '@nestjs/common';
import type {
  AdminUpdateMissionInput,
  ApplicationStatus,
  CreateMissionInput,
  MissionListItem,
  MissionListQuery,
  MissionView,
  Page,
  PlatformSettings,
  UpdateMissionInput,
} from '@empgt/contracts';
import type { Prisma } from '../../generated/prisma/client.js';
import { assertAllowed, visibleActions } from '../../common/actions.js';
import { parseIsoDate, parseOptionalIsoDate, toIso, toIsoDate } from '../../common/dates.js';
import { conflict, forbidden, notFound } from '../../common/errors.js';
import { dec, decimalString } from '../../common/money.js';
import { pageArgs, toPage } from '../../common/pagination.js';
import { PrismaService, type Db } from '../../common/prisma.service.js';
import { nextReference } from '../../common/references.js';
import { slugify } from '../../common/text.js';
import { isCompanyMember, type Actor } from '../auth/actor.js';
import { AuditService } from '../core/audit.service.js';
import { NotificationService } from '../core/notification.service.js';
import { SettingsService } from '../core/settings.service.js';
import { SkillsService } from '../profiles/skills.service.js';
import { missionActions, missionPending, VISIBLE_TO_FREELANCERS, type MissionContext } from './mission.policy.js';

const missionInclude = {
  company: true,
  skills: { include: { skill: true }, orderBy: { skill: { name: 'asc' } } },
  _count: { select: { applications: true } },
} satisfies Prisma.MissionInclude;

type MissionFull = Prisma.MissionGetPayload<{ include: typeof missionInclude }>;

const LIVE_CONTRACT = ['AWAITING_SIGNATURE', 'SIGNED', 'ACTIVE', 'SUSPENDED'] as const;

@Injectable()
export class MissionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly notifications: NotificationService,
    private readonly settings: SettingsService,
    private readonly skills: SkillsService,
  ) {}

  // ── Lecture et contexte d'autorisation ────────────────────────────────────

  private async load(missionId: string, db: Db = this.prisma): Promise<MissionFull> {
    const mission = await db.mission.findUnique({ where: { id: missionId }, include: missionInclude });
    if (!mission) throw notFound('Mission');
    return mission;
  }

  private async context(
    actor: Actor,
    mission: MissionFull,
    settings?: PlatformSettings,
  ): Promise<MissionContext & { myApplication: { id: string; status: ApplicationStatus; createdAt: Date } | null }> {
    const [resolvedSettings, profile, myApplication, liveContract] = await Promise.all([
      settings ?? this.settings.get(),
      actor.isFreelancer && actor.profileId ? this.prisma.freelancerProfile.findUnique({ where: { id: actor.profileId } }) : null,
      actor.isFreelancer && actor.profileId
        ? this.prisma.application.findUnique({
            where: { missionId_profileId: { missionId: mission.id, profileId: actor.profileId } },
            select: { id: true, status: true, createdAt: true },
          })
        : null,
      this.prisma.contract.count({ where: { missionId: mission.id, status: { in: [...LIVE_CONTRACT] } } }),
    ]);
    return {
      company: mission.company,
      settings: resolvedSettings,
      skillsCount: mission.skills.length,
      profile,
      hasApplied: Boolean(myApplication),
      hasLiveContract: liveContract > 0,
      myApplication,
    };
  }

  /** Lecture autorisée : membre de l'entreprise, E-MPGT, ou freelance (mission visible ou déjà candidaté). */
  private assertCanRead(actor: Actor, mission: MissionFull, hasApplied: boolean): void {
    if (actor.isAdmin || isCompanyMember(actor, mission.companyId)) return;
    if (actor.isFreelancer) {
      const visible = mission.publicationStatus === 'PUBLISHED' && mission.status === 'OPEN' && mission.company.status === 'ACTIVE';
      if (visible || hasApplied) return;
    }
    throw notFound('Mission');
  }

  private companyNameFor(actor: Actor, mission: MissionFull, settings: PlatformSettings, applicationStatus?: string | null): string | null {
    if (actor.isAdmin || isCompanyMember(actor, mission.companyId) || settings.freelancerSeesCompanyName) return mission.company.legalName;
    // Le freelance retenu connaît l'entreprise (nécessaire à la contractualisation).
    return applicationStatus === 'SELECTED' ? mission.company.legalName : null;
  }

  private async toView(actor: Actor, mission: MissionFull): Promise<MissionView> {
    const ctx = await this.context(actor, mission);
    this.assertCanRead(actor, mission, ctx.hasApplied ?? false);
    const insider = actor.isAdmin || isCompanyMember(actor, mission.companyId);
    const showBudget = insider || mission.budgetVisibleToFreelancers;
    return {
      id: mission.id,
      reference: mission.reference,
      companyId: mission.companyId,
      companyName: this.companyNameFor(actor, mission, ctx.settings, ctx.myApplication?.status),
      title: mission.title,
      description: mission.description,
      profileSought: mission.profileSought,
      sector: mission.sector,
      city: mission.city,
      region: mission.region,
      country: mission.country,
      workMode: mission.workMode,
      startDate: toIsoDate(mission.startDate),
      endDate: toIsoDate(mission.endDate),
      durationLabel: mission.durationLabel,
      budgetMin: showBudget ? decimalString(mission.budgetMin) : null,
      budgetMax: showBudget ? decimalString(mission.budgetMax) : null,
      budgetUnit: showBudget ? mission.budgetUnit : null,
      budgetCurrency: showBudget ? mission.budgetCurrency : null,
      budgetVisibleToFreelancers: insider ? mission.budgetVisibleToFreelancers : null,
      applicationDeadline: toIsoDate(mission.applicationDeadline),
      publicationStatus: mission.publicationStatus,
      status: mission.status,
      reviewNote: insider ? mission.reviewNote : null,
      statusReason: insider ? mission.statusReason : null,
      submittedAt: insider ? toIso(mission.submittedAt) : null,
      publishedAt: toIso(mission.publishedAt),
      createdAt: toIso(mission.createdAt),
      updatedAt: toIso(mission.updatedAt),
      skills: mission.skills.map((s) => ({ skillId: s.skillId, name: s.skill.name, category: s.skill.category, required: s.required })),
      applicationsCount: insider ? mission._count.applications : null,
      myApplication: ctx.myApplication
        ? { id: ctx.myApplication.id, status: ctx.myApplication.status, createdAt: toIso(ctx.myApplication.createdAt) }
        : null,
      isDemo: mission.isDemo,
      actions: visibleActions(missionActions(actor, mission, ctx)),
      pending: isCompanyMember(actor, mission.companyId) ? missionPending(mission, ctx, mission._count.applications) : [],
    };
  }

  async get(actor: Actor, missionId: string): Promise<MissionView> {
    return this.toView(actor, await this.load(missionId));
  }

  async list(actor: Actor, query: MissionListQuery): Promise<Page<MissionListItem>> {
    const settings = await this.settings.get();
    const filters: Prisma.MissionWhereInput[] = [];
    if (actor.isAdmin) {
      if (query.companyId) filters.push({ companyId: query.companyId });
      if (query.publicationStatus) filters.push({ publicationStatus: query.publicationStatus });
      if (query.status) filters.push({ status: query.status });
    } else if (actor.isCompany && actor.companyId) {
      filters.push({ companyId: actor.companyId });
      if (query.publicationStatus) filters.push({ publicationStatus: query.publicationStatus });
      if (query.status) filters.push({ status: query.status });
    } else if (actor.isFreelancer) {
      filters.push(VISIBLE_TO_FREELANCERS);
    } else {
      throw forbidden();
    }
    if (query.q) {
      filters.push({
        OR: [
          { title: { contains: query.q, mode: 'insensitive' } },
          { description: { contains: query.q, mode: 'insensitive' } },
          { reference: { contains: query.q, mode: 'insensitive' } },
          { skills: { some: { skill: { name: { contains: query.q, mode: 'insensitive' } } } } },
        ],
      });
    }
    if (query.city) filters.push({ city: { contains: query.city, mode: 'insensitive' } });
    if (query.country) filters.push({ country: query.country.toUpperCase() });
    if (query.workMode) filters.push({ workMode: query.workMode });
    if (query.skill) filters.push({ skills: { some: { skill: { slug: { contains: slugify(query.skill) } } } } });
    if (query.startFrom) filters.push({ OR: [{ startDate: null }, { startDate: { gte: parseIsoDate(query.startFrom) } }] });
    const where: Prisma.MissionWhereInput = { AND: filters };

    const [items, total] = await Promise.all([
      this.prisma.mission.findMany({
        where,
        ...pageArgs(query),
        orderBy: actor.isFreelancer ? [{ publishedAt: 'desc' }] : [{ updatedAt: 'desc' }],
        include: {
          ...missionInclude,
          applications: actor.isFreelancer && actor.profileId ? { where: { profileId: actor.profileId }, select: { status: true } } : false,
        },
      }),
      this.prisma.mission.count({ where }),
    ]);
    return toPage(
      items.map((m) => {
        const insider = actor.isAdmin || isCompanyMember(actor, m.companyId);
        const myStatus = (m as unknown as { applications?: Array<{ status: MissionListItem['myApplicationStatus'] }> }).applications?.[0]?.status ?? null;
        return {
          id: m.id,
          reference: m.reference,
          title: m.title,
          companyId: m.companyId,
          companyName: this.companyNameFor(actor, m, settings, myStatus),
          city: m.city,
          country: m.country,
          workMode: m.workMode,
          startDate: toIsoDate(m.startDate),
          endDate: toIsoDate(m.endDate),
          durationLabel: m.durationLabel,
          publicationStatus: m.publicationStatus,
          status: m.status,
          skills: m.skills.map((s) => s.skill.name),
          applicationsCount: insider ? m._count.applications : null,
          publishedAt: toIso(m.publishedAt),
          createdAt: toIso(m.createdAt),
          updatedAt: toIso(m.updatedAt),
          myApplicationStatus: myStatus,
        };
      }),
      total,
      query,
    );
  }

  // ── Écriture (entreprise) ─────────────────────────────────────────────────

  private missionData(input: UpdateMissionInput): Prisma.MissionUncheckedUpdateInput {
    const data: Record<string, unknown> = {};
    const copy = [
      'title',
      'description',
      'profileSought',
      'sector',
      'city',
      'region',
      'country',
      'workMode',
      'durationLabel',
      'budgetMin',
      'budgetMax',
      'budgetUnit',
      'budgetCurrency',
      'budgetVisibleToFreelancers',
    ] as const;
    for (const key of copy) if (input[key] !== undefined) data[key] = input[key];
    if (input.startDate !== undefined) data.startDate = parseOptionalIsoDate(input.startDate);
    if (input.endDate !== undefined) data.endDate = parseOptionalIsoDate(input.endDate);
    if (input.applicationDeadline !== undefined) data.applicationDeadline = parseOptionalIsoDate(input.applicationDeadline);
    return data as Prisma.MissionUncheckedUpdateInput;
  }

  private checkConsistency(merged: { startDate?: Date | null; endDate?: Date | null; budgetMin?: unknown; budgetMax?: unknown; budgetCurrency?: string | null; budgetUnit?: string | null }): void {
    if (merged.startDate && merged.endDate && merged.endDate < merged.startDate) throw conflict('La date de fin précède la date de début.');
    if (merged.budgetMin && merged.budgetMax && dec(merged.budgetMax as string).lt(dec(merged.budgetMin as string))) {
      throw conflict('Le budget maximal doit être supérieur ou égal au budget minimal.');
    }
    if ((merged.budgetMin || merged.budgetMax) && (!merged.budgetCurrency || !merged.budgetUnit)) {
      throw conflict('Précisez la devise et l’unité du budget indicatif.');
    }
  }

  private async replaceSkills(tx: Db, missionId: string, skills: CreateMissionInput['skills']): Promise<void> {
    const ids = await this.skills.resolve(tx, skills);
    await tx.missionSkill.deleteMany({ where: { missionId } });
    const seen = new Set<string>();
    for (const item of skills) {
      const skillId = ids.get(slugify(item.name));
      if (!skillId || seen.has(skillId)) continue;
      seen.add(skillId);
      await tx.missionSkill.create({ data: { missionId, skillId, required: item.required } });
    }
  }

  async create(actor: Actor, input: CreateMissionInput): Promise<MissionView> {
    if (!actor.isCompany || !actor.companyId) throw forbidden('Espace réservé aux entreprises');
    const company = await this.prisma.company.findUniqueOrThrow({ where: { id: actor.companyId } });
    if (company.status !== 'ACTIVE') throw conflict('Entreprise suspendue : contactez E-MPGT.');
    const data = this.missionData(input);
    this.checkConsistency(data as never);
    const missionId = await this.prisma.$transaction(async (tx) => {
      const reference = await nextReference(tx, 'MIS');
      const mission = await tx.mission.create({
        data: {
          ...(data as Prisma.MissionUncheckedCreateInput),
          title: input.title,
          description: input.description,
          reference,
          companyId: company.id,
          createdById: actor.userId,
        },
      });
      await this.replaceSkills(tx, mission.id, input.skills);
      await this.audit.record(tx, actor, { action: 'mission.create', entityType: 'Mission', entityId: mission.id, metadata: { reference } });
      return mission.id;
    });
    return this.get(actor, missionId);
  }

  async update(actor: Actor, missionId: string, input: UpdateMissionInput): Promise<MissionView> {
    const mission = await this.load(missionId);
    const ctx = await this.context(actor, mission);
    assertAllowed(missionActions(actor, mission, ctx), 'update');
    const data = this.missionData(input);
    this.checkConsistency({ ...mission, ...(data as object) } as never);
    await this.prisma.$transaction(async (tx) => {
      await tx.mission.update({ where: { id: missionId }, data });
      if (input.skills) await this.replaceSkills(tx, missionId, input.skills);
      await this.audit.record(tx, actor, { action: 'mission.update', entityType: 'Mission', entityId: missionId, metadata: { fields: Object.keys(input) } });
    });
    return this.get(actor, missionId);
  }

  async adminUpdate(actor: Actor, missionId: string, input: AdminUpdateMissionInput): Promise<MissionView> {
    const { reason, ...rest } = input;
    const mission = await this.load(missionId);
    const ctx = await this.context(actor, mission);
    assertAllowed(missionActions(actor, mission, ctx), 'adminUpdate');
    const data = this.missionData(rest);
    this.checkConsistency({ ...mission, ...(data as object) } as never);
    const changes = Object.fromEntries(
      Object.entries(data).map(([k, v]) => [k, { before: (mission as Record<string, unknown>)[k], after: v }]),
    );
    await this.prisma.$transaction(async (tx) => {
      await tx.mission.update({ where: { id: missionId }, data });
      if (rest.skills) await this.replaceSkills(tx, missionId, rest.skills);
      await this.audit.record(tx, actor, { action: 'admin.mission.update', entityType: 'Mission', entityId: missionId, reason, metadata: { changes, skills: Boolean(rest.skills) } });
      await this.notifications.notifyCompany(tx, mission.companyId, {
        type: 'mission.admin_updated',
        title: 'Mission modifiée par E-MPGT',
        body: `E-MPGT a modifié la mission ${mission.reference}. Motif : ${reason}`,
        link: `/entreprise/missions/${missionId}`,
      });
    });
    return this.get(actor, missionId);
  }

  async submit(actor: Actor, missionId: string): Promise<MissionView> {
    const mission = await this.load(missionId);
    const ctx = await this.context(actor, mission);
    assertAllowed(missionActions(actor, mission, ctx), 'submit');
    // Publication directe uniquement si la politique ne l'exige pas ET que l'entreprise remplit les conditions.
    const verified = ctx.company.verificationStatus === 'VERIFIED' || !ctx.settings.companyVerificationRequiredForPublication;
    const publishNow = !ctx.settings.missionApprovalRequired && verified;
    await this.prisma.$transaction(async (tx) => {
      const updated = await tx.mission.updateMany({
        where: { id: missionId, publicationStatus: { in: ['DRAFT', 'CHANGES_REQUESTED', 'UNPUBLISHED'] } },
        data: publishNow
          ? { publicationStatus: 'PUBLISHED', submittedAt: new Date(), publishedAt: new Date(), reviewNote: null }
          : { publicationStatus: 'PENDING_REVIEW', submittedAt: new Date() },
      });
      if (updated.count !== 1) throw conflict('La mission a déjà été soumise.');
      await this.audit.record(tx, actor, {
        action: publishNow ? 'mission.submit_auto_published' : 'mission.submit',
        entityType: 'Mission',
        entityId: missionId,
      });
      if (!publishNow) {
        await this.notifications.notifyAdmins(tx, {
          type: 'mission.submitted',
          title: 'Mission à valider',
          body: `La mission ${mission.reference} « ${mission.title} » (${mission.company.legalName}) attend votre validation.`,
          link: `/admin/missions/${missionId}`,
          email: true,
        });
      }
    });
    return this.get(actor, missionId);
  }

  async withdraw(actor: Actor, missionId: string): Promise<MissionView> {
    const mission = await this.load(missionId);
    const ctx = await this.context(actor, mission);
    assertAllowed(missionActions(actor, mission, ctx), 'withdraw');
    await this.prisma.$transaction(async (tx) => {
      await tx.mission.update({ where: { id: missionId }, data: { publicationStatus: 'DRAFT' } });
      await this.audit.record(tx, actor, { action: 'mission.withdraw', entityType: 'Mission', entityId: missionId });
    });
    return this.get(actor, missionId);
  }

  async cancel(actor: Actor, missionId: string, reason: string): Promise<MissionView> {
    const mission = await this.load(missionId);
    const ctx = await this.context(actor, mission);
    assertAllowed(missionActions(actor, mission, ctx), 'cancel');
    await this.prisma.$transaction(async (tx) => {
      await tx.mission.update({ where: { id: missionId }, data: { status: 'CANCELLED', statusReason: reason } });
      const open = await tx.application.findMany({
        where: { missionId, status: { in: ['SUBMITTED', 'SHORTLISTED', 'SELECTED'] } },
        select: { id: true, profileId: true },
      });
      await tx.application.updateMany({
        where: { id: { in: open.map((a) => a.id) } },
        data: { status: 'CLOSED', statusReason: 'Mission annulée', decidedAt: new Date() },
      });
      await tx.commercialProposal.updateMany({
        where: { missionId, status: { in: ['DRAFT', 'SENT', 'PARTIES_AGREED'] } },
        data: { status: 'WITHDRAWN', statusReason: 'Mission annulée' },
      });
      await this.audit.record(tx, actor, {
        action: actor.isAdmin ? 'admin.mission.cancel' : 'mission.cancel',
        entityType: 'Mission',
        entityId: missionId,
        reason,
        metadata: { closedApplications: open.length },
      });
      for (const application of open) {
        await this.notifications.notifyProfileOwner(tx, application.profileId, {
          type: 'mission.cancelled',
          title: 'Mission annulée',
          body: `La mission « ${mission.title} » à laquelle vous avez candidaté a été annulée.`,
          link: '/freelance/candidatures',
          email: true,
        });
      }
      if (actor.isAdmin) {
        await this.notifications.notifyCompany(tx, mission.companyId, {
          type: 'mission.cancelled',
          title: 'Mission annulée par E-MPGT',
          body: `La mission ${mission.reference} a été annulée. Motif : ${reason}`,
          link: `/entreprise/missions/${missionId}`,
          email: true,
        });
      }
    });
    return this.get(actor, missionId);
  }

  // ── Décisions E-MPGT ──────────────────────────────────────────────────────

  async adminDecide(
    actor: Actor,
    missionId: string,
    decision: 'approve' | 'requestChanges' | 'reject' | 'unpublish' | 'republish',
    reason: string | null,
  ): Promise<MissionView> {
    const mission = await this.load(missionId);
    const ctx = await this.context(actor, mission);
    assertAllowed(missionActions(actor, mission, ctx), decision);
    const now = new Date();
    const data: Prisma.MissionUpdateInput = {
      approve: { publicationStatus: 'PUBLISHED' as const, publishedAt: now, reviewedAt: now, reviewedById: actor.userId, reviewNote: reason },
      requestChanges: { publicationStatus: 'CHANGES_REQUESTED' as const, reviewedAt: now, reviewedById: actor.userId, reviewNote: reason },
      reject: { publicationStatus: 'REJECTED' as const, reviewedAt: now, reviewedById: actor.userId, reviewNote: reason },
      unpublish: { publicationStatus: 'UNPUBLISHED' as const, reviewNote: reason },
      republish: { publicationStatus: 'PUBLISHED' as const, publishedAt: now, reviewNote: reason },
    }[decision];
    const message = {
      approve: ['Mission publiée', `Votre mission ${mission.reference} « ${mission.title} » est publiée et visible des freelances validés.`],
      requestChanges: ['Corrections demandées', `E-MPGT demande des corrections sur la mission ${mission.reference} : ${reason}`],
      reject: ['Mission refusée', `E-MPGT a refusé la mission ${mission.reference} : ${reason}`],
      unpublish: ['Mission dépubliée', `E-MPGT a dépublié la mission ${mission.reference} : ${reason}`],
      republish: ['Mission republiée', `La mission ${mission.reference} est de nouveau publiée.`],
    }[decision];
    await this.prisma.$transaction(async (tx) => {
      await tx.mission.update({ where: { id: missionId }, data });
      await this.audit.record(tx, actor, {
        action: `admin.mission.${decision}`,
        entityType: 'Mission',
        entityId: missionId,
        reason,
        metadata: { before: mission.publicationStatus },
      });
      await this.notifications.notifyCompany(tx, mission.companyId, {
        type: `mission.${decision}`,
        title: message[0]!,
        body: message[1]!,
        link: `/entreprise/missions/${missionId}`,
        email: true,
      });
    });
    return this.get(actor, missionId);
  }
}
