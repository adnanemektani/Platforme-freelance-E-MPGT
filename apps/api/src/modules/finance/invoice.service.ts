import { Injectable } from '@nestjs/common';
import type {
  ActionState,
  CompanyBillingOverview,
  DepositInvoiceInput,
  FreelancerPaymentsOverview,
  InvoiceListItem,
  InvoiceListQuery,
  InvoiceView,
  MoneyRecordView,
  Page,
  PaymentConfigurationView,
  PendingItem,
  RecordMoneyInput,
  UpdatePaymentConfigInput,
} from '@empgt/contracts';
import type { DocumentVisibility, PaymentConfiguration, Prisma } from '../../generated/prisma/client.js';
import { assertAllowed, check, deny, NOT_FOR_ROLE, visibleActions } from '../../common/actions.js';
import { monthLabel, parseIsoDate, today, toIso, toIsoDate } from '../../common/dates.js';
import { badRequest, conflict, forbidden, notFound } from '../../common/errors.js';
import { dec, Decimal, moneyString, sumDecimals } from '../../common/money.js';
import { pageArgs, toPage } from '../../common/pagination.js';
import { PrismaService, type Db } from '../../common/prisma.service.js';
import { fullName } from '../../common/text.js';
import { isCompanyMember, ownsProfile, type Actor } from '../auth/actor.js';
import { AuditService } from '../core/audit.service.js';
import { NotificationService } from '../core/notification.service.js';
import { DocumentService, type UploadedFile } from '../documents/document.service.js';
import type { AmountsSnapshot } from './calc.js';
import { PaymentProviderRegistry } from './payment-provider.js';

const invoiceInclude = {
  contract: { include: { mission: { select: { title: true } }, company: { select: { legalName: true } }, profile: { include: { user: { select: { firstName: true, lastName: true } } } } } },
  timesheet: { select: { periodStart: true, amountsSnapshot: true, status: true } },
  payments: { orderBy: { receivedOn: 'asc' } },
  payouts: { orderBy: { paidOn: 'asc' } },
} satisfies Prisma.InvoiceInclude;

type InvoiceFull = Prisma.InvoiceGetPayload<{ include: typeof invoiceInclude }>;

export const MANUAL_DISCLAIMER =
  'Suivi manuel (V1) : la plateforme ne déclenche aucun virement et ne détient aucun fonds. Un règlement n’apparaît ici que lorsqu’E-MPGT l’a enregistré avec sa référence et son justificatif. Un CRA validé ne vaut pas paiement.';

/** Factures adressées au client : encaissements ; factures freelance adressées à E-MPGT : règlements. */
function collectsFromClient(invoice: { kind: string; addressee: string }): boolean {
  return invoice.kind === 'CLIENT_INVOICE' || invoice.addressee === 'CLIENT';
}

@Injectable()
export class InvoiceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly notifications: NotificationService,
    private readonly documents: DocumentService,
    private readonly providers: PaymentProviderRegistry,
  ) {}

  private async load(id: string, db: Db = this.prisma): Promise<InvoiceFull> {
    const invoice = await db.invoice.findUnique({ where: { id }, include: invoiceInclude });
    if (!invoice) throw notFound('Facture');
    return invoice;
  }

  /**
   * Visibilité : E-MPGT voit tout ; l'entreprise voit les factures qui lui sont adressées ;
   * le freelance voit ses propres factures (jamais la facture client, qui révèle le prix client).
   */
  scopeWhere(actor: Actor): Prisma.InvoiceWhereInput {
    if (actor.isAdmin) return {};
    if (actor.isCompany && actor.companyId) {
      return { companyId: actor.companyId, OR: [{ kind: 'CLIENT_INVOICE' }, { addressee: 'CLIENT' }] };
    }
    if (actor.isFreelancer && actor.profileId) return { profileId: actor.profileId, kind: 'FREELANCER_INVOICE' };
    return { id: '00000000-0000-0000-0000-000000000000' };
  }

  private canRead(actor: Actor, inv: InvoiceFull): boolean {
    if (actor.isAdmin) return true;
    if (isCompanyMember(actor, inv.companyId)) return collectsFromClient(inv);
    if (ownsProfile(actor, inv.profileId)) return inv.kind === 'FREELANCER_INVOICE';
    return false;
  }

  private outstanding(inv: { amountInclTax: Prisma.Decimal; paidAmount: Prisma.Decimal }): Decimal {
    return dec(inv.amountInclTax).minus(dec(inv.paidAmount));
  }

  private overdue(inv: { dueDate: Date; paymentState: string; status: string }): boolean {
    return inv.status !== 'CANCELLED' && inv.status !== 'REJECTED' && inv.paymentState !== 'PAID' && inv.dueDate < today();
  }

  actions(actor: Actor, inv: InvoiceFull): ActionState[] {
    if (!actor.isAdmin) return [deny('verify', NOT_FOR_ROLE)];
    const recorded = [...inv.payments, ...inv.payouts].some((p) => p.status === 'RECORDED');
    const remaining = this.outstanding(inv).gt(0);
    return [
      check('verify', [[inv.status === 'SUBMITTED', 'Facture déjà contrôlée ou clôturée']]),
      check('reject', [[inv.status === 'SUBMITTED', 'Facture déjà contrôlée ou clôturée']]),
      check('cancel', [
        [inv.status === 'SUBMITTED' || inv.status === 'VERIFIED', 'Facture déjà clôturée'],
        [!recorded, 'Des paiements sont enregistrés : annulez-les d’abord'],
      ]),
      check('recordPayment', [
        [collectsFromClient(inv), 'Facture non adressée au client : enregistrer un règlement freelance'],
        [inv.status === 'VERIFIED', 'Contrôlez la facture avant d’enregistrer un encaissement'],
        [remaining, 'Facture entièrement réglée'],
      ]),
      check('recordPayout', [
        [inv.kind === 'FREELANCER_INVOICE' && inv.addressee === 'EMPGT', 'Seule une facture freelance adressée à E-MPGT donne lieu à un règlement par E-MPGT'],
        [inv.status === 'VERIFIED', 'Contrôlez la facture avant d’enregistrer un règlement'],
        [remaining, 'Facture entièrement réglée'],
      ]),
    ];
  }

  private pending(actor: Actor, inv: InvoiceFull): PendingItem[] {
    if (inv.status === 'SUBMITTED') {
      return [{ code: 'invoice.submitted', title: 'Facture déposée', description: actor.isAdmin ? 'Contrôlez la facture (montants, rapprochement avec le CRA).' : 'E-MPGT contrôle la facture.', severity: actor.isAdmin ? 'action' : 'info' }];
    }
    if (inv.status === 'VERIFIED' && inv.paymentState !== 'PAID') {
      return [
        {
          code: this.overdue(inv) ? 'invoice.overdue' : 'invoice.unpaid',
          title: this.overdue(inv) ? 'Échéance dépassée' : 'En attente de règlement',
          description: `Reste dû : ${moneyString(this.outstanding(inv), inv.currency)} ${inv.currency} — échéance ${toIsoDate(inv.dueDate)}.`,
          severity: this.overdue(inv) ? 'action' : 'info',
        },
      ];
    }
    return [];
  }

  private moneyView(record: { id: string; invoiceId: string; amount: Prisma.Decimal; currency: string; method: MoneyRecordView['method']; reference: string; proofDocumentId: string; note: string | null; status: MoneyRecordView['status']; recordedAt: Date; cancelledAt: Date | null; cancelReason: string | null }, date: Date, invoiceNumber: string, actor: Actor): MoneyRecordView {
    return {
      id: record.id,
      invoiceId: record.invoiceId,
      invoiceNumber,
      amount: moneyString(record.amount, record.currency),
      currency: record.currency,
      date: toIsoDate(date),
      method: record.method,
      reference: record.reference,
      proofDocumentId: record.proofDocumentId,
      note: record.note,
      status: record.status,
      recordedAt: toIso(record.recordedAt),
      cancelledAt: toIso(record.cancelledAt),
      cancelReason: record.cancelReason,
      actions: actor.isAdmin ? visibleActions([check('cancel', [[record.status === 'RECORDED', 'Déjà annulé']])]) : [],
    };
  }

  toView(actor: Actor, inv: InvoiceFull): InvoiceView {
    if (!this.canRead(actor, inv)) throw notFound('Facture');
    const own = ownsProfile(actor, inv.profileId);
    const company = isCompanyMember(actor, inv.companyId);
    const expected = inv.expectedAmountExclTax ? dec(inv.expectedAmountExclTax) : null;
    return {
      id: inv.id,
      kind: inv.kind,
      number: inv.number,
      contractId: inv.contractId,
      contractReference: inv.contract.reference,
      missionTitle: inv.contract.mission.title,
      timesheetId: inv.timesheetId,
      timesheetPeriod: inv.timesheet ? monthLabel(inv.timesheet.periodStart) : null,
      companyId: inv.companyId,
      companyName: inv.contract.company.legalName,
      profileId: inv.profileId,
      freelancerName: fullName(inv.contract.profile.user?.firstName, inv.contract.profile.user?.lastName),
      issuerLabel: inv.issuerLabel,
      addressee: inv.addressee,
      issueDate: toIsoDate(inv.issueDate),
      dueDate: toIsoDate(inv.dueDate),
      currency: inv.currency,
      amountExclTax: moneyString(inv.amountExclTax, inv.currency),
      taxAmount: moneyString(inv.taxAmount, inv.currency),
      amountInclTax: moneyString(inv.amountInclTax, inv.currency),
      expectedAmountExclTax: actor.isAdmin && expected ? moneyString(expected, inv.currency) : null,
      discrepancy: actor.isAdmin && expected ? moneyString(dec(inv.amountExclTax).minus(expected), inv.currency) : null,
      documentId: inv.documentId,
      status: inv.status,
      statusReason: inv.statusReason,
      verifiedAt: toIso(inv.verifiedAt),
      paymentState: inv.paymentState,
      paidAmount: moneyString(inv.paidAmount, inv.currency),
      outstandingAmount: moneyString(this.outstanding(inv), inv.currency),
      overdue: this.overdue(inv),
      payments: actor.isAdmin || company || (own && inv.addressee === 'CLIENT') ? inv.payments.map((p) => this.moneyView(p, p.receivedOn, inv.number, actor)) : [],
      payouts: actor.isAdmin || own ? inv.payouts.map((p) => this.moneyView(p, p.paidOn, inv.number, actor)) : [],
      createdAt: toIso(inv.createdAt),
      actions: visibleActions(this.actions(actor, inv)),
      pending: this.pending(actor, inv),
    };
  }

  private listItem(inv: InvoiceFull): InvoiceListItem {
    return {
      id: inv.id,
      kind: inv.kind,
      number: inv.number,
      contractReference: inv.contract.reference,
      companyName: inv.contract.company.legalName,
      freelancerName: fullName(inv.contract.profile.user?.firstName, inv.contract.profile.user?.lastName),
      issueDate: toIsoDate(inv.issueDate),
      dueDate: toIsoDate(inv.dueDate),
      currency: inv.currency,
      amountInclTax: moneyString(inv.amountInclTax, inv.currency),
      paidAmount: moneyString(inv.paidAmount, inv.currency),
      status: inv.status,
      paymentState: inv.paymentState,
      overdue: this.overdue(inv),
    };
  }

  async get(actor: Actor, id: string): Promise<InvoiceView> {
    return this.toView(actor, await this.load(id));
  }

  async list(actor: Actor, query: InvoiceListQuery): Promise<Page<InvoiceListItem>> {
    const where: Prisma.InvoiceWhereInput = {
      AND: [
        this.scopeWhere(actor),
        query.kind ? { kind: query.kind } : {},
        query.status ? { status: query.status } : {},
        query.paymentState ? { paymentState: query.paymentState } : {},
        query.contractId ? { contractId: query.contractId } : {},
        query.overdue ? { dueDate: { lt: today() }, paymentState: { not: 'PAID' }, status: { in: ['SUBMITTED', 'VERIFIED'] } } : {},
        query.q ? { OR: [{ number: { contains: query.q, mode: 'insensitive' } }, { contract: { reference: { contains: query.q, mode: 'insensitive' } } }] } : {},
      ],
    };
    const [items, total] = await Promise.all([
      this.prisma.invoice.findMany({ where, ...pageArgs(query), orderBy: { issueDate: 'desc' }, include: invoiceInclude }),
      this.prisma.invoice.count({ where }),
    ]);
    return toPage(items.map((i) => this.listItem(i)), total, query);
  }

  // ── Dépôt ─────────────────────────────────────────────────────────────────

  async deposit(actor: Actor, file: UploadedFile | undefined, input: DepositInvoiceInput): Promise<InvoiceView> {
    const contract = await this.prisma.contract.findUnique({ where: { id: input.contractId } });
    if (!contract) throw notFound('Contrat');
    if (input.kind === 'CLIENT_INVOICE' && !actor.isAdmin) throw forbidden('Les factures client sont déposées par E-MPGT.');
    if (input.kind === 'FREELANCER_INVOICE' && !actor.isAdmin && !ownsProfile(actor, contract.profileId)) throw notFound('Contrat');
    if (!['ACTIVE', 'SUSPENDED', 'COMPLETED', 'TERMINATED'].includes(contract.status)) {
      throw conflict('La facturation est possible une fois la mission démarrée.');
    }
    if (input.currency !== contract.currency) throw conflict(`La devise doit être celle du contrat (${contract.currency}).`);
    const ht = dec(input.amountExclTax);
    const tax = dec(input.taxAmount);
    const ttc = dec(input.amountInclTax);
    if (!ht.plus(tax).eq(ttc)) throw badRequest('Montant TTC incohérent : il doit être égal au HT plus les taxes déclarées.');
    if (ttc.lte(0)) throw badRequest('Le montant de la facture doit être positif.');
    const issueDate = parseIsoDate(input.issueDate);
    const dueDate = parseIsoDate(input.dueDate);
    if (dueDate < issueDate) throw badRequest("L'échéance précède la date d'émission.");

    const addressee = input.kind === 'CLIENT_INVOICE' ? 'CLIENT' : contract.freelancerInvoiceAddressee;
    let expected: string | null = null;
    if (input.timesheetId) {
      const ts = await this.prisma.timesheet.findFirst({ where: { id: input.timesheetId, contractId: contract.id } });
      if (!ts) throw notFound('CRA');
      if (ts.status !== 'APPROVED') throw conflict('Une facture se rattache à un CRA validé.');
      const snapshot = ts.amountsSnapshot as unknown as AmountsSnapshot | null;
      if (snapshot) {
        // Rapprochement indicatif (modèle de facturation à confirmer : décision D-04).
        expected =
          input.kind === 'CLIENT_INVOICE'
            ? snapshot.clientTotalExclTax
            : addressee === 'EMPGT'
              ? snapshot.freelanceNetExclTax
              : snapshot.freelanceGrossAmount;
      }
    }
    const visibility: DocumentVisibility =
      input.kind === 'CLIENT_INVOICE' ? 'COMPANY_AND_ADMIN' : addressee === 'CLIENT' ? 'CONTRACT_PARTIES' : 'OWNER_AND_ADMIN';

    const id = await this.prisma.$transaction(async (tx) => {
      const doc = await this.documents.store(tx, {
        file: file as UploadedFile,
        kind: 'INVOICE',
        title: `Facture ${input.number}`,
        visibility,
        uploadedById: actor.userId,
        verificationStatus: 'NOT_REQUIRED',
        links: {
          contractId: contract.id,
          companyId: input.kind === 'CLIENT_INVOICE' ? contract.companyId : null,
          profileId: input.kind === 'FREELANCER_INVOICE' ? contract.profileId : null,
        },
      });
      const invoice = await tx.invoice.create({
        data: {
          kind: input.kind,
          number: input.number,
          contractId: contract.id,
          timesheetId: input.timesheetId,
          companyId: contract.companyId,
          profileId: contract.profileId,
          issuerLabel: input.issuerLabel,
          addressee,
          issueDate,
          dueDate,
          currency: input.currency,
          amountExclTax: ht.toFixed(2),
          taxAmount: tax.toFixed(2),
          amountInclTax: ttc.toFixed(2),
          expectedAmountExclTax: expected,
          documentId: doc.id,
          submittedById: actor.userId,
        },
      });
      await tx.document.update({ where: { id: doc.id }, data: { invoiceId: invoice.id } });
      await this.audit.record(tx, actor, {
        action: 'invoice.deposit',
        entityType: 'Invoice',
        entityId: invoice.id,
        metadata: { kind: input.kind, number: input.number, amountInclTax: ttc.toFixed(2), currency: input.currency, expected },
      });
      await this.notifications.notifyAdmins(tx, {
        type: 'invoice.deposited',
        title: 'Facture à contrôler',
        body: `Facture ${input.number} (${ttc.toFixed(2)} ${input.currency}) déposée sur le contrat ${contract.reference}.`,
        link: `/admin/finance/factures/${invoice.id}`,
        email: !actor.isAdmin,
      });
      if (collectsFromClient({ kind: input.kind, addressee })) {
        await this.notifications.notifyCompany(tx, contract.companyId, {
          type: 'invoice.received',
          title: 'Nouvelle facture',
          body: `La facture ${input.number} (${ttc.toFixed(2)} ${input.currency}, échéance ${input.dueDate}) est disponible.`,
          link: `/entreprise/factures/${invoice.id}`,
          email: true,
        });
      }
      return invoice.id;
    });
    return this.get(actor, id);
  }

  async decide(actor: Actor, id: string, decision: 'verify' | 'reject' | 'cancel', reason: string | null): Promise<InvoiceView> {
    const inv = await this.load(id);
    assertAllowed(this.actions(actor, inv), decision);
    if (decision !== 'verify' && !reason) throw conflict('Un motif est obligatoire.');
    await this.prisma.$transaction(async (tx) => {
      await tx.invoice.update({
        where: { id },
        data:
          decision === 'verify'
            ? { status: 'VERIFIED', verifiedAt: new Date(), verifiedById: actor.userId, statusReason: reason }
            : { status: decision === 'reject' ? 'REJECTED' : 'CANCELLED', statusReason: reason },
      });
      await this.audit.record(tx, actor, { action: `admin.invoice.${decision}`, entityType: 'Invoice', entityId: id, reason, metadata: { before: inv.status } });
      if (inv.kind === 'FREELANCER_INVOICE') {
        const labels = { verify: 'contrôlée', reject: `refusée : ${reason}`, cancel: `annulée : ${reason}` };
        await this.notifications.notifyProfileOwner(tx, inv.profileId, {
          type: `invoice.${decision}`,
          title: `Facture ${inv.number}`,
          body: `Votre facture ${inv.number} a été ${labels[decision]}.`,
          link: `/freelance/paiements`,
          email: decision !== 'verify',
        });
      }
    });
    return this.get(actor, id);
  }

  // ── Encaissements et règlements (justifiés, jamais simulés) ───────────────

  async record(
    actor: Actor,
    invoiceId: string,
    kind: 'payment' | 'payout',
    file: UploadedFile | undefined,
    input: RecordMoneyInput,
  ): Promise<InvoiceView> {
    if (!actor.isAdmin) throw forbidden();
    if (!file) throw badRequest('Le justificatif est obligatoire : un enregistrement sans preuve ne simule pas un virement.');
    const amount = dec(input.amount);
    if (amount.lte(0)) throw badRequest('Le montant doit être positif.');
    const date = parseIsoDate(input.date);
    if (date > today()) throw badRequest('La date du paiement ne peut pas être dans le futur.');
    await this.prisma.serializable(async (tx) => {
      const inv = await this.load(invoiceId, tx);
      assertAllowed(this.actions(actor, inv), kind === 'payment' ? 'recordPayment' : 'recordPayout');
      const outstanding = this.outstanding(inv);
      if (amount.gt(outstanding)) {
        throw conflict(`Le montant dépasse le reste dû (${moneyString(outstanding, inv.currency)} ${inv.currency}).`);
      }
      const doc = await this.documents.store(tx, {
        file,
        kind: 'PAYMENT_PROOF',
        title: `Justificatif ${input.reference}`,
        visibility: kind === 'payout' ? 'OWNER_AND_ADMIN' : inv.kind === 'CLIENT_INVOICE' ? 'COMPANY_AND_ADMIN' : 'CONTRACT_PARTIES',
        uploadedById: actor.userId,
        verificationStatus: 'NOT_REQUIRED',
        links: {
          invoiceId: inv.id,
          contractId: inv.contractId,
          profileId: kind === 'payout' ? inv.profileId : null,
          companyId: kind === 'payment' && inv.kind === 'CLIENT_INVOICE' ? inv.companyId : null,
        },
      });
      const common = { invoiceId, amount: amount.toFixed(2), currency: inv.currency, method: input.method, reference: input.reference, proofDocumentId: doc.id, note: input.note, recordedById: actor.userId };
      const record =
        kind === 'payment'
          ? await tx.paymentRecord.create({ data: { ...common, receivedOn: date } })
          : await tx.payoutRecord.create({ data: { ...common, paidOn: date, contractId: inv.contractId, profileId: inv.profileId } });
      await this.recomputePaid(tx, invoiceId);
      await this.audit.record(tx, actor, {
        action: kind === 'payment' ? 'admin.payment.record' : 'admin.payout.record',
        entityType: kind === 'payment' ? 'PaymentRecord' : 'PayoutRecord',
        entityId: record.id,
        metadata: { invoiceId, amount: amount.toFixed(2), currency: inv.currency, reference: input.reference, proofDocumentId: doc.id, provider: this.providers.current().code },
      });
      const body = `${kind === 'payment' ? 'Encaissement' : 'Règlement'} de ${amount.toFixed(2)} ${inv.currency} enregistré sur la facture ${inv.number} (référence ${input.reference}).`;
      if (kind === 'payout') {
        await this.notifications.notifyProfileOwner(tx, inv.profileId, { type: 'payout.recorded', title: 'Règlement enregistré', body, link: '/freelance/paiements', email: true });
      } else {
        await this.notifications.notifyCompany(tx, inv.companyId, { type: 'payment.recorded', title: 'Règlement reçu enregistré', body, link: `/entreprise/factures/${invoiceId}`, email: true });
        if (inv.addressee === 'CLIENT' && inv.kind === 'FREELANCER_INVOICE') {
          await this.notifications.notifyProfileOwner(tx, inv.profileId, { type: 'payment.recorded', title: 'Règlement client enregistré', body, link: '/freelance/paiements', email: true });
        }
      }
    });
    return this.get(actor, invoiceId);
  }

  async cancelRecord(actor: Actor, kind: 'payment' | 'payout', recordId: string, reason: string): Promise<InvoiceView> {
    if (!actor.isAdmin) throw forbidden();
    const record = kind === 'payment' ? await this.prisma.paymentRecord.findUnique({ where: { id: recordId } }) : await this.prisma.payoutRecord.findUnique({ where: { id: recordId } });
    if (!record) throw notFound('Enregistrement');
    if (record.status !== 'RECORDED') throw conflict('Déjà annulé.');
    await this.prisma.serializable(async (tx) => {
      const data = { status: 'CANCELLED' as const, cancelledAt: new Date(), cancelledById: actor.userId, cancelReason: reason };
      if (kind === 'payment') await tx.paymentRecord.update({ where: { id: recordId }, data });
      else await tx.payoutRecord.update({ where: { id: recordId }, data });
      await this.recomputePaid(tx, record.invoiceId);
      await this.audit.record(tx, actor, { action: `admin.${kind}.cancel`, entityType: kind === 'payment' ? 'PaymentRecord' : 'PayoutRecord', entityId: recordId, reason });
    });
    return this.get(actor, record.invoiceId);
  }

  /** Rapprochement : somme des enregistrements non annulés → montant réglé et état de paiement. */
  private async recomputePaid(tx: Db, invoiceId: string): Promise<void> {
    const inv = await tx.invoice.findUniqueOrThrow({ where: { id: invoiceId }, include: { payments: true, payouts: true } });
    const relevant = collectsFromClient(inv) ? inv.payments : inv.payouts;
    const paid = sumDecimals(relevant.filter((r) => r.status === 'RECORDED').map((r) => r.amount));
    const total = dec(inv.amountInclTax);
    const state = paid.eq(0) ? 'UNPAID' : paid.gte(total) ? 'PAID' : 'PARTIALLY_PAID';
    await tx.invoice.update({ where: { id: invoiceId }, data: { paidAmount: paid.toFixed(2), paymentState: state } });
  }

  // ── Configuration de règlement et synthèses ───────────────────────────────

  configurationView(config: PaymentConfiguration | null): PaymentConfigurationView {
    const provider = this.providers.current();
    const status = config?.status ?? 'NOT_CONFIGURED';
    const explanations: Record<string, string> = {
      NOT_CONFIGURED:
        'Règlement prévu par virement manuel hors plateforme. Le prestataire de paiement et les modalités (délais, paiement avant ou après encaissement client) restent à valider par E-MPGT : aucune coordonnée bancaire n’est collectée ici.',
      PENDING_DECISION: 'E-MPGT finalise les modalités de règlement applicables à votre situation. Aucune coordonnée bancaire n’est collectée sur la plateforme.',
      MANUAL_CONFIRMED: 'Règlement par virement manuel confirmé par E-MPGT. Vos coordonnées bancaires sont échangées hors plateforme selon la procédure E-MPGT.',
      PROVIDER_ONBOARDING: `Inscription auprès du prestataire de paiement en cours${config?.providerMode === 'TEST' ? ' (MODE TEST : aucun paiement réel)' : ''}.`,
      PROVIDER_ACTIVE: `Prestataire de paiement actif${config?.providerMode === 'TEST' ? ' (MODE TEST : aucun paiement réel)' : ''}.`,
    };
    return {
      method: config?.method ?? 'MANUAL_BANK_TRANSFER',
      status,
      provider: config?.provider ?? (provider.code === 'manual' ? null : provider.code),
      providerMode: config?.providerMode ?? (provider.code === 'manual' ? null : provider.mode),
      note: config?.note ?? null,
      confirmedAt: toIso(config?.confirmedAt),
      explanation: explanations[status]!,
    };
  }

  async freelancerOverview(actor: Actor): Promise<FreelancerPaymentsOverview> {
    if (!actor.isFreelancer || !actor.profileId) throw forbidden();
    const profileId = actor.profileId;
    const [config, timesheets, invoices, payouts] = await Promise.all([
      this.prisma.paymentConfiguration.findUnique({ where: { profileId } }),
      this.prisma.timesheet.findMany({
        where: { status: 'APPROVED', contract: { profileId } },
        orderBy: { periodStart: 'desc' },
        include: { contract: { select: { reference: true } }, invoices: { where: { kind: 'FREELANCER_INVOICE', status: { in: ['SUBMITTED', 'VERIFIED'] } }, select: { id: true } } },
      }),
      this.prisma.invoice.findMany({ where: { profileId, kind: 'FREELANCER_INVOICE' }, include: invoiceInclude, orderBy: { dueDate: 'asc' } }),
      this.prisma.payoutRecord.findMany({ where: { profileId }, include: { invoice: { select: { number: true } } }, orderBy: { paidOn: 'desc' } }),
    ]);
    const approvedAmounts = timesheets.map((t) => {
      const s = t.amountsSnapshot as unknown as AmountsSnapshot | null;
      return {
        timesheetId: t.id,
        contractReference: t.contract.reference,
        periodStart: toIsoDate(t.periodStart),
        currency: s?.currency ?? '',
        hours: dec(t.totalHours).toFixed(2),
        freelanceNetExclTax: s?.freelanceNetExclTax ?? null,
        invoiced: t.invoices.length > 0,
      };
    });
    const currencies = new Set([...approvedAmounts.map((a) => a.currency), ...invoices.map((i) => i.currency)].filter(Boolean));
    const totals = [...currencies].map((currency) => {
      const approvedNet = sumDecimals(approvedAmounts.filter((a) => a.currency === currency && a.freelanceNetExclTax).map((a) => a.freelanceNetExclTax!));
      const live = invoices.filter((i) => i.currency === currency && (i.status === 'SUBMITTED' || i.status === 'VERIFIED'));
      const invoiced = sumDecimals(live.map((i) => i.amountInclTax));
      const paid = sumDecimals(live.map((i) => i.paidAmount));
      return { currency, approvedNet: moneyString(approvedNet, currency), invoiced: moneyString(invoiced, currency), paid: moneyString(paid, currency), outstanding: moneyString(invoiced.minus(paid), currency) };
    });
    return {
      configuration: this.configurationView(config),
      mode: 'MANUAL',
      disclaimer: MANUAL_DISCLAIMER,
      approvedAmounts,
      invoices: invoices.map((i) => this.listItem(i)),
      payouts: payouts.map((p) => this.moneyView(p, p.paidOn, p.invoice.number, actor)),
      totals,
    };
  }

  async companyOverview(actor: Actor): Promise<CompanyBillingOverview> {
    if (!actor.isCompany || !actor.companyId) throw forbidden();
    const invoices = await this.prisma.invoice.findMany({ where: this.scopeWhere(actor), include: invoiceInclude, orderBy: { dueDate: 'asc' } });
    const payments = await this.prisma.paymentRecord.findMany({
      where: { invoice: this.scopeWhere(actor) },
      include: { invoice: { select: { number: true } } },
      orderBy: { receivedOn: 'desc' },
    });
    const currencies = new Set(invoices.map((i) => i.currency));
    const totals = [...currencies].map((currency) => {
      const live = invoices.filter((i) => i.currency === currency && (i.status === 'SUBMITTED' || i.status === 'VERIFIED'));
      const invoiced = sumDecimals(live.map((i) => i.amountInclTax));
      const paid = sumDecimals(live.map((i) => i.paidAmount));
      const overdue = sumDecimals(live.filter((i) => this.overdue(i)).map((i) => this.outstanding(i)));
      return { currency, invoiced: moneyString(invoiced, currency), paid: moneyString(paid, currency), outstanding: moneyString(invoiced.minus(paid), currency), overdue: moneyString(overdue, currency) };
    });
    return {
      disclaimer: MANUAL_DISCLAIMER,
      invoices: invoices.map((i) => this.listItem(i)),
      payments: payments.map((p) => this.moneyView(p, p.receivedOn, p.invoice.number, actor)),
      totals,
    };
  }

  async updatePaymentConfiguration(actor: Actor, profileId: string, input: UpdatePaymentConfigInput): Promise<PaymentConfigurationView> {
    if (!actor.isAdmin) throw forbidden();
    if (input.method === 'PROVIDER' && this.providers.current().code === 'manual') {
      throw conflict('Aucun prestataire de paiement n’est configuré (décision D-11) : seul le règlement manuel est disponible.');
    }
    const config = await this.prisma.$transaction(async (tx) => {
      const before = await tx.paymentConfiguration.findUnique({ where: { profileId } });
      const saved = await tx.paymentConfiguration.upsert({
        where: { profileId },
        create: { profileId, method: input.method, status: input.status, note: input.note, confirmedById: actor.userId, confirmedAt: new Date() },
        update: { method: input.method, status: input.status, note: input.note, confirmedById: actor.userId, confirmedAt: new Date() },
      });
      await this.audit.record(tx, actor, {
        action: 'admin.payment_configuration.update',
        entityType: 'PaymentConfiguration',
        entityId: saved.id,
        reason: input.reason,
        metadata: { profileId, before: before ? { method: before.method, status: before.status } : null, after: { method: input.method, status: input.status } },
      });
      await this.notifications.notifyProfileOwner(tx, profileId, {
        type: 'payment_configuration.updated',
        title: 'Modalités de règlement mises à jour',
        body: 'E-MPGT a mis à jour vos modalités de règlement. Consultez la page Paiements.',
        link: '/freelance/paiements',
      });
      return saved;
    });
    return this.configurationView(config);
  }

  async getPaymentConfiguration(actor: Actor, profileId: string): Promise<PaymentConfigurationView> {
    if (!actor.isAdmin && !ownsProfile(actor, profileId)) throw notFound('Profil');
    return this.configurationView(await this.prisma.paymentConfiguration.findUnique({ where: { profileId } }));
  }

  /** Vue E-MPGT : commissions et flux par devise (CRA approuvés, factures, encaissements, règlements). */
  async adminOverview() {
    const [timesheets, invoices, payments, payouts] = await Promise.all([
      this.prisma.timesheet.findMany({ where: { status: 'APPROVED' }, select: { amountsSnapshot: true } }),
      this.prisma.invoice.findMany({ where: { status: { in: ['SUBMITTED', 'VERIFIED'] } } }),
      this.prisma.paymentRecord.findMany({ where: { status: 'RECORDED' } }),
      this.prisma.payoutRecord.findMany({ where: { status: 'RECORDED' } }),
    ]);
    const byCurrency = new Map<string, Record<string, Decimal>>();
    const bucket = (currency: string) => {
      if (!byCurrency.has(currency)) {
        byCurrency.set(currency, Object.fromEntries(['approvedClientTotal', 'approvedFreelanceNet', 'approvedCommission', 'approvedMargin', 'clientInvoiced', 'clientCollected', 'freelancerInvoiced', 'freelancerPaid', 'overdue'].map((k) => [k, new Decimal(0)])));
      }
      return byCurrency.get(currency)!;
    };
    for (const t of timesheets) {
      const s = t.amountsSnapshot as unknown as AmountsSnapshot | null;
      if (!s) continue;
      const b = bucket(s.currency);
      b.approvedClientTotal = b.approvedClientTotal!.plus(s.clientTotalExclTax);
      b.approvedFreelanceNet = b.approvedFreelanceNet!.plus(s.freelanceNetExclTax);
      b.approvedCommission = b.approvedCommission!.plus(s.commissionAmount);
      b.approvedMargin = b.approvedMargin!.plus(s.platformMarginExclTax);
    }
    for (const i of invoices) {
      const b = bucket(i.currency);
      if (collectsFromClient(i)) b.clientInvoiced = b.clientInvoiced!.plus(i.amountInclTax);
      else b.freelancerInvoiced = b.freelancerInvoiced!.plus(i.amountInclTax);
      if (this.overdue(i)) b.overdue = b.overdue!.plus(this.outstanding(i));
    }
    for (const p of payments) bucket(p.currency).clientCollected = bucket(p.currency).clientCollected!.plus(p.amount);
    for (const p of payouts) bucket(p.currency).freelancerPaid = bucket(p.currency).freelancerPaid!.plus(p.amount);
    return {
      disclaimer: MANUAL_DISCLAIMER,
      provider: this.providers.describe(),
      totals: [...byCurrency.entries()].map(([currency, values]) => ({
        currency,
        ...Object.fromEntries(Object.entries(values).map(([k, v]) => [k, moneyString(v, currency)])),
      })),
    };
  }
}
