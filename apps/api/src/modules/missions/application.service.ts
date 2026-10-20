import { Injectable } from '@nestjs/common';
import type { ApplicationListItem, ApplicationListQuery, ApplicationView, ApplyInput, Page } from '@empgt/contracts';
import type { Prisma } from '../../generated/prisma/client.js';
import { assertAllowed, visibleActions } from '../../common/actions.js';
import { toIso } from '../../common/dates.js';
import { conflict, forbidden, notFound } from '../../common/errors.js';
import { dec, decimalString } from '../../common/money.js';
import { pageArgs, toPage } from '../../common/pagination.js';
import { PrismaService, type Db } from '../../common/prisma.service.js';
import { displayName } from '../../common/text.js';
import { isCompanyMember, ownsProfile, type Actor } from '../auth/actor.js';
import { AuditService } from '../core/audit.service.js';
import { NotificationService } from '../core/notification.service.js';
import { SettingsService } from '../core/settings.service.js';
import { ProfileService } from '../profiles/profile.service.js';
import { applicationActions, applicationPending, type ApplicationContext } from './application.policy.js';
import { missionActions } from './mission.policy.js';

const applicationInclude = {
  mission: { include: { company: true } },
  profile: { include: { user: { select: { firstName: true, lastName: true } } } },
  proposals: { where: { status: { notIn: ['WITHDRAWN', 'SUPERSEDED'] } }, orderBy: { createdAt: 'desc' }, take: 1, select: { id: true, status: true } },
  contracts: { where: { status: { notIn: ['CANCELLED'] } }, orderBy: { createdAt: 'desc' }, take: 1, select: { id: true, status: true } },
} satisfies Prisma.ApplicationInclude;

type ApplicationFull = Prisma.ApplicationGetPayload<{ include: typeof applicationInclude }>;

@Injectable()
export class ApplicationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly notifications: NotificationService,
    private readonly settings: SettingsService,
    private readonly profiles: ProfileService,
  ) {}

  private async load(applicationId: string, db: Db = this.prisma): Promise<ApplicationFull> {
    const application = await db.application.findUnique({ where: { id: applicationId }, include: applicationInclude });
    if (!application) throw notFound('Candidature');
    return application;
  }

  /** Confidentialité : visible du freelance concerné, de l'entreprise de la mission et d'E-MPGT uniquement. */
  private assertCanRead(actor: Actor, app: ApplicationFull): void {
    if (actor.isAdmin || ownsProfile(actor, app.profileId) || isCompanyMember(actor, app.mission.companyId)) return;
    throw notFound('Candidature');
  }

  /** Contexte d'autorisation. Séquentiel : il est aussi évalué dans une transaction (pas de requêtes concurrentes). */
  private async context(app: ApplicationFull, db: Db = this.prisma): Promise<ApplicationContext> {
    const otherSelected = await db.application.count({ where: { missionId: app.missionId, status: 'SELECTED', NOT: { id: app.id } } });
    const sentProposal = await db.commercialProposal.count({ where: { applicationId: app.id, status: { in: ['SENT', 'PARTIES_AGREED', 'APPROVED'] } } });
    const liveContract = await db.contract.count({ where: { applicationId: app.id, status: { in: ['AWAITING_SIGNATURE', 'SIGNED', 'ACTIVE', 'SUSPENDED'] } } });
    return { mission: app.mission, otherSelected: otherSelected > 0, hasSentProposal: sentProposal > 0, hasLiveContract: liveContract > 0 };
  }

  private async toView(actor: Actor, app: ApplicationFull): Promise<ApplicationView> {
    this.assertCanRead(actor, app);
    const ctx = await this.context(app);
    const own = ownsProfile(actor, app.profileId);
    const settings = await this.settings.get();
    const seesCompany = actor.isAdmin || !own || settings.freelancerSeesCompanyName || app.status === 'SELECTED';
    return {
      id: app.id,
      missionId: app.missionId,
      missionReference: app.mission.reference,
      missionTitle: app.mission.title,
      missionStatus: app.mission.status,
      companyId: app.mission.companyId,
      companyName: seesCompany ? app.mission.company.legalName : null,
      profileId: app.profileId,
      message: app.message,
      availabilityNote: app.availabilityNote,
      proposedRate: actor.isAdmin || own ? decimalString(app.proposedRate) : null,
      proposedRateUnit: actor.isAdmin || own ? app.proposedRateUnit : null,
      proposedRateCurrency: actor.isAdmin || own ? app.proposedRateCurrency : null,
      status: app.status,
      statusReason: app.statusReason,
      decidedAt: toIso(app.decidedAt),
      createdAt: toIso(app.createdAt),
      updatedAt: toIso(app.updatedAt),
      // Après retrait, l'entreprise ne consulte plus le profil du candidat.
      candidate: own || (!actor.isAdmin && app.status === 'WITHDRAWN') ? null : await this.profiles.candidateView(app.profileId),
      proposalId: app.proposals[0]?.id ?? null,
      contractId: app.contracts[0]?.id ?? null,
      actions: visibleActions(applicationActions(actor, app, ctx)),
      pending: applicationPending(actor, app, ctx),
    };
  }

  async get(actor: Actor, applicationId: string): Promise<ApplicationView> {
    return this.toView(actor, await this.load(applicationId));
  }

  async list(actor: Actor, query: ApplicationListQuery): Promise<Page<ApplicationListItem>> {
    const scope: Prisma.ApplicationWhereInput = actor.isAdmin
      ? {}
      : actor.isCompany && actor.companyId
        ? { mission: { companyId: actor.companyId } }
        : actor.isFreelancer && actor.profileId
          ? { profileId: actor.profileId }
          : { id: '00000000-0000-0000-0000-000000000000' };
    const where: Prisma.ApplicationWhereInput = {
      AND: [
        scope,
        query.missionId ? { missionId: query.missionId } : {},
        query.status ? { status: query.status } : {},
        query.q
          ? {
              OR: [
                { mission: { title: { contains: query.q, mode: 'insensitive' } } },
                { mission: { reference: { contains: query.q, mode: 'insensitive' } } },
                { profile: { headline: { contains: query.q, mode: 'insensitive' } } },
              ],
            }
          : {},
      ],
    };
    const settings = await this.settings.get();
    const [items, total] = await Promise.all([
      this.prisma.application.findMany({
        where,
        ...pageArgs(query),
        orderBy: { updatedAt: 'desc' },
        include: { mission: { include: { company: true } }, profile: { include: { user: { select: { firstName: true, lastName: true } } } } },
      }),
      this.prisma.application.count({ where }),
    ]);
    return toPage(
      items.map((a) => {
        const own = ownsProfile(actor, a.profileId);
        return {
          id: a.id,
          missionId: a.missionId,
          missionReference: a.mission.reference,
          missionTitle: a.mission.title,
          companyName: !own || settings.freelancerSeesCompanyName || a.status === 'SELECTED' ? a.mission.company.legalName : null,
          profileId: a.profileId,
          candidateName: displayName(a.profile.user?.firstName, a.profile.user?.lastName),
          candidateHeadline: a.profile.headline,
          status: a.status,
          createdAt: toIso(a.createdAt),
          updatedAt: toIso(a.updatedAt),
        };
      }),
      total,
      query,
    );
  }

  // ── Candidater et se retirer (freelance) ──────────────────────────────────

  async apply(actor: Actor, missionId: string, input: ApplyInput): Promise<ApplicationView> {
    if (!actor.isFreelancer || !actor.profileId) throw forbidden('Seuls les freelances peuvent candidater');
    const [mission, profile, settings, existing] = await Promise.all([
      this.prisma.mission.findUnique({ where: { id: missionId }, include: { company: true, _count: { select: { skills: true } } } }),
      this.prisma.freelancerProfile.findUniqueOrThrow({ where: { id: actor.profileId } }),
      this.settings.get(),
      this.prisma.application.count({ where: { missionId, profileId: actor.profileId } }),
    ]);
    if (!mission) throw notFound('Mission');
    const actions = missionActions(actor, mission, {
      company: mission.company,
      settings,
      skillsCount: mission._count.skills,
      profile,
      hasApplied: existing > 0,
    });
    const visible = mission.publicationStatus === 'PUBLISHED' && mission.status === 'OPEN' && mission.company.status === 'ACTIVE';
    if (!visible && existing === 0) throw notFound('Mission');
    assertAllowed(actions, 'apply');
    if (input.proposedRate && (!input.proposedRateCurrency || !input.proposedRateUnit)) {
      throw conflict('Précisez la devise et l’unité du tarif indicatif.');
    }
    if (input.proposedRate && dec(input.proposedRate).lte(0)) throw conflict('Le tarif indicatif doit être positif.');

    const applicationId = await this.prisma.$transaction(async (tx) => {
      const application = await tx.application.create({
        data: {
          missionId,
          profileId: actor.profileId!,
          submittedById: actor.userId,
          message: input.message,
          availabilityNote: input.availabilityNote,
          proposedRate: input.proposedRate,
          proposedRateUnit: input.proposedRate ? input.proposedRateUnit : null,
          proposedRateCurrency: input.proposedRate ? input.proposedRateCurrency : null,
        },
      });
      await this.audit.record(tx, actor, { action: 'application.submit', entityType: 'Application', entityId: application.id, metadata: { missionId } });
      await this.notifications.notifyCompany(tx, mission.companyId, {
        type: 'application.received',
        title: 'Nouvelle candidature',
        body: `Une nouvelle candidature a été reçue pour la mission ${mission.reference} « ${mission.title} ».`,
        link: `/entreprise/candidatures/${application.id}`,
        email: true,
      });
      await this.notifications.notifyAdmins(tx, {
        type: 'application.received',
        title: 'Nouvelle candidature',
        body: `Candidature reçue pour ${mission.reference} (${mission.company.legalName}).`,
        link: `/admin/candidatures/${application.id}`,
      });
      return application.id;
    });
    return this.get(actor, applicationId);
  }

  async withdraw(actor: Actor, applicationId: string, reason: string | null): Promise<ApplicationView> {
    const app = await this.load(applicationId);
    this.assertCanRead(actor, app);
    assertAllowed(applicationActions(actor, app, await this.context(app)), 'withdraw');
    await this.prisma.serializable(async (tx) => {
      await tx.application.update({ where: { id: applicationId }, data: { status: 'WITHDRAWN', statusReason: reason, decidedAt: new Date() } });
      if (app.status === 'SELECTED') {
        await this.releaseSelection(tx, app);
      }
      await this.audit.record(tx, actor, { action: 'application.withdraw', entityType: 'Application', entityId: applicationId, reason });
      await this.notifications.notifyCompany(tx, app.mission.companyId, {
        type: 'application.withdrawn',
        title: 'Candidature retirée',
        body: `Un candidat a retiré sa candidature à la mission ${app.mission.reference}.`,
        link: `/entreprise/missions/${app.missionId}`,
        email: app.status === 'SELECTED',
      });
    });
    return this.get(actor, applicationId);
  }

  /** Libère la mission lorsque le candidat retenu se retire ou est désélectionné. */
  private async releaseSelection(tx: Db, app: ApplicationFull): Promise<void> {
    await tx.mission.updateMany({ where: { id: app.missionId, status: 'SELECTION' }, data: { status: 'OPEN' } });
    const proposals = await tx.commercialProposal.updateMany({
      where: { applicationId: app.id, status: { in: ['DRAFT', 'SENT', 'PARTIES_AGREED'] } },
      data: { status: 'WITHDRAWN', statusReason: 'Sélection annulée' },
    });
    if (proposals.count > 0) {
      await this.notifications.notifyAdmins(tx, {
        type: 'proposal.withdrawn',
        title: 'Proposition retirée',
        body: `La sélection pour la mission ${app.mission.reference} a été annulée : la proposition en cours a été retirée.`,
        link: `/admin/missions/${app.missionId}`,
      });
    }
  }

  // ── Décisions (entreprise ou E-MPGT) ──────────────────────────────────────

  async decide(
    actor: Actor,
    applicationId: string,
    decision: 'shortlist' | 'select' | 'reject' | 'deselect',
    reason: string | null,
  ): Promise<ApplicationView> {
    const app = await this.load(applicationId);
    this.assertCanRead(actor, app);
    if (actor.isAdmin && !reason) {
      throw conflict('Motif obligatoire : E-MPGT intervient à la place de l’entreprise.');
    }
    if ((decision === 'reject' || decision === 'deselect') && !reason) throw conflict('Un motif est obligatoire.');

    // Isolation sérialisable + index unique partiel : impossible de retenir deux candidats pour un même poste.
    await this.prisma.serializable(async (tx) => {
      const fresh = await this.load(applicationId, tx);
      assertAllowed(applicationActions(actor, fresh, await this.context(fresh, tx)), decision);
      const now = new Date();
      if (decision === 'select') {
        const missionUpdate = await tx.mission.updateMany({ where: { id: fresh.missionId, status: 'OPEN' }, data: { status: 'SELECTION' } });
        if (missionUpdate.count !== 1) throw conflict('Un candidat est déjà retenu pour cette mission.');
      }
      const status = { shortlist: 'SHORTLISTED', select: 'SELECTED', reject: 'REJECTED', deselect: 'SHORTLISTED' }[decision] as
        | 'SHORTLISTED'
        | 'SELECTED'
        | 'REJECTED';
      await tx.application.update({
        where: { id: applicationId },
        data: { status, statusReason: reason, decidedById: actor.userId, decidedAt: now },
      });
      if (decision === 'deselect') await this.releaseSelection(tx, fresh);
      await this.audit.record(tx, actor, {
        action: actor.isAdmin ? `admin.application.${decision}` : `application.${decision}`,
        entityType: 'Application',
        entityId: applicationId,
        reason,
        metadata: { missionId: fresh.missionId, before: fresh.status, onBehalfOfCompany: actor.isAdmin },
      });
      const messages = {
        shortlist: ['Candidature présélectionnée', `Votre candidature à la mission « ${fresh.mission.title} » a été présélectionnée.`],
        select: [
          'Candidature retenue',
          `Votre candidature à la mission « ${fresh.mission.title} » a été retenue. E-MPGT vous adressera une proposition commerciale ; la mission démarrera après signature du contrat.`,
        ],
        reject: ['Candidature non retenue', `Votre candidature à la mission « ${fresh.mission.title} » n'a pas été retenue. ${reason ?? ''}`.trim()],
        deselect: ['Sélection annulée', `La sélection de votre candidature à la mission « ${fresh.mission.title} » a été annulée. ${reason ?? ''}`.trim()],
      }[decision];
      await this.notifications.notifyProfileOwner(tx, fresh.profileId, {
        type: `application.${decision}`,
        title: messages[0]!,
        body: messages[1]!,
        link: `/freelance/candidatures/${applicationId}`,
        email: true,
      });
      if (decision === 'select') {
        await this.notifications.notifyAdmins(tx, {
          type: 'application.selected',
          title: 'Candidat retenu : proposition à préparer',
          body: `Un candidat a été retenu pour la mission ${fresh.mission.reference} (${fresh.mission.company.legalName}). Préparez la proposition commerciale.`,
          link: `/admin/propositions/nouvelle?applicationId=${applicationId}`,
          email: true,
        });
      }
      if (actor.isAdmin) {
        await this.notifications.notifyCompany(tx, fresh.mission.companyId, {
          type: `application.${decision}`,
          title: 'Décision d’E-MPGT sur une candidature',
          body: `E-MPGT a modifié une candidature à la mission ${fresh.mission.reference} (${decision}). Motif : ${reason}`,
          link: `/entreprise/candidatures/${applicationId}`,
        });
      }
    });
    return this.get(actor, applicationId);
  }
}
