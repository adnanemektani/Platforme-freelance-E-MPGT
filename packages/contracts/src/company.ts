import { z } from 'zod';
import {
  email,
  optionalCountryCode,
  optionalText,
  optionalUrl,
  phone,
  requiredText,
  type ActionState,
  type PendingItem,
} from './common.js';
import {
  CompanyRole,
  ContactKind,
  type CompanyStatus,
  type CompanyVerificationStatus,
  type MembershipStatus,
} from './enums.js';

export const updateCompanySchema = z.object({
  legalName: requiredText(200).optional(),
  tradeName: optionalText(200),
  legalForm: optionalText(100),
  registrationNumber: optionalText(100),
  registrationType: optionalText(100),
  vatNumber: optionalText(100),
  addressLine1: optionalText(200),
  addressLine2: optionalText(200),
  postalCode: optionalText(20),
  city: optionalText(100),
  country: optionalCountryCode,
  sector: optionalText(200),
  sizeRange: optionalText(50),
  website: optionalUrl,
  description: optionalText(4000),
});
export type UpdateCompanyInput = z.infer<typeof updateCompanySchema>;

export const companyContactSchema = z.object({
  kind: z.enum(ContactKind).default('PRIMARY'),
  fullName: requiredText(200),
  jobTitle: optionalText(200),
  email: email.nullish().transform((value) => value ?? null),
  phone,
});
export type CompanyContactInput = z.infer<typeof companyContactSchema>;

export const inviteMemberSchema = z.object({
  email,
  role: z.enum(CompanyRole).default('MEMBER'),
  message: optionalText(1000),
});
export type InviteMemberInput = z.infer<typeof inviteMemberSchema>;

export interface CompanyContactView {
  id: string;
  kind: ContactKind;
  fullName: string;
  jobTitle: string | null;
  email: string | null;
  phone: string | null;
}

export interface CompanyMemberView {
  membershipId: string;
  userId: string;
  firstName: string;
  lastName: string;
  email: string;
  role: CompanyRole;
  status: MembershipStatus;
  since: string;
}

export interface CompanyInvitationView {
  id: string;
  email: string;
  role: CompanyRole | null;
  status: string;
  expiresAt: string;
  createdAt: string;
}

export interface CompanyView {
  id: string;
  legalName: string;
  tradeName: string | null;
  legalForm: string | null;
  registrationNumber: string | null;
  registrationType: string | null;
  vatNumber: string | null;
  addressLine1: string | null;
  addressLine2: string | null;
  postalCode: string | null;
  city: string | null;
  country: string | null;
  sector: string | null;
  sizeRange: string | null;
  website: string | null;
  description: string | null;
  verificationStatus: CompanyVerificationStatus;
  verificationNote: string | null;
  verificationSubmittedAt: string | null;
  verifiedAt: string | null;
  status: CompanyStatus;
  statusReason: string | null;
  isDemo: boolean;
  createdAt: string;
  contacts: CompanyContactView[];
  members: CompanyMemberView[];
  invitations: CompanyInvitationView[];
  /** Champs requis manquants pour soumettre la vérification. */
  missingForVerification: string[];
  /** Champs d'identité légale verrouillés après vérification (modification via E-MPGT). */
  lockedFields: string[];
  actions: ActionState[];
  pending: PendingItem[];
}

/** Vue d'administration : ajoute les notes internes et des compteurs. */
export interface AdminCompanyView extends CompanyView {
  internalNotes: string | null;
  stats: {
    missions: number;
    publishedMissions: number;
    activeContracts: number;
  };
}

export interface AdminCompanyListItem {
  id: string;
  legalName: string;
  country: string | null;
  city: string | null;
  verificationStatus: CompanyVerificationStatus;
  status: CompanyStatus;
  ownerEmail: string | null;
  missions: number;
  isDemo: boolean;
  createdAt: string;
  verificationSubmittedAt: string | null;
}
