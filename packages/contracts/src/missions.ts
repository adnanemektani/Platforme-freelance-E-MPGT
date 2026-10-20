import { z } from 'zod';
import {
  currency,
  optionalCountryCode,
  optionalDecimalString,
  optionalIsoDate,
  optionalText,
  pageQuery,
  requiredText,
  type ActionState,
  type PendingItem,
} from './common.js';
import {
  ApplicationStatus,
  MissionPublicationStatus,
  MissionStatus,
  RateUnit,
  SkillCategory,
  WorkMode,
} from './enums.js';
import type { CandidateProfileView } from './profile.js';

const missionFields = {
  title: requiredText(200),
  description: requiredText(10000),
  profileSought: optionalText(2000),
  sector: optionalText(200),
  city: optionalText(100),
  region: optionalText(100),
  country: optionalCountryCode,
  workMode: z.enum(WorkMode).nullish(),
  startDate: optionalIsoDate,
  endDate: optionalIsoDate,
  durationLabel: optionalText(100),
  budgetMin: optionalDecimalString(),
  budgetMax: optionalDecimalString(),
  budgetUnit: z.enum(RateUnit).nullish(),
  budgetCurrency: currency.nullish(),
  budgetVisibleToFreelancers: z.boolean().default(false),
  applicationDeadline: optionalIsoDate,
  skills: z
    .array(
      z.object({
        name: requiredText(100),
        category: z.enum(SkillCategory).default('TECHNICAL'),
        required: z.boolean().default(true),
      }),
    )
    .max(40)
    .default([]),
};

export const createMissionSchema = z.object(missionFields);
export type CreateMissionInput = z.infer<typeof createMissionSchema>;

export const updateMissionSchema = z.object(missionFields).partial();
export type UpdateMissionInput = z.infer<typeof updateMissionSchema>;

export const adminUpdateMissionSchema = updateMissionSchema.extend({
  reason: z.string().trim().min(3, 'Motif obligatoire').max(2000),
});
export type AdminUpdateMissionInput = z.infer<typeof adminUpdateMissionSchema>;

export const missionListQuery = pageQuery.extend({
  publicationStatus: z.enum(MissionPublicationStatus).optional(),
  status: z.enum(MissionStatus).optional(),
  companyId: z.uuid().optional(),
  city: z.string().trim().max(100).optional(),
  country: z.string().trim().max(2).optional(),
  skill: z.string().trim().max(100).optional(),
  workMode: z.enum(WorkMode).optional(),
  startFrom: optionalIsoDate,
});
export type MissionListQuery = z.infer<typeof missionListQuery>;

export interface MissionSkillView {
  skillId: string;
  name: string;
  category: SkillCategory;
  required: boolean;
}

export interface MissionListItem {
  id: string;
  reference: string;
  title: string;
  companyId: string;
  /** Nom de l'entreprise : visible des freelances uniquement si la politique le permet (D-15). */
  companyName: string | null;
  city: string | null;
  country: string | null;
  workMode: WorkMode | null;
  startDate: string | null;
  endDate: string | null;
  durationLabel: string | null;
  publicationStatus: MissionPublicationStatus;
  status: MissionStatus;
  skills: string[];
  applicationsCount: number | null;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
  /** Pour un freelance : statut de sa propre candidature. */
  myApplicationStatus: ApplicationStatus | null;
}

export interface MissionView {
  id: string;
  reference: string;
  companyId: string;
  companyName: string | null;
  title: string;
  description: string;
  profileSought: string | null;
  sector: string | null;
  city: string | null;
  region: string | null;
  country: string | null;
  workMode: WorkMode | null;
  startDate: string | null;
  endDate: string | null;
  durationLabel: string | null;
  /** Budget : visible du freelance seulement si l'entreprise l'a choisi. */
  budgetMin: string | null;
  budgetMax: string | null;
  budgetUnit: RateUnit | null;
  budgetCurrency: string | null;
  budgetVisibleToFreelancers: boolean | null;
  applicationDeadline: string | null;
  publicationStatus: MissionPublicationStatus;
  status: MissionStatus;
  reviewNote: string | null;
  statusReason: string | null;
  submittedAt: string | null;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
  skills: MissionSkillView[];
  applicationsCount: number | null;
  myApplication: { id: string; status: ApplicationStatus; createdAt: string } | null;
  isDemo: boolean;
  actions: ActionState[];
  pending: PendingItem[];
}

// ── Candidatures ────────────────────────────────────────────────────────────

export const applySchema = z.object({
  message: requiredText(5000),
  availabilityNote: optionalText(1000),
  proposedRate: optionalDecimalString(),
  proposedRateUnit: z.enum(RateUnit).nullish(),
  proposedRateCurrency: currency.nullish(),
});
export type ApplyInput = z.infer<typeof applySchema>;

export const applicationListQuery = pageQuery.extend({
  missionId: z.uuid().optional(),
  status: z.enum(ApplicationStatus).optional(),
});
export type ApplicationListQuery = z.infer<typeof applicationListQuery>;

export interface ApplicationListItem {
  id: string;
  missionId: string;
  missionReference: string;
  missionTitle: string;
  companyName: string | null;
  profileId: string;
  candidateName: string;
  candidateHeadline: string | null;
  status: ApplicationStatus;
  createdAt: string;
  updatedAt: string;
}

export interface ApplicationView {
  id: string;
  missionId: string;
  missionReference: string;
  missionTitle: string;
  missionStatus: MissionStatus;
  companyId: string;
  companyName: string | null;
  profileId: string;
  message: string;
  availabilityNote: string | null;
  /** Tarif indicatif : E-MPGT et le freelance uniquement. */
  proposedRate: string | null;
  proposedRateUnit: RateUnit | null;
  proposedRateCurrency: string | null;
  status: ApplicationStatus;
  statusReason: string | null;
  decidedAt: string | null;
  createdAt: string;
  updatedAt: string;
  candidate: CandidateProfileView | null;
  proposalId: string | null;
  contractId: string | null;
  actions: ActionState[];
  pending: PendingItem[];
}
