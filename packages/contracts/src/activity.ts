import { z } from 'zod';
import {
  decimalString,
  isoDate,
  optionalText,
  pageQuery,
  reason,
  type ActionState,
  type PendingItem,
} from './common.js';
import type { AmountBreakdown } from './commercial.js';
import { DisputeSubject, TimesheetStatus, type DisputeStatus } from './enums.js';

export const createTimesheetSchema = z.object({
  /** Premier jour du mois couvert (période mensuelle en V1). */
  periodStart: isoDate.refine((value) => value.endsWith('-01'), 'La période commence le 1er du mois'),
});
export type CreateTimesheetInput = z.infer<typeof createTimesheetSchema>;

export const timesheetEntriesSchema = z.object({
  entries: z
    .array(
      z.object({
        date: isoDate,
        hours: decimalString({ scale: 2, max: 24 }),
        comment: optionalText(1000),
      }),
    )
    .max(31, '31 lignes maximum par CRA'),
  freelancerComment: optionalText(2000),
});
export type TimesheetEntriesInput = z.infer<typeof timesheetEntriesSchema>;

export const approveTimesheetSchema = z.object({
  /** Obligatoire lorsqu'E-MPGT valide à la place du client. */
  reason: z
    .string()
    .trim()
    .max(2000)
    .nullish()
    .transform((value) => (value ? value : null)),
});
export type ApproveTimesheetInput = z.infer<typeof approveTimesheetSchema>;

export const correctTimesheetSchema = z.object({ reason });
export type CorrectTimesheetInput = z.infer<typeof correctTimesheetSchema>;

export const timesheetListQuery = pageQuery.extend({
  contractId: z.uuid().optional(),
  status: z.enum(TimesheetStatus).optional(),
});
export type TimesheetListQuery = z.infer<typeof timesheetListQuery>;

export interface TimesheetEntryView {
  id: string;
  date: string;
  hours: string;
  comment: string | null;
}

/** Contrôle de cohérence détecté par le serveur (bloquant ou avertissement). */
export interface TimesheetCheck {
  level: 'error' | 'warning';
  code: string;
  message: string;
  date?: string;
}

export interface TimesheetView {
  id: string;
  contractId: string;
  contractReference: string;
  missionTitle: string;
  companyName: string;
  freelancerName: string;
  periodStart: string;
  periodEnd: string;
  version: number;
  supersedesId: string | null;
  correctedById: string | null;
  status: TimesheetStatus;
  totalHours: string;
  freelancerComment: string | null;
  submittedAt: string | null;
  approvedAt: string | null;
  approvedOnBehalf: boolean;
  approvalReason: string | null;
  changesRequestedAt: string | null;
  changesRequestedReason: string | null;
  correctionReason: string | null;
  entries: TimesheetEntryView[];
  /** Bornes autorisées pour la saisie (intersection période / contrat). */
  allowedRange: { from: string; to: string } | null;
  checks: TimesheetCheck[];
  amounts: AmountBreakdown | null;
  createdAt: string;
  updatedAt: string;
  actions: ActionState[];
  pending: PendingItem[];
}

export interface TimesheetListItem {
  id: string;
  contractId: string;
  contractReference: string;
  missionTitle: string;
  companyName: string;
  freelancerName: string;
  periodStart: string;
  version: number;
  status: TimesheetStatus;
  totalHours: string;
  submittedAt: string | null;
  updatedAt: string;
}

// ── Litiges ─────────────────────────────────────────────────────────────────

export const openDisputeSchema = z.object({
  subjectType: z.enum(DisputeSubject),
  contractId: z.uuid(),
  timesheetId: z.uuid().nullish(),
  invoiceId: z.uuid().nullish(),
  reason,
});
export type OpenDisputeInput = z.infer<typeof openDisputeSchema>;

export const resolveDisputeSchema = z.object({
  resolution: reason,
  close: z.boolean().default(false),
});
export type ResolveDisputeInput = z.infer<typeof resolveDisputeSchema>;

export interface DisputeView {
  id: string;
  subjectType: DisputeSubject;
  contractId: string;
  contractReference: string;
  timesheetId: string | null;
  invoiceId: string | null;
  openedByName: string;
  reason: string;
  status: DisputeStatus;
  resolution: string | null;
  resolvedAt: string | null;
  createdAt: string;
  actions: ActionState[];
}
