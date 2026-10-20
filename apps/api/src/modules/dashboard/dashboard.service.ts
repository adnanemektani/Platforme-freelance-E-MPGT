import { Injectable } from '@nestjs/common';
import type { AdminOverview, CompanyOverview, FreelancerOverview, NotificationView, Page, PageQuery, PendingItem } from '@empgt/contracts';
import { addDays, endOfMonth, toIso, today } from '../../common/dates.js';
import { forbidden, notFound } from '../../common/errors.js';
import { pageArgs, toPage } from '../../common/pagination.js';
import { PrismaService } from '../../common/prisma.service.js';
import type { Actor } from '../auth/actor.js';
import { companyPending } from '../companies/company.policy.js';
import { VISIBLE_TO_FREELANCERS } from '../missions/mission.policy.js';
import { profilePending } from '../profiles/profile.policy.js';

@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService) {}

  async company(actor: Actor): Promise<CompanyOverview> {
    if (!actor.isCompany || !actor.companyId) throw forbidden();
    const companyId = actor.companyId;
    const company = await this.prisma.company.findUniqueOrThrow({ where: { id: companyId } });
    const [draftMissions, missionsInReview, publishedMissions, applicationsToReview, proposalsToAnswer, activeContracts, timesheetsToValidate, unpaidInvoices, contractsToSign] =
      await Promise.all([
        this.prisma.mission.count({ where: { companyId, publicationStatus: { in: ['DRAFT', 'CHANGES_REQUESTED'] }, status: 'OPEN' } }),
        this.prisma.mission.count({ where: { companyId, publicationStatus: 'PENDING_REVIEW' } }),
        this.prisma.mission.count({ where: { companyId, publicationStatus: 'PUBLISHED', status: 'OPEN' } }),
        this.prisma.application.count({ where: { mission: { companyId, status: 'OPEN' }, status: { in: ['SUBMITTED', 'SHORTLISTED'] } } }),
        this.prisma.commercialProposal.count({ where: { companyId, status: 'SENT', companyDecision: 'PENDING' } }),
        this.prisma.contract.count({ where: { companyId, status: 'ACTIVE' } }),
        this.prisma.timesheet.count({ where: { status: 'SUBMITTED', contract: { companyId } } }),
        this.prisma.invoice.count({ where: { companyId, OR: [{ kind: 'CLIENT_INVOICE' }, { addressee: 'CLIENT' }], status: 'VERIFIED', paymentState: { not: 'PAID' } } }),
        this.prisma.contract.count({ where: { companyId, status: 'AWAITING_SIGNATURE' } }),
      ]);
    const pending: PendingItem[] = [...companyPending(company)];
    if (draftMissions) pending.push({ code: 'missions.drafts', title: `${draftMissions} mission(s) en préparation`, description: 'Complétez et soumettez vos missions à E-MPGT.', severity: 'action', link: '/entreprise/missions' });
    if (applicationsToReview) pending.push({ code: 'applications.to_review', title: `${applicationsToReview} candidature(s) à examiner`, description: 'Présélectionnez, retenez ou déclinez les candidats.', severity: 'action', link: '/entreprise/candidatures' });
    if (proposalsToAnswer) pending.push({ code: 'proposals.to_answer', title: `${proposalsToAnswer} proposition(s) commerciale(s) à examiner`, description: 'Acceptez ou déclinez les propositions reçues.', severity: 'action', link: '/entreprise/propositions' });
    if (contractsToSign) pending.push({ code: 'contracts.to_sign', title: `${contractsToSign} contrat(s) en attente de signature`, description: 'Signez le contrat transmis par E-MPGT ; la mission démarrera après dépôt du contrat signé.', severity: 'info', link: '/entreprise/contrats' });
    if (timesheetsToValidate) pending.push({ code: 'timesheets.to_validate', title: `${timesheetsToValidate} CRA à valider`, description: 'Validez les CRA ou demandez une correction motivée.', severity: 'action', link: '/entreprise/cra' });
    return {
      companyName: company.legalName,
      pending,
      counts: { draftMissions, missionsInReview, publishedMissions, applicationsToReview, proposalsToAnswer, activeContracts, timesheetsToValidate, unpaidInvoices },
    };
  }

  async freelancer(actor: Actor): Promise<FreelancerOverview> {
    if (!actor.isFreelancer || !actor.profileId) throw forbidden();
    const profileId = actor.profileId;
    const profile = await this.prisma.freelancerProfile.findUniqueOrThrow({
      where: { id: profileId },
      include: { _count: { select: { skills: true, experiences: true } } },
    });
    const month = new Date(Date.UTC(today().getUTCFullYear(), today().getUTCMonth(), 1));
    const [openMissions, activeApplications, proposalsToAnswer, activeContractsList, timesheetsChangesRequested, unpaidInvoices, timesheetsDraft] = await Promise.all([
      this.prisma.mission.count({ where: VISIBLE_TO_FREELANCERS }),
      this.prisma.application.count({ where: { profileId, status: { in: ['SUBMITTED', 'SHORTLISTED', 'SELECTED'] } } }),
      this.prisma.commercialProposal.count({ where: { profileId, status: 'SENT', freelancerDecision: 'PENDING' } }),
      this.prisma.contract.findMany({ where: { profileId, status: 'ACTIVE' }, select: { id: true, reference: true, timesheets: { where: { periodStart: month }, select: { id: true } } } }),
      this.prisma.timesheet.count({ where: { status: 'CHANGES_REQUESTED', contract: { profileId } } }),
      this.prisma.invoice.count({ where: { profileId, kind: 'FREELANCER_INVOICE', status: 'VERIFIED', paymentState: { not: 'PAID' } } }),
      this.prisma.timesheet.count({ where: { status: 'DRAFT', contract: { profileId } } }),
    ]);
    const pending: PendingItem[] = [...profilePending(profile, { skills: profile._count.skills, experiences: profile._count.experiences })];
    if (proposalsToAnswer) pending.push({ code: 'proposals.to_answer', title: `${proposalsToAnswer} proposition(s) à examiner`, description: 'Acceptez ou déclinez les propositions commerciales reçues.', severity: 'action', link: '/freelance/propositions' });
    if (timesheetsChangesRequested) pending.push({ code: 'timesheets.changes_requested', title: `${timesheetsChangesRequested} CRA à corriger`, description: 'Une correction a été demandée sur vos CRA.', severity: 'action', link: '/freelance/cra' });
    const missingThisMonth = activeContractsList.filter((c) => c.timesheets.length === 0);
    if (missingThisMonth.length) {
      pending.push({
        code: 'timesheets.month_missing',
        title: 'CRA du mois à ouvrir',
        description: `Ouvrez le CRA du mois en cours pour : ${missingThisMonth.map((c) => c.reference).join(', ')} (fin de période le ${toIso(endOfMonth(month)).slice(0, 10)}).`,
        severity: 'action',
        link: '/freelance/cra',
      });
    }
    return {
      headline: profile.headline,
      pending,
      counts: {
        openMissions: profile.validationStatus === 'APPROVED' || profile.validationStatus === 'SUBMITTED' ? openMissions : openMissions,
        activeApplications,
        proposalsToAnswer,
        activeContracts: activeContractsList.length,
        timesheetsToComplete: timesheetsDraft + missingThisMonth.length,
        timesheetsChangesRequested,
        unpaidInvoices,
      },
    };
  }

  async admin(actor: Actor): Promise<AdminOverview> {
    if (!actor.isAdmin) throw forbidden();
    const soon = addDays(today(), 30);
    const [
      usersPendingVerification, companiesToVerify, profilesToReview, missionsToReview, applicationsActive, proposalsAwaitingApproval,
      contractsAwaitingSignature, contractsActive, timesheetsSubmitted, disputesOpen, documentsToVerify, documentsExpiringSoon,
      invoicesToVerify, invoicesOverdue, importItemsToReview, contactRequestsNew,
    ] = await Promise.all([
      this.prisma.user.count({ where: { status: 'PENDING_VERIFICATION' } }),
      this.prisma.company.count({ where: { verificationStatus: 'PENDING' } }),
      this.prisma.freelancerProfile.count({ where: { validationStatus: 'SUBMITTED' } }),
      this.prisma.mission.count({ where: { publicationStatus: 'PENDING_REVIEW' } }),
      this.prisma.application.count({ where: { status: { in: ['SUBMITTED', 'SHORTLISTED', 'SELECTED'] } } }),
      this.prisma.commercialProposal.count({ where: { status: 'PARTIES_AGREED' } }),
      this.prisma.contract.count({ where: { status: { in: ['AWAITING_SIGNATURE', 'SIGNED'] } } }),
      this.prisma.contract.count({ where: { status: 'ACTIVE' } }),
      this.prisma.timesheet.count({ where: { status: 'SUBMITTED' } }),
      this.prisma.dispute.count({ where: { status: 'OPEN' } }),
      this.prisma.document.count({ where: { verificationStatus: 'PENDING', deletedAt: null } }),
      this.prisma.document.count({ where: { expiresAt: { not: null, lte: soon }, deletedAt: null } }),
      this.prisma.invoice.count({ where: { status: 'SUBMITTED' } }),
      this.prisma.invoice.count({ where: { status: { in: ['SUBMITTED', 'VERIFIED'] }, paymentState: { not: 'PAID' }, dueDate: { lt: today() } } }),
      this.prisma.importItem.count({ where: { status: 'PENDING_REVIEW' } }),
      this.prisma.contactRequest.count({ where: { status: 'NEW' } }),
    ]);
    const counts = {
      usersPendingVerification, companiesToVerify, profilesToReview, missionsToReview, applicationsActive, proposalsAwaitingApproval,
      contractsAwaitingSignature, contractsActive, timesheetsSubmitted, disputesOpen, documentsToVerify, documentsExpiringSoon,
      invoicesToVerify, invoicesOverdue, importItemsToReview, contactRequestsNew,
    };
    const items: Array<[number, string, string, string]> = [
      [companiesToVerify, 'Entreprises à vérifier', 'Vérifiez les entreprises avant la publication de leur première mission.', '/admin/validations?onglet=entreprises'],
      [profilesToReview, 'Profils à valider', 'Profils freelances soumis à validation.', '/admin/validations?onglet=profils'],
      [missionsToReview, 'Missions à valider', 'Missions en attente de publication.', '/admin/validations?onglet=missions'],
      [proposalsAwaitingApproval, 'Propositions acceptées à valider', 'Les deux parties ont accepté : validez pour générer le contrat.', '/admin/propositions'],
      [contractsAwaitingSignature, 'Contrats à finaliser', 'Déposez le contrat signé puis activez la mission.', '/admin/contrats'],
      [disputesOpen, 'Litiges ouverts', 'Litiges à instruire.', '/admin/cra?onglet=litiges'],
      [documentsToVerify, 'Documents à vérifier', 'Justificatifs déposés en attente de vérification.', '/admin/documents'],
      [invoicesToVerify, 'Factures à contrôler', 'Factures déposées en attente de contrôle.', '/admin/finance'],
      [invoicesOverdue, 'Factures en retard', 'Échéances dépassées sans règlement complet.', '/admin/finance'],
      [importItemsToReview, 'Profils importés à examiner', 'Éléments d’import en attente de décision.', '/admin/imports'],
      [contactRequestsNew, 'Demandes de contact', 'Nouvelles demandes reçues via le formulaire public.', '/admin/contact'],
    ];
    return {
      pending: items.filter(([n]) => n > 0).map(([n, title, description, link]) => ({ code: link, title: `${title} (${n})`, description, severity: 'action', link })),
      counts,
    };
  }

  // ── Notifications ─────────────────────────────────────────────────────────

  async notifications(actor: Actor, query: PageQuery & { unread?: boolean }): Promise<Page<NotificationView>> {
    const where = { userId: actor.userId, ...(query.unread ? { readAt: null } : {}) };
    const [items, total] = await Promise.all([
      this.prisma.notification.findMany({ where, ...pageArgs(query), orderBy: { createdAt: 'desc' } }),
      this.prisma.notification.count({ where }),
    ]);
    return toPage(
      items.map((n) => ({ id: n.id, type: n.type, title: n.title, body: n.body, link: n.link, readAt: toIso(n.readAt), createdAt: toIso(n.createdAt) })),
      total,
      query,
    );
  }

  async markRead(actor: Actor, id: string): Promise<void> {
    const result = await this.prisma.notification.updateMany({ where: { id, userId: actor.userId, readAt: null }, data: { readAt: new Date() } });
    if (result.count === 0) {
      const exists = await this.prisma.notification.count({ where: { id, userId: actor.userId } });
      if (!exists) throw notFound('Notification');
    }
  }

  async markAllRead(actor: Actor): Promise<{ updated: number }> {
    const result = await this.prisma.notification.updateMany({ where: { userId: actor.userId, readAt: null }, data: { readAt: new Date() } });
    return { updated: result.count };
  }
}
