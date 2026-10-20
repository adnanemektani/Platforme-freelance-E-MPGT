import { z } from 'zod';
import {
  currency,
  decimalString,
  isoDate,
  optionalText,
  pageQuery,
  requiredText,
  type ActionState,
  type PendingItem,
} from './common.js';
import {
  InvoiceKind,
  InvoiceStatus,
  PaymentConfigStatus,
  PaymentMethod,
  PaymentState,
  PayoutMethodType,
  type InvoiceAddressee,
  type RecordStatus,
} from './enums.js';

/** Dépôt d'une facture : métadonnées envoyées avec le PDF (multipart/form-data). */
export const depositInvoiceSchema = z.object({
  kind: z.enum(InvoiceKind),
  contractId: z.uuid(),
  timesheetId: z
    .union([z.uuid(), z.literal(''), z.null()])
    .optional()
    .transform((value) => (value ? value : null)),
  number: requiredText(100),
  issuerLabel: requiredText(200),
  issueDate: isoDate,
  dueDate: isoDate,
  currency,
  amountExclTax: decimalString(),
  taxAmount: decimalString(),
  amountInclTax: decimalString(),
});
export type DepositInvoiceInput = z.infer<typeof depositInvoiceSchema>;

export const invoiceListQuery = pageQuery.extend({
  kind: z.enum(InvoiceKind).optional(),
  status: z.enum(InvoiceStatus).optional(),
  paymentState: z.enum(PaymentState).optional(),
  contractId: z.uuid().optional(),
  overdue: z.stringbool().optional(),
});
export type InvoiceListQuery = z.infer<typeof invoiceListQuery>;

/** Enregistrement d'un encaissement ou d'un règlement : référence ET justificatif obligatoires. */
export const recordMoneySchema = z.object({
  amount: decimalString(),
  date: isoDate,
  method: z.enum(PaymentMethod),
  reference: requiredText(200),
  note: optionalText(2000),
});
export type RecordMoneyInput = z.infer<typeof recordMoneySchema>;

export const updatePaymentConfigSchema = z.object({
  method: z.enum(PayoutMethodType),
  status: z.enum(PaymentConfigStatus),
  note: optionalText(2000),
  reason: z.string().trim().min(3, 'Motif obligatoire').max(2000),
});
export type UpdatePaymentConfigInput = z.infer<typeof updatePaymentConfigSchema>;

export interface MoneyRecordView {
  id: string;
  invoiceId: string;
  invoiceNumber: string;
  amount: string;
  currency: string;
  date: string;
  method: PaymentMethod;
  reference: string;
  proofDocumentId: string;
  note: string | null;
  status: RecordStatus;
  recordedAt: string;
  cancelledAt: string | null;
  cancelReason: string | null;
  actions: ActionState[];
}

export interface InvoiceView {
  id: string;
  kind: InvoiceKind;
  number: string;
  contractId: string;
  contractReference: string;
  missionTitle: string;
  timesheetId: string | null;
  timesheetPeriod: string | null;
  companyId: string;
  companyName: string;
  profileId: string;
  freelancerName: string;
  issuerLabel: string;
  addressee: InvoiceAddressee;
  issueDate: string;
  dueDate: string;
  currency: string;
  amountExclTax: string;
  taxAmount: string;
  amountInclTax: string;
  /** Montant HT attendu d'après le CRA approuvé (rapprochement). */
  expectedAmountExclTax: string | null;
  /** Écart déclaré − attendu (HT). */
  discrepancy: string | null;
  documentId: string;
  status: InvoiceStatus;
  statusReason: string | null;
  verifiedAt: string | null;
  paymentState: PaymentState;
  paidAmount: string;
  outstandingAmount: string;
  overdue: boolean;
  /** Encaissements clients (E-MPGT et entreprise concernée). */
  payments: MoneyRecordView[];
  /** Règlements au freelance (E-MPGT et freelance concerné). */
  payouts: MoneyRecordView[];
  createdAt: string;
  actions: ActionState[];
  pending: PendingItem[];
}

export interface InvoiceListItem {
  id: string;
  kind: InvoiceKind;
  number: string;
  contractReference: string;
  companyName: string;
  freelancerName: string;
  issueDate: string;
  dueDate: string;
  currency: string;
  amountInclTax: string;
  paidAmount: string;
  status: InvoiceStatus;
  paymentState: PaymentState;
  overdue: boolean;
}

export interface PaymentConfigurationView {
  method: PayoutMethodType;
  status: PaymentConfigStatus;
  provider: string | null;
  providerMode: string | null;
  note: string | null;
  confirmedAt: string | null;
  /** Explication affichée au freelance (mode manuel, décision en attente…). */
  explanation: string;
}

export interface CurrencyTotals {
  currency: string;
  approvedNet: string;
  invoiced: string;
  paid: string;
  outstanding: string;
}

/** Page « Paiements » de l'espace freelance. */
export interface FreelancerPaymentsOverview {
  configuration: PaymentConfigurationView;
  /** Mode de fonctionnement : manuel en V1, aucun mouvement d'argent automatique. */
  mode: 'MANUAL';
  disclaimer: string;
  approvedAmounts: Array<{
    timesheetId: string;
    contractReference: string;
    periodStart: string;
    currency: string;
    hours: string;
    freelanceNetExclTax: string | null;
    invoiced: boolean;
  }>;
  invoices: InvoiceListItem[];
  payouts: MoneyRecordView[];
  totals: CurrencyTotals[];
}

/** Vue « Factures et règlements » de l'espace entreprise. */
export interface CompanyBillingOverview {
  disclaimer: string;
  invoices: InvoiceListItem[];
  payments: MoneyRecordView[];
  totals: Array<{ currency: string; invoiced: string; paid: string; outstanding: string; overdue: string }>;
}
