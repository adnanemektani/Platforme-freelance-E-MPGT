import type { ImportBatchStatus } from '@empgt/contracts';

// Libellés propres à l'administration (partie A) qui n'existent pas dans `labels` de @empgt/contracts.

/** Noms lisibles des champs signalés par l'API (champs à confirmer, verrouillés, manquants…). */
const FIELD_LABELS: Record<string, string> = {
  identity: 'Identité (prénom, nom)',
  email: 'Adresse e-mail',
  businessStatus: 'Statut d’exercice',
  availabilityStatus: 'Disponibilité',
  availableFrom: 'Date de disponibilité',
  rates: 'Tarifs',
  rateMin: 'Tarif minimum',
  rateMax: 'Tarif maximum',
  rateUnit: 'Unité du tarif',
  rateCurrency: 'Devise du tarif',
  rateNote: 'Précisions sur le tarif',
  city: 'Ville',
  region: 'Région',
  country: 'Pays',
  mobility: 'Mobilité',
  mobilityNote: 'Précisions sur la mobilité',
  workModes: 'Modes de travail',
  qualifications: 'Qualifications',
  publicationConsent: 'Consentement de publication',
  headline: 'Titre du profil',
  summary: 'Résumé',
  tagline: 'Accroche',
  yearsOfExperience: 'Années d’expérience',
  skills: 'Compétences',
  experiences: 'Expériences',
  educations: 'Formations',
  languages: 'Langues',
  availabilities: 'Disponibilités',
  legalName: 'Raison sociale',
  tradeName: 'Nom commercial',
  legalForm: 'Forme juridique',
  registrationNumber: 'Numéro d’immatriculation',
  registrationType: 'Type d’immatriculation',
  vatNumber: 'Numéro de TVA',
  addressLine1: 'Adresse',
  addressLine2: 'Complément d’adresse',
  postalCode: 'Code postal',
  sector: 'Secteur',
  sizeRange: 'Effectif',
  website: 'Site web',
  description: 'Description',
};

export function fieldLabel(key: string): string {
  return FIELD_LABELS[key] ?? key;
}

export const importBatchStatusLabels: Record<ImportBatchStatus, string> = {
  PREVIEW: 'En cours d’examen',
  COMPLETED: 'Terminé',
  FAILED: 'Échec',
};

export const importBatchStatusTones: Record<ImportBatchStatus, 'amber' | 'green' | 'red'> = {
  PREVIEW: 'amber',
  COMPLETED: 'green',
  FAILED: 'red',
};

export const contactStatusLabels: Record<string, string> = {
  NEW: 'Nouvelle',
  HANDLED: 'Traitée',
};

export const contactAudienceLabels: Record<string, string> = {
  COMPANY: 'Entreprise',
  FREELANCER: 'Freelance',
  OTHER: 'Autre',
};

/** Types d'objets connus du journal d'audit (suggestions du filtre). */
export const AUDIT_ENTITY_TYPES = [
  'User',
  'Company',
  'CompanyContact',
  'CompanyMembership',
  'Invitation',
  'FreelancerProfile',
  'Qualification',
  'Mission',
  'Application',
  'CommercialProposal',
  'Contract',
  'ContractAmendment',
  'Timesheet',
  'Dispute',
  'Review',
  'Document',
  'Invoice',
  'Payment',
  'Payout',
  'PaymentConfiguration',
  'PaymentWebhookEvent',
  'ImportBatch',
  'ImportItem',
  'IntegrationClient',
  'PlatformSetting',
  'ContactRequest',
] as const;

/** Lien vers la fiche d'administration correspondant à un objet du journal d'audit (si elle existe). */
export function auditEntityHref(entityType: string, entityId: string | null): string | null {
  if (!entityId) return null;
  switch (entityType) {
    case 'Company':
      return `/admin/entreprises/${entityId}`;
    case 'FreelancerProfile':
      return `/admin/freelances/${entityId}`;
    case 'ImportBatch':
      return `/admin/imports/${entityId}`;
    case 'Mission':
      return `/admin/missions/${entityId}`;
    default:
      return null;
  }
}

export const invitationStatusLabels: Record<string, string> = {
  PENDING: 'En attente',
  ACCEPTED: 'Acceptée',
  REVOKED: 'Révoquée',
  EXPIRED: 'Expirée',
};

export const auditActorTypeLabels: Record<string, string> = {
  USER: 'Utilisateur',
  SYSTEM: 'Système',
  CLI: 'Ligne de commande',
  INTEGRATION: 'Client d’intégration',
};
