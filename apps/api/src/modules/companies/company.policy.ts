import type { ActionState, PendingItem } from '@empgt/contracts';
import type { Company } from '../../generated/prisma/client.js';
import { check, deny, NOT_FOR_ROLE } from '../../common/actions.js';
import { isCompanyMember, isCompanyOwner, type Actor } from '../auth/actor.js';

/** Champs d'identité légale verrouillés une fois l'entreprise vérifiée. */
export const LOCKED_WHEN_VERIFIED = ['legalName', 'legalForm', 'registrationNumber', 'registrationType', 'country'] as const;

const REQUIRED_FOR_VERIFICATION: Array<[keyof Company, string]> = [
  ['legalName', 'Raison sociale'],
  ['registrationNumber', "Numéro d'immatriculation"],
  ['addressLine1', 'Adresse'],
  ['city', 'Ville'],
  ['country', 'Pays'],
];

export function missingForVerification(company: Company, contactsCount: number): string[] {
  const missing = REQUIRED_FOR_VERIFICATION.filter(([field]) => !company[field]).map(([, label]) => label);
  if (contactsCount === 0) missing.push('Au moins un contact');
  return missing;
}

export function companyActions(actor: Actor, company: Company, contactsCount: number): ActionState[] {
  const member = isCompanyMember(actor, company.id);
  const owner = isCompanyOwner(actor, company.id);
  const active = company.status === 'ACTIVE';
  const missing = missingForVerification(company, contactsCount);

  if (actor.isAdmin) {
    const reviewable = company.verificationStatus === 'PENDING';
    return [
      check('verify', [[reviewable, 'Seule une entreprise en attente de vérification peut être vérifiée']]),
      check('requestChanges', [[reviewable, 'Seule une entreprise en attente de vérification peut être renvoyée en correction']]),
      check('reject', [[reviewable || company.verificationStatus === 'CHANGES_REQUESTED', 'Aucune vérification en cours']]),
      check('suspend', [[active, 'Entreprise déjà suspendue']]),
      check('reactivate', [[!active, "L'entreprise n'est pas suspendue"]]),
      { action: 'adminUpdate', allowed: true },
    ];
  }
  if (!member) return [deny('update', NOT_FOR_ROLE)];
  return [
    check('update', [
      [owner, "Seul le responsable de l'organisation peut modifier ses informations"],
      [active, 'Entreprise suspendue : contactez E-MPGT'],
    ]),
    check('submitVerification', [
      [owner, "Seul le responsable de l'organisation peut demander la vérification"],
      [active, 'Entreprise suspendue : contactez E-MPGT'],
      [
        company.verificationStatus === 'NOT_SUBMITTED' || company.verificationStatus === 'CHANGES_REQUESTED',
        company.verificationStatus === 'PENDING'
          ? 'Vérification déjà en cours'
          : company.verificationStatus === 'VERIFIED'
            ? 'Entreprise déjà vérifiée'
            : 'Vérification refusée : contactez E-MPGT',
      ],
      [missing.length === 0, `Informations manquantes : ${missing.join(', ')}`],
    ]),
    check('manageContacts', [[active, 'Entreprise suspendue : contactez E-MPGT']]),
    check('inviteMember', [
      [owner, "Seul le responsable de l'organisation peut inviter des membres"],
      [active, 'Entreprise suspendue : contactez E-MPGT'],
    ]),
  ];
}

export function companyPending(company: Company): PendingItem[] {
  const link = '/entreprise/organisation';
  const items: PendingItem[] = [];
  if (company.status === 'SUSPENDED') {
    items.push({
      code: 'company.suspended',
      title: 'Entreprise suspendue',
      description: `${company.statusReason ?? 'Votre organisation est suspendue.'} Contactez E-MPGT.`,
      severity: 'blocked',
    });
    return items;
  }
  switch (company.verificationStatus) {
    case 'NOT_SUBMITTED':
      items.push({
        code: 'company.verification.not_submitted',
        title: 'Faites vérifier votre entreprise',
        description:
          'Complétez les informations de votre entreprise puis demandez sa vérification. Elle est requise avant la publication de votre première mission ; vous pouvez préparer vos missions dès maintenant.',
        severity: 'action',
        link,
      });
      break;
    case 'PENDING':
      items.push({
        code: 'company.verification.pending',
        title: 'Vérification en cours',
        description: 'E-MPGT vérifie les informations de votre entreprise. Vous pouvez préparer et soumettre vos missions en attendant.',
        severity: 'info',
        link,
      });
      break;
    case 'CHANGES_REQUESTED':
      items.push({
        code: 'company.verification.changes_requested',
        title: 'Compléments demandés par E-MPGT',
        description: company.verificationNote ?? 'Des compléments sont nécessaires avant la vérification.',
        severity: 'action',
        link,
      });
      break;
    case 'REJECTED':
      items.push({
        code: 'company.verification.rejected',
        title: 'Vérification refusée',
        description: `${company.verificationNote ?? ''} Vos missions ne peuvent pas être publiées. Contactez E-MPGT.`.trim(),
        severity: 'blocked',
      });
      break;
    default:
      break;
  }
  return items;
}
