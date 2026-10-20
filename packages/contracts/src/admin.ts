import { z } from 'zod';
import {
  email,
  optionalText,
  pageQuery,
  reason,
  requiredText,
  type ActionState,
} from './common.js';
import {
  ImportItemStatus,
  IntegrationScope,
  RoleCode,
  UserStatus,
  type ImportBatchStatus,
  type ImportItemChange,
  type SkillCategory,
} from './enums.js';

// ── Paramètres métier (politique de validation V1, informations légales…) ───

export const legalInfoSchema = z.object({
  operatorName: optionalText(200),
  operatorLegalForm: optionalText(100),
  operatorAddress: optionalText(500),
  operatorRegistration: optionalText(200),
  operatorCountry: optionalText(100),
  publicationDirector: optionalText(200),
  hostingProvider: optionalText(500),
  contactEmail: optionalText(200),
  dataProtectionContact: optionalText(200),
});
export type LegalInfo = z.infer<typeof legalInfoSchema>;

export const platformSettingsSchema = z.object({
  /** Validation des profils freelances avant publication et candidature. */
  freelancerProfileApprovalRequired: z.boolean(),
  /** Vérification de l'entreprise avant la publication de sa première mission. */
  companyVerificationRequiredForPublication: z.boolean(),
  /** Validation de chaque mission par E-MPGT avant visibilité. */
  missionApprovalRequired: z.boolean(),
  /** Les freelances voient le nom de l'entreprise sur les missions (décision D-15). */
  freelancerSeesCompanyName: z.boolean(),
  /** Politique de commission validée (texte de référence) ; null tant que la décision D-05 est ouverte. */
  commissionPolicy: optionalText(4000),
  legal: legalInfoSchema,
  /** Domaines autorisés au partage avec le Knowledge Graph (décision D-16) : aucun par défaut. */
  integrationEnabledScopes: z.array(z.enum(IntegrationScope)),
});
export type PlatformSettings = z.infer<typeof platformSettingsSchema>;

export const updateSettingsSchema = platformSettingsSchema
  .extend({ legal: legalInfoSchema.partial() })
  .partial()
  .extend({ reason });
export type UpdateSettingsInput = z.infer<typeof updateSettingsSchema>;

/** Paramètres publics (pages légales, politique d'affichage). */
export interface PublicSettings {
  legal: LegalInfo;
  policy: {
    freelancerProfileApprovalRequired: boolean;
    companyVerificationRequiredForPublication: boolean;
    missionApprovalRequired: boolean;
  };
}

// ── Utilisateurs ────────────────────────────────────────────────────────────

export const userListQuery = pageQuery.extend({
  role: z.enum(RoleCode).optional(),
  status: z.enum(UserStatus).optional(),
});
export type UserListQuery = z.infer<typeof userListQuery>;

export interface AdminUserListItem {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  roles: RoleCode[];
  status: UserStatus;
  emailVerified: boolean;
  companyName: string | null;
  profileId: string | null;
  lastLoginAt: string | null;
  createdAt: string;
  isDemo: boolean;
  actions: ActionState[];
}

// ── Audit ───────────────────────────────────────────────────────────────────

export const auditListQuery = pageQuery.extend({
  entityType: z.string().trim().max(100).optional(),
  entityId: z.string().trim().max(100).optional(),
  actorUserId: z.uuid().optional(),
  action: z.string().trim().max(100).optional(),
  from: z.iso.datetime({ offset: true }).optional(),
  to: z.iso.datetime({ offset: true }).optional(),
});
export type AuditListQuery = z.infer<typeof auditListQuery>;

export interface AuditEventView {
  id: string;
  occurredAt: string;
  actorType: string;
  actorUserId: string | null;
  actorName: string | null;
  actorRoles: string[];
  action: string;
  entityType: string;
  entityId: string | null;
  reason: string | null;
  metadata: unknown;
  requestId: string | null;
}

// ── Import des profils historiques ──────────────────────────────────────────

export const createImportSchema = z.object({
  /** URL publique à collecter (hôte autorisé côté serveur). */
  sourceUrl: z.url().max(500),
});
export type CreateImportInput = z.infer<typeof createImportSchema>;

export const reviewImportItemSchema = z.object({
  decision: z.enum(['APPROVE', 'IGNORE', 'DUPLICATE']),
  /** Pour DUPLICATE : profil existant correspondant. Pour APPROVE : profil à mettre à jour (facultatif). */
  profileId: z.uuid().nullish(),
  note: optionalText(2000),
});
export type ReviewImportItemInput = z.infer<typeof reviewImportItemSchema>;

export const importItemListQuery = pageQuery.extend({
  status: z.enum(ImportItemStatus).optional(),
});
export type ImportItemListQuery = z.infer<typeof importItemListQuery>;

export interface ParsedProfileExperience {
  title: string;
  organization: string | null;
  periodLabel: string | null;
  startYear: number | null;
  startMonth: number | null;
  endYear: number | null;
  endMonth: number | null;
  isCurrent: boolean;
  description: string | null;
}

export interface ParsedProfile {
  headline: string | null;
  tagline: string | null;
  summary: string | null;
  experiences: ParsedProfileExperience[];
  skills: Array<{ name: string; category: SkillCategory }>;
  educations: Array<{ title: string; institution: string | null; periodLabel: string | null; year: number | null }>;
  languages: Array<{ name: string; level: string | null }>;
  /** Mentions de diplômes / certifications : jamais considérées comme vérifiées. */
  qualificationMentions: string[];
  /** Blocs de la source agrégés pour ce profil. */
  sourceBlockIds: string[];
}

export interface ImportBatchView {
  id: string;
  sourceUrl: string;
  collectedAt: string;
  parserVersion: string;
  snapshotSha256: string;
  status: ImportBatchStatus;
  stats: {
    blocks: number;
    profiles: number;
    new: number;
    unchanged: number;
    changed: number;
    duplicates: number;
    skipped: number;
  };
  error: string | null;
  createdAt: string;
  pendingItems: number;
}

export interface ImportItemView {
  id: string;
  batchId: string;
  externalKey: string;
  fingerprint: string;
  change: ImportItemChange;
  status: ImportItemStatus;
  parsed: ParsedProfile;
  rawText: string;
  warnings: string[];
  duplicateOf: { profileId: string; headline: string | null; score: number } | null;
  profileId: string | null;
  /** Champs que la réexécution n'appliquera pas car corrigés par un humain. */
  lockedFields: string[];
  reviewNote: string | null;
  reviewedAt: string | null;
  actions: ActionState[];
}

export const inviteProfileClaimSchema = z.object({
  email,
  message: optionalText(1000),
});
export type InviteProfileClaimInput = z.infer<typeof inviteProfileClaimSchema>;

// ── Clients d'intégration (Knowledge Graph) ─────────────────────────────────

export const createIntegrationClientSchema = z.object({
  name: requiredText(100),
  description: optionalText(500),
  scopes: z.array(z.enum(IntegrationScope)).min(1, 'Au moins un domaine'),
  expiresInDays: z.coerce.number().int().min(1).max(730).nullish(),
});
export type CreateIntegrationClientInput = z.infer<typeof createIntegrationClientSchema>;

export interface IntegrationClientView {
  id: string;
  name: string;
  description: string | null;
  tokenPrefix: string;
  scopes: IntegrationScope[];
  createdAt: string;
  lastUsedAt: string | null;
  expiresAt: string | null;
  revokedAt: string | null;
  revokeReason: string | null;
}

export interface CreatedIntegrationClient extends IntegrationClientView {
  /** Affiché une seule fois : seul son condensat est conservé. */
  token: string;
}

// ── Demandes de contact ─────────────────────────────────────────────────────

export interface ContactRequestView {
  id: string;
  name: string;
  email: string;
  organization: string | null;
  audience: string;
  subject: string;
  message: string;
  status: string;
  createdAt: string;
  handledAt: string | null;
}
