import { z } from 'zod';
import {
  currency,
  optionalCountryCode,
  optionalDecimalString,
  optionalIsoDate,
  optionalText,
  requiredText,
  isoDate,
  type ActionState,
  type PendingItem,
} from './common.js';
import {
  AvailabilityKind,
  AvailabilityStatus,
  BusinessStatus,
  CatalogVisibility,
  Mobility,
  RateUnit,
  SkillCategory,
  WorkMode,
  type ProfileOrigin,
  type ProfileValidationStatus,
  type QualificationStatus,
} from './enums.js';

const year = z.coerce.number().int().min(1950).max(2100);
const month = z.coerce.number().int().min(1).max(12);

export const updateProfileSchema = z.object({
  headline: optionalText(200),
  summary: optionalText(5000),
  yearsOfExperience: z.coerce.number().int().min(0).max(70).nullish(),
  city: optionalText(100),
  region: optionalText(100),
  country: optionalCountryCode,
  mobility: z.enum(Mobility).nullish(),
  mobilityNote: optionalText(500),
  workModes: z.array(z.enum(WorkMode)).max(3).optional(),
  businessStatus: z.enum(BusinessStatus).nullish(),
  rateMin: optionalDecimalString(),
  rateMax: optionalDecimalString(),
  rateUnit: z.enum(RateUnit).nullish(),
  rateCurrency: currency.nullish(),
  rateNote: optionalText(500),
});
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;

export const profileSkillsSchema = z.object({
  skills: z
    .array(
      z.object({
        name: requiredText(100),
        category: z.enum(SkillCategory).default('TECHNICAL'),
        level: optionalText(50),
        yearsOfExperience: z.coerce.number().int().min(0).max(70).nullish(),
      }),
    )
    .max(80, '80 compétences maximum'),
});
export type ProfileSkillsInput = z.infer<typeof profileSkillsSchema>;

export const experienceSchema = z.object({
  title: requiredText(200),
  organization: optionalText(200),
  location: optionalText(200),
  periodLabel: optionalText(100),
  startYear: year.nullish(),
  startMonth: month.nullish(),
  endYear: year.nullish(),
  endMonth: month.nullish(),
  isCurrent: z.boolean().default(false),
  description: optionalText(5000),
  position: z.coerce.number().int().min(0).max(1000).optional(),
});
export type ExperienceInput = z.infer<typeof experienceSchema>;

export const educationSchema = z.object({
  title: requiredText(300),
  institution: optionalText(200),
  periodLabel: optionalText(100),
  year: year.nullish(),
  description: optionalText(2000),
  position: z.coerce.number().int().min(0).max(1000).optional(),
});
export type EducationInput = z.infer<typeof educationSchema>;

export const profileLanguagesSchema = z.object({
  languages: z
    .array(z.object({ name: requiredText(100), level: optionalText(100) }))
    .max(20, '20 langues maximum'),
});
export type ProfileLanguagesInput = z.infer<typeof profileLanguagesSchema>;

export const qualificationSchema = z.object({
  name: requiredText(200),
  issuer: optionalText(200),
  reference: optionalText(200),
  obtainedAt: optionalIsoDate,
  expiresAt: optionalIsoDate,
});
export type QualificationInput = z.infer<typeof qualificationSchema>;

export const availabilitySchema = z.object({
  kind: z.enum(AvailabilityKind),
  startDate: isoDate,
  endDate: optionalIsoDate,
  daysPerWeek: optionalDecimalString({ scale: 1, max: 7 }),
  note: optionalText(500),
});
export type AvailabilityInput = z.infer<typeof availabilitySchema>;

export const availabilityStatusSchema = z.object({
  availabilityStatus: z.enum(AvailabilityStatus),
  availableFrom: optionalIsoDate,
});
export type AvailabilityStatusInput = z.infer<typeof availabilityStatusSchema>;

export const publicationSchema = z.object({
  catalogVisibility: z.enum(CatalogVisibility),
  /** Consentement explicite exigé pour PUBLIC_ANONYMOUS. */
  consent: z.boolean(),
});
export type PublicationInput = z.infer<typeof publicationSchema>;

export interface SkillView {
  skillId: string;
  name: string;
  category: SkillCategory;
  level: string | null;
  yearsOfExperience: number | null;
}

export interface ExperienceView {
  id: string;
  position: number;
  title: string;
  organization: string | null;
  location: string | null;
  periodLabel: string | null;
  startYear: number | null;
  startMonth: number | null;
  endYear: number | null;
  endMonth: number | null;
  isCurrent: boolean;
  description: string | null;
}

export interface EducationView {
  id: string;
  position: number;
  title: string;
  institution: string | null;
  periodLabel: string | null;
  year: number | null;
  description: string | null;
}

export interface LanguageView {
  id: string;
  name: string;
  level: string | null;
}

export interface QualificationView {
  id: string;
  name: string;
  issuer: string | null;
  reference: string | null;
  obtainedAt: string | null;
  expiresAt: string | null;
  status: QualificationStatus;
  verificationNote: string | null;
}

export interface AvailabilityView {
  id: string;
  kind: AvailabilityKind;
  startDate: string;
  endDate: string | null;
  daysPerWeek: string | null;
  note: string | null;
}

/** Contenu professionnel commun (sans identité ni coordonnées). */
export interface ProfessionalProfile {
  id: string;
  headline: string | null;
  summary: string | null;
  yearsOfExperience: number | null;
  city: string | null;
  region: string | null;
  country: string | null;
  mobility: Mobility | null;
  mobilityNote: string | null;
  workModes: WorkMode[];
  availabilityStatus: AvailabilityStatus;
  availableFrom: string | null;
  skills: SkillView[];
  experiences: ExperienceView[];
  educations: EducationView[];
  languages: LanguageView[];
}

/** Vue complète pour le freelance lui-même. */
export interface OwnProfileView extends ProfessionalProfile {
  origin: ProfileOrigin;
  businessStatus: BusinessStatus | null;
  rateMin: string | null;
  rateMax: string | null;
  rateUnit: RateUnit | null;
  rateCurrency: string | null;
  rateNote: string | null;
  validationStatus: ProfileValidationStatus;
  validationNote: string | null;
  submittedAt: string | null;
  reviewedAt: string | null;
  catalogVisibility: CatalogVisibility;
  publicationConsentAt: string | null;
  qualifications: QualificationView[];
  availabilities: AvailabilityView[];
  fieldsToConfirm: string[];
  /** Éléments requis manquants pour soumettre le profil. */
  missingForSubmission: string[];
  updatedAt: string;
  actions: ActionState[];
  pending: PendingItem[];
}

/** Vue d'administration : ajoute identité, provenance et notes internes. */
export interface AdminProfileView extends OwnProfileView {
  user: { id: string; email: string; firstName: string; lastName: string; status: string } | null;
  sourceUrl: string | null;
  sourceCollectedAt: string | null;
  sourceExternalKey: string | null;
  importLockedFields: string[];
  internalNotes: string | null;
  changedSinceReview: boolean;
  isDemo: boolean;
}

/** Vue d'un candidat pour une entreprise : profil professionnel, identité réduite, aucune coordonnée. */
export interface CandidateProfileView extends ProfessionalProfile {
  displayName: string;
  qualifications: Array<Pick<QualificationView, 'id' | 'name' | 'issuer' | 'status' | 'expiresAt'>>;
}

/** Fiche publique anonymisée (catalogue). */
export interface PublicProfileView {
  id: string;
  headline: string;
  summary: string | null;
  yearsOfExperience: number | null;
  city: string | null;
  country: string | null;
  mobility: Mobility | null;
  workModes: WorkMode[];
  availabilityStatus: AvailabilityStatus;
  availableFrom: string | null;
  skills: Array<Pick<SkillView, 'name' | 'category'>>;
  experiences: Array<Pick<ExperienceView, 'title' | 'organization' | 'periodLabel' | 'description'>>;
  educations: Array<Pick<EducationView, 'title' | 'institution' | 'periodLabel'>>;
  languages: Array<Pick<LanguageView, 'name' | 'level'>>;
}

export interface PublicProfileListItem {
  id: string;
  headline: string;
  summaryExcerpt: string | null;
  yearsOfExperience: number | null;
  city: string | null;
  country: string | null;
  availabilityStatus: AvailabilityStatus;
  skills: string[];
}

export const publicProfilesQuery = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(12),
  q: z.string().trim().max(200).optional(),
  skill: z.string().trim().max(100).optional(),
  country: z.string().trim().max(2).optional(),
  availability: z.enum(AvailabilityStatus).optional(),
});
export type PublicProfilesQuery = z.infer<typeof publicProfilesQuery>;

export interface AdminProfileListItem {
  id: string;
  headline: string | null;
  origin: ProfileOrigin;
  validationStatus: ProfileValidationStatus;
  catalogVisibility: CatalogVisibility;
  userEmail: string | null;
  userName: string | null;
  city: string | null;
  country: string | null;
  submittedAt: string | null;
  updatedAt: string;
  changedSinceReview: boolean;
  isDemo: boolean;
}

export const adminUpdateProfileSchema = updateProfileSchema.extend({
  internalNotes: optionalText(5000),
  /** Motif obligatoire : toute modification administrative est tracée. */
  reason: z.string().trim().min(3, 'Motif obligatoire').max(2000),
});
export type AdminUpdateProfileInput = z.infer<typeof adminUpdateProfileSchema>;

export interface SkillSuggestion {
  id: string;
  name: string;
  category: SkillCategory;
}
