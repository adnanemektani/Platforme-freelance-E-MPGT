import type {
  AdminProfileListItem,
  AdminProfileView,
  CandidateProfileView,
  OwnProfileView,
  ProfessionalProfile,
  PublicProfileListItem,
  PublicProfileView,
} from '@empgt/contracts';
import type { Prisma } from '../../generated/prisma/client.js';
import { visibleActions } from '../../common/actions.js';
import { toIso, toIsoDate } from '../../common/dates.js';
import { decimalString } from '../../common/money.js';
import { displayName, excerpt, fullName } from '../../common/text.js';
import type { Actor } from '../auth/actor.js';
import { missingForSubmission, profileActions, profilePending } from './profile.policy.js';

export const profileInclude = {
  skills: { include: { skill: true }, orderBy: { skill: { name: 'asc' } } },
  experiences: { orderBy: [{ position: 'asc' }, { startYear: 'desc' }] },
  educations: { orderBy: [{ position: 'asc' }, { year: 'desc' }] },
  languages: { orderBy: { position: 'asc' } },
  qualifications: { orderBy: { createdAt: 'asc' } },
  availabilities: { orderBy: { startDate: 'asc' } },
  user: { select: { id: true, email: true, firstName: true, lastName: true, status: true, isDemo: true } },
} satisfies Prisma.FreelancerProfileInclude;

export type ProfileFull = Prisma.FreelancerProfileGetPayload<{ include: typeof profileInclude }>;

function professional(profile: ProfileFull): ProfessionalProfile {
  return {
    id: profile.id,
    headline: profile.headline,
    summary: profile.summary,
    yearsOfExperience: profile.yearsOfExperience,
    city: profile.city,
    region: profile.region,
    country: profile.country,
    mobility: profile.mobility,
    mobilityNote: profile.mobilityNote,
    workModes: profile.workModes,
    availabilityStatus: profile.availabilityStatus,
    availableFrom: toIsoDate(profile.availableFrom),
    skills: profile.skills.map((s) => ({
      skillId: s.skillId,
      name: s.skill.name,
      category: s.skill.category,
      level: s.level,
      yearsOfExperience: s.yearsOfExperience,
    })),
    experiences: profile.experiences.map((e) => ({
      id: e.id,
      position: e.position,
      title: e.title,
      organization: e.organization,
      location: e.location,
      periodLabel: e.periodLabel,
      startYear: e.startYear,
      startMonth: e.startMonth,
      endYear: e.endYear,
      endMonth: e.endMonth,
      isCurrent: e.isCurrent,
      description: e.description,
    })),
    educations: profile.educations.map((e) => ({
      id: e.id,
      position: e.position,
      title: e.title,
      institution: e.institution,
      periodLabel: e.periodLabel,
      year: e.year,
      description: e.description,
    })),
    languages: profile.languages.map((l) => ({ id: l.id, name: l.name, level: l.level })),
  };
}

function counts(profile: ProfileFull) {
  return { skills: profile.skills.length, experiences: profile.experiences.length };
}

export function toOwnView(profile: ProfileFull, actor: Actor): OwnProfileView {
  return {
    ...professional(profile),
    origin: profile.origin,
    businessStatus: profile.businessStatus,
    rateMin: decimalString(profile.rateMin),
    rateMax: decimalString(profile.rateMax),
    rateUnit: profile.rateUnit,
    rateCurrency: profile.rateCurrency,
    rateNote: profile.rateNote,
    validationStatus: profile.validationStatus,
    validationNote: profile.validationNote,
    submittedAt: toIso(profile.submittedAt),
    reviewedAt: toIso(profile.reviewedAt),
    catalogVisibility: profile.catalogVisibility,
    publicationConsentAt: toIso(profile.publicationConsentAt),
    qualifications: profile.qualifications.map((q) => ({
      id: q.id,
      name: q.name,
      issuer: q.issuer,
      reference: q.reference,
      obtainedAt: toIsoDate(q.obtainedAt),
      expiresAt: toIsoDate(q.expiresAt),
      status: q.status,
      verificationNote: q.verificationNote,
    })),
    availabilities: profile.availabilities.map((a) => ({
      id: a.id,
      kind: a.kind,
      startDate: toIsoDate(a.startDate),
      endDate: toIsoDate(a.endDate),
      daysPerWeek: decimalString(a.daysPerWeek),
      note: a.note,
    })),
    fieldsToConfirm: profile.fieldsToConfirm,
    missingForSubmission: missingForSubmission(profile, counts(profile)),
    updatedAt: toIso(profile.updatedAt),
    actions: visibleActions(profileActions(actor, profile, counts(profile))),
    pending: actor.isAdmin ? [] : profilePending(profile, counts(profile)),
  };
}

export function toAdminView(profile: ProfileFull, actor: Actor): AdminProfileView {
  return {
    ...toOwnView(profile, actor),
    user: profile.user
      ? {
          id: profile.user.id,
          email: profile.user.email,
          firstName: profile.user.firstName,
          lastName: profile.user.lastName,
          status: profile.user.status,
        }
      : null,
    sourceUrl: profile.sourceUrl,
    sourceCollectedAt: toIso(profile.sourceCollectedAt),
    sourceExternalKey: profile.sourceExternalKey,
    importLockedFields: profile.importLockedFields,
    internalNotes: profile.internalNotes,
    changedSinceReview: Boolean(profile.reviewedAt && profile.updatedAt > profile.reviewedAt),
    isDemo: profile.origin === 'DEMO' || Boolean(profile.user?.isDemo),
  };
}

/** Vue entreprise d'un candidat : contenu professionnel, prénom + initiale, aucune coordonnée ni tarif. */
export function toCandidateView(profile: ProfileFull): CandidateProfileView {
  return {
    ...professional(profile),
    displayName: displayName(profile.user?.firstName, profile.user?.lastName),
    qualifications: profile.qualifications
      .filter((q) => q.status !== 'REJECTED')
      .map((q) => ({ id: q.id, name: q.name, issuer: q.issuer, status: q.status, expiresAt: toIsoDate(q.expiresAt) })),
  };
}

/** Fiche publique anonymisée : ni nom, ni coordonnées, ni organisation exacte des diplômes au-delà du libellé. */
export function toPublicView(profile: ProfileFull): PublicProfileView {
  const p = professional(profile);
  return {
    id: p.id,
    headline: p.headline ?? 'Profil BTP',
    summary: p.summary,
    yearsOfExperience: p.yearsOfExperience,
    city: p.city,
    country: p.country,
    mobility: p.mobility,
    workModes: p.workModes,
    availabilityStatus: p.availabilityStatus,
    availableFrom: p.availableFrom,
    skills: p.skills.map((s) => ({ name: s.name, category: s.category })),
    experiences: p.experiences.map((e) => ({
      title: e.title,
      organization: e.organization,
      periodLabel: e.periodLabel,
      description: e.description,
    })),
    educations: p.educations.map((e) => ({ title: e.title, institution: e.institution, periodLabel: e.periodLabel })),
    languages: p.languages.map((l) => ({ name: l.name, level: l.level })),
  };
}

export function toPublicListItem(profile: ProfileFull): PublicProfileListItem {
  return {
    id: profile.id,
    headline: profile.headline ?? 'Profil BTP',
    summaryExcerpt: excerpt(profile.summary),
    yearsOfExperience: profile.yearsOfExperience,
    city: profile.city,
    country: profile.country,
    availabilityStatus: profile.availabilityStatus,
    skills: profile.skills.slice(0, 8).map((s) => s.skill.name),
  };
}

export function toAdminListItem(
  profile: Prisma.FreelancerProfileGetPayload<{ include: { user: { select: { email: true; firstName: true; lastName: true; isDemo: true } } } }>,
): AdminProfileListItem {
  return {
    id: profile.id,
    headline: profile.headline,
    origin: profile.origin,
    validationStatus: profile.validationStatus,
    catalogVisibility: profile.catalogVisibility,
    userEmail: profile.user?.email ?? null,
    userName: profile.user ? fullName(profile.user.firstName, profile.user.lastName) : null,
    city: profile.city,
    country: profile.country,
    submittedAt: toIso(profile.submittedAt),
    updatedAt: toIso(profile.updatedAt),
    changedSinceReview: Boolean(profile.reviewedAt && profile.updatedAt > profile.reviewedAt),
    isDemo: profile.origin === 'DEMO' || Boolean(profile.user?.isDemo),
  };
}
