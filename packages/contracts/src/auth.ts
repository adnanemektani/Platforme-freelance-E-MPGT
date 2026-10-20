import { z } from 'zod';
import { email, optionalCountryCode, password, phone, requiredText } from './common.js';
import type {
  CompanyRole,
  CompanyStatus,
  CompanyVerificationStatus,
  ProfileValidationStatus,
  RoleCode,
  UserStatus,
} from './enums.js';

const acceptTerms = z.literal(true, {
  message: "L'acceptation des conditions d'utilisation est obligatoire",
});

const identity = {
  email,
  password,
  firstName: requiredText(100),
  lastName: requiredText(100),
  phone,
  acceptTerms,
};

export const registerCompanySchema = z.object({
  ...identity,
  companyName: requiredText(200),
  country: optionalCountryCode,
});
export type RegisterCompanyInput = z.infer<typeof registerCompanySchema>;

export const registerFreelancerSchema = z.object(identity);
export type RegisterFreelancerInput = z.infer<typeof registerFreelancerSchema>;

export const loginSchema = z.object({
  email,
  password: z.string({ message: 'Mot de passe obligatoire' }).min(1, 'Mot de passe obligatoire').max(128),
});
export type LoginInput = z.infer<typeof loginSchema>;

export const tokenSchema = z.object({
  token: z.string().trim().min(20, 'Lien invalide').max(200, 'Lien invalide'),
});
export type TokenInput = z.infer<typeof tokenSchema>;

export const emailOnlySchema = z.object({ email });
export type EmailOnlyInput = z.infer<typeof emailOnlySchema>;

export const resetPasswordSchema = z.object({
  token: tokenSchema.shape.token,
  password,
});
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Mot de passe actuel obligatoire').max(128),
  newPassword: password,
});
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;

export const updateMeSchema = z.object({
  firstName: requiredText(100).optional(),
  lastName: requiredText(100).optional(),
  phone,
});
export type UpdateMeInput = z.infer<typeof updateMeSchema>;

export const acceptInvitationSchema = z.object({
  token: tokenSchema.shape.token,
  firstName: requiredText(100).optional(),
  lastName: requiredText(100).optional(),
  /** Obligatoire si l'adresse invitée n'a pas encore de compte. */
  password: password.optional(),
  acceptTerms: acceptTerms.optional(),
});
export type AcceptInvitationInput = z.infer<typeof acceptInvitationSchema>;

export type Space = 'company' | 'freelancer' | 'admin';

export interface SessionUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  phone: string | null;
  status: UserStatus;
  emailVerified: boolean;
  roles: RoleCode[];
  space: Space;
  isDemo: boolean;
  company: {
    id: string;
    legalName: string;
    verificationStatus: CompanyVerificationStatus;
    status: CompanyStatus;
    membershipRole: CompanyRole;
  } | null;
  freelancerProfile: {
    id: string;
    headline: string | null;
    validationStatus: ProfileValidationStatus;
  } | null;
}

export interface MeResponse {
  user: SessionUser;
  csrfToken: string;
  unreadNotifications: number;
}

export interface InvitationPreview {
  type: 'COMPANY_MEMBER' | 'PROFILE_CLAIM';
  email: string;
  companyName: string | null;
  profileHeadline: string | null;
  accountExists: boolean;
  expiresAt: string;
}

export interface SessionInfo {
  id: string;
  createdAt: string;
  lastSeenAt: string;
  expiresAt: string;
  userAgent: string | null;
  ipPrefix: string | null;
  current: boolean;
}

export interface MessageResponse {
  message: string;
}
