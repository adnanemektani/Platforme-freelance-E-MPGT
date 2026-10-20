import { z } from 'zod';
import { optionalIsoDate, optionalText, pageQuery, type ActionState } from './common.js';
import {
  DocumentKind,
  DocumentVerificationStatus,
  type DocumentVisibility,
} from './enums.js';

/** Cible de rattachement d'un document déposé par un utilisateur. */
export const DocumentTarget = ['profile', 'company', 'mission', 'contract', 'qualification', 'timesheet'] as const;
export type DocumentTarget = (typeof DocumentTarget)[number];

/** Métadonnées envoyées avec le fichier (multipart/form-data). */
export const uploadDocumentSchema = z.object({
  kind: z.enum(DocumentKind),
  target: z.enum(DocumentTarget),
  targetId: z.uuid(),
  title: optionalText(200),
  expiresAt: optionalIsoDate,
});
export type UploadDocumentInput = z.infer<typeof uploadDocumentSchema>;

export const documentListQuery = pageQuery.extend({
  kind: z.enum(DocumentKind).optional(),
  verificationStatus: z.enum(DocumentVerificationStatus).optional(),
  profileId: z.uuid().optional(),
  companyId: z.uuid().optional(),
  contractId: z.uuid().optional(),
  expiringWithinDays: z.coerce.number().int().min(0).max(365).optional(),
});
export type DocumentListQuery = z.infer<typeof documentListQuery>;

export const verifyDocumentSchema = z.object({
  status: z.enum(['VERIFIED', 'REJECTED']),
  note: optionalText(2000),
  expiresAt: optionalIsoDate,
});
export type VerifyDocumentInput = z.infer<typeof verifyDocumentSchema>;

export interface DocumentView {
  id: string;
  kind: DocumentKind;
  title: string | null;
  originalFilename: string;
  mimeType: string;
  sizeBytes: number;
  sha256: string;
  visibility: DocumentVisibility;
  uploadedByName: string | null;
  profileId: string | null;
  companyId: string | null;
  missionId: string | null;
  contractId: string | null;
  invoiceId: string | null;
  qualificationId: string | null;
  timesheetId: string | null;
  verificationStatus: DocumentVerificationStatus;
  verificationNote: string | null;
  verifiedAt: string | null;
  expiresAt: string | null;
  /** Échéance dépassée ou proche (30 jours). */
  expiryState: 'none' | 'valid' | 'expiring' | 'expired';
  createdAt: string;
  actions: ActionState[];
}

/** Limites de dépôt communiquées au frontend (source : configuration serveur). */
export interface UploadPolicy {
  maxBytes: number;
  allowedMimeTypes: string[];
  allowedExtensions: string[];
}
