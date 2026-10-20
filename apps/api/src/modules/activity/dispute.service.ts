import { Injectable } from '@nestjs/common';
import type { DisputeView, OpenDisputeInput, ResolveDisputeInput } from '@empgt/contracts';
import type { Prisma } from '../../generated/prisma/client.js';
import { check, visibleActions } from '../../common/actions.js';
import { toIso } from '../../common/dates.js';
import { conflict, forbidden, notFound } from '../../common/errors.js';
import { PrismaService } from '../../common/prisma.service.js';
import { fullName } from '../../common/text.js';
import { isCompanyMember, ownsProfile, type Actor } from '../auth/actor.js';
import { AuditService } from '../core/audit.service.js';
import { NotificationService } from '../core/notification.service.js';

const disputeInclude = { contract: { select: { reference: true, companyId: true, profileId: true } } } satisfies Prisma.DisputeInclude;

@Injectable()
export class DisputeService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly notifications: NotificationService,
  ) {}

  private async view(actor: Actor, d: Prisma.DisputeGetPayload<{ include: typeof disputeInclude }>): Promise<DisputeView> {
    const opener = await this.prisma.user.findUnique({ where: { id: d.openedById }, select: { firstName: true, lastName: true } });
    return {
      id: d.id,
      subjectType: d.subjectType,
      contractId: d.contractId,
      contractReference: d.contract.reference,
      timesheetId: d.timesheetId,
      invoiceId: d.invoiceId,
      openedByName: fullName(opener?.firstName, opener?.lastName),
      reason: d.reason,
      status: d.status,
      resolution: d.resolution,
      resolvedAt: toIso(d.resolvedAt),
      createdAt: toIso(d.createdAt),
      actions: actor.isAdmin ? visibleActions([check('resolve', [[d.status === 'OPEN', 'Litige déjà traité']])]) : [],
    };
  }

  async list(actor: Actor): Promise<DisputeView[]> {
    const where: Prisma.DisputeWhereInput = actor.isAdmin
      ? {}
      : { contract: { OR: [{ companyId: actor.companyId ?? '00000000-0000-0000-0000-000000000000' }, { profileId: actor.profileId ?? '00000000-0000-0000-0000-000000000000' }] } };
    const disputes = await this.prisma.dispute.findMany({ where, include: disputeInclude, orderBy: [{ status: 'asc' }, { createdAt: 'desc' }], take: 200 });
    return Promise.all(disputes.map((d) => this.view(actor, d)));
  }

  async open(actor: Actor, input: OpenDisputeInput): Promise<DisputeView> {
    const contract = await this.prisma.contract.findUnique({ where: { id: input.contractId } });
    if (!contract || (!actor.isAdmin && !isCompanyMember(actor, contract.companyId) && !ownsProfile(actor, contract.profileId))) {
      throw notFound('Contrat');
    }
    if (input.subjectType === 'TIMESHEET') {
      if (!input.timesheetId) throw conflict('Précisez le CRA concerné.');
      const ts = await this.prisma.timesheet.findFirst({ where: { id: input.timesheetId, contractId: contract.id } });
      if (!ts) throw notFound('CRA');
    }
    if (input.subjectType === 'INVOICE') {
      if (!input.invoiceId) throw conflict('Précisez la facture concernée.');
      const invoice = await this.prisma.invoice.findFirst({ where: { id: input.invoiceId, contractId: contract.id } });
      if (!invoice) throw notFound('Facture');
    }
    const dispute = await this.prisma.$transaction(async (tx) => {
      const created = await tx.dispute.create({
        data: {
          subjectType: input.subjectType,
          contractId: contract.id,
          timesheetId: input.subjectType === 'TIMESHEET' ? input.timesheetId : null,
          invoiceId: input.subjectType === 'INVOICE' ? input.invoiceId : null,
          openedById: actor.userId,
          reason: input.reason,
        },
      });
      await this.audit.record(tx, actor, { action: 'dispute.open', entityType: 'Dispute', entityId: created.id, reason: input.reason, metadata: { contractId: contract.id } });
      await this.notifications.notifyAdmins(tx, {
        type: 'dispute.opened',
        title: 'Litige ouvert',
        body: `Un litige a été ouvert sur le contrat ${contract.reference} : ${input.reason}`,
        link: '/admin/cra?tab=litiges',
        email: true,
      });
      return created;
    });
    return this.view(actor, await this.prisma.dispute.findUniqueOrThrow({ where: { id: dispute.id }, include: disputeInclude }));
  }

  async resolve(actor: Actor, id: string, input: ResolveDisputeInput): Promise<DisputeView> {
    if (!actor.isAdmin) throw forbidden();
    const dispute = await this.prisma.dispute.findUnique({ where: { id }, include: disputeInclude });
    if (!dispute) throw notFound('Litige');
    if (dispute.status !== 'OPEN') throw conflict('Litige déjà traité.');
    const updated = await this.prisma.$transaction(async (tx) => {
      const result = await tx.dispute.update({
        where: { id },
        data: { status: input.close ? 'CLOSED' : 'RESOLVED', resolution: input.resolution, resolvedById: actor.userId, resolvedAt: new Date() },
      });
      await this.audit.record(tx, actor, { action: 'admin.dispute.resolve', entityType: 'Dispute', entityId: id, reason: input.resolution });
      const body = `Le litige sur le contrat ${dispute.contract.reference} a été traité par E-MPGT : ${input.resolution}`;
      await this.notifications.notifyCompany(tx, dispute.contract.companyId, { type: 'dispute.resolved', title: 'Litige traité', body, link: `/entreprise/contrats/${dispute.contractId}` });
      await this.notifications.notifyProfileOwner(tx, dispute.contract.profileId, { type: 'dispute.resolved', title: 'Litige traité', body, link: `/freelance/contrats/${dispute.contractId}` });
      return result;
    });
    return this.view(actor, await this.prisma.dispute.findUniqueOrThrow({ where: { id: updated.id }, include: disputeInclude }));
  }
}
