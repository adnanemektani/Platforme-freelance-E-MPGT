import { Injectable } from '@nestjs/common';
import type {
  ActionState,
  CreateTimesheetInput,
  Page,
  PendingItem,
  TimesheetCheck,
  TimesheetEntriesInput,
  TimesheetListItem,
  TimesheetListQuery,
  TimesheetView,
} from '@empgt/contracts';
import type { Contract, ContractAmendment, Prisma } from '../../generated/prisma/client.js';
import { assertAllowed, check, deny, NOT_FOR_ROLE, visibleActions } from '../../common/actions.js';
import { endOfMonth, maxDate, minDate, monthLabel, parseIsoDate, today, toIso, toIsoDate } from '../../common/dates.js';
import { conflict, forbidden, notFound } from '../../common/errors.js';
import { dec, Decimal, sumDecimals } from '../../common/money.js';
import { pageArgs, toPage } from '../../common/pagination.js';
import { PrismaService, type Db } from '../../common/prisma.service.js';
import { fullName } from '../../common/text.js';
import { isCompanyMember, ownsProfile, type Actor } from '../auth/actor.js';
import { effectiveEndDate, effectiveTermsAt } from '../commercial/terms.js';
import { AuditService } from '../core/audit.service.js';
import { NotificationService } from '../core/notification.service.js';
import {
  amountsSnapshot,
  completeTerms,
  computeFromQuantity,
  PricingError,
  quantityFromHours,
  snapshotToAmounts,
  toBreakdown,
  type Amounts,
  type AmountsSnapshot,
  type Audience,
} from '../finance/calc.js';

const timesheetInclude = {
  entries: { orderBy: { date: 'asc' } },
  contract: {
    include: {
      mission: { select: { title: true } },
      company: { select: { legalName: true } },
      profile: { include: { user: { select: { id: true, firstName: true, lastName: true } } } },
      amendments: true,
    },
  },
  correction: { select: { id: true } },
} satisfies Prisma.TimesheetInclude;

type TimesheetFull = Prisma.TimesheetGetPayload<{ include: typeof timesheetInclude }>;

const MAX_HOURS_PER_DAY = new Decimal(24);

/**
 * Montants d'un CRA : les lignes sont regroupées par conditions applicables (contrat puis avenants
 * signés), chaque groupe est calculé et arrondi, puis les groupes sont additionnés.
 */
export function computeTimesheetAmounts(
  entries: Array<{ date: Date; hours: Decimal | string | { toString(): string } }>,
  contract: Contract,
  amendments: ContractAmendment[],
): Amounts {
  const groups = new Map<string, { terms: ReturnType<typeof effectiveTermsAt>; hours: Decimal }>();
  for (const entry of entries) {
    const terms = effectiveTermsAt(contract, amendments, entry.date);
    const group = groups.get(terms.key) ?? { terms, hours: new Decimal(0) };
    group.hours = group.hours.plus(dec(entry.hours));
    groups.set(terms.key, group);
  }
  const parts = [...groups.values()].map(({ terms, hours }) => {
    const complete = completeTerms(terms);
    return computeFromQuantity(quantityFromHours(hours, complete), complete, hours);
  });
  if (parts.length === 0) {
    const complete = completeTerms(effectiveTermsAt(contract, amendments, contract.startDate));
    return computeFromQuantity(0, complete, 0);
  }
  const sum = (key: keyof Amounts) => sumDecimals(parts.map((p) => p[key] as Decimal));
  return {
    ...parts[0]!,
    hours: sum('hours'),
    quantity: sum('quantity'),
    clientServiceAmount: sum('clientServiceAmount'),
    freelanceGrossAmount: sum('freelanceGrossAmount'),
    commissionAmount: sum('commissionAmount'),
    clientTotalExclTax: sum('clientTotalExclTax'),
    freelanceNetExclTax: sum('freelanceNetExclTax'),
    platformMarginExclTax: sum('platformMarginExclTax'),
    unexplainedSpread: sum('unexplainedSpread'),
  };
}

@Injectable()
export class TimesheetService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly notifications: NotificationService,
  ) {}

  private async load(id: string, db: Db = this.prisma): Promise<TimesheetFull> {
    const ts = await db.timesheet.findUnique({ where: { id }, include: timesheetInclude });
    if (!ts) throw notFound('CRA');
    return ts;
  }

  private audience(actor: Actor, ts: TimesheetFull): Audience {
    if (actor.isAdmin) return 'admin';
    if (isCompanyMember(actor, ts.contract.companyId)) {
      // Les brouillons restent privés au freelance tant qu'ils ne sont pas soumis.
      if (ts.status === 'DRAFT' && ts.version === 1) throw notFound('CRA');
      return 'company';
    }
    if (ownsProfile(actor, ts.contract.profileId)) return 'freelancer';
    throw notFound('CRA');
  }

  /** Bornes de saisie : intersection du mois et de la période effective du contrat. */
  private allowedRange(ts: { periodStart: Date; periodEnd: Date }, contract: Contract, amendments: ContractAmendment[]) {
    const end = effectiveEndDate(contract, amendments);
    const from = maxDate(ts.periodStart, contract.startDate);
    const to = end ? minDate(ts.periodEnd, end) : ts.periodEnd;
    return from <= to ? { from, to } : null;
  }

  /** Contrôles de cohérence : hors période, hors contrat, cumul quotidien multi-contrats > 24 h. */
  async checks(
    db: Db,
    ts: Pick<TimesheetFull, 'id' | 'periodStart' | 'periodEnd' | 'supersedesId'> & { contract: Contract & { amendments: ContractAmendment[] } },
    entries: Array<{ date: Date; hours: Decimal }>,
  ): Promise<TimesheetCheck[]> {
    const result: TimesheetCheck[] = [];
    const range = this.allowedRange(ts, ts.contract, ts.contract.amendments);
    const seen = new Set<string>();
    for (const entry of entries) {
      const iso = toIsoDate(entry.date);
      if (seen.has(iso)) result.push({ level: 'error', code: 'duplicate_date', message: `Date saisie deux fois : ${iso}`, date: iso });
      seen.add(iso);
      if (entry.date < ts.periodStart || entry.date > ts.periodEnd) {
        result.push({ level: 'error', code: 'outside_period', message: `${iso} est hors de la période du CRA`, date: iso });
      } else if (!range || entry.date < range.from || entry.date > range.to) {
        result.push({ level: 'error', code: 'outside_contract', message: `${iso} est hors de la période du contrat`, date: iso });
      }
      if (entry.date > today()) result.push({ level: 'error', code: 'future_date', message: `${iso} est dans le futur`, date: iso });
      if (entry.hours.lte(0) || entry.hours.gt(MAX_HOURS_PER_DAY)) {
        result.push({ level: 'error', code: 'invalid_hours', message: `Nombre d'heures invalide le ${iso}`, date: iso });
      }
      if (ts.contract.billingUnit === 'DAY' && ts.contract.hoursPerDay && entry.hours.gt(dec(ts.contract.hoursPerDay))) {
        result.push({
          level: 'warning',
          code: 'above_reference_day',
          message: `Le ${iso} dépasse la journée de référence du contrat (${dec(ts.contract.hoursPerDay).toFixed()} h) : vérifiez la saisie`,
          date: iso,
        });
      }
    }
    if (entries.length) {
      // Cumul avec les autres contrats du même freelance (CRA non annulés ni remplacés).
      const others = await db.timesheetEntry.findMany({
        where: {
          date: { in: entries.map((e) => e.date) },
          timesheet: {
            id: { notIn: [ts.id, ...(ts.supersedesId ? [ts.supersedesId] : [])] },
            status: { notIn: ['CANCELLED', 'SUPERSEDED'] },
            contract: { profileId: ts.contract.profileId },
            // Une version corrigée en cours remplace la version approuvée du même contrat.
            NOT: { contractId: ts.contract.id, periodStart: ts.periodStart },
          },
        },
        select: { date: true, hours: true },
      });
      const byDay = new Map<string, Decimal>();
      for (const e of others) byDay.set(toIsoDate(e.date), (byDay.get(toIsoDate(e.date)) ?? new Decimal(0)).plus(dec(e.hours)));
      for (const entry of entries) {
        const iso = toIsoDate(entry.date);
        const total = (byDay.get(iso) ?? new Decimal(0)).plus(entry.hours);
        if (total.gt(MAX_HOURS_PER_DAY)) {
          result.push({ level: 'error', code: 'daily_total', message: `Le ${iso}, le cumul de vos CRA dépasse 24 h (${total.toFixed(2)} h)`, date: iso });
        }
      }
    }
    return result;
  }

  actions(actor: Actor, ts: TimesheetFull, hasInvoice: boolean): ActionState[] {
    const contractOpen = ['ACTIVE', 'SUSPENDED', 'COMPLETED', 'TERMINATED'].includes(ts.contract.status);
    if (ownsProfile(actor, ts.contract.profileId)) {
      const editable = ts.status === 'DRAFT' || ts.status === 'CHANGES_REQUESTED';
      return [
        check('edit', [[editable, ts.status === 'SUBMITTED' ? 'CRA soumis : en attente de validation' : 'CRA figé']]),
        check('submit', [
          [editable, 'CRA déjà soumis ou figé'],
          [ts.entries.length > 0, 'Saisissez au moins une journée'],
        ]),
        check('delete', [[ts.status === 'DRAFT', 'Seul un brouillon peut être supprimé']]),
        check('correct', [
          [ts.status === 'APPROVED', 'Seul un CRA validé peut faire l’objet d’une correction'],
          [!ts.correction, 'Une correction est déjà en cours'],
          [!hasInvoice, 'Une facture est rattachée à ce CRA : contactez E-MPGT'],
          [contractOpen, 'Contrat non démarré'],
        ]),
      ];
    }
    const company = isCompanyMember(actor, ts.contract.companyId);
    if (company || actor.isAdmin) {
      return [
        check('approve', [[ts.status === 'SUBMITTED', 'Seul un CRA soumis peut être validé']]),
        check('requestChanges', [[ts.status === 'SUBMITTED', 'Seul un CRA soumis peut être renvoyé en correction']]),
        ...(actor.isAdmin
          ? [
              check('correct', [
                [ts.status === 'APPROVED', 'Seul un CRA validé peut faire l’objet d’une correction'],
                [!ts.correction, 'Une correction est déjà en cours'],
                [!hasInvoice, 'Une facture est rattachée à ce CRA : annulez-la d’abord'],
              ]),
            ]
          : []),
      ];
    }
    return [deny('edit', NOT_FOR_ROLE)];
  }

  private pending(actor: Actor, ts: TimesheetFull): PendingItem[] {
    const own = ownsProfile(actor, ts.contract.profileId);
    if (ts.status === 'DRAFT') return own ? [{ code: 'timesheet.draft', title: 'CRA à compléter', description: 'Saisissez vos heures puis soumettez le CRA à validation.', severity: 'action' }] : [];
    if (ts.status === 'CHANGES_REQUESTED') {
      return [{ code: 'timesheet.changes_requested', title: 'Correction demandée', description: ts.changesRequestedReason ?? '', severity: own ? 'action' : 'info' }];
    }
    if (ts.status === 'SUBMITTED') {
      return own
        ? [{ code: 'timesheet.submitted', title: 'En attente de validation', description: "L'entreprise doit valider votre CRA.", severity: 'info' }]
        : [{ code: 'timesheet.to_validate', title: 'CRA à valider', description: 'Validez le CRA ou demandez une correction motivée.', severity: 'action' }];
    }
    if (ts.status === 'APPROVED') {
      return [{ code: 'timesheet.approved', title: 'CRA validé', description: 'Un CRA validé ne constitue pas un paiement : la facturation et les règlements sont suivis séparément.', severity: 'info' }];
    }
    return [];
  }

  private amounts(ts: TimesheetFull, audience: Audience) {
    try {
      const amounts =
        ts.status === 'APPROVED' || ts.status === 'SUPERSEDED'
          ? ts.amountsSnapshot
            ? snapshotToAmounts(ts.amountsSnapshot as unknown as AmountsSnapshot)
            : null
          : computeTimesheetAmounts(ts.entries, ts.contract, ts.contract.amendments);
      return amounts ? toBreakdown(amounts, audience, ts.contract) : null;
    } catch (error) {
      if (error instanceof PricingError) return null;
      throw error;
    }
  }

  async toView(actor: Actor, ts: TimesheetFull): Promise<TimesheetView> {
    const audience = this.audience(actor, ts);
    const range = this.allowedRange(ts, ts.contract, ts.contract.amendments);
    const hasInvoice = (await this.prisma.invoice.count({ where: { timesheetId: ts.id, status: { in: ['SUBMITTED', 'VERIFIED'] } } })) > 0;
    const checks = ['DRAFT', 'CHANGES_REQUESTED'].includes(ts.status)
      ? await this.checks(this.prisma, ts, ts.entries.map((e) => ({ date: e.date, hours: dec(e.hours) })))
      : [];
    return {
      id: ts.id,
      contractId: ts.contractId,
      contractReference: ts.contract.reference,
      missionTitle: ts.contract.mission.title,
      companyName: ts.contract.company.legalName,
      freelancerName: fullName(ts.contract.profile.user?.firstName, ts.contract.profile.user?.lastName),
      periodStart: toIsoDate(ts.periodStart),
      periodEnd: toIsoDate(ts.periodEnd),
      version: ts.version,
      supersedesId: ts.supersedesId,
      correctedById: ts.correction?.id ?? null,
      status: ts.status,
      totalHours: dec(ts.totalHours).toFixed(2),
      freelancerComment: ts.freelancerComment,
      submittedAt: toIso(ts.submittedAt),
      approvedAt: toIso(ts.approvedAt),
      approvedOnBehalf: ts.approvedOnBehalf,
      approvalReason: ts.approvalReason,
      changesRequestedAt: toIso(ts.changesRequestedAt),
      changesRequestedReason: ts.changesRequestedReason,
      correctionReason: ts.correctionReason,
      entries: ts.entries.map((e) => ({ id: e.id, date: toIsoDate(e.date), hours: dec(e.hours).toFixed(2), comment: e.comment })),
      allowedRange: range ? { from: toIsoDate(range.from), to: toIsoDate(range.to) } : null,
      checks,
      amounts: this.amounts(ts, audience),
      createdAt: toIso(ts.createdAt),
      updatedAt: toIso(ts.updatedAt),
      actions: visibleActions(this.actions(actor, ts, hasInvoice)),
      pending: this.pending(actor, ts),
    };
  }

  async get(actor: Actor, id: string): Promise<TimesheetView> {
    return this.toView(actor, await this.load(id));
  }

  async list(actor: Actor, query: TimesheetListQuery): Promise<Page<TimesheetListItem>> {
    const scope: Prisma.TimesheetWhereInput = actor.isAdmin
      ? {}
      : actor.isCompany && actor.companyId
        ? { contract: { companyId: actor.companyId }, NOT: { status: 'DRAFT', version: 1 } }
        : actor.isFreelancer && actor.profileId
          ? { contract: { profileId: actor.profileId } }
          : { id: '00000000-0000-0000-0000-000000000000' };
    const where: Prisma.TimesheetWhereInput = {
      AND: [scope, query.contractId ? { contractId: query.contractId } : {}, query.status ? { status: query.status } : {}],
    };
    const [items, total] = await Promise.all([
      this.prisma.timesheet.findMany({
        where,
        ...pageArgs(query),
        orderBy: [{ periodStart: 'desc' }, { version: 'desc' }],
        include: { contract: { include: { mission: { select: { title: true } }, company: { select: { legalName: true } }, profile: { include: { user: { select: { firstName: true, lastName: true } } } } } } },
      }),
      this.prisma.timesheet.count({ where }),
    ]);
    return toPage(
      items.map((t) => ({
        id: t.id,
        contractId: t.contractId,
        contractReference: t.contract.reference,
        missionTitle: t.contract.mission.title,
        companyName: t.contract.company.legalName,
        freelancerName: fullName(t.contract.profile.user?.firstName, t.contract.profile.user?.lastName),
        periodStart: toIsoDate(t.periodStart),
        version: t.version,
        status: t.status,
        totalHours: dec(t.totalHours).toFixed(2),
        submittedAt: toIso(t.submittedAt),
        updatedAt: toIso(t.updatedAt),
      })),
      total,
      query,
    );
  }

  // ── Saisie (freelance) ────────────────────────────────────────────────────

  async create(actor: Actor, contractId: string, input: CreateTimesheetInput): Promise<TimesheetView> {
    const contract = await this.prisma.contract.findUnique({ where: { id: contractId }, include: { amendments: true } });
    if (!contract || !ownsProfile(actor, contract.profileId)) throw notFound('Contrat');
    if (contract.status !== 'ACTIVE') {
      throw conflict(contract.status === 'SUSPENDED' ? 'Mission suspendue : saisie impossible.' : 'La saisie des CRA est ouverte une fois la mission active.');
    }
    const periodStart = parseIsoDate(input.periodStart);
    const periodEnd = endOfMonth(periodStart);
    if (periodStart > today()) throw conflict('Impossible de créer un CRA pour un mois futur.');
    if (!this.allowedRange({ periodStart, periodEnd }, contract, contract.amendments)) throw conflict('Ce mois est hors de la période du contrat.');
    const existing = await this.prisma.timesheet.findFirst({
      where: { contractId, periodStart, status: { notIn: ['CANCELLED', 'SUPERSEDED'] } },
      orderBy: { version: 'desc' },
    });
    if (existing) {
      throw conflict(existing.status === 'APPROVED' ? 'Un CRA validé existe pour ce mois : demandez une correction.' : 'Un CRA existe déjà pour ce mois.');
    }
    const id = await this.prisma.$transaction(async (tx) => {
      const ts = await tx.timesheet.create({ data: { contractId, periodStart, periodEnd } });
      await this.audit.record(tx, actor, { action: 'timesheet.create', entityType: 'Timesheet', entityId: ts.id, metadata: { contractId, period: input.periodStart } });
      return ts.id;
    });
    return this.get(actor, id);
  }

  async saveEntries(actor: Actor, id: string, input: TimesheetEntriesInput): Promise<TimesheetView> {
    const ts = await this.load(id);
    this.audience(actor, ts);
    assertAllowed(this.actions(actor, ts, false), 'edit');
    const entries = input.entries.map((e) => ({ date: parseIsoDate(e.date), hours: dec(e.hours), comment: e.comment }));
    const errors = (await this.checks(this.prisma, ts, entries)).filter((c) => c.level === 'error');
    if (errors.length) throw conflict(errors.map((e) => e.message).join(' ; '));
    await this.prisma.$transaction(async (tx) => {
      await tx.timesheetEntry.deleteMany({ where: { timesheetId: id } });
      await tx.timesheetEntry.createMany({
        data: entries.map((e) => ({ timesheetId: id, date: e.date, hours: e.hours.toFixed(2), comment: e.comment })),
      });
      await tx.timesheet.update({
        where: { id },
        data: { totalHours: sumDecimals(entries.map((e) => e.hours)).toFixed(2), freelancerComment: input.freelancerComment },
      });
      await this.audit.record(tx, actor, { action: 'timesheet.save_entries', entityType: 'Timesheet', entityId: id, metadata: { entries: entries.length } });
    });
    return this.get(actor, id);
  }

  async remove(actor: Actor, id: string): Promise<void> {
    const ts = await this.load(id);
    this.audience(actor, ts);
    assertAllowed(this.actions(actor, ts, false), 'delete');
    await this.prisma.$transaction(async (tx) => {
      await tx.timesheet.delete({ where: { id } });
      await this.audit.record(tx, actor, { action: 'timesheet.delete_draft', entityType: 'Timesheet', entityId: id });
    });
  }

  async submit(actor: Actor, id: string): Promise<TimesheetView> {
    const ts = await this.load(id);
    this.audience(actor, ts);
    assertAllowed(this.actions(actor, ts, false), 'submit');
    const errors = (await this.checks(this.prisma, ts, ts.entries.map((e) => ({ date: e.date, hours: dec(e.hours) })))).filter((c) => c.level === 'error');
    if (errors.length) throw conflict(errors.map((e) => e.message).join(' ; '));
    await this.prisma.$transaction(async (tx) => {
      const updated = await tx.timesheet.updateMany({
        where: { id, status: { in: ['DRAFT', 'CHANGES_REQUESTED'] } },
        data: { status: 'SUBMITTED', submittedAt: new Date(), submittedById: actor.userId },
      });
      if (updated.count !== 1) throw conflict('CRA déjà soumis.');
      await this.audit.record(tx, actor, { action: 'timesheet.submit', entityType: 'Timesheet', entityId: id, metadata: { totalHours: ts.totalHours.toString() } });
      await this.notifications.notifyCompany(tx, ts.contract.companyId, {
        type: 'timesheet.submitted',
        title: 'CRA à valider',
        body: `Le CRA de ${monthLabel(ts.periodStart)} (contrat ${ts.contract.reference}, ${dec(ts.totalHours).toFixed(2)} h) attend votre validation.`,
        link: `/entreprise/cra/${id}`,
        email: true,
      });
    });
    return this.get(actor, id);
  }

  // ── Validation (entreprise, ou E-MPGT avec motif) ─────────────────────────

  async approve(actor: Actor, id: string, reason: string | null): Promise<TimesheetView> {
    const ts = await this.load(id);
    this.audience(actor, ts);
    assertAllowed(this.actions(actor, ts, false), 'approve');
    const onBehalf = actor.isAdmin;
    if (onBehalf && !reason) throw conflict('Motif obligatoire : E-MPGT valide à la place de l’entreprise cliente.');
    let snapshot: AmountsSnapshot;
    try {
      snapshot = amountsSnapshot(computeTimesheetAmounts(ts.entries, ts.contract, ts.contract.amendments));
    } catch (error) {
      if (error instanceof PricingError) throw conflict(`Calcul impossible : ${error.message}`);
      throw error;
    }
    await this.prisma.serializable(async (tx) => {
      if (ts.supersedesId) {
        // La version précédente est conservée, marquée « remplacée » (correction tracée).
        await tx.timesheet.update({ where: { id: ts.supersedesId }, data: { status: 'SUPERSEDED' } });
      }
      const updated = await tx.timesheet.updateMany({
        where: { id, status: 'SUBMITTED' },
        data: {
          status: 'APPROVED',
          approvedAt: new Date(),
          approvedById: actor.userId,
          approvedOnBehalf: onBehalf,
          approvalReason: reason,
          amountsSnapshot: snapshot as unknown as Prisma.InputJsonValue,
        },
      });
      if (updated.count !== 1) throw conflict('Ce CRA a déjà été traité.');
      await this.audit.record(tx, actor, {
        action: onBehalf ? 'admin.timesheet.approve_on_behalf' : 'timesheet.approve',
        entityType: 'Timesheet',
        entityId: id,
        reason,
        metadata: { hours: snapshot.hours, supersedes: ts.supersedesId, onBehalfOfCompany: onBehalf },
      });
      const body = `Votre CRA de ${monthLabel(ts.periodStart)} (contrat ${ts.contract.reference}) a été validé${onBehalf ? ' par E-MPGT' : ''}.`;
      await this.notifications.notifyProfileOwner(tx, ts.contract.profileId, { type: 'timesheet.approved', title: 'CRA validé', body, link: `/freelance/cra/${id}`, email: true });
      if (onBehalf) {
        await this.notifications.notifyCompany(tx, ts.contract.companyId, {
          type: 'timesheet.approved_on_behalf',
          title: 'CRA validé par E-MPGT',
          body: `E-MPGT a validé le CRA de ${monthLabel(ts.periodStart)} à votre place. Motif : ${reason}`,
          link: `/entreprise/cra/${id}`,
          email: true,
        });
      }
      await this.notifications.notifyAdmins(tx, { type: 'timesheet.approved', title: 'CRA validé', body: `CRA ${ts.contract.reference} — ${monthLabel(ts.periodStart)} validé.`, link: `/admin/cra/${id}` });
    });
    return this.get(actor, id);
  }

  async requestChanges(actor: Actor, id: string, reason: string): Promise<TimesheetView> {
    const ts = await this.load(id);
    this.audience(actor, ts);
    assertAllowed(this.actions(actor, ts, false), 'requestChanges');
    await this.prisma.$transaction(async (tx) => {
      await tx.timesheet.update({
        where: { id },
        data: { status: 'CHANGES_REQUESTED', changesRequestedAt: new Date(), changesRequestedById: actor.userId, changesRequestedReason: reason },
      });
      await this.audit.record(tx, actor, { action: actor.isAdmin ? 'admin.timesheet.request_changes' : 'timesheet.request_changes', entityType: 'Timesheet', entityId: id, reason });
      await this.notifications.notifyProfileOwner(tx, ts.contract.profileId, {
        type: 'timesheet.changes_requested',
        title: 'Correction de CRA demandée',
        body: `Une correction est demandée sur votre CRA de ${monthLabel(ts.periodStart)} : ${reason}`,
        link: `/freelance/cra/${id}`,
        email: true,
      });
    });
    return this.get(actor, id);
  }

  /** Correction d'un CRA approuvé : nouvelle version à valider, l'ancienne reste consultable. */
  async correct(actor: Actor, id: string, reason: string): Promise<TimesheetView> {
    const ts = await this.load(id);
    this.audience(actor, ts);
    const hasInvoice = (await this.prisma.invoice.count({ where: { timesheetId: id, status: { in: ['SUBMITTED', 'VERIFIED'] } } })) > 0;
    assertAllowed(this.actions(actor, ts, hasInvoice), 'correct');
    const newId = await this.prisma.$transaction(async (tx) => {
      const next = await tx.timesheet.create({
        data: {
          contractId: ts.contractId,
          periodStart: ts.periodStart,
          periodEnd: ts.periodEnd,
          version: ts.version + 1,
          supersedesId: ts.id,
          correctionReason: reason,
          totalHours: ts.totalHours,
          freelancerComment: ts.freelancerComment,
        },
      });
      await tx.timesheetEntry.createMany({
        data: ts.entries.map((e) => ({ timesheetId: next.id, date: e.date, hours: e.hours, comment: e.comment })),
      });
      await this.audit.record(tx, actor, { action: actor.isAdmin ? 'admin.timesheet.correct' : 'timesheet.correct', entityType: 'Timesheet', entityId: next.id, reason, metadata: { supersedes: id } });
      await this.notifications.notifyCompany(tx, ts.contract.companyId, {
        type: 'timesheet.correction_started',
        title: 'Correction de CRA en cours',
        body: `Une correction du CRA de ${monthLabel(ts.periodStart)} (contrat ${ts.contract.reference}) a été ouverte : ${reason}. La version validée reste en vigueur jusqu'à validation de la correction.`,
        link: `/entreprise/cra/${id}`,
      });
      await this.notifications.notifyAdmins(tx, { type: 'timesheet.correction_started', title: 'Correction de CRA', body: `Correction ouverte sur ${ts.contract.reference} : ${reason}`, link: `/admin/cra/${next.id}` });
      return next.id;
    });
    return this.get(actor, newId);
  }

  /** Pour la création de CRA par le freelance depuis la page contrat. */
  assertFreelancer(actor: Actor): void {
    if (!actor.isFreelancer) throw forbidden();
  }
}
