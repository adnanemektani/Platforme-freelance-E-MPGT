import { z } from 'zod';
import {
  ApplicationStatus,
  AvailabilityKind,
  AvailabilityStatus,
  BillingUnit,
  ContractStatus,
  DocumentKind,
  DocumentVerificationStatus,
  MissionPublicationStatus,
  MissionStatus,
  Mobility,
  ProfileValidationStatus,
  QualificationStatus,
  SkillCategory,
  TimesheetStatus,
  WorkMode,
} from './enums.js';

// DTO de l'API d'intégration (/api/v1/integration) destinée au Knowledge Graph.
// Ces schémas sont appliqués à chaque réponse : tout champ non déclaré est retiré.
// Ils sont distincts des modèles internes et ne contiennent jamais : mot de passe,
// coordonnées (e-mail, téléphone), données bancaires, pièces d'identité,
// contenu de documents ni notes internes.

const isoDateTime = z.string();
const isoDateOnly = z.string();

export const integrationFreelancerSchema = z.object({
  id: z.uuid(),
  headline: z.string().nullable(),
  summary: z.string().nullable(),
  yearsOfExperience: z.number().int().nullable(),
  city: z.string().nullable(),
  region: z.string().nullable(),
  country: z.string().nullable(),
  mobility: z.enum(Mobility).nullable(),
  workModes: z.array(z.enum(WorkMode)),
  availabilityStatus: z.enum(AvailabilityStatus),
  availableFrom: isoDateOnly.nullable(),
  validationStatus: z.enum(ProfileValidationStatus),
  skills: z.array(
    z.object({
      skillId: z.uuid(),
      name: z.string(),
      category: z.enum(SkillCategory),
      level: z.string().nullable(),
    }),
  ),
  experiences: z.array(
    z.object({
      title: z.string(),
      organization: z.string().nullable(),
      periodLabel: z.string().nullable(),
      startYear: z.number().int().nullable(),
      endYear: z.number().int().nullable(),
      isCurrent: z.boolean(),
    }),
  ),
  educations: z.array(
    z.object({ title: z.string(), institution: z.string().nullable(), year: z.number().int().nullable() }),
  ),
  languages: z.array(z.object({ name: z.string(), level: z.string().nullable() })),
  qualifications: z.array(
    z.object({ name: z.string(), status: z.enum(QualificationStatus), expiresAt: isoDateOnly.nullable() }),
  ),
  updatedAt: isoDateTime,
});
export type IntegrationFreelancer = z.infer<typeof integrationFreelancerSchema>;

export const integrationSkillSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  slug: z.string(),
  category: z.enum(SkillCategory),
  updatedAt: isoDateTime,
});
export type IntegrationSkill = z.infer<typeof integrationSkillSchema>;

export const integrationAvailabilitySchema = z.object({
  id: z.uuid(),
  freelancerId: z.uuid(),
  kind: z.enum(AvailabilityKind),
  startDate: isoDateOnly,
  endDate: isoDateOnly.nullable(),
  daysPerWeek: z.string().nullable(),
  updatedAt: isoDateTime,
});
export type IntegrationAvailability = z.infer<typeof integrationAvailabilitySchema>;

export const integrationMissionSchema = z.object({
  id: z.uuid(),
  reference: z.string(),
  title: z.string(),
  companyId: z.uuid(),
  companyName: z.string(),
  sector: z.string().nullable(),
  city: z.string().nullable(),
  country: z.string().nullable(),
  workMode: z.enum(WorkMode).nullable(),
  startDate: isoDateOnly.nullable(),
  endDate: isoDateOnly.nullable(),
  publicationStatus: z.enum(MissionPublicationStatus),
  status: z.enum(MissionStatus),
  skills: z.array(z.object({ skillId: z.uuid(), name: z.string(), required: z.boolean() })),
  updatedAt: isoDateTime,
});
export type IntegrationMission = z.infer<typeof integrationMissionSchema>;

export const integrationApplicationSchema = z.object({
  id: z.uuid(),
  missionId: z.uuid(),
  freelancerId: z.uuid(),
  status: z.enum(ApplicationStatus),
  createdAt: isoDateTime,
  updatedAt: isoDateTime,
});
export type IntegrationApplication = z.infer<typeof integrationApplicationSchema>;

export const integrationContractSchema = z.object({
  id: z.uuid(),
  reference: z.string(),
  missionId: z.uuid(),
  companyId: z.uuid(),
  freelancerId: z.uuid(),
  status: z.enum(ContractStatus),
  startDate: isoDateOnly,
  endDate: isoDateOnly.nullable(),
  currentEndDate: isoDateOnly.nullable(),
  billingUnit: z.enum(BillingUnit),
  currency: z.string(),
  updatedAt: isoDateTime,
});
export type IntegrationContract = z.infer<typeof integrationContractSchema>;

/** Coûts : uniquement les CRA approuvés, montants issus de l'instantané figé à l'approbation. */
export const integrationCostSchema = z.object({
  id: z.uuid(),
  contractId: z.uuid(),
  periodStart: isoDateOnly,
  periodEnd: isoDateOnly,
  version: z.number().int(),
  status: z.enum(TimesheetStatus),
  hours: z.string(),
  quantity: z.string().nullable(),
  billingUnit: z.enum(BillingUnit).nullable(),
  currency: z.string().nullable(),
  clientTotalExclTax: z.string().nullable(),
  freelanceNetExclTax: z.string().nullable(),
  commissionAmount: z.string().nullable(),
  approvedAt: isoDateTime.nullable(),
  updatedAt: isoDateTime,
});
export type IntegrationCost = z.infer<typeof integrationCostSchema>;

export const integrationReviewSchema = z.object({
  id: z.uuid(),
  contractId: z.uuid(),
  subject: z.string(),
  authorRole: z.string(),
  rating: z.number().int(),
  createdAt: isoDateTime,
  updatedAt: isoDateTime,
});
export type IntegrationReview = z.infer<typeof integrationReviewSchema>;

export const integrationDocumentSchema = z.object({
  id: z.uuid(),
  kind: z.enum(DocumentKind),
  title: z.string().nullable(),
  mimeType: z.string(),
  sizeBytes: z.number().int(),
  sha256: z.string(),
  attachedTo: z.object({ type: z.string(), id: z.uuid() }).nullable(),
  verificationStatus: z.enum(DocumentVerificationStatus),
  expiresAt: isoDateOnly.nullable(),
  createdAt: isoDateTime,
  updatedAt: isoDateTime,
});
export type IntegrationDocument = z.infer<typeof integrationDocumentSchema>;

export const IntegrationEntityType = [
  'freelancer',
  'skill',
  'availability',
  'mission',
  'application',
  'contract',
  'cost',
  'review',
  'document',
] as const;
export type IntegrationEntityType = (typeof IntegrationEntityType)[number];

export const integrationChangeSchema = z.object({
  seq: z.string(),
  entityType: z.enum(IntegrationEntityType),
  entityId: z.uuid(),
  /** UPSERT : relire l'entité ; DELETE : supprimée ; WITHDRAWN : plus partagée (retrait, statut, consentement). */
  operation: z.enum(['UPSERT', 'DELETE', 'WITHDRAWN']),
  changedAt: isoDateTime,
});
export type IntegrationChange = z.infer<typeof integrationChangeSchema>;

export const integrationListQuery = z.object({
  cursor: z.string().max(500).optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
  /** Synchronisation incrémentale : éléments modifiés depuis cet instant (ISO 8601). */
  updatedSince: z.iso.datetime({ offset: true }).optional(),
});
export type IntegrationListQuery = z.infer<typeof integrationListQuery>;

export const integrationPage = <T extends z.ZodType>(item: T) =>
  z.object({ data: z.array(item), nextCursor: z.string().nullable(), hasMore: z.boolean() });
