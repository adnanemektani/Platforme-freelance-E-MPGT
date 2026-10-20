-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "RoleCode" AS ENUM ('PLATFORM_ADMIN', 'COMPANY', 'FREELANCER');

-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('PENDING_VERIFICATION', 'ACTIVE', 'SUSPENDED', 'DISABLED');

-- CreateEnum
CREATE TYPE "AuthTokenType" AS ENUM ('EMAIL_VERIFICATION', 'PASSWORD_RESET');

-- CreateEnum
CREATE TYPE "InvitationType" AS ENUM ('COMPANY_MEMBER', 'PROFILE_CLAIM');

-- CreateEnum
CREATE TYPE "InvitationStatus" AS ENUM ('PENDING', 'ACCEPTED', 'REVOKED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "CompanyVerificationStatus" AS ENUM ('NOT_SUBMITTED', 'PENDING', 'VERIFIED', 'CHANGES_REQUESTED', 'REJECTED');

-- CreateEnum
CREATE TYPE "CompanyStatus" AS ENUM ('ACTIVE', 'SUSPENDED');

-- CreateEnum
CREATE TYPE "CompanyRole" AS ENUM ('OWNER', 'MEMBER');

-- CreateEnum
CREATE TYPE "MembershipStatus" AS ENUM ('ACTIVE', 'REVOKED');

-- CreateEnum
CREATE TYPE "ContactKind" AS ENUM ('PRIMARY', 'BILLING', 'OPERATIONS', 'OTHER');

-- CreateEnum
CREATE TYPE "ProfileOrigin" AS ENUM ('SELF_REGISTERED', 'IMPORTED', 'DEMO');

-- CreateEnum
CREATE TYPE "ProfileValidationStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'APPROVED', 'CHANGES_REQUESTED', 'REJECTED', 'SUSPENDED');

-- CreateEnum
CREATE TYPE "CatalogVisibility" AS ENUM ('PRIVATE', 'PUBLIC_ANONYMOUS');

-- CreateEnum
CREATE TYPE "Mobility" AS ENUM ('LOCAL', 'REGIONAL', 'NATIONAL', 'INTERNATIONAL');

-- CreateEnum
CREATE TYPE "WorkMode" AS ENUM ('ONSITE', 'REMOTE', 'HYBRID');

-- CreateEnum
CREATE TYPE "BusinessStatus" AS ENUM ('MICRO_ENTREPRENEUR', 'COMPANY', 'PORTAGE', 'OTHER');

-- CreateEnum
CREATE TYPE "AvailabilityStatus" AS ENUM ('UNKNOWN', 'AVAILABLE_NOW', 'AVAILABLE_FROM', 'UNAVAILABLE');

-- CreateEnum
CREATE TYPE "RateUnit" AS ENUM ('HOUR', 'DAY');

-- CreateEnum
CREATE TYPE "SkillCategory" AS ENUM ('TECHNICAL', 'SOFTWARE', 'MANAGEMENT', 'DOMAIN', 'OTHER');

-- CreateEnum
CREATE TYPE "QualificationStatus" AS ENUM ('DECLARED', 'PENDING_VERIFICATION', 'VERIFIED', 'REJECTED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "AvailabilityKind" AS ENUM ('AVAILABLE', 'PARTIAL', 'UNAVAILABLE');

-- CreateEnum
CREATE TYPE "MissionPublicationStatus" AS ENUM ('DRAFT', 'PENDING_REVIEW', 'CHANGES_REQUESTED', 'PUBLISHED', 'REJECTED', 'UNPUBLISHED');

-- CreateEnum
CREATE TYPE "MissionStatus" AS ENUM ('OPEN', 'SELECTION', 'ACTIVE', 'SUSPENDED', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ApplicationStatus" AS ENUM ('SUBMITTED', 'SHORTLISTED', 'SELECTED', 'REJECTED', 'WITHDRAWN', 'CLOSED');

-- CreateEnum
CREATE TYPE "ProposalStatus" AS ENUM ('DRAFT', 'SENT', 'PARTIES_AGREED', 'APPROVED', 'DECLINED', 'WITHDRAWN', 'SUPERSEDED');

-- CreateEnum
CREATE TYPE "PartyDecision" AS ENUM ('PENDING', 'ACCEPTED', 'DECLINED');

-- CreateEnum
CREATE TYPE "BillingUnit" AS ENUM ('HOUR', 'DAY');

-- CreateEnum
CREATE TYPE "CommissionPayer" AS ENUM ('CLIENT', 'FREELANCER', 'NONE');

-- CreateEnum
CREATE TYPE "CommissionMode" AS ENUM ('PERCENTAGE', 'FIXED_PER_UNIT');

-- CreateEnum
CREATE TYPE "CommissionBase" AS ENUM ('CLIENT_AMOUNT', 'FREELANCE_AMOUNT');

-- CreateEnum
CREATE TYPE "InvoiceAddressee" AS ENUM ('EMPGT', 'CLIENT');

-- CreateEnum
CREATE TYPE "ContractStatus" AS ENUM ('AWAITING_SIGNATURE', 'SIGNED', 'ACTIVE', 'SUSPENDED', 'COMPLETED', 'TERMINATED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "AmendmentType" AS ENUM ('EXTENSION', 'TERMS_CHANGE', 'OTHER');

-- CreateEnum
CREATE TYPE "AmendmentStatus" AS ENUM ('DRAFT', 'AWAITING_SIGNATURE', 'SIGNED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "TimesheetStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'APPROVED', 'CHANGES_REQUESTED', 'SUPERSEDED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "DisputeSubject" AS ENUM ('TIMESHEET', 'INVOICE', 'CONTRACT');

-- CreateEnum
CREATE TYPE "DisputeStatus" AS ENUM ('OPEN', 'RESOLVED', 'CLOSED');

-- CreateEnum
CREATE TYPE "DocumentKind" AS ENUM ('CV', 'IDENTITY', 'INSURANCE', 'COMPANY_REGISTRATION', 'TAX_SOCIAL_CERTIFICATE', 'QUALIFICATION_CERTIFICATE', 'SIGNED_CONTRACT', 'SIGNED_AMENDMENT', 'INVOICE', 'PAYMENT_PROOF', 'TIMESHEET_ATTACHMENT', 'IMPORT_SNAPSHOT', 'OTHER');

-- CreateEnum
CREATE TYPE "DocumentVisibility" AS ENUM ('OWNER_AND_ADMIN', 'CONTRACT_PARTIES', 'COMPANY_AND_ADMIN', 'ADMIN_ONLY');

-- CreateEnum
CREATE TYPE "DocumentVerificationStatus" AS ENUM ('NOT_REQUIRED', 'PENDING', 'VERIFIED', 'REJECTED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "InvoiceKind" AS ENUM ('CLIENT_INVOICE', 'FREELANCER_INVOICE');

-- CreateEnum
CREATE TYPE "InvoiceStatus" AS ENUM ('SUBMITTED', 'VERIFIED', 'REJECTED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "PaymentState" AS ENUM ('UNPAID', 'PARTIALLY_PAID', 'PAID');

-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('BANK_TRANSFER', 'CHEQUE', 'OTHER');

-- CreateEnum
CREATE TYPE "RecordStatus" AS ENUM ('RECORDED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "PayoutMethodType" AS ENUM ('MANUAL_BANK_TRANSFER', 'PROVIDER');

-- CreateEnum
CREATE TYPE "PaymentConfigStatus" AS ENUM ('NOT_CONFIGURED', 'PENDING_DECISION', 'MANUAL_CONFIRMED', 'PROVIDER_ONBOARDING', 'PROVIDER_ACTIVE');

-- CreateEnum
CREATE TYPE "WebhookEventStatus" AS ENUM ('RECEIVED', 'PROCESSED', 'IGNORED', 'REJECTED');

-- CreateEnum
CREATE TYPE "ReviewAuthorRole" AS ENUM ('COMPANY', 'FREELANCER', 'ADMIN');

-- CreateEnum
CREATE TYPE "ReviewSubject" AS ENUM ('FREELANCER', 'COMPANY');

-- CreateEnum
CREATE TYPE "ReviewVisibility" AS ENUM ('INTERNAL');

-- CreateEnum
CREATE TYPE "NotificationEmailStatus" AS ENUM ('NOT_REQUIRED', 'PENDING', 'SENT', 'FAILED');

-- CreateEnum
CREATE TYPE "ActorType" AS ENUM ('USER', 'SYSTEM', 'CLI', 'INTEGRATION');

-- CreateEnum
CREATE TYPE "ContactRequestStatus" AS ENUM ('NEW', 'HANDLED');

-- CreateEnum
CREATE TYPE "ImportBatchStatus" AS ENUM ('PREVIEW', 'COMPLETED', 'FAILED');

-- CreateEnum
CREATE TYPE "ImportItemStatus" AS ENUM ('PENDING_REVIEW', 'APPROVED', 'IGNORED', 'DUPLICATE');

-- CreateEnum
CREATE TYPE "ImportItemChange" AS ENUM ('NEW', 'UNCHANGED', 'CHANGED');

-- CreateEnum
CREATE TYPE "IntegrationScope" AS ENUM ('FREELANCERS', 'SKILLS', 'AVAILABILITY', 'MISSIONS', 'APPLICATIONS', 'CONTRACTS', 'COSTS', 'REVIEWS', 'DOCUMENTS_METADATA');

-- CreateTable
CREATE TABLE "User" (
    "id" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "phone" TEXT,
    "status" "UserStatus" NOT NULL DEFAULT 'PENDING_VERIFICATION',
    "emailVerifiedAt" TIMESTAMPTZ(3),
    "failedLoginCount" INTEGER NOT NULL DEFAULT 0,
    "lockedUntil" TIMESTAMPTZ(3),
    "lastLoginAt" TIMESTAMPTZ(3),
    "statusReason" TEXT,
    "isDemo" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserRole" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "role" "RoleCode" NOT NULL,
    "grantedById" UUID,
    "grantedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revokedAt" TIMESTAMPTZ(3),

    CONSTRAINT "UserRole_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" UUID NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "userId" UUID NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMPTZ(3) NOT NULL,
    "revokedAt" TIMESTAMPTZ(3),
    "revokedReason" TEXT,
    "ipPrefix" TEXT,
    "userAgent" TEXT,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuthToken" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "type" "AuthTokenType" NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMPTZ(3) NOT NULL,
    "usedAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuthToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Invitation" (
    "id" UUID NOT NULL,
    "type" "InvitationType" NOT NULL,
    "email" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "status" "InvitationStatus" NOT NULL DEFAULT 'PENDING',
    "companyId" UUID,
    "companyRole" "CompanyRole",
    "freelancerProfileId" UUID,
    "message" TEXT,
    "invitedById" UUID NOT NULL,
    "expiresAt" TIMESTAMPTZ(3) NOT NULL,
    "acceptedAt" TIMESTAMPTZ(3),
    "acceptedById" UUID,
    "revokedAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Invitation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Company" (
    "id" UUID NOT NULL,
    "legalName" TEXT NOT NULL,
    "tradeName" TEXT,
    "legalForm" TEXT,
    "registrationNumber" TEXT,
    "registrationType" TEXT,
    "vatNumber" TEXT,
    "addressLine1" TEXT,
    "addressLine2" TEXT,
    "postalCode" TEXT,
    "city" TEXT,
    "country" TEXT,
    "sector" TEXT,
    "sizeRange" TEXT,
    "website" TEXT,
    "description" TEXT,
    "verificationStatus" "CompanyVerificationStatus" NOT NULL DEFAULT 'NOT_SUBMITTED',
    "verificationNote" TEXT,
    "verificationSubmittedAt" TIMESTAMPTZ(3),
    "verifiedAt" TIMESTAMPTZ(3),
    "verifiedById" UUID,
    "status" "CompanyStatus" NOT NULL DEFAULT 'ACTIVE',
    "statusReason" TEXT,
    "internalNotes" TEXT,
    "isDemo" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "Company_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CompanyMembership" (
    "id" UUID NOT NULL,
    "companyId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "role" "CompanyRole" NOT NULL,
    "status" "MembershipStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revokedAt" TIMESTAMPTZ(3),

    CONSTRAINT "CompanyMembership_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CompanyContact" (
    "id" UUID NOT NULL,
    "companyId" UUID NOT NULL,
    "kind" "ContactKind" NOT NULL DEFAULT 'PRIMARY',
    "fullName" TEXT NOT NULL,
    "jobTitle" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "CompanyContact_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FreelancerProfile" (
    "id" UUID NOT NULL,
    "userId" UUID,
    "origin" "ProfileOrigin" NOT NULL,
    "headline" TEXT,
    "summary" TEXT,
    "yearsOfExperience" INTEGER,
    "city" TEXT,
    "region" TEXT,
    "country" TEXT,
    "mobility" "Mobility",
    "mobilityNote" TEXT,
    "workModes" "WorkMode"[] DEFAULT ARRAY[]::"WorkMode"[],
    "businessStatus" "BusinessStatus",
    "availabilityStatus" "AvailabilityStatus" NOT NULL DEFAULT 'UNKNOWN',
    "availableFrom" DATE,
    "rateMin" DECIMAL(14,2),
    "rateMax" DECIMAL(14,2),
    "rateUnit" "RateUnit",
    "rateCurrency" CHAR(3),
    "rateNote" TEXT,
    "validationStatus" "ProfileValidationStatus" NOT NULL DEFAULT 'DRAFT',
    "validationNote" TEXT,
    "submittedAt" TIMESTAMPTZ(3),
    "reviewedAt" TIMESTAMPTZ(3),
    "reviewedById" UUID,
    "catalogVisibility" "CatalogVisibility" NOT NULL DEFAULT 'PRIVATE',
    "publicationConsentAt" TIMESTAMPTZ(3),
    "sourceUrl" TEXT,
    "sourceCollectedAt" TIMESTAMPTZ(3),
    "sourceExternalKey" TEXT,
    "importLockedFields" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "fieldsToConfirm" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "internalNotes" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "FreelancerProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Skill" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "category" "SkillCategory" NOT NULL DEFAULT 'TECHNICAL',
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "Skill_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FreelancerSkill" (
    "id" UUID NOT NULL,
    "profileId" UUID NOT NULL,
    "skillId" UUID NOT NULL,
    "level" TEXT,
    "yearsOfExperience" INTEGER,

    CONSTRAINT "FreelancerSkill_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Experience" (
    "id" UUID NOT NULL,
    "profileId" UUID NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,
    "title" TEXT NOT NULL,
    "organization" TEXT,
    "location" TEXT,
    "periodLabel" TEXT,
    "startYear" INTEGER,
    "startMonth" INTEGER,
    "endYear" INTEGER,
    "endMonth" INTEGER,
    "isCurrent" BOOLEAN NOT NULL DEFAULT false,
    "description" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "Experience_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Education" (
    "id" UUID NOT NULL,
    "profileId" UUID NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,
    "title" TEXT NOT NULL,
    "institution" TEXT,
    "periodLabel" TEXT,
    "year" INTEGER,
    "description" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "Education_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Language" (
    "id" UUID NOT NULL,
    "profileId" UUID NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,
    "name" TEXT NOT NULL,
    "level" TEXT,

    CONSTRAINT "Language_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Qualification" (
    "id" UUID NOT NULL,
    "profileId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "issuer" TEXT,
    "reference" TEXT,
    "obtainedAt" DATE,
    "expiresAt" DATE,
    "status" "QualificationStatus" NOT NULL DEFAULT 'DECLARED',
    "verifiedAt" TIMESTAMPTZ(3),
    "verifiedById" UUID,
    "verificationNote" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "Qualification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Availability" (
    "id" UUID NOT NULL,
    "profileId" UUID NOT NULL,
    "kind" "AvailabilityKind" NOT NULL,
    "startDate" DATE NOT NULL,
    "endDate" DATE,
    "daysPerWeek" DECIMAL(3,1),
    "note" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "Availability_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Mission" (
    "id" UUID NOT NULL,
    "reference" TEXT NOT NULL,
    "companyId" UUID NOT NULL,
    "createdById" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "profileSought" TEXT,
    "sector" TEXT,
    "city" TEXT,
    "region" TEXT,
    "country" TEXT,
    "workMode" "WorkMode",
    "startDate" DATE,
    "endDate" DATE,
    "durationLabel" TEXT,
    "budgetMin" DECIMAL(14,2),
    "budgetMax" DECIMAL(14,2),
    "budgetUnit" "RateUnit",
    "budgetCurrency" CHAR(3),
    "budgetVisibleToFreelancers" BOOLEAN NOT NULL DEFAULT false,
    "applicationDeadline" DATE,
    "publicationStatus" "MissionPublicationStatus" NOT NULL DEFAULT 'DRAFT',
    "status" "MissionStatus" NOT NULL DEFAULT 'OPEN',
    "reviewNote" TEXT,
    "submittedAt" TIMESTAMPTZ(3),
    "reviewedAt" TIMESTAMPTZ(3),
    "reviewedById" UUID,
    "publishedAt" TIMESTAMPTZ(3),
    "statusReason" TEXT,
    "isDemo" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "Mission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MissionSkill" (
    "id" UUID NOT NULL,
    "missionId" UUID NOT NULL,
    "skillId" UUID NOT NULL,
    "required" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "MissionSkill_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Application" (
    "id" UUID NOT NULL,
    "missionId" UUID NOT NULL,
    "profileId" UUID NOT NULL,
    "submittedById" UUID NOT NULL,
    "message" TEXT NOT NULL,
    "availabilityNote" TEXT,
    "proposedRate" DECIMAL(14,2),
    "proposedRateUnit" "RateUnit",
    "proposedRateCurrency" CHAR(3),
    "status" "ApplicationStatus" NOT NULL DEFAULT 'SUBMITTED',
    "statusReason" TEXT,
    "decidedById" UUID,
    "decidedAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "Application_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CommercialProposal" (
    "id" UUID NOT NULL,
    "reference" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "previousId" UUID,
    "missionId" UUID NOT NULL,
    "applicationId" UUID NOT NULL,
    "companyId" UUID NOT NULL,
    "profileId" UUID NOT NULL,
    "status" "ProposalStatus" NOT NULL DEFAULT 'DRAFT',
    "startDate" DATE,
    "endDate" DATE,
    "currency" CHAR(3),
    "billingUnit" "BillingUnit",
    "hoursPerDay" DECIMAL(4,2),
    "freelanceRate" DECIMAL(14,4),
    "clientRate" DECIMAL(14,4),
    "estimatedQuantity" DECIMAL(10,2),
    "commissionPayer" "CommissionPayer",
    "commissionMode" "CommissionMode",
    "commissionBase" "CommissionBase",
    "commissionValue" DECIMAL(14,4),
    "commissionNote" TEXT,
    "commissionVisibleToCompany" BOOLEAN NOT NULL DEFAULT false,
    "commissionVisibleToFreelancer" BOOLEAN NOT NULL DEFAULT false,
    "expensesPolicy" TEXT,
    "taxNote" TEXT,
    "timesheetValidationRule" TEXT,
    "clientPaymentTermsDays" INTEGER,
    "freelancerPaymentTermsDays" INTEGER,
    "paymentTermsNote" TEXT,
    "freelancerInvoiceAddressee" "InvoiceAddressee",
    "companyDecision" "PartyDecision" NOT NULL DEFAULT 'PENDING',
    "companyDecisionAt" TIMESTAMPTZ(3),
    "companyDecisionById" UUID,
    "companyDecisionComment" TEXT,
    "freelancerDecision" "PartyDecision" NOT NULL DEFAULT 'PENDING',
    "freelancerDecisionAt" TIMESTAMPTZ(3),
    "freelancerDecisionById" UUID,
    "freelancerDecisionComment" TEXT,
    "sentAt" TIMESTAMPTZ(3),
    "approvedAt" TIMESTAMPTZ(3),
    "approvedById" UUID,
    "statusReason" TEXT,
    "internalNotes" TEXT,
    "createdById" UUID NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "CommercialProposal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Contract" (
    "id" UUID NOT NULL,
    "reference" TEXT NOT NULL,
    "proposalId" UUID NOT NULL,
    "missionId" UUID NOT NULL,
    "applicationId" UUID NOT NULL,
    "companyId" UUID NOT NULL,
    "profileId" UUID NOT NULL,
    "status" "ContractStatus" NOT NULL DEFAULT 'AWAITING_SIGNATURE',
    "startDate" DATE NOT NULL,
    "endDate" DATE,
    "currency" CHAR(3) NOT NULL,
    "billingUnit" "BillingUnit" NOT NULL,
    "hoursPerDay" DECIMAL(4,2),
    "freelanceRate" DECIMAL(14,4) NOT NULL,
    "clientRate" DECIMAL(14,4) NOT NULL,
    "commissionPayer" "CommissionPayer" NOT NULL,
    "commissionMode" "CommissionMode",
    "commissionBase" "CommissionBase",
    "commissionValue" DECIMAL(14,4),
    "commissionNote" TEXT,
    "commissionVisibleToCompany" BOOLEAN NOT NULL,
    "commissionVisibleToFreelancer" BOOLEAN NOT NULL,
    "expensesPolicy" TEXT,
    "taxNote" TEXT,
    "timesheetValidationRule" TEXT,
    "clientPaymentTermsDays" INTEGER,
    "freelancerPaymentTermsDays" INTEGER,
    "paymentTermsNote" TEXT,
    "freelancerInvoiceAddressee" "InvoiceAddressee" NOT NULL,
    "partiesSnapshot" JSONB NOT NULL,
    "termsSnapshot" JSONB NOT NULL,
    "termsHash" TEXT NOT NULL,
    "currentEndDate" DATE,
    "signedDocumentId" UUID,
    "signedAt" DATE,
    "signatureProofNote" TEXT,
    "signatureRecordedById" UUID,
    "signatureRecordedAt" TIMESTAMPTZ(3),
    "activatedAt" TIMESTAMPTZ(3),
    "activatedById" UUID,
    "closedAt" TIMESTAMPTZ(3),
    "statusReason" TEXT,
    "createdById" UUID NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "Contract_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContractAmendment" (
    "id" UUID NOT NULL,
    "contractId" UUID NOT NULL,
    "number" INTEGER NOT NULL,
    "type" "AmendmentType" NOT NULL,
    "status" "AmendmentStatus" NOT NULL DEFAULT 'AWAITING_SIGNATURE',
    "effectiveDate" DATE NOT NULL,
    "reason" TEXT NOT NULL,
    "newEndDate" DATE,
    "newFreelanceRate" DECIMAL(14,4),
    "newClientRate" DECIMAL(14,4),
    "newHoursPerDay" DECIMAL(4,2),
    "newCommissionValue" DECIMAL(14,4),
    "otherChanges" TEXT,
    "changesSnapshot" JSONB NOT NULL,
    "signedDocumentId" UUID,
    "signedAt" DATE,
    "signatureProofNote" TEXT,
    "signatureRecordedById" UUID,
    "statusReason" TEXT,
    "createdById" UUID NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "ContractAmendment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Timesheet" (
    "id" UUID NOT NULL,
    "contractId" UUID NOT NULL,
    "periodStart" DATE NOT NULL,
    "periodEnd" DATE NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "supersedesId" UUID,
    "status" "TimesheetStatus" NOT NULL DEFAULT 'DRAFT',
    "totalHours" DECIMAL(7,2) NOT NULL DEFAULT 0,
    "freelancerComment" TEXT,
    "submittedAt" TIMESTAMPTZ(3),
    "submittedById" UUID,
    "approvedAt" TIMESTAMPTZ(3),
    "approvedById" UUID,
    "approvedOnBehalf" BOOLEAN NOT NULL DEFAULT false,
    "approvalReason" TEXT,
    "changesRequestedAt" TIMESTAMPTZ(3),
    "changesRequestedById" UUID,
    "changesRequestedReason" TEXT,
    "correctionReason" TEXT,
    "amountsSnapshot" JSONB,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "Timesheet_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TimesheetEntry" (
    "id" UUID NOT NULL,
    "timesheetId" UUID NOT NULL,
    "date" DATE NOT NULL,
    "hours" DECIMAL(5,2) NOT NULL,
    "comment" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "TimesheetEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Dispute" (
    "id" UUID NOT NULL,
    "subjectType" "DisputeSubject" NOT NULL,
    "contractId" UUID NOT NULL,
    "timesheetId" UUID,
    "invoiceId" UUID,
    "openedById" UUID NOT NULL,
    "reason" TEXT NOT NULL,
    "status" "DisputeStatus" NOT NULL DEFAULT 'OPEN',
    "resolution" TEXT,
    "resolvedById" UUID,
    "resolvedAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "Dispute_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Document" (
    "id" UUID NOT NULL,
    "kind" "DocumentKind" NOT NULL,
    "title" TEXT,
    "originalFilename" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "sha256" TEXT NOT NULL,
    "storageKey" TEXT NOT NULL,
    "visibility" "DocumentVisibility" NOT NULL DEFAULT 'OWNER_AND_ADMIN',
    "uploadedById" UUID,
    "profileId" UUID,
    "companyId" UUID,
    "missionId" UUID,
    "contractId" UUID,
    "invoiceId" UUID,
    "qualificationId" UUID,
    "timesheetId" UUID,
    "importBatchId" UUID,
    "verificationStatus" "DocumentVerificationStatus" NOT NULL DEFAULT 'NOT_REQUIRED',
    "verificationNote" TEXT,
    "verifiedById" UUID,
    "verifiedAt" TIMESTAMPTZ(3),
    "expiresAt" DATE,
    "deletedAt" TIMESTAMPTZ(3),
    "deletedById" UUID,
    "deleteReason" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "Document_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Invoice" (
    "id" UUID NOT NULL,
    "kind" "InvoiceKind" NOT NULL,
    "number" TEXT NOT NULL,
    "contractId" UUID NOT NULL,
    "timesheetId" UUID,
    "companyId" UUID NOT NULL,
    "profileId" UUID NOT NULL,
    "issuerLabel" TEXT NOT NULL,
    "addressee" "InvoiceAddressee" NOT NULL,
    "issueDate" DATE NOT NULL,
    "dueDate" DATE NOT NULL,
    "currency" CHAR(3) NOT NULL,
    "amountExclTax" DECIMAL(16,2) NOT NULL,
    "taxAmount" DECIMAL(16,2) NOT NULL,
    "amountInclTax" DECIMAL(16,2) NOT NULL,
    "expectedAmountExclTax" DECIMAL(16,2),
    "documentId" UUID NOT NULL,
    "status" "InvoiceStatus" NOT NULL DEFAULT 'SUBMITTED',
    "statusReason" TEXT,
    "verifiedAt" TIMESTAMPTZ(3),
    "verifiedById" UUID,
    "paymentState" "PaymentState" NOT NULL DEFAULT 'UNPAID',
    "paidAmount" DECIMAL(16,2) NOT NULL DEFAULT 0,
    "submittedById" UUID NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "Invoice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaymentRecord" (
    "id" UUID NOT NULL,
    "invoiceId" UUID NOT NULL,
    "amount" DECIMAL(16,2) NOT NULL,
    "currency" CHAR(3) NOT NULL,
    "receivedOn" DATE NOT NULL,
    "method" "PaymentMethod" NOT NULL,
    "reference" TEXT NOT NULL,
    "proofDocumentId" UUID NOT NULL,
    "note" TEXT,
    "status" "RecordStatus" NOT NULL DEFAULT 'RECORDED',
    "recordedById" UUID NOT NULL,
    "recordedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "cancelledAt" TIMESTAMPTZ(3),
    "cancelledById" UUID,
    "cancelReason" TEXT,

    CONSTRAINT "PaymentRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PayoutRecord" (
    "id" UUID NOT NULL,
    "invoiceId" UUID NOT NULL,
    "contractId" UUID NOT NULL,
    "profileId" UUID NOT NULL,
    "amount" DECIMAL(16,2) NOT NULL,
    "currency" CHAR(3) NOT NULL,
    "paidOn" DATE NOT NULL,
    "method" "PaymentMethod" NOT NULL,
    "reference" TEXT NOT NULL,
    "proofDocumentId" UUID NOT NULL,
    "note" TEXT,
    "status" "RecordStatus" NOT NULL DEFAULT 'RECORDED',
    "recordedById" UUID NOT NULL,
    "recordedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "cancelledAt" TIMESTAMPTZ(3),
    "cancelledById" UUID,
    "cancelReason" TEXT,

    CONSTRAINT "PayoutRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaymentConfiguration" (
    "id" UUID NOT NULL,
    "profileId" UUID NOT NULL,
    "method" "PayoutMethodType" NOT NULL DEFAULT 'MANUAL_BANK_TRANSFER',
    "status" "PaymentConfigStatus" NOT NULL DEFAULT 'NOT_CONFIGURED',
    "provider" TEXT,
    "providerAccountRef" TEXT,
    "providerMode" TEXT,
    "note" TEXT,
    "confirmedById" UUID,
    "confirmedAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "PaymentConfiguration_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaymentWebhookEvent" (
    "id" UUID NOT NULL,
    "provider" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "signatureValid" BOOLEAN NOT NULL,
    "payloadSha256" TEXT NOT NULL,
    "status" "WebhookEventStatus" NOT NULL DEFAULT 'RECEIVED',
    "error" TEXT,
    "receivedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processedAt" TIMESTAMPTZ(3),

    CONSTRAINT "PaymentWebhookEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Review" (
    "id" UUID NOT NULL,
    "contractId" UUID NOT NULL,
    "authorUserId" UUID NOT NULL,
    "authorRole" "ReviewAuthorRole" NOT NULL,
    "subject" "ReviewSubject" NOT NULL,
    "rating" INTEGER NOT NULL,
    "comment" TEXT,
    "visibility" "ReviewVisibility" NOT NULL DEFAULT 'INTERNAL',
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "Review_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "link" TEXT,
    "readAt" TIMESTAMPTZ(3),
    "emailStatus" "NotificationEmailStatus" NOT NULL DEFAULT 'NOT_REQUIRED',
    "emailAttempts" INTEGER NOT NULL DEFAULT 0,
    "emailedAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditEvent" (
    "id" BIGSERIAL NOT NULL,
    "occurredAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actorType" "ActorType" NOT NULL,
    "actorUserId" UUID,
    "actorRoles" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT,
    "reason" TEXT,
    "metadata" JSONB,
    "requestId" TEXT,

    CONSTRAINT "AuditEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReferenceCounter" (
    "key" TEXT NOT NULL,
    "value" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "ReferenceCounter_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "PlatformSetting" (
    "key" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "updatedById" UUID,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "PlatformSetting_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "ContactRequest" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "organization" TEXT,
    "audience" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "status" "ContactRequestStatus" NOT NULL DEFAULT 'NEW',
    "handledAt" TIMESTAMPTZ(3),
    "handledById" UUID,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ContactRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ImportBatch" (
    "id" UUID NOT NULL,
    "sourceUrl" TEXT NOT NULL,
    "collectedAt" TIMESTAMPTZ(3) NOT NULL,
    "parserVersion" TEXT NOT NULL,
    "snapshotSha256" TEXT NOT NULL,
    "status" "ImportBatchStatus" NOT NULL DEFAULT 'PREVIEW',
    "stats" JSONB NOT NULL,
    "error" TEXT,
    "createdById" UUID,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "ImportBatch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ImportItem" (
    "id" UUID NOT NULL,
    "batchId" UUID NOT NULL,
    "externalKey" TEXT NOT NULL,
    "fingerprint" TEXT NOT NULL,
    "change" "ImportItemChange" NOT NULL,
    "status" "ImportItemStatus" NOT NULL DEFAULT 'PENDING_REVIEW',
    "parsed" JSONB NOT NULL,
    "rawText" TEXT NOT NULL,
    "warnings" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "duplicateOfProfileId" UUID,
    "duplicateScore" DOUBLE PRECISION,
    "profileId" UUID,
    "reviewedById" UUID,
    "reviewedAt" TIMESTAMPTZ(3),
    "reviewNote" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ImportItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IntegrationClient" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "tokenPrefix" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "scopes" "IntegrationScope"[],
    "createdById" UUID NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastUsedAt" TIMESTAMPTZ(3),
    "expiresAt" TIMESTAMPTZ(3),
    "revokedAt" TIMESTAMPTZ(3),
    "revokedById" UUID,
    "revokeReason" TEXT,

    CONSTRAINT "IntegrationClient_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SyncChange" (
    "seq" BIGSERIAL NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" UUID NOT NULL,
    "operation" TEXT NOT NULL,
    "changedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SyncChange_pkey" PRIMARY KEY ("seq")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "UserRole_userId_role_key" ON "UserRole"("userId", "role");

-- CreateIndex
CREATE UNIQUE INDEX "Session_tokenHash_key" ON "Session"("tokenHash");

-- CreateIndex
CREATE INDEX "Session_userId_idx" ON "Session"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "AuthToken_tokenHash_key" ON "AuthToken"("tokenHash");

-- CreateIndex
CREATE INDEX "AuthToken_userId_type_idx" ON "AuthToken"("userId", "type");

-- CreateIndex
CREATE UNIQUE INDEX "Invitation_tokenHash_key" ON "Invitation"("tokenHash");

-- CreateIndex
CREATE INDEX "Invitation_email_idx" ON "Invitation"("email");

-- CreateIndex
CREATE INDEX "Invitation_companyId_idx" ON "Invitation"("companyId");

-- CreateIndex
CREATE INDEX "Invitation_freelancerProfileId_idx" ON "Invitation"("freelancerProfileId");

-- CreateIndex
CREATE INDEX "Company_verificationStatus_idx" ON "Company"("verificationStatus");

-- CreateIndex
CREATE INDEX "CompanyMembership_userId_idx" ON "CompanyMembership"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "CompanyMembership_companyId_userId_key" ON "CompanyMembership"("companyId", "userId");

-- CreateIndex
CREATE INDEX "CompanyContact_companyId_idx" ON "CompanyContact"("companyId");

-- CreateIndex
CREATE UNIQUE INDEX "FreelancerProfile_userId_key" ON "FreelancerProfile"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "FreelancerProfile_sourceExternalKey_key" ON "FreelancerProfile"("sourceExternalKey");

-- CreateIndex
CREATE INDEX "FreelancerProfile_validationStatus_idx" ON "FreelancerProfile"("validationStatus");

-- CreateIndex
CREATE INDEX "FreelancerProfile_catalogVisibility_idx" ON "FreelancerProfile"("catalogVisibility");

-- CreateIndex
CREATE UNIQUE INDEX "Skill_slug_key" ON "Skill"("slug");

-- CreateIndex
CREATE INDEX "FreelancerSkill_skillId_idx" ON "FreelancerSkill"("skillId");

-- CreateIndex
CREATE UNIQUE INDEX "FreelancerSkill_profileId_skillId_key" ON "FreelancerSkill"("profileId", "skillId");

-- CreateIndex
CREATE INDEX "Experience_profileId_idx" ON "Experience"("profileId");

-- CreateIndex
CREATE INDEX "Education_profileId_idx" ON "Education"("profileId");

-- CreateIndex
CREATE INDEX "Language_profileId_idx" ON "Language"("profileId");

-- CreateIndex
CREATE INDEX "Qualification_profileId_idx" ON "Qualification"("profileId");

-- CreateIndex
CREATE INDEX "Availability_profileId_startDate_idx" ON "Availability"("profileId", "startDate");

-- CreateIndex
CREATE UNIQUE INDEX "Mission_reference_key" ON "Mission"("reference");

-- CreateIndex
CREATE INDEX "Mission_companyId_idx" ON "Mission"("companyId");

-- CreateIndex
CREATE INDEX "Mission_publicationStatus_status_idx" ON "Mission"("publicationStatus", "status");

-- CreateIndex
CREATE INDEX "MissionSkill_skillId_idx" ON "MissionSkill"("skillId");

-- CreateIndex
CREATE UNIQUE INDEX "MissionSkill_missionId_skillId_key" ON "MissionSkill"("missionId", "skillId");

-- CreateIndex
CREATE INDEX "Application_profileId_idx" ON "Application"("profileId");

-- CreateIndex
CREATE INDEX "Application_missionId_status_idx" ON "Application"("missionId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "Application_missionId_profileId_key" ON "Application"("missionId", "profileId");

-- CreateIndex
CREATE UNIQUE INDEX "Application_one_selected_per_mission" ON "Application"("missionId") WHERE (status = 'SELECTED'::"ApplicationStatus");

-- CreateIndex
CREATE UNIQUE INDEX "CommercialProposal_reference_key" ON "CommercialProposal"("reference");

-- CreateIndex
CREATE UNIQUE INDEX "CommercialProposal_previousId_key" ON "CommercialProposal"("previousId");

-- CreateIndex
CREATE INDEX "CommercialProposal_missionId_idx" ON "CommercialProposal"("missionId");

-- CreateIndex
CREATE INDEX "CommercialProposal_companyId_idx" ON "CommercialProposal"("companyId");

-- CreateIndex
CREATE INDEX "CommercialProposal_profileId_idx" ON "CommercialProposal"("profileId");

-- CreateIndex
CREATE UNIQUE INDEX "Proposal_one_live_per_application" ON "CommercialProposal"("applicationId") WHERE (status = ANY (ARRAY['DRAFT'::"ProposalStatus", 'SENT'::"ProposalStatus", 'PARTIES_AGREED'::"ProposalStatus"]));

-- CreateIndex
CREATE UNIQUE INDEX "Contract_reference_key" ON "Contract"("reference");

-- CreateIndex
CREATE UNIQUE INDEX "Contract_proposalId_key" ON "Contract"("proposalId");

-- CreateIndex
CREATE UNIQUE INDEX "Contract_signedDocumentId_key" ON "Contract"("signedDocumentId");

-- CreateIndex
CREATE INDEX "Contract_companyId_idx" ON "Contract"("companyId");

-- CreateIndex
CREATE INDEX "Contract_profileId_idx" ON "Contract"("profileId");

-- CreateIndex
CREATE INDEX "Contract_missionId_idx" ON "Contract"("missionId");

-- CreateIndex
CREATE UNIQUE INDEX "Contract_one_live_per_mission" ON "Contract"("missionId") WHERE (status = ANY (ARRAY['AWAITING_SIGNATURE'::"ContractStatus", 'SIGNED'::"ContractStatus", 'ACTIVE'::"ContractStatus", 'SUSPENDED'::"ContractStatus", 'COMPLETED'::"ContractStatus"]));

-- CreateIndex
CREATE UNIQUE INDEX "ContractAmendment_signedDocumentId_key" ON "ContractAmendment"("signedDocumentId");

-- CreateIndex
CREATE UNIQUE INDEX "ContractAmendment_contractId_number_key" ON "ContractAmendment"("contractId", "number");

-- CreateIndex
CREATE UNIQUE INDEX "Timesheet_supersedesId_key" ON "Timesheet"("supersedesId");

-- CreateIndex
CREATE INDEX "Timesheet_contractId_periodStart_idx" ON "Timesheet"("contractId", "periodStart");

-- CreateIndex
CREATE UNIQUE INDEX "Timesheet_one_approved_per_period" ON "Timesheet"("contractId", "periodStart") WHERE (status = 'APPROVED'::"TimesheetStatus");

-- CreateIndex
CREATE UNIQUE INDEX "Timesheet_one_open_per_period" ON "Timesheet"("contractId", "periodStart") WHERE (status = ANY (ARRAY['DRAFT'::"TimesheetStatus", 'SUBMITTED'::"TimesheetStatus", 'CHANGES_REQUESTED'::"TimesheetStatus"]));

-- CreateIndex
CREATE UNIQUE INDEX "TimesheetEntry_timesheetId_date_key" ON "TimesheetEntry"("timesheetId", "date");

-- CreateIndex
CREATE INDEX "Dispute_contractId_idx" ON "Dispute"("contractId");

-- CreateIndex
CREATE INDEX "Dispute_status_idx" ON "Dispute"("status");

-- CreateIndex
CREATE UNIQUE INDEX "Document_storageKey_key" ON "Document"("storageKey");

-- CreateIndex
CREATE INDEX "Document_profileId_idx" ON "Document"("profileId");

-- CreateIndex
CREATE INDEX "Document_companyId_idx" ON "Document"("companyId");

-- CreateIndex
CREATE INDEX "Document_contractId_idx" ON "Document"("contractId");

-- CreateIndex
CREATE INDEX "Document_invoiceId_idx" ON "Document"("invoiceId");

-- CreateIndex
CREATE INDEX "Document_kind_verificationStatus_idx" ON "Document"("kind", "verificationStatus");

-- CreateIndex
CREATE UNIQUE INDEX "Invoice_documentId_key" ON "Invoice"("documentId");

-- CreateIndex
CREATE INDEX "Invoice_contractId_idx" ON "Invoice"("contractId");

-- CreateIndex
CREATE INDEX "Invoice_companyId_idx" ON "Invoice"("companyId");

-- CreateIndex
CREATE INDEX "Invoice_profileId_idx" ON "Invoice"("profileId");

-- CreateIndex
CREATE INDEX "Invoice_status_paymentState_idx" ON "Invoice"("status", "paymentState");

-- CreateIndex
CREATE UNIQUE INDEX "Invoice_freelancer_number_unique" ON "Invoice"("profileId", "number") WHERE ((kind = 'FREELANCER_INVOICE'::"InvoiceKind") AND (status = ANY (ARRAY['SUBMITTED'::"InvoiceStatus", 'VERIFIED'::"InvoiceStatus"])));

-- CreateIndex
CREATE UNIQUE INDEX "Invoice_client_number_unique" ON "Invoice"("number") WHERE ((kind = 'CLIENT_INVOICE'::"InvoiceKind") AND (status = ANY (ARRAY['SUBMITTED'::"InvoiceStatus", 'VERIFIED'::"InvoiceStatus"])));

-- CreateIndex
CREATE UNIQUE INDEX "Invoice_one_per_timesheet_and_kind" ON "Invoice"("timesheetId", "kind") WHERE (("timesheetId" IS NOT NULL) AND (status = ANY (ARRAY['SUBMITTED'::"InvoiceStatus", 'VERIFIED'::"InvoiceStatus"])));

-- CreateIndex
CREATE UNIQUE INDEX "PaymentRecord_proofDocumentId_key" ON "PaymentRecord"("proofDocumentId");

-- CreateIndex
CREATE INDEX "PaymentRecord_invoiceId_idx" ON "PaymentRecord"("invoiceId");

-- CreateIndex
CREATE UNIQUE INDEX "PayoutRecord_proofDocumentId_key" ON "PayoutRecord"("proofDocumentId");

-- CreateIndex
CREATE INDEX "PayoutRecord_invoiceId_idx" ON "PayoutRecord"("invoiceId");

-- CreateIndex
CREATE INDEX "PayoutRecord_profileId_idx" ON "PayoutRecord"("profileId");

-- CreateIndex
CREATE UNIQUE INDEX "PaymentConfiguration_profileId_key" ON "PaymentConfiguration"("profileId");

-- CreateIndex
CREATE UNIQUE INDEX "PaymentWebhookEvent_provider_eventId_key" ON "PaymentWebhookEvent"("provider", "eventId");

-- CreateIndex
CREATE UNIQUE INDEX "Review_contractId_authorRole_key" ON "Review"("contractId", "authorRole");

-- CreateIndex
CREATE INDEX "Notification_userId_readAt_idx" ON "Notification"("userId", "readAt");

-- CreateIndex
CREATE INDEX "Notification_emailStatus_createdAt_idx" ON "Notification"("emailStatus", "createdAt");

-- CreateIndex
CREATE INDEX "AuditEvent_entityType_entityId_idx" ON "AuditEvent"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "AuditEvent_actorUserId_idx" ON "AuditEvent"("actorUserId");

-- CreateIndex
CREATE INDEX "AuditEvent_occurredAt_idx" ON "AuditEvent"("occurredAt");

-- CreateIndex
CREATE INDEX "AuditEvent_action_idx" ON "AuditEvent"("action");

-- CreateIndex
CREATE INDEX "ImportItem_externalKey_idx" ON "ImportItem"("externalKey");

-- CreateIndex
CREATE UNIQUE INDEX "ImportItem_batchId_externalKey_key" ON "ImportItem"("batchId", "externalKey");

-- CreateIndex
CREATE UNIQUE INDEX "IntegrationClient_tokenPrefix_key" ON "IntegrationClient"("tokenPrefix");

-- CreateIndex
CREATE INDEX "SyncChange_entityType_seq_idx" ON "SyncChange"("entityType", "seq");

-- AddForeignKey
ALTER TABLE "UserRole" ADD CONSTRAINT "UserRole_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserRole" ADD CONSTRAINT "UserRole_grantedById_fkey" FOREIGN KEY ("grantedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuthToken" ADD CONSTRAINT "AuthToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invitation" ADD CONSTRAINT "Invitation_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invitation" ADD CONSTRAINT "Invitation_freelancerProfileId_fkey" FOREIGN KEY ("freelancerProfileId") REFERENCES "FreelancerProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invitation" ADD CONSTRAINT "Invitation_invitedById_fkey" FOREIGN KEY ("invitedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invitation" ADD CONSTRAINT "Invitation_acceptedById_fkey" FOREIGN KEY ("acceptedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompanyMembership" ADD CONSTRAINT "CompanyMembership_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompanyMembership" ADD CONSTRAINT "CompanyMembership_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompanyContact" ADD CONSTRAINT "CompanyContact_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FreelancerProfile" ADD CONSTRAINT "FreelancerProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FreelancerSkill" ADD CONSTRAINT "FreelancerSkill_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "FreelancerProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FreelancerSkill" ADD CONSTRAINT "FreelancerSkill_skillId_fkey" FOREIGN KEY ("skillId") REFERENCES "Skill"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Experience" ADD CONSTRAINT "Experience_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "FreelancerProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Education" ADD CONSTRAINT "Education_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "FreelancerProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Language" ADD CONSTRAINT "Language_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "FreelancerProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Qualification" ADD CONSTRAINT "Qualification_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "FreelancerProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Availability" ADD CONSTRAINT "Availability_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "FreelancerProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Mission" ADD CONSTRAINT "Mission_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Mission" ADD CONSTRAINT "Mission_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MissionSkill" ADD CONSTRAINT "MissionSkill_missionId_fkey" FOREIGN KEY ("missionId") REFERENCES "Mission"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MissionSkill" ADD CONSTRAINT "MissionSkill_skillId_fkey" FOREIGN KEY ("skillId") REFERENCES "Skill"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Application" ADD CONSTRAINT "Application_missionId_fkey" FOREIGN KEY ("missionId") REFERENCES "Mission"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Application" ADD CONSTRAINT "Application_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "FreelancerProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommercialProposal" ADD CONSTRAINT "CommercialProposal_missionId_fkey" FOREIGN KEY ("missionId") REFERENCES "Mission"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommercialProposal" ADD CONSTRAINT "CommercialProposal_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "Application"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommercialProposal" ADD CONSTRAINT "CommercialProposal_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommercialProposal" ADD CONSTRAINT "CommercialProposal_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "FreelancerProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommercialProposal" ADD CONSTRAINT "CommercialProposal_previousId_fkey" FOREIGN KEY ("previousId") REFERENCES "CommercialProposal"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Contract" ADD CONSTRAINT "Contract_proposalId_fkey" FOREIGN KEY ("proposalId") REFERENCES "CommercialProposal"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Contract" ADD CONSTRAINT "Contract_missionId_fkey" FOREIGN KEY ("missionId") REFERENCES "Mission"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Contract" ADD CONSTRAINT "Contract_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "Application"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Contract" ADD CONSTRAINT "Contract_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Contract" ADD CONSTRAINT "Contract_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "FreelancerProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Contract" ADD CONSTRAINT "Contract_signedDocumentId_fkey" FOREIGN KEY ("signedDocumentId") REFERENCES "Document"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContractAmendment" ADD CONSTRAINT "ContractAmendment_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "Contract"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContractAmendment" ADD CONSTRAINT "ContractAmendment_signedDocumentId_fkey" FOREIGN KEY ("signedDocumentId") REFERENCES "Document"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Timesheet" ADD CONSTRAINT "Timesheet_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "Contract"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Timesheet" ADD CONSTRAINT "Timesheet_supersedesId_fkey" FOREIGN KEY ("supersedesId") REFERENCES "Timesheet"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TimesheetEntry" ADD CONSTRAINT "TimesheetEntry_timesheetId_fkey" FOREIGN KEY ("timesheetId") REFERENCES "Timesheet"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Dispute" ADD CONSTRAINT "Dispute_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "Contract"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Dispute" ADD CONSTRAINT "Dispute_timesheetId_fkey" FOREIGN KEY ("timesheetId") REFERENCES "Timesheet"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Dispute" ADD CONSTRAINT "Dispute_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "FreelancerProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_missionId_fkey" FOREIGN KEY ("missionId") REFERENCES "Mission"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "Contract"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_qualificationId_fkey" FOREIGN KEY ("qualificationId") REFERENCES "Qualification"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_timesheetId_fkey" FOREIGN KEY ("timesheetId") REFERENCES "Timesheet"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_importBatchId_fkey" FOREIGN KEY ("importBatchId") REFERENCES "ImportBatch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "Contract"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_timesheetId_fkey" FOREIGN KEY ("timesheetId") REFERENCES "Timesheet"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "FreelancerProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Document"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentRecord" ADD CONSTRAINT "PaymentRecord_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentRecord" ADD CONSTRAINT "PaymentRecord_proofDocumentId_fkey" FOREIGN KEY ("proofDocumentId") REFERENCES "Document"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayoutRecord" ADD CONSTRAINT "PayoutRecord_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayoutRecord" ADD CONSTRAINT "PayoutRecord_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "Contract"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayoutRecord" ADD CONSTRAINT "PayoutRecord_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "FreelancerProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayoutRecord" ADD CONSTRAINT "PayoutRecord_proofDocumentId_fkey" FOREIGN KEY ("proofDocumentId") REFERENCES "Document"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentConfiguration" ADD CONSTRAINT "PaymentConfiguration_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "FreelancerProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Review" ADD CONSTRAINT "Review_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "Contract"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditEvent" ADD CONSTRAINT "AuditEvent_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImportItem" ADD CONSTRAINT "ImportItem_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "ImportBatch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImportItem" ADD CONSTRAINT "ImportItem_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "FreelancerProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImportItem" ADD CONSTRAINT "ImportItem_duplicateOfProfileId_fkey" FOREIGN KEY ("duplicateOfProfileId") REFERENCES "FreelancerProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

