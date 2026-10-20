// Énumérations métier partagées. Elles reflètent exactement celles du schéma Prisma :
// l'API vérifie cette parité à la compilation (apps/api/src/common/enum-parity.ts).

const values = <const T extends readonly [string, ...string[]]>(...items: T) => items;

export const RoleCode = values('PLATFORM_ADMIN', 'COMPANY', 'FREELANCER');
export type RoleCode = (typeof RoleCode)[number];

export const UserStatus = values('PENDING_VERIFICATION', 'ACTIVE', 'SUSPENDED', 'DISABLED');
export type UserStatus = (typeof UserStatus)[number];

export const CompanyVerificationStatus = values(
  'NOT_SUBMITTED',
  'PENDING',
  'VERIFIED',
  'CHANGES_REQUESTED',
  'REJECTED',
);
export type CompanyVerificationStatus = (typeof CompanyVerificationStatus)[number];

export const CompanyStatus = values('ACTIVE', 'SUSPENDED');
export type CompanyStatus = (typeof CompanyStatus)[number];

export const CompanyRole = values('OWNER', 'MEMBER');
export type CompanyRole = (typeof CompanyRole)[number];

export const MembershipStatus = values('ACTIVE', 'REVOKED');
export type MembershipStatus = (typeof MembershipStatus)[number];

export const ContactKind = values('PRIMARY', 'BILLING', 'OPERATIONS', 'OTHER');
export type ContactKind = (typeof ContactKind)[number];

export const InvitationType = values('COMPANY_MEMBER', 'PROFILE_CLAIM');
export type InvitationType = (typeof InvitationType)[number];

export const InvitationStatus = values('PENDING', 'ACCEPTED', 'REVOKED', 'EXPIRED');
export type InvitationStatus = (typeof InvitationStatus)[number];

export const ProfileOrigin = values('SELF_REGISTERED', 'IMPORTED', 'DEMO');
export type ProfileOrigin = (typeof ProfileOrigin)[number];

export const ProfileValidationStatus = values(
  'DRAFT',
  'SUBMITTED',
  'APPROVED',
  'CHANGES_REQUESTED',
  'REJECTED',
  'SUSPENDED',
);
export type ProfileValidationStatus = (typeof ProfileValidationStatus)[number];

export const CatalogVisibility = values('PRIVATE', 'PUBLIC_ANONYMOUS');
export type CatalogVisibility = (typeof CatalogVisibility)[number];

export const Mobility = values('LOCAL', 'REGIONAL', 'NATIONAL', 'INTERNATIONAL');
export type Mobility = (typeof Mobility)[number];

export const WorkMode = values('ONSITE', 'REMOTE', 'HYBRID');
export type WorkMode = (typeof WorkMode)[number];

export const BusinessStatus = values('MICRO_ENTREPRENEUR', 'COMPANY', 'PORTAGE', 'OTHER');
export type BusinessStatus = (typeof BusinessStatus)[number];

export const AvailabilityStatus = values('UNKNOWN', 'AVAILABLE_NOW', 'AVAILABLE_FROM', 'UNAVAILABLE');
export type AvailabilityStatus = (typeof AvailabilityStatus)[number];

export const RateUnit = values('HOUR', 'DAY');
export type RateUnit = (typeof RateUnit)[number];

export const SkillCategory = values('TECHNICAL', 'SOFTWARE', 'MANAGEMENT', 'DOMAIN', 'OTHER');
export type SkillCategory = (typeof SkillCategory)[number];

export const QualificationStatus = values(
  'DECLARED',
  'PENDING_VERIFICATION',
  'VERIFIED',
  'REJECTED',
  'EXPIRED',
);
export type QualificationStatus = (typeof QualificationStatus)[number];

export const AvailabilityKind = values('AVAILABLE', 'PARTIAL', 'UNAVAILABLE');
export type AvailabilityKind = (typeof AvailabilityKind)[number];

export const MissionPublicationStatus = values(
  'DRAFT',
  'PENDING_REVIEW',
  'CHANGES_REQUESTED',
  'PUBLISHED',
  'REJECTED',
  'UNPUBLISHED',
);
export type MissionPublicationStatus = (typeof MissionPublicationStatus)[number];

export const MissionStatus = values('OPEN', 'SELECTION', 'ACTIVE', 'SUSPENDED', 'COMPLETED', 'CANCELLED');
export type MissionStatus = (typeof MissionStatus)[number];

export const ApplicationStatus = values(
  'SUBMITTED',
  'SHORTLISTED',
  'SELECTED',
  'REJECTED',
  'WITHDRAWN',
  'CLOSED',
);
export type ApplicationStatus = (typeof ApplicationStatus)[number];

export const ProposalStatus = values(
  'DRAFT',
  'SENT',
  'PARTIES_AGREED',
  'APPROVED',
  'DECLINED',
  'WITHDRAWN',
  'SUPERSEDED',
);
export type ProposalStatus = (typeof ProposalStatus)[number];

export const PartyDecision = values('PENDING', 'ACCEPTED', 'DECLINED');
export type PartyDecision = (typeof PartyDecision)[number];

export const BillingUnit = values('HOUR', 'DAY');
export type BillingUnit = (typeof BillingUnit)[number];

export const CommissionPayer = values('CLIENT', 'FREELANCER', 'NONE');
export type CommissionPayer = (typeof CommissionPayer)[number];

export const CommissionMode = values('PERCENTAGE', 'FIXED_PER_UNIT');
export type CommissionMode = (typeof CommissionMode)[number];

export const CommissionBase = values('CLIENT_AMOUNT', 'FREELANCE_AMOUNT');
export type CommissionBase = (typeof CommissionBase)[number];

export const InvoiceAddressee = values('EMPGT', 'CLIENT');
export type InvoiceAddressee = (typeof InvoiceAddressee)[number];

export const ContractStatus = values(
  'AWAITING_SIGNATURE',
  'SIGNED',
  'ACTIVE',
  'SUSPENDED',
  'COMPLETED',
  'TERMINATED',
  'CANCELLED',
);
export type ContractStatus = (typeof ContractStatus)[number];

export const AmendmentType = values('EXTENSION', 'TERMS_CHANGE', 'OTHER');
export type AmendmentType = (typeof AmendmentType)[number];

export const AmendmentStatus = values('DRAFT', 'AWAITING_SIGNATURE', 'SIGNED', 'CANCELLED');
export type AmendmentStatus = (typeof AmendmentStatus)[number];

export const TimesheetStatus = values(
  'DRAFT',
  'SUBMITTED',
  'APPROVED',
  'CHANGES_REQUESTED',
  'SUPERSEDED',
  'CANCELLED',
);
export type TimesheetStatus = (typeof TimesheetStatus)[number];

export const DisputeSubject = values('TIMESHEET', 'INVOICE', 'CONTRACT');
export type DisputeSubject = (typeof DisputeSubject)[number];

export const DisputeStatus = values('OPEN', 'RESOLVED', 'CLOSED');
export type DisputeStatus = (typeof DisputeStatus)[number];

export const DocumentKind = values(
  'CV',
  'IDENTITY',
  'INSURANCE',
  'COMPANY_REGISTRATION',
  'TAX_SOCIAL_CERTIFICATE',
  'QUALIFICATION_CERTIFICATE',
  'SIGNED_CONTRACT',
  'SIGNED_AMENDMENT',
  'INVOICE',
  'PAYMENT_PROOF',
  'TIMESHEET_ATTACHMENT',
  'IMPORT_SNAPSHOT',
  'OTHER',
);
export type DocumentKind = (typeof DocumentKind)[number];

export const DocumentVisibility = values(
  'OWNER_AND_ADMIN',
  'CONTRACT_PARTIES',
  'COMPANY_AND_ADMIN',
  'ADMIN_ONLY',
);
export type DocumentVisibility = (typeof DocumentVisibility)[number];

export const DocumentVerificationStatus = values(
  'NOT_REQUIRED',
  'PENDING',
  'VERIFIED',
  'REJECTED',
  'EXPIRED',
);
export type DocumentVerificationStatus = (typeof DocumentVerificationStatus)[number];

export const InvoiceKind = values('CLIENT_INVOICE', 'FREELANCER_INVOICE');
export type InvoiceKind = (typeof InvoiceKind)[number];

export const InvoiceStatus = values('SUBMITTED', 'VERIFIED', 'REJECTED', 'CANCELLED');
export type InvoiceStatus = (typeof InvoiceStatus)[number];

export const PaymentState = values('UNPAID', 'PARTIALLY_PAID', 'PAID');
export type PaymentState = (typeof PaymentState)[number];

export const PaymentMethod = values('BANK_TRANSFER', 'CHEQUE', 'OTHER');
export type PaymentMethod = (typeof PaymentMethod)[number];

export const RecordStatus = values('RECORDED', 'CANCELLED');
export type RecordStatus = (typeof RecordStatus)[number];

export const PayoutMethodType = values('MANUAL_BANK_TRANSFER', 'PROVIDER');
export type PayoutMethodType = (typeof PayoutMethodType)[number];

export const PaymentConfigStatus = values(
  'NOT_CONFIGURED',
  'PENDING_DECISION',
  'MANUAL_CONFIRMED',
  'PROVIDER_ONBOARDING',
  'PROVIDER_ACTIVE',
);
export type PaymentConfigStatus = (typeof PaymentConfigStatus)[number];

export const ReviewAuthorRole = values('COMPANY', 'FREELANCER', 'ADMIN');
export type ReviewAuthorRole = (typeof ReviewAuthorRole)[number];

export const ReviewSubject = values('FREELANCER', 'COMPANY');
export type ReviewSubject = (typeof ReviewSubject)[number];

export const ImportItemStatus = values('PENDING_REVIEW', 'APPROVED', 'IGNORED', 'DUPLICATE');
export type ImportItemStatus = (typeof ImportItemStatus)[number];

export const ImportItemChange = values('NEW', 'UNCHANGED', 'CHANGED');
export type ImportItemChange = (typeof ImportItemChange)[number];

export const ImportBatchStatus = values('PREVIEW', 'COMPLETED', 'FAILED');
export type ImportBatchStatus = (typeof ImportBatchStatus)[number];

export const IntegrationScope = values(
  'FREELANCERS',
  'SKILLS',
  'AVAILABILITY',
  'MISSIONS',
  'APPLICATIONS',
  'CONTRACTS',
  'COSTS',
  'REVIEWS',
  'DOCUMENTS_METADATA',
);
export type IntegrationScope = (typeof IntegrationScope)[number];

/** Devises acceptées en V1 et nombre de décimales (exposant ISO 4217). Liste à confirmer : décision D-02. */
export const CURRENCIES = {
  EUR: 2,
  MAD: 2,
  XOF: 0,
  XAF: 0,
  USD: 2,
} as const;
export type Currency = keyof typeof CURRENCIES;
export const CurrencyCode = Object.keys(CURRENCIES) as [Currency, ...Currency[]];
