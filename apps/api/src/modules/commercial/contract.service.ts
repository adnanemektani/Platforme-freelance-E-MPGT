import { Injectable } from '@nestjs/common';
import type {
  ActionState,
  AmendmentView,
  ContractListItem,
  ContractListQuery,
  ContractReviewInput,
  ContractView,
  CreateAmendmentInput,
  Page,
  PendingItem,
  ReviewView,
  SignedDepositInput,
} from '@empgt/contracts';
import type { ContractAmendment, Prisma } from '../../generated/prisma/client.js';
import { assertAllowed, check, deny, NOT_FOR_ROLE, visibleActions } from '../../common/actions.js';
import { canonicalJson } from '../../common/crypto.js';
import { parseIsoDate, parseOptionalIsoDate, toIso, toIsoDate } from '../../common/dates.js';
import { conflict, forbidden, notFound } from '../../common/errors.js';
import { dec, decimalString } from '../../common/money.js';
import { pageArgs, toPage } from '../../common/pagination.js';
import { PrismaService, type Db } from '../../common/prisma.service.js';
import { displayName, fullName } from '../../common/text.js';
import { isCompanyMember, ownsProfile, type Actor } from '../auth/actor.js';
import { AuditService } from '../core/audit.service.js';
import { NotificationService } from '../core/notification.service.js';
import { DocumentService, type UploadedFile } from '../documents/document.service.js';
import { audienceOf } from './proposal.service.js';
import { effectiveEndDate, visibleTerms } from './terms.js';

const contractInclude = {
  mission: true,
  company: true,
  profile: { include: { user: { select: { firstName: true, lastName: true } } } },
  amendments: { orderBy: { number: 'asc' } },
  reviews: { select: { authorRole: true } },
  _count: { select: { timesheets: true } },
} satisfies Prisma.ContractInclude;

type ContractFull = Prisma.ContractGetPayload<{ include: typeof contractInclude }>;

export type ContractDecision = 'activate' | 'suspend' | 'resume' | 'complete' | 'terminate' | 'cancel';

@Injectable()
export class ContractService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly notifications: NotificationService,
    private readonly documents: DocumentService,
  ) {}

  async load(id: string, db: Db = this.prisma): Promise<ContractFull> {
    const contract = await db.contract.findUnique({ where: { id }, include: contractInclude });
    if (!contract) throw notFound('Contrat');
    return contract;
  }

  /** Accès : parties au contrat et E-MPGT. */
  assertParty(actor: Actor, contract: { companyId: string; profileId: string }) {
    const audience = audienceOf(actor, contract.companyId, contract.profileId);
    if (!audience) throw notFound('Contrat');
    return audience;
  }

  actions(actor: Actor, c: ContractFull): ActionState[] {
    const authorRole = actor.isAdmin ? 'ADMIN' : isCompanyMember(actor, c.companyId) ? 'COMPANY' : 'FREELANCER';
    const reviewConditions: Array<[boolean, string]> = [
      [c.status === 'COMPLETED' || c.status === 'TERMINATED', 'L’évaluation est possible une fois la mission terminée'],
      [!c.reviews.some((r) => r.authorRole === authorRole), 'Évaluation déjà déposée pour ce contrat'],
    ];
    if (!actor.isAdmin) {
      const party = isCompanyMember(actor, c.companyId) || ownsProfile(actor, c.profileId);
      if (!party) return [deny('review', NOT_FOR_ROLE)];
      return [check('review', reviewConditions)];
    }
    return [
      check('depositSigned', [[c.status === 'AWAITING_SIGNATURE', 'Le contrat signé a déjà été déposé']]),
      check('activate', [
        [c.status === 'SIGNED', c.status === 'AWAITING_SIGNATURE' ? 'Déposez d’abord le contrat signé' : 'Contrat déjà activé ou clôturé'],
        [Boolean(c.signedDocumentId), 'Contrat signé manquant'],
      ]),
      check('suspend', [[c.status === 'ACTIVE', 'Seule une mission active peut être suspendue']]),
      check('resume', [[c.status === 'SUSPENDED', 'La mission n’est pas suspendue']]),
      check('complete', [[c.status === 'ACTIVE' || c.status === 'SUSPENDED', 'La mission n’est pas en cours']]),
      check('terminate', [[c.status === 'ACTIVE' || c.status === 'SUSPENDED', 'La mission n’est pas en cours']]),
      check('cancel', [[c.status === 'AWAITING_SIGNATURE' || c.status === 'SIGNED', 'Un contrat démarré se résilie, il ne s’annule pas']]),
      check('amend', [[['SIGNED', 'ACTIVE', 'SUSPENDED'].includes(c.status), 'Avenant possible sur un contrat signé et non clôturé']]),
      check('review', reviewConditions),
    ];
  }

  private pending(actor: Actor, c: ContractFull): PendingItem[] {
    switch (c.status) {
      case 'AWAITING_SIGNATURE':
        return [
          {
            code: 'contract.awaiting_signature',
            title: 'Contrat en attente de signature',
            description: actor.isAdmin
              ? 'Recueillez les signatures hors plateforme puis déposez le contrat signé avec la preuve de signature.'
              : 'Le contrat doit être signé par les parties ; E-MPGT enregistre ensuite le document signé. La plateforme n’intègre pas de signature électronique.',
            severity: actor.isAdmin ? 'action' : 'info',
          },
        ];
      case 'SIGNED':
        return [
          {
            code: 'contract.signed',
            title: 'Contrat signé',
            description: actor.isAdmin ? 'Activez la mission pour ouvrir la saisie des CRA.' : 'Le contrat signé est enregistré ; E-MPGT va activer la mission.',
            severity: actor.isAdmin ? 'action' : 'info',
          },
        ];
      case 'SUSPENDED':
        return [{ code: 'contract.suspended', title: 'Mission suspendue', description: c.statusReason ?? '', severity: 'blocked' }];
      default:
        return [];
    }
  }

  private amendmentView(actor: Actor, a: ContractAmendment, audience: 'admin' | 'company' | 'freelancer'): AmendmentView {
    return {
      id: a.id,
      number: a.number,
      type: a.type,
      status: a.status,
      effectiveDate: toIsoDate(a.effectiveDate),
      reason: a.reason,
      newEndDate: toIsoDate(a.newEndDate),
      newFreelanceRate: audience === 'company' ? null : decimalString(a.newFreelanceRate),
      newClientRate: audience === 'freelancer' ? null : decimalString(a.newClientRate),
      newHoursPerDay: decimalString(a.newHoursPerDay),
      newCommissionValue: audience === 'admin' ? decimalString(a.newCommissionValue) : null,
      otherChanges: a.otherChanges,
      signedDocumentId: a.signedDocumentId,
      signedAt: toIsoDate(a.signedAt),
      signatureProofNote: a.signatureProofNote,
      statusReason: a.statusReason,
      createdAt: toIso(a.createdAt),
      actions: actor.isAdmin
        ? visibleActions([
            check('depositSigned', [[a.status === 'AWAITING_SIGNATURE' || a.status === 'DRAFT', 'Avenant déjà signé ou annulé']]),
            check('cancel', [[a.status === 'AWAITING_SIGNATURE' || a.status === 'DRAFT', 'Avenant déjà signé ou annulé']]),
          ])
        : [],
    };
  }

  toView(actor: Actor, c: ContractFull): ContractView {
    const audience = this.assertParty(actor, c);
    const terms = visibleTerms(c, audience);
    return {
      id: c.id,
      reference: c.reference,
      proposalId: c.proposalId,
      missionId: c.missionId,
      missionReference: c.mission.reference,
      missionTitle: c.mission.title,
      companyId: c.companyId,
      companyName: c.company.legalName,
      profileId: c.profileId,
      freelancerName: fullName(c.profile.user?.firstName, c.profile.user?.lastName) || displayName(null, null),
      status: c.status,
      startDate: toIsoDate(c.startDate),
      endDate: toIsoDate(c.endDate),
      currentEndDate: toIsoDate(c.currentEndDate),
      currency: c.currency,
      billingUnit: c.billingUnit,
      hoursPerDay: decimalString(c.hoursPerDay),
      ...terms,
      expensesPolicy: c.expensesPolicy,
      taxNote: c.taxNote,
      timesheetValidationRule: c.timesheetValidationRule,
      clientPaymentTermsDays: audience === 'freelancer' ? null : c.clientPaymentTermsDays,
      freelancerPaymentTermsDays: audience === 'company' ? null : c.freelancerPaymentTermsDays,
      paymentTermsNote: c.paymentTermsNote,
      freelancerInvoiceAddressee: c.freelancerInvoiceAddressee,
      termsHash: c.termsHash,
      signedDocumentId: c.signedDocumentId,
      signedAt: toIsoDate(c.signedAt),
      signatureProofNote: c.signatureProofNote,
      signatureRecordedAt: toIso(c.signatureRecordedAt),
      activatedAt: toIso(c.activatedAt),
      closedAt: toIso(c.closedAt),
      statusReason: c.statusReason,
      createdAt: toIso(c.createdAt),
      amendments: c.amendments.map((a) => this.amendmentView(actor, a, audience)),
      timesheetsCount: c._count.timesheets,
      actions: visibleActions(this.actions(actor, c)),
      pending: this.pending(actor, c),
    };
  }

  async get(actor: Actor, id: string): Promise<ContractView> {
    return this.toView(actor, await this.load(id));
  }

  scopeWhere(actor: Actor): Prisma.ContractWhereInput {
    if (actor.isAdmin) return {};
    if (actor.isCompany && actor.companyId) return { companyId: actor.companyId };
    if (actor.isFreelancer && actor.profileId) return { profileId: actor.profileId };
    return { id: '00000000-0000-0000-0000-000000000000' };
  }

  async list(actor: Actor, query: ContractListQuery): Promise<Page<ContractListItem>> {
    const where: Prisma.ContractWhereInput = {
      AND: [
        this.scopeWhere(actor),
        query.status ? { status: query.status } : {},
        query.q
          ? { OR: [{ reference: { contains: query.q, mode: 'insensitive' } }, { mission: { title: { contains: query.q, mode: 'insensitive' } } }] }
          : {},
      ],
    };
    const [items, total] = await Promise.all([
      this.prisma.contract.findMany({ where, ...pageArgs(query), orderBy: { updatedAt: 'desc' }, include: contractInclude }),
      this.prisma.contract.count({ where }),
    ]);
    return toPage(
      items.map((c) => ({
        id: c.id,
        reference: c.reference,
        missionTitle: c.mission.title,
        companyName: c.company.legalName,
        freelancerName: fullName(c.profile.user?.firstName, c.profile.user?.lastName),
        status: c.status,
        startDate: toIsoDate(c.startDate),
        currentEndDate: toIsoDate(c.currentEndDate),
        updatedAt: toIso(c.updatedAt),
      })),
      total,
      query,
    );
  }

  // ── Dépôt du contrat signé (ce n'est pas une signature électronique) ──────

  async depositSigned(actor: Actor, id: string, file: UploadedFile | undefined, input: SignedDepositInput): Promise<ContractView> {
    const c = await this.load(id);
    assertAllowed(this.actions(actor, c), 'depositSigned');
    const signedAt = parseIsoDate(input.signedAt);
    if (signedAt > new Date()) throw conflict('La date de signature ne peut pas être dans le futur.');
    await this.prisma.$transaction(async (tx) => {
      const doc = await this.documents.store(tx, {
        file: file as UploadedFile,
        kind: 'SIGNED_CONTRACT',
        title: `Contrat signé ${c.reference}`,
        visibility: 'CONTRACT_PARTIES',
        uploadedById: actor.userId,
        verificationStatus: 'VERIFIED',
        links: { contractId: c.id },
      });
      const updated = await tx.contract.updateMany({
        where: { id, status: 'AWAITING_SIGNATURE', signedDocumentId: null },
        data: {
          status: 'SIGNED',
          signedDocumentId: doc.id,
          signedAt,
          signatureProofNote: input.signatureProofNote,
          signatureRecordedById: actor.userId,
          signatureRecordedAt: new Date(),
        },
      });
      if (updated.count !== 1) throw conflict('Le contrat signé a déjà été déposé.');
      await this.audit.record(tx, actor, {
        action: 'admin.contract.deposit_signed',
        entityType: 'Contract',
        entityId: id,
        metadata: { documentId: doc.id, signedAt: input.signedAt, proof: input.signatureProofNote },
      });
      const body = `Le contrat signé ${c.reference} a été enregistré (signé le ${input.signedAt}).`;
      await this.notifications.notifyCompany(tx, c.companyId, { type: 'contract.signed', title: 'Contrat signé enregistré', body, link: `/entreprise/contrats/${id}`, email: true });
      await this.notifications.notifyProfileOwner(tx, c.profileId, { type: 'contract.signed', title: 'Contrat signé enregistré', body, link: `/freelance/contrats/${id}`, email: true });
    });
    return this.get(actor, id);
  }

  async decide(actor: Actor, id: string, decision: ContractDecision, reason: string | null): Promise<ContractView> {
    const c = await this.load(id);
    assertAllowed(this.actions(actor, c), decision);
    if (decision !== 'activate' && decision !== 'complete' && !reason) throw conflict('Un motif est obligatoire.');
    const now = new Date();
    await this.prisma.$transaction(async (tx) => {
      const contractData: Prisma.ContractUpdateInput = {
        activate: { status: 'ACTIVE' as const, activatedAt: now, activatedById: actor.userId },
        suspend: { status: 'SUSPENDED' as const, statusReason: reason },
        resume: { status: 'ACTIVE' as const, statusReason: reason },
        complete: { status: 'COMPLETED' as const, closedAt: now, statusReason: reason },
        terminate: { status: 'TERMINATED' as const, closedAt: now, statusReason: reason },
        cancel: { status: 'CANCELLED' as const, closedAt: now, statusReason: reason },
      }[decision];
      await tx.contract.update({ where: { id }, data: contractData });

      const missionData: Prisma.MissionUpdateInput = {
        activate: { status: 'ACTIVE' as const },
        suspend: { status: 'SUSPENDED' as const, statusReason: reason },
        resume: { status: 'ACTIVE' as const, statusReason: null },
        complete: { status: 'COMPLETED' as const, statusReason: reason },
        terminate: { status: 'COMPLETED' as const, statusReason: `Contrat résilié : ${reason}` },
        // Annulation avant démarrage : le poste peut être pourvu par un autre candidat.
        cancel: { status: 'OPEN' as const, statusReason: `Contrat annulé : ${reason}` },
      }[decision];
      await tx.mission.update({ where: { id: c.missionId }, data: missionData });

      if (decision === 'activate') {
        // Le poste est pourvu : les autres candidatures sont clôturées.
        const others = await tx.application.findMany({
          where: { missionId: c.missionId, id: { not: c.applicationId }, status: { in: ['SUBMITTED', 'SHORTLISTED'] } },
          select: { id: true, profileId: true },
        });
        await tx.application.updateMany({
          where: { id: { in: others.map((o) => o.id) } },
          data: { status: 'CLOSED', statusReason: 'Poste pourvu', decidedAt: now },
        });
        for (const other of others) {
          await this.notifications.notifyProfileOwner(tx, other.profileId, {
            type: 'application.closed',
            title: 'Mission pourvue',
            body: `La mission « ${c.mission.title} » a été pourvue. Votre candidature est clôturée.`,
            link: '/freelance/candidatures',
          });
        }
      }
      if (decision === 'cancel') {
        await tx.application.update({ where: { id: c.applicationId }, data: { status: 'CLOSED', statusReason: `Contrat annulé : ${reason}`, decidedAt: now } });
      }
      await this.audit.record(tx, actor, { action: `admin.contract.${decision}`, entityType: 'Contract', entityId: id, reason, metadata: { before: c.status } });
      const labels: Record<ContractDecision, string> = {
        activate: 'Mission activée : la saisie des CRA est ouverte.',
        suspend: `Mission suspendue : ${reason}`,
        resume: `Mission reprise : ${reason}`,
        complete: 'Mission terminée. Vous pouvez déposer une évaluation.',
        terminate: `Contrat résilié : ${reason}`,
        cancel: `Contrat annulé : ${reason}`,
      };
      const title = `Contrat ${c.reference}`;
      await this.notifications.notifyCompany(tx, c.companyId, { type: `contract.${decision}`, title, body: labels[decision], link: `/entreprise/contrats/${id}`, email: true });
      await this.notifications.notifyProfileOwner(tx, c.profileId, { type: `contract.${decision}`, title, body: labels[decision], link: `/freelance/contrats/${id}`, email: true });
    });
    return this.get(actor, id);
  }

  // ── Avenants ──────────────────────────────────────────────────────────────

  async createAmendment(actor: Actor, id: string, input: CreateAmendmentInput): Promise<ContractView> {
    const c = await this.load(id);
    assertAllowed(this.actions(actor, c), 'amend');
    const effectiveDate = parseIsoDate(input.effectiveDate);
    const currentEnd = effectiveEndDate(c, c.amendments);
    if (effectiveDate < c.startDate) throw conflict("La date d'effet précède le début du contrat.");
    if (input.type === 'EXTENSION') {
      const newEnd = parseOptionalIsoDate(input.newEndDate);
      if (!newEnd) throw conflict('Une prolongation précise la nouvelle date de fin.');
      if (currentEnd && newEnd <= currentEnd) throw conflict('La nouvelle date de fin doit être postérieure à la fin actuelle.');
    }
    if (input.type === 'TERMS_CHANGE') {
      if (!input.newFreelanceRate && !input.newClientRate && !input.newHoursPerDay && !input.newCommissionValue) {
        throw conflict('Une modification de conditions précise au moins une nouvelle valeur.');
      }
      if (input.newHoursPerDay && c.billingUnit !== 'DAY') throw conflict('Les heures par journée ne concernent que la facturation journalière.');
      if (input.newCommissionValue && c.commissionPayer === 'NONE') throw conflict('Ce contrat ne prévoit pas de commission.');
      for (const value of [input.newFreelanceRate, input.newClientRate, input.newHoursPerDay]) {
        if (value && dec(value).lte(0)) throw conflict('Les nouvelles valeurs doivent être strictement positives.');
      }
      if (currentEnd && effectiveDate > currentEnd) throw conflict("La date d'effet dépasse la fin du contrat.");
    }
    if (input.type === 'OTHER' && !input.otherChanges) throw conflict('Décrivez les modifications de l’avenant.');
    const changes = {
      type: input.type,
      effectiveDate: input.effectiveDate,
      newEndDate: input.newEndDate,
      newFreelanceRate: input.newFreelanceRate,
      newClientRate: input.newClientRate,
      newHoursPerDay: input.newHoursPerDay,
      newCommissionValue: input.newCommissionValue,
      otherChanges: input.otherChanges,
    };
    await this.prisma.$transaction(async (tx) => {
      const number = (await tx.contractAmendment.count({ where: { contractId: id } })) + 1;
      const amendment = await tx.contractAmendment.create({
        data: {
          contractId: id,
          number,
          type: input.type,
          status: 'AWAITING_SIGNATURE',
          effectiveDate,
          reason: input.reason,
          newEndDate: parseOptionalIsoDate(input.newEndDate),
          newFreelanceRate: input.newFreelanceRate,
          newClientRate: input.newClientRate,
          newHoursPerDay: input.newHoursPerDay,
          newCommissionValue: input.newCommissionValue,
          otherChanges: input.otherChanges,
          changesSnapshot: JSON.parse(canonicalJson(changes)),
          createdById: actor.userId,
        },
      });
      await this.audit.record(tx, actor, { action: 'admin.contract.amendment_create', entityType: 'ContractAmendment', entityId: amendment.id, reason: input.reason, metadata: changes });
      const body = `Un avenant n°${number} au contrat ${c.reference} est en attente de signature : ${input.reason}`;
      await this.notifications.notifyCompany(tx, c.companyId, { type: 'amendment.created', title: 'Avenant à signer', body, link: `/entreprise/contrats/${id}`, email: true });
      await this.notifications.notifyProfileOwner(tx, c.profileId, { type: 'amendment.created', title: 'Avenant à signer', body, link: `/freelance/contrats/${id}`, email: true });
    });
    return this.get(actor, id);
  }

  async depositAmendmentSigned(actor: Actor, amendmentId: string, file: UploadedFile | undefined, input: SignedDepositInput): Promise<ContractView> {
    if (!actor.isAdmin) throw forbidden();
    const amendment = await this.prisma.contractAmendment.findUnique({ where: { id: amendmentId } });
    if (!amendment) throw notFound('Avenant');
    if (amendment.status !== 'AWAITING_SIGNATURE' && amendment.status !== 'DRAFT') throw conflict('Avenant déjà signé ou annulé.');
    const c = await this.load(amendment.contractId);
    if (!['SIGNED', 'ACTIVE', 'SUSPENDED'].includes(c.status)) throw conflict('Le contrat est clôturé.');
    await this.prisma.$transaction(async (tx) => {
      const doc = await this.documents.store(tx, {
        file: file as UploadedFile,
        kind: 'SIGNED_AMENDMENT',
        title: `Avenant n°${amendment.number} — ${c.reference}`,
        visibility: 'CONTRACT_PARTIES',
        uploadedById: actor.userId,
        verificationStatus: 'VERIFIED',
        links: { contractId: c.id },
      });
      await tx.contractAmendment.update({
        where: { id: amendmentId },
        data: {
          status: 'SIGNED',
          signedDocumentId: doc.id,
          signedAt: parseIsoDate(input.signedAt),
          signatureProofNote: input.signatureProofNote,
          signatureRecordedById: actor.userId,
        },
      });
      if (amendment.type === 'EXTENSION' && amendment.newEndDate) {
        await tx.contract.update({ where: { id: c.id }, data: { currentEndDate: amendment.newEndDate } });
      }
      await this.audit.record(tx, actor, {
        action: 'admin.contract.amendment_signed',
        entityType: 'ContractAmendment',
        entityId: amendmentId,
        metadata: { documentId: doc.id, signedAt: input.signedAt },
      });
      const body = `L'avenant n°${amendment.number} au contrat ${c.reference} est signé et s'applique à compter du ${toIsoDate(amendment.effectiveDate)}.`;
      await this.notifications.notifyCompany(tx, c.companyId, { type: 'amendment.signed', title: 'Avenant signé', body, link: `/entreprise/contrats/${c.id}` });
      await this.notifications.notifyProfileOwner(tx, c.profileId, { type: 'amendment.signed', title: 'Avenant signé', body, link: `/freelance/contrats/${c.id}` });
    });
    return this.get(actor, c.id);
  }

  async cancelAmendment(actor: Actor, amendmentId: string, reason: string): Promise<ContractView> {
    if (!actor.isAdmin) throw forbidden();
    const amendment = await this.prisma.contractAmendment.findUnique({ where: { id: amendmentId } });
    if (!amendment) throw notFound('Avenant');
    if (amendment.status !== 'AWAITING_SIGNATURE' && amendment.status !== 'DRAFT') throw conflict('Avenant déjà signé ou annulé.');
    await this.prisma.$transaction(async (tx) => {
      await tx.contractAmendment.update({ where: { id: amendmentId }, data: { status: 'CANCELLED', statusReason: reason } });
      await this.audit.record(tx, actor, { action: 'admin.contract.amendment_cancel', entityType: 'ContractAmendment', entityId: amendmentId, reason });
    });
    return this.get(actor, amendment.contractId);
  }

  // ── Évaluations (internes par défaut) ─────────────────────────────────────

  async review(actor: Actor, id: string, input: ContractReviewInput): Promise<ReviewView> {
    const c = await this.load(id);
    this.assertParty(actor, c);
    assertAllowed(this.actions(actor, c), 'review');
    const authorRole = actor.isAdmin ? 'ADMIN' : isCompanyMember(actor, c.companyId) ? 'COMPANY' : 'FREELANCER';
    const subject = authorRole === 'FREELANCER' ? 'COMPANY' : 'FREELANCER';
    const review = await this.prisma.$transaction(async (tx) => {
      const created = await tx.review.create({
        data: { contractId: id, authorUserId: actor.userId, authorRole, subject, rating: input.rating, comment: input.comment },
      });
      await this.audit.record(tx, actor, { action: 'review.create', entityType: 'Review', entityId: created.id, metadata: { contractId: id, rating: input.rating } });
      return created;
    });
    return this.reviewView(review);
  }

  private reviewView(r: { id: string; contractId: string; authorRole: string; subject: string; rating: number; comment: string | null; visibility: string; createdAt: Date }): ReviewView {
    return { id: r.id, contractId: r.contractId, authorRole: r.authorRole, subject: r.subject, rating: r.rating, comment: r.comment, visibility: r.visibility, createdAt: toIso(r.createdAt) };
  }

  /** Évaluations internes : E-MPGT voit tout ; une partie ne voit que ses propres évaluations. */
  async reviews(actor: Actor, contractId?: string): Promise<ReviewView[]> {
    const where: Prisma.ReviewWhereInput = actor.isAdmin ? (contractId ? { contractId } : {}) : { authorUserId: actor.userId, ...(contractId ? { contractId } : {}) };
    const reviews = await this.prisma.review.findMany({ where, orderBy: { createdAt: 'desc' }, take: 200 });
    return reviews.map((r) => this.reviewView(r));
  }
}
