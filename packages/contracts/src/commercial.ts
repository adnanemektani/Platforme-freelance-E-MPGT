import { z } from 'zod';
import {
  currency,
  isoDate,
  optionalDecimalString,
  optionalIsoDate,
  optionalText,
  pageQuery,
  type ActionState,
  type PendingItem,
} from './common.js';
import {
  AmendmentType,
  BillingUnit,
  CommissionBase,
  CommissionMode,
  CommissionPayer,
  ContractStatus,
  InvoiceAddressee,
  ProposalStatus,
  type AmendmentStatus,
  type PartyDecision,
} from './enums.js';

// ── Propositions commerciales (préparées par E-MPGT) ────────────────────────

/**
 * Tous les champs sont facultatifs en brouillon : la complétude est contrôlée
 * à l'envoi et à la validation. Aucune valeur commerciale n'est supposée.
 */
export const proposalTermsSchema = z.object({
  startDate: optionalIsoDate,
  endDate: optionalIsoDate,
  currency: currency.nullish(),
  billingUnit: z.enum(BillingUnit).nullish(),
  hoursPerDay: optionalDecimalString({ scale: 2, max: 24 }),
  freelanceRate: optionalDecimalString({ scale: 4 }),
  clientRate: optionalDecimalString({ scale: 4 }),
  estimatedQuantity: optionalDecimalString({ scale: 2 }),
  commissionPayer: z.enum(CommissionPayer).nullish(),
  commissionMode: z.enum(CommissionMode).nullish(),
  commissionBase: z.enum(CommissionBase).nullish(),
  commissionValue: optionalDecimalString({ scale: 4 }),
  commissionNote: optionalText(2000),
  commissionVisibleToCompany: z.boolean().optional(),
  commissionVisibleToFreelancer: z.boolean().optional(),
  expensesPolicy: optionalText(2000),
  taxNote: optionalText(2000),
  timesheetValidationRule: optionalText(2000),
  clientPaymentTermsDays: z.coerce.number().int().min(0).max(365).nullish(),
  freelancerPaymentTermsDays: z.coerce.number().int().min(0).max(365).nullish(),
  paymentTermsNote: optionalText(2000),
  freelancerInvoiceAddressee: z.enum(InvoiceAddressee).nullish(),
  internalNotes: optionalText(5000),
});
export type ProposalTermsInput = z.infer<typeof proposalTermsSchema>;

export const createProposalSchema = proposalTermsSchema.extend({
  applicationId: z.uuid(),
});
export type CreateProposalInput = z.infer<typeof createProposalSchema>;

export const proposalDecisionSchema = z.object({
  comment: optionalText(2000),
});
export type ProposalDecisionInput = z.infer<typeof proposalDecisionSchema>;

export const proposalListQuery = pageQuery.extend({
  status: z.enum(ProposalStatus).optional(),
  missionId: z.uuid().optional(),
});
export type ProposalListQuery = z.infer<typeof proposalListQuery>;

/** Montants calculés pour une quantité de référence (aperçu, ou CRA approuvé). */
export interface AmountBreakdown {
  currency: string;
  billingUnit: BillingUnit;
  hours: string;
  quantity: string;
  /** Prestation facturée au client, hors commission. */
  clientServiceAmount: string | null;
  /** Rémunération brute du freelance. */
  freelanceGrossAmount: string | null;
  commissionAmount: string | null;
  commissionPayer: CommissionPayer;
  /** Total HT facturé au client (prestation + commission si payée par le client). */
  clientTotalExclTax: string | null;
  /** Montant HT dû au freelance (brut − commission si payée par le freelance). */
  freelanceNetExclTax: string | null;
  /** Marge E-MPGT (interne) : total client − montant net freelance. */
  platformMarginExclTax: string | null;
  /** Écart non expliqué par la commission (interne, signalé à E-MPGT). */
  unexplainedSpread: string | null;
  roundingRule: string;
}

export interface ProposalView {
  id: string;
  reference: string;
  version: number;
  previousId: string | null;
  missionId: string;
  missionReference: string;
  missionTitle: string;
  applicationId: string;
  companyId: string;
  companyName: string;
  profileId: string;
  candidateName: string;
  status: ProposalStatus;
  startDate: string | null;
  endDate: string | null;
  currency: string | null;
  billingUnit: BillingUnit | null;
  hoursPerDay: string | null;
  /** Masqué à l'entreprise. */
  freelanceRate: string | null;
  /** Masqué au freelance. */
  clientRate: string | null;
  estimatedQuantity: string | null;
  /** Conditions de commission : selon la visibilité fixée par E-MPGT. */
  commissionPayer: CommissionPayer | null;
  commissionMode: CommissionMode | null;
  commissionBase: CommissionBase | null;
  commissionValue: string | null;
  commissionNote: string | null;
  commissionVisibleToCompany: boolean | null;
  commissionVisibleToFreelancer: boolean | null;
  expensesPolicy: string | null;
  taxNote: string | null;
  timesheetValidationRule: string | null;
  clientPaymentTermsDays: number | null;
  freelancerPaymentTermsDays: number | null;
  paymentTermsNote: string | null;
  freelancerInvoiceAddressee: InvoiceAddressee | null;
  companyDecision: PartyDecision;
  companyDecisionAt: string | null;
  companyDecisionComment: string | null;
  freelancerDecision: PartyDecision;
  freelancerDecisionAt: string | null;
  freelancerDecisionComment: string | null;
  sentAt: string | null;
  approvedAt: string | null;
  statusReason: string | null;
  internalNotes: string | null;
  createdAt: string;
  updatedAt: string;
  /** Aperçu de calcul sur la quantité estimée (montants filtrés selon le rôle). */
  preview: AmountBreakdown | null;
  /** Éléments manquants pour envoyer / valider la proposition. */
  missingTerms: string[];
  contractId: string | null;
  actions: ActionState[];
  pending: PendingItem[];
}

export interface ProposalListItem {
  id: string;
  reference: string;
  version: number;
  missionTitle: string;
  companyName: string;
  candidateName: string;
  status: ProposalStatus;
  companyDecision: PartyDecision;
  freelancerDecision: PartyDecision;
  updatedAt: string;
}

// ── Contrats et avenants ────────────────────────────────────────────────────

export const signedDepositSchema = z.object({
  signedAt: isoDate,
  /** Preuve de signature renseignée : nature, signataires, prestataire externe éventuel. */
  signatureProofNote: z.string().trim().min(5, 'Décrire la preuve de signature').max(2000),
});
export type SignedDepositInput = z.infer<typeof signedDepositSchema>;

export const createAmendmentSchema = z.object({
  type: z.enum(AmendmentType),
  effectiveDate: isoDate,
  reason: z.string().trim().min(3, 'Motif obligatoire').max(2000),
  newEndDate: optionalIsoDate,
  newFreelanceRate: optionalDecimalString({ scale: 4 }),
  newClientRate: optionalDecimalString({ scale: 4 }),
  newHoursPerDay: optionalDecimalString({ scale: 2, max: 24 }),
  newCommissionValue: optionalDecimalString({ scale: 4 }),
  otherChanges: optionalText(4000),
});
export type CreateAmendmentInput = z.infer<typeof createAmendmentSchema>;

export const contractListQuery = pageQuery.extend({
  status: z.enum(ContractStatus).optional(),
});
export type ContractListQuery = z.infer<typeof contractListQuery>;

export interface AmendmentView {
  id: string;
  number: number;
  type: AmendmentType;
  status: AmendmentStatus;
  effectiveDate: string;
  reason: string;
  newEndDate: string | null;
  newFreelanceRate: string | null;
  newClientRate: string | null;
  newHoursPerDay: string | null;
  newCommissionValue: string | null;
  otherChanges: string | null;
  signedDocumentId: string | null;
  signedAt: string | null;
  signatureProofNote: string | null;
  statusReason: string | null;
  createdAt: string;
  actions: ActionState[];
}

export interface ContractView {
  id: string;
  reference: string;
  proposalId: string;
  missionId: string;
  missionReference: string;
  missionTitle: string;
  companyId: string;
  companyName: string;
  profileId: string;
  freelancerName: string;
  status: ContractStatus;
  startDate: string;
  endDate: string | null;
  currentEndDate: string | null;
  currency: string;
  billingUnit: BillingUnit;
  hoursPerDay: string | null;
  freelanceRate: string | null;
  clientRate: string | null;
  commissionPayer: CommissionPayer | null;
  commissionMode: CommissionMode | null;
  commissionBase: CommissionBase | null;
  commissionValue: string | null;
  commissionNote: string | null;
  expensesPolicy: string | null;
  taxNote: string | null;
  timesheetValidationRule: string | null;
  clientPaymentTermsDays: number | null;
  freelancerPaymentTermsDays: number | null;
  paymentTermsNote: string | null;
  freelancerInvoiceAddressee: InvoiceAddressee;
  termsHash: string;
  signedDocumentId: string | null;
  signedAt: string | null;
  signatureProofNote: string | null;
  signatureRecordedAt: string | null;
  activatedAt: string | null;
  closedAt: string | null;
  statusReason: string | null;
  createdAt: string;
  amendments: AmendmentView[];
  timesheetsCount: number;
  actions: ActionState[];
  pending: PendingItem[];
}

export interface ContractListItem {
  id: string;
  reference: string;
  missionTitle: string;
  companyName: string;
  freelancerName: string;
  status: ContractStatus;
  startDate: string;
  currentEndDate: string | null;
  updatedAt: string;
}

export const contractReviewSchema = z.object({
  rating: z.coerce.number().int().min(1).max(5),
  comment: optionalText(4000),
});
export type ContractReviewInput = z.infer<typeof contractReviewSchema>;

export interface ReviewView {
  id: string;
  contractId: string;
  authorRole: string;
  subject: string;
  rating: number;
  comment: string | null;
  visibility: string;
  createdAt: string;
}
