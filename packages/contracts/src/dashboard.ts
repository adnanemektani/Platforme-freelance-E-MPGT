import { z } from 'zod';
import { email, optionalText, requiredText, type PendingItem } from './common.js';

export interface NotificationView {
  id: string;
  type: string;
  title: string;
  body: string;
  link: string | null;
  readAt: string | null;
  createdAt: string;
}

export interface CompanyOverview {
  companyName: string;
  pending: PendingItem[];
  counts: {
    draftMissions: number;
    missionsInReview: number;
    publishedMissions: number;
    applicationsToReview: number;
    proposalsToAnswer: number;
    activeContracts: number;
    timesheetsToValidate: number;
    unpaidInvoices: number;
  };
}

export interface FreelancerOverview {
  headline: string | null;
  pending: PendingItem[];
  counts: {
    openMissions: number;
    activeApplications: number;
    proposalsToAnswer: number;
    activeContracts: number;
    timesheetsToComplete: number;
    timesheetsChangesRequested: number;
    unpaidInvoices: number;
  };
}

export interface AdminOverview {
  pending: PendingItem[];
  counts: {
    usersPendingVerification: number;
    companiesToVerify: number;
    profilesToReview: number;
    missionsToReview: number;
    applicationsActive: number;
    proposalsAwaitingApproval: number;
    contractsAwaitingSignature: number;
    contractsActive: number;
    timesheetsSubmitted: number;
    disputesOpen: number;
    documentsToVerify: number;
    documentsExpiringSoon: number;
    invoicesToVerify: number;
    invoicesOverdue: number;
    importItemsToReview: number;
    contactRequestsNew: number;
  };
}

export const contactRequestSchema = z.object({
  name: requiredText(200),
  email,
  organization: optionalText(200),
  audience: z.enum(['COMPANY', 'FREELANCER', 'OTHER']),
  subject: requiredText(200),
  message: requiredText(5000),
  /** Piège à robots : doit rester vide. */
  website: z.string().max(0).optional(),
});
export type ContactRequestInput = z.infer<typeof contactRequestSchema>;
