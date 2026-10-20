import type { ActionState, PendingItem } from '@empgt/contracts';
import type { FreelancerProfile } from '../../generated/prisma/client.js';
import { check, deny, NOT_FOR_ROLE } from '../../common/actions.js';
import { ownsProfile, type Actor } from '../auth/actor.js';

export interface ProfileCompleteness {
  skills: number;
  experiences: number;
}

/** Éléments requis pour soumettre un profil à la validation d'E-MPGT (politique V1). */
export function missingForSubmission(profile: FreelancerProfile, counts: ProfileCompleteness): string[] {
  const missing: string[] = [];
  if (!profile.headline) missing.push('Titre du profil');
  if (!profile.summary || profile.summary.length < 40) missing.push('Résumé (40 caractères minimum)');
  if (counts.skills === 0) missing.push('Au moins une compétence');
  if (counts.experiences === 0) missing.push('Au moins une expérience');
  if (!profile.country) missing.push('Pays de résidence');
  if (profile.availabilityStatus === 'UNKNOWN') missing.push('Disponibilité');
  return missing;
}

const EDITABLE_BY_OWNER = new Set(['DRAFT', 'SUBMITTED', 'CHANGES_REQUESTED', 'APPROVED']);

export function canOwnerEdit(profile: FreelancerProfile): boolean {
  return EDITABLE_BY_OWNER.has(profile.validationStatus);
}

export function profileActions(actor: Actor, profile: FreelancerProfile, counts: ProfileCompleteness): ActionState[] {
  if (actor.isAdmin) {
    const submitted = profile.validationStatus === 'SUBMITTED';
    const claimed = Boolean(profile.userId);
    return [
      check('approve', [
        [claimed, 'Profil historique sans compte : il doit être rattaché puis soumis par le freelance'],
        [submitted, 'Seul un profil soumis peut être validé'],
      ]),
      check('requestChanges', [[submitted || profile.validationStatus === 'APPROVED', 'Aucune validation en cours']]),
      check('reject', [[submitted || profile.validationStatus === 'CHANGES_REQUESTED', 'Aucune validation en cours']]),
      check('suspend', [[profile.validationStatus === 'APPROVED', 'Seul un profil validé peut être suspendu']]),
      check('reactivate', [
        [profile.validationStatus === 'SUSPENDED' || profile.validationStatus === 'REJECTED', 'Profil ni suspendu ni refusé'],
      ]),
      check('adminUpdate', []),
      check('editSections', [[!claimed, 'Le freelance gère lui-même les rubriques de son profil : demandez-lui une correction']]),
      check('inviteClaim', [
        [!claimed, 'Profil déjà rattaché à un compte'],
        [profile.origin === 'IMPORTED', 'Seuls les profils historiques importés se rattachent par invitation'],
      ]),
    ];
  }
  if (!ownsProfile(actor, profile.id)) return [deny('update', NOT_FOR_ROLE)];
  const missing = missingForSubmission(profile, counts);
  const editable = canOwnerEdit(profile);
  const editReason =
    profile.validationStatus === 'SUSPENDED'
      ? 'Profil suspendu : contactez E-MPGT'
      : 'Profil refusé : contactez E-MPGT';
  return [
    check('update', [[editable, editReason]]),
    check('submit', [
      [
        profile.validationStatus === 'DRAFT' || profile.validationStatus === 'CHANGES_REQUESTED',
        profile.validationStatus === 'SUBMITTED'
          ? 'Profil déjà soumis : validation en cours'
          : profile.validationStatus === 'APPROVED'
            ? 'Profil déjà validé'
            : editReason,
      ],
      [missing.length === 0, `À compléter avant soumission : ${missing.join(', ')}`],
    ]),
    check('publish', [
      [profile.validationStatus === 'APPROVED', 'La publication dans le catalogue exige un profil validé par E-MPGT'],
    ]),
    check('apply', [
      [profile.validationStatus === 'APPROVED', 'La candidature exige un profil validé par E-MPGT'],
    ]),
  ];
}

export function profilePending(profile: FreelancerProfile, counts: ProfileCompleteness): PendingItem[] {
  const link = '/freelance/profil';
  const missing = missingForSubmission(profile, counts);
  switch (profile.validationStatus) {
    case 'DRAFT':
      return [
        {
          code: 'profile.draft',
          title: missing.length ? 'Complétez votre profil' : 'Soumettez votre profil',
          description: missing.length
            ? `Votre profil doit être validé par E-MPGT avant de pouvoir candidater. À compléter : ${missing.join(', ')}.`
            : 'Votre profil est complet : soumettez-le à E-MPGT pour validation afin de pouvoir candidater aux missions.',
          severity: 'action',
          link,
        },
      ];
    case 'SUBMITTED':
      return [
        {
          code: 'profile.submitted',
          title: 'Profil en cours de validation',
          description: 'E-MPGT examine votre profil. Vous pouvez consulter les missions ; la candidature sera possible après validation.',
          severity: 'info',
          link,
        },
      ];
    case 'CHANGES_REQUESTED':
      return [
        {
          code: 'profile.changes_requested',
          title: 'Corrections demandées par E-MPGT',
          description: profile.validationNote ?? 'Corrigez votre profil puis soumettez-le de nouveau.',
          severity: 'action',
          link,
        },
      ];
    case 'REJECTED':
      return [
        {
          code: 'profile.rejected',
          title: 'Profil refusé',
          description: `${profile.validationNote ?? ''} Contactez E-MPGT pour en savoir plus.`.trim(),
          severity: 'blocked',
        },
      ];
    case 'SUSPENDED':
      return [
        {
          code: 'profile.suspended',
          title: 'Profil suspendu',
          description: `${profile.validationNote ?? ''} Vos candidatures sont suspendues. Contactez E-MPGT.`.trim(),
          severity: 'blocked',
        },
      ];
    default:
      return profile.availabilityStatus === 'UNKNOWN'
        ? [
            {
              code: 'profile.availability_unknown',
              title: 'Indiquez votre disponibilité',
              description: 'Une disponibilité à jour aide E-MPGT et les entreprises à vous proposer des missions adaptées.',
              severity: 'action',
              link: '/freelance/disponibilites',
            },
          ]
        : [];
  }
}
