import { Injectable } from '@nestjs/common';
import type {
  ActionState,
  CreateProposalInput,
  PendingItem,
  Page,
  ProposalListItem,
  ProposalListQuery,
  ProposalTermsInput,
  ProposalView,
} from '@empgt/contracts';
import type { CommercialProposal, Prisma } from '../../generated/prisma/client.js';
import { assertAllowed, check, deny, NOT_FOR_ROLE, visibleActions } from '../../common/actions.js';
import { canonicalJson, sha256Hex } from '../../common/crypto.js';
import { parseOptionalIsoDate, toIso, toIsoDate } from '../../common/dates.js';
import { conflict, forbidden, notFound } from '../../common/errors.js';
import { decimalString } from '../../common/money.js';
import { pageArgs, toPage } from '../../common/pagination.js';
import { PrismaService, type Db } from '../../common/prisma.service.js';
import { nextReference } from '../../common/references.js';
import { displayName, fullName } from '../../common/text.js';
import { isCompanyMember, ownsProfile, type Actor } from '../auth/actor.js';
import { AuditService } from '../core/audit.service.js';
import { NotificationService } from '../core/notification.service.js';
import { SettingsService } from '../core/settings.service.js';
import { computeFromQuantity, PricingError, toBreakdown, type Audience } from '../finance/calc.js';
import { pricingOf, proposalMissingTerms, visibleTerms } from './terms.js';

const proposalInclude = {
  mission: { include: { company: true } },
  application: true,
  company: true,
  profile: { include: { user: { select: { id: true, firstName: true, lastName: true } } } },
  contract: { select: { id: true } },
} satisfies Prisma.CommercialProposalInclude;

type ProposalFull = Prisma.CommercialProposalGetPayload<{ include: typeof proposalInclude }>;

const LIVE = ['DRAFT', 'SENT', 'PARTIES_AGREED'] as const;

export function audienceOf(actor: Actor, companyId: string, profileId: string): Audience | null {
  if (actor.isAdmin) return 'admin';
  if (isCompanyMember(actor, companyId)) return 'company';
  if (ownsProfile(actor, profileId)) return 'freelancer';
  return null;
}

@Injectable()
export class ProposalService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly notifications: NotificationService,
    private readonly settings: SettingsService,
  ) {}

  private async load(id: string, db: Db = this.prisma): Promise<ProposalFull> {
    const proposal = await db.commercialProposal.findUnique({ where: { id }, include: proposalInclude });
    if (!proposal) throw notFound('Proposition');
    return proposal;
  }

  /** Les brouillons sont internes à E-MPGT ; les parties ne voient que les propositions envoyées. */
  private audience(actor: Actor, p: ProposalFull): Audience {
    const audience = audienceOf(actor, p.companyId, p.profileId);
    if (!audience || (audience !== 'admin' && p.status === 'DRAFT')) throw notFound('Proposition');
    return audience;
  }

  actions(actor: Actor, p: ProposalFull): ActionState[] {
    const missing = proposalMissingTerms(p);
    if (actor.isAdmin) {
      return [
        check('update', [[p.status === 'DRAFT', 'Seul un brouillon est modifiable : créez une nouvelle version']]),
        check('send', [
          [p.status === 'DRAFT', 'Proposition déjà envoyée'],
          [missing.length === 0, `Conditions à compléter : ${missing.join(', ')}`],
        ]),
        check('revise', [[['SENT', 'PARTIES_AGREED', 'DECLINED'].includes(p.status), 'Aucune version envoyée à réviser']]),
        check('withdraw', [[(LIVE as readonly string[]).includes(p.status), 'Proposition déjà clôturée']]),
        check('approve', [
          [p.status === 'PARTIES_AGREED', 'La validation E-MPGT intervient après l’accord des deux parties'],
          [missing.length === 0, `Conditions à compléter : ${missing.join(', ')}`],
          [p.application.status === 'SELECTED', 'La candidature n’est plus retenue'],
        ]),
      ];
    }
    const side = isCompanyMember(actor, p.companyId) ? 'company' : ownsProfile(actor, p.profileId) ? 'freelancer' : null;
    if (!side) return [deny('accept', NOT_FOR_ROLE)];
    const decision = side === 'company' ? p.companyDecision : p.freelancerDecision;
    const conditions: Array<[boolean, string]> = [
      [p.status === 'SENT', p.status === 'PARTIES_AGREED' ? 'Les deux parties ont accepté : validation E-MPGT en attente' : 'Proposition non ouverte à décision'],
      [decision === 'PENDING', 'Vous avez déjà répondu à cette proposition'],
    ];
    return [check('accept', conditions), check('decline', conditions)];
  }

  private pending(actor: Actor, p: ProposalFull): PendingItem[] {
    if (actor.isAdmin) {
      if (p.status === 'DRAFT') return [{ code: 'proposal.draft', title: 'Brouillon', description: 'Complétez les conditions puis envoyez la proposition aux parties.', severity: 'action' }];
      if (p.status === 'PARTIES_AGREED') return [{ code: 'proposal.to_approve', title: 'Validation E-MPGT attendue', description: 'Les deux parties ont accepté : validez pour générer le contrat.', severity: 'action' }];
      return [];
    }
    const side = isCompanyMember(actor, p.companyId) ? p.companyDecision : p.freelancerDecision;
    if (p.status === 'SENT' && side === 'PENDING') {
      return [{ code: 'proposal.to_answer', title: 'Proposition à examiner', description: 'Acceptez ou déclinez la proposition commerciale.', severity: 'action' }];
    }
    if (p.status === 'SENT' || p.status === 'PARTIES_AGREED') {
      return [{ code: 'proposal.waiting', title: 'En attente', description: p.status === 'SENT' ? "En attente de la réponse de l'autre partie." : 'En attente de la validation par E-MPGT.', severity: 'info' }];
    }
    return [];
  }

  toView(actor: Actor, p: ProposalFull): ProposalView {
    const audience = this.audience(actor, p);
    const terms = visibleTerms(p, audience);
    let preview: ProposalView['preview'] = null;
    if (p.estimatedQuantity) {
      try {
        preview = toBreakdown(computeFromQuantity(p.estimatedQuantity, pricingOf(p)), audience, p);
      } catch (error) {
        if (!(error instanceof PricingError)) throw error;
      }
    }
    return {
      id: p.id,
      reference: p.reference,
      version: p.version,
      previousId: p.previousId,
      missionId: p.missionId,
      missionReference: p.mission.reference,
      missionTitle: p.mission.title,
      applicationId: p.applicationId,
      companyId: p.companyId,
      companyName: p.company.legalName,
      profileId: p.profileId,
      candidateName: audience === 'company' ? displayName(p.profile.user?.firstName, p.profile.user?.lastName) : fullName(p.profile.user?.firstName, p.profile.user?.lastName),
      status: p.status,
      startDate: toIsoDate(p.startDate),
      endDate: toIsoDate(p.endDate),
      currency: p.currency,
      billingUnit: p.billingUnit,
      hoursPerDay: decimalString(p.hoursPerDay),
      ...terms,
      estimatedQuantity: decimalString(p.estimatedQuantity),
      commissionVisibleToCompany: audience === 'admin' ? p.commissionVisibleToCompany : null,
      commissionVisibleToFreelancer: audience === 'admin' ? p.commissionVisibleToFreelancer : null,
      expensesPolicy: p.expensesPolicy,
      taxNote: p.taxNote,
      timesheetValidationRule: p.timesheetValidationRule,
      clientPaymentTermsDays: audience === 'freelancer' ? null : p.clientPaymentTermsDays,
      freelancerPaymentTermsDays: audience === 'company' ? null : p.freelancerPaymentTermsDays,
      paymentTermsNote: p.paymentTermsNote,
      freelancerInvoiceAddressee: p.freelancerInvoiceAddressee,
      companyDecision: p.companyDecision,
      companyDecisionAt: toIso(p.companyDecisionAt),
      companyDecisionComment: p.companyDecisionComment,
      freelancerDecision: p.freelancerDecision,
      freelancerDecisionAt: toIso(p.freelancerDecisionAt),
      freelancerDecisionComment: p.freelancerDecisionComment,
      sentAt: toIso(p.sentAt),
      approvedAt: toIso(p.approvedAt),
      statusReason: p.statusReason,
      internalNotes: audience === 'admin' ? p.internalNotes : null,
      createdAt: toIso(p.createdAt),
      updatedAt: toIso(p.updatedAt),
      preview,
      missingTerms: audience === 'admin' ? proposalMissingTerms(p) : [],
      contractId: p.contract?.id ?? null,
      actions: visibleActions(this.actions(actor, p)),
      pending: this.pending(actor, p),
    };
  }

  async get(actor: Actor, id: string): Promise<ProposalView> {
    return this.toView(actor, await this.load(id));
  }

  async list(actor: Actor, query: ProposalListQuery): Promise<Page<ProposalListItem>> {
    const scope: Prisma.CommercialProposalWhereInput = actor.isAdmin
      ? {}
      : actor.isCompany && actor.companyId
        ? { companyId: actor.companyId, status: { not: 'DRAFT' } }
        : actor.isFreelancer && actor.profileId
          ? { profileId: actor.profileId, status: { not: 'DRAFT' } }
          : { id: '00000000-0000-0000-0000-000000000000' };
    const where: Prisma.CommercialProposalWhereInput = {
      AND: [scope, query.status ? { status: query.status } : {}, query.missionId ? { missionId: query.missionId } : {}],
    };
    const [items, total] = await Promise.all([
      this.prisma.commercialProposal.findMany({ where, ...pageArgs(query), orderBy: { updatedAt: 'desc' }, include: proposalInclude }),
      this.prisma.commercialProposal.count({ where }),
    ]);
    return toPage(
      items.map((p) => ({
        id: p.id,
        reference: p.reference,
        version: p.version,
        missionTitle: p.mission.title,
        companyName: p.company.legalName,
        candidateName: actor.isCompany ? displayName(p.profile.user?.firstName, p.profile.user?.lastName) : fullName(p.profile.user?.firstName, p.profile.user?.lastName),
        status: p.status,
        companyDecision: p.companyDecision,
        freelancerDecision: p.freelancerDecision,
        updatedAt: toIso(p.updatedAt),
      })),
      total,
      query,
    );
  }

  // ── Préparation par E-MPGT ────────────────────────────────────────────────

  private termsData(input: ProposalTermsInput): Prisma.CommercialProposalUncheckedUpdateInput {
    const data: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(input)) {
      if (value === undefined) continue;
      data[key] = key === 'startDate' || key === 'endDate' ? parseOptionalIsoDate(value as string | null) : value;
    }
    return data as Prisma.CommercialProposalUncheckedUpdateInput;
  }

  async create(actor: Actor, input: CreateProposalInput): Promise<ProposalView> {
    if (!actor.isAdmin) throw forbidden();
    const { applicationId, ...terms } = input;
    const application = await this.prisma.application.findUnique({ where: { id: applicationId }, include: { mission: true } });
    if (!application) throw notFound('Candidature');
    if (application.status !== 'SELECTED') throw conflict('Une proposition se prépare pour une candidature retenue.');
    const id = await this.prisma.$transaction(async (tx) => {
      const live = await tx.commercialProposal.count({ where: { applicationId, status: { in: [...LIVE] } } });
      if (live > 0) throw conflict('Une proposition est déjà en cours pour cette candidature.');
      const version = (await tx.commercialProposal.count({ where: { applicationId } })) + 1;
      const proposal = await tx.commercialProposal.create({
        data: {
          ...(this.termsData(terms) as Prisma.CommercialProposalUncheckedCreateInput),
          reference: await nextReference(tx, 'PRO'),
          version,
          applicationId,
          missionId: application.missionId,
          companyId: application.mission.companyId,
          profileId: application.profileId,
          createdById: actor.userId,
          // Valeurs par défaut prudentes : la commission n'est montrée qu'à son payeur (décision D-05).
          commissionVisibleToCompany: terms.commissionVisibleToCompany ?? false,
          commissionVisibleToFreelancer: terms.commissionVisibleToFreelancer ?? false,
        },
      });
      await this.audit.record(tx, actor, { action: 'admin.proposal.create', entityType: 'CommercialProposal', entityId: proposal.id, metadata: { applicationId } });
      return proposal.id;
    });
    return this.get(actor, id);
  }

  async update(actor: Actor, id: string, input: ProposalTermsInput): Promise<ProposalView> {
    const p = await this.load(id);
    assertAllowed(this.actions(actor, p), 'update');
    await this.prisma.$transaction(async (tx) => {
      await tx.commercialProposal.update({ where: { id }, data: this.termsData(input) });
      await this.audit.record(tx, actor, { action: 'admin.proposal.update', entityType: 'CommercialProposal', entityId: id, metadata: { fields: Object.keys(input) } });
    });
    return this.get(actor, id);
  }

  async send(actor: Actor, id: string): Promise<ProposalView> {
    const p = await this.load(id);
    assertAllowed(this.actions(actor, p), 'send');
    await this.prisma.$transaction(async (tx) => {
      await tx.commercialProposal.update({
        where: { id },
        data: { status: 'SENT', sentAt: new Date(), companyDecision: 'PENDING', freelancerDecision: 'PENDING' },
      });
      await this.audit.record(tx, actor, { action: 'admin.proposal.send', entityType: 'CommercialProposal', entityId: id });
      const body = `Une proposition commerciale (${p.reference}, version ${p.version}) pour la mission « ${p.mission.title} » attend votre réponse.`;
      await this.notifications.notifyCompany(tx, p.companyId, { type: 'proposal.sent', title: 'Proposition commerciale reçue', body, link: `/entreprise/propositions/${id}`, email: true });
      await this.notifications.notifyProfileOwner(tx, p.profileId, { type: 'proposal.sent', title: 'Proposition commerciale reçue', body, link: `/freelance/propositions/${id}`, email: true });
    });
    return this.get(actor, id);
  }

  async decide(actor: Actor, id: string, decision: 'accept' | 'decline', comment: string | null): Promise<ProposalView> {
    if (decision === 'decline' && !comment) throw conflict('Indiquez le motif du refus.');
    await this.prisma.serializable(async (tx) => {
      const p = await this.load(id, tx);
      this.audience(actor, p);
      assertAllowed(this.actions(actor, p), decision);
      const side = isCompanyMember(actor, p.companyId) ? 'company' : 'freelancer';
      const value = decision === 'accept' ? 'ACCEPTED' : 'DECLINED';
      const data: Prisma.CommercialProposalUpdateInput =
        side === 'company'
          ? { companyDecision: value, companyDecisionAt: new Date(), companyDecisionById: actor.userId, companyDecisionComment: comment }
          : { freelancerDecision: value, freelancerDecisionAt: new Date(), freelancerDecisionById: actor.userId, freelancerDecisionComment: comment };
      const other = side === 'company' ? p.freelancerDecision : p.companyDecision;
      if (decision === 'decline') {
        data.status = 'DECLINED';
        data.statusReason = comment;
      } else if (other === 'ACCEPTED') {
        data.status = 'PARTIES_AGREED';
      }
      await tx.commercialProposal.update({ where: { id }, data });
      await this.audit.record(tx, actor, { action: `proposal.${decision}`, entityType: 'CommercialProposal', entityId: id, reason: comment, metadata: { side } });
      if (decision === 'decline' || other === 'ACCEPTED') {
        await this.notifications.notifyAdmins(tx, {
          type: decision === 'decline' ? 'proposal.declined' : 'proposal.agreed',
          title: decision === 'decline' ? 'Proposition refusée' : 'Proposition acceptée par les parties',
          body:
            decision === 'decline'
              ? `La proposition ${p.reference} a été refusée par ${side === 'company' ? "l'entreprise" : 'le freelance'} : ${comment}`
              : `Les deux parties ont accepté la proposition ${p.reference} : votre validation est attendue pour générer le contrat.`,
          link: `/admin/propositions/${id}`,
          email: true,
        });
      }
    });
    return this.get(actor, id);
  }

  async revise(actor: Actor, id: string): Promise<ProposalView> {
    const p = await this.load(id);
    assertAllowed(this.actions(actor, p), 'revise');
    const newId = await this.prisma.$transaction(async (tx) => {
      await tx.commercialProposal.update({ where: { id }, data: { status: 'SUPERSEDED' } });
      const copy: Record<string, unknown> = { ...p };
      for (const key of [
        'id', 'reference', 'version', 'previousId', 'status', 'companyDecision', 'companyDecisionAt', 'companyDecisionById', 'companyDecisionComment',
        'freelancerDecision', 'freelancerDecisionAt', 'freelancerDecisionById', 'freelancerDecisionComment', 'sentAt', 'approvedAt', 'approvedById',
        'statusReason', 'createdAt', 'updatedAt', 'createdById', 'mission', 'application', 'company', 'profile', 'contract',
      ]) delete copy[key];
      const next = await tx.commercialProposal.create({
        data: {
          ...(copy as Prisma.CommercialProposalUncheckedCreateInput),
          reference: await nextReference(tx, 'PRO'),
          version: p.version + 1,
          previousId: p.id,
          createdById: actor.userId,
        },
      });
      await this.audit.record(tx, actor, { action: 'admin.proposal.revise', entityType: 'CommercialProposal', entityId: next.id, metadata: { previousId: id } });
      return next.id;
    });
    return this.get(actor, newId);
  }

  async withdraw(actor: Actor, id: string, reason: string): Promise<ProposalView> {
    const p = await this.load(id);
    assertAllowed(this.actions(actor, p), 'withdraw');
    await this.prisma.$transaction(async (tx) => {
      await tx.commercialProposal.update({ where: { id }, data: { status: 'WITHDRAWN', statusReason: reason } });
      await this.audit.record(tx, actor, { action: 'admin.proposal.withdraw', entityType: 'CommercialProposal', entityId: id, reason });
      if (p.status !== 'DRAFT') {
        const body = `La proposition ${p.reference} a été retirée par E-MPGT : ${reason}`;
        await this.notifications.notifyCompany(tx, p.companyId, { type: 'proposal.withdrawn', title: 'Proposition retirée', body, link: `/entreprise/propositions/${id}` });
        await this.notifications.notifyProfileOwner(tx, p.profileId, { type: 'proposal.withdrawn', title: 'Proposition retirée', body, link: `/freelance/propositions/${id}` });
      }
    });
    return this.get(actor, id);
  }

  /** Validation E-MPGT : fige les conditions dans un contrat (instantané + empreinte). */
  async approve(actor: Actor, id: string): Promise<ProposalView> {
    const settings = await this.settings.get();
    await this.prisma.serializable(async (tx) => {
      const p = await this.load(id, tx);
      assertAllowed(this.actions(actor, p), 'approve');
      const now = new Date();
      await tx.commercialProposal.update({ where: { id }, data: { status: 'APPROVED', approvedAt: now, approvedById: actor.userId } });
      const termsSnapshot = this.snapshot(p, now);
      const partiesSnapshot = {
        operator: {
          name: settings.legal.operatorName ?? 'Société exploitante à définir (décision D-01)',
          registration: settings.legal.operatorRegistration,
          country: settings.legal.operatorCountry,
        },
        company: {
          id: p.company.id,
          legalName: p.company.legalName,
          legalForm: p.company.legalForm,
          registrationNumber: p.company.registrationNumber,
          registrationType: p.company.registrationType,
          address: [p.company.addressLine1, p.company.addressLine2, p.company.postalCode, p.company.city].filter(Boolean).join(', '),
          country: p.company.country,
        },
        freelancer: {
          profileId: p.profileId,
          name: fullName(p.profile.user?.firstName, p.profile.user?.lastName),
          businessStatus: p.profile.businessStatus,
        },
      };
      const contract = await tx.contract.create({
        data: {
          reference: await nextReference(tx, 'CTR'),
          proposalId: p.id,
          missionId: p.missionId,
          applicationId: p.applicationId,
          companyId: p.companyId,
          profileId: p.profileId,
          startDate: p.startDate!,
          endDate: p.endDate,
          currentEndDate: p.endDate,
          currency: p.currency!,
          billingUnit: p.billingUnit!,
          hoursPerDay: p.hoursPerDay,
          freelanceRate: p.freelanceRate!,
          clientRate: p.clientRate!,
          commissionPayer: p.commissionPayer!,
          commissionMode: p.commissionPayer === 'NONE' ? null : p.commissionMode,
          commissionBase: p.commissionPayer === 'NONE' ? null : p.commissionBase,
          commissionValue: p.commissionPayer === 'NONE' ? null : p.commissionValue,
          commissionNote: p.commissionNote,
          commissionVisibleToCompany: p.commissionVisibleToCompany,
          commissionVisibleToFreelancer: p.commissionVisibleToFreelancer,
          expensesPolicy: p.expensesPolicy,
          taxNote: p.taxNote,
          timesheetValidationRule: p.timesheetValidationRule,
          clientPaymentTermsDays: p.clientPaymentTermsDays,
          freelancerPaymentTermsDays: p.freelancerPaymentTermsDays,
          paymentTermsNote: p.paymentTermsNote,
          freelancerInvoiceAddressee: p.freelancerInvoiceAddressee!,
          partiesSnapshot,
          termsSnapshot,
          termsHash: sha256Hex(canonicalJson(termsSnapshot)),
          createdById: actor.userId,
        },
      });
      await this.audit.record(tx, actor, {
        action: 'admin.proposal.approve',
        entityType: 'CommercialProposal',
        entityId: id,
        metadata: { contractId: contract.id, contractReference: contract.reference, termsHash: contract.termsHash },
      });
      const body = `La proposition ${p.reference} est validée. Le contrat ${contract.reference} est en attente de signature ; la mission démarrera après dépôt du contrat signé.`;
      await this.notifications.notifyCompany(tx, p.companyId, { type: 'contract.created', title: 'Contrat en attente de signature', body, link: `/entreprise/contrats/${contract.id}`, email: true });
      await this.notifications.notifyProfileOwner(tx, p.profileId, { type: 'contract.created', title: 'Contrat en attente de signature', body, link: `/freelance/contrats/${contract.id}`, email: true });
    });
    return this.get(actor, id);
  }

  private snapshot(p: CommercialProposal & { mission: { reference: string } }, approvedAt: Date) {
    return {
      proposal: { id: p.id, reference: p.reference, version: p.version, approvedAt: approvedAt.toISOString() },
      mission: { id: p.missionId, reference: p.mission.reference },
      startDate: toIsoDate(p.startDate),
      endDate: toIsoDate(p.endDate),
      currency: p.currency,
      billingUnit: p.billingUnit,
      hoursPerDay: decimalString(p.hoursPerDay),
      freelanceRate: decimalString(p.freelanceRate),
      clientRate: decimalString(p.clientRate),
      commission: {
        payer: p.commissionPayer,
        mode: p.commissionPayer === 'NONE' ? null : p.commissionMode,
        base: p.commissionPayer === 'NONE' ? null : p.commissionBase,
        value: p.commissionPayer === 'NONE' ? null : decimalString(p.commissionValue),
        note: p.commissionNote,
        visibleToCompany: p.commissionVisibleToCompany,
        visibleToFreelancer: p.commissionVisibleToFreelancer,
      },
      expensesPolicy: p.expensesPolicy,
      taxNote: p.taxNote,
      timesheetValidationRule: p.timesheetValidationRule,
      payment: {
        clientTermsDays: p.clientPaymentTermsDays,
        freelancerTermsDays: p.freelancerPaymentTermsDays,
        note: p.paymentTermsNote,
        freelancerInvoiceAddressee: p.freelancerInvoiceAddressee,
      },
    };
  }
}
