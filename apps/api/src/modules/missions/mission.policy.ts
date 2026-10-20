import type { ActionState, PendingItem, PlatformSettings } from '@empgt/contracts';
import type { Company, FreelancerProfile, Mission, Prisma } from '../../generated/prisma/client.js';
import { check, deny, NOT_FOR_ROLE } from '../../common/actions.js';
import { today } from '../../common/dates.js';
import { isCompanyMember, type Actor } from '../auth/actor.js';

/** Missions visibles des freelances : publiées, ouvertes, entreprise active. */
export const VISIBLE_TO_FREELANCERS: Prisma.MissionWhereInput = {
  publicationStatus: 'PUBLISHED',
  status: 'OPEN',
  company: { status: 'ACTIVE' },
};

export function isVisibleToFreelancers(mission: Mission, company: Company): boolean {
  return mission.publicationStatus === 'PUBLISHED' && mission.status === 'OPEN' && company.status === 'ACTIVE';
}

export interface MissionContext {
  company: Company;
  settings: PlatformSettings;
  skillsCount: number;
  /** Profil du freelance courant (pour l'action « candidater »). */
  profile?: FreelancerProfile | null;
  hasApplied?: boolean;
  hasLiveContract?: boolean;
}

export function missingForSubmission(mission: Mission, skillsCount: number): string[] {
  const missing: string[] = [];
  if (!mission.title) missing.push('Titre');
  if (!mission.description || mission.description.length < 50) missing.push('Description (50 caractères minimum)');
  if (!mission.country) missing.push('Pays');
  if (!mission.workMode) missing.push("Modalité d'intervention");
  if (skillsCount === 0) missing.push('Au moins une compétence');
  return missing;
}

function companyVerificationGate(ctx: MissionContext, forPublication: boolean): [boolean, string] {
  if (!ctx.settings.companyVerificationRequiredForPublication) return [true, ''];
  const status = ctx.company.verificationStatus;
  if (forPublication) {
    return [status === 'VERIFIED', "L'entreprise doit être vérifiée par E-MPGT avant la publication de sa première mission"];
  }
  return [
    status === 'PENDING' || status === 'VERIFIED',
    status === 'REJECTED'
      ? "La vérification de l'entreprise a été refusée : contactez E-MPGT"
      : "Demandez d'abord la vérification de votre entreprise (page Organisation)",
  ];
}

export function missionActions(actor: Actor, mission: Mission, ctx: MissionContext): ActionState[] {
  const companyActive = ctx.company.status === 'ACTIVE';
  const open = mission.status === 'OPEN';
  const pub = mission.publicationStatus;

  if (actor.isAdmin) {
    return [
      check('approve', [
        [pub === 'PENDING_REVIEW', 'Seule une mission en attente de validation peut être publiée'],
        [open, 'Mission non ouverte'],
        [companyActive, 'Entreprise suspendue'],
        companyVerificationGate(ctx, true),
      ]),
      check('requestChanges', [[pub === 'PENDING_REVIEW', 'Aucune validation en cours']]),
      check('reject', [[pub === 'PENDING_REVIEW', 'Aucune validation en cours']]),
      check('unpublish', [[pub === 'PUBLISHED', "La mission n'est pas publiée"]]),
      check('republish', [
        [pub === 'UNPUBLISHED', "La mission n'est pas dépubliée"],
        [open, 'Mission non ouverte'],
        companyVerificationGate(ctx, true),
      ]),
      check('cancel', [
        [mission.status === 'OPEN' || mission.status === 'SELECTION', 'Mission déjà engagée ou clôturée : agir sur le contrat'],
        [!ctx.hasLiveContract, 'Un contrat existe : annulez ou résiliez d’abord le contrat'],
      ]),
      check('adminUpdate', [[mission.status !== 'COMPLETED' && mission.status !== 'CANCELLED', 'Mission clôturée']]),
    ];
  }

  if (isCompanyMember(actor, mission.companyId)) {
    const missing = missingForSubmission(mission, ctx.skillsCount);
    const editable = pub === 'DRAFT' || pub === 'CHANGES_REQUESTED' || pub === 'UNPUBLISHED';
    return [
      check('update', [
        [companyActive, 'Entreprise suspendue : contactez E-MPGT'],
        [open, 'Mission engagée ou clôturée : elle ne se modifie plus'],
        [
          editable,
          pub === 'PENDING_REVIEW'
            ? 'Mission en cours de validation : retirez-la de la validation pour la modifier'
            : pub === 'PUBLISHED'
              ? 'Mission publiée : contactez E-MPGT pour la modifier, ou annulez-la'
              : 'Mission refusée par E-MPGT : créez une nouvelle mission',
        ],
      ]),
      check('submit', [
        [companyActive, 'Entreprise suspendue : contactez E-MPGT'],
        [open, 'Mission engagée ou clôturée'],
        [editable, pub === 'PENDING_REVIEW' ? 'Mission déjà soumise' : pub === 'PUBLISHED' ? 'Mission déjà publiée' : 'Mission refusée'],
        companyVerificationGate(ctx, false),
        [missing.length === 0, `À compléter avant soumission : ${missing.join(', ')}`],
      ]),
      check('withdraw', [[pub === 'PENDING_REVIEW', "La mission n'est pas en cours de validation"]]),
      check('cancel', [
        [mission.status === 'OPEN' || mission.status === 'SELECTION', 'Mission déjà engagée ou clôturée'],
        [!ctx.hasLiveContract, 'Un contrat existe pour cette mission : contactez E-MPGT'],
      ]),
    ];
  }

  if (actor.isFreelancer) {
    const deadlinePassed = mission.applicationDeadline ? mission.applicationDeadline < today() : false;
    const profileOk = ctx.profile?.validationStatus === 'APPROVED';
    return [
      check('apply', [
        [isVisibleToFreelancers(mission, ctx.company), "Cette mission n'est plus ouverte aux candidatures"],
        [!ctx.hasApplied, 'Vous avez déjà candidaté à cette mission'],
        [!deadlinePassed, 'La date limite de candidature est dépassée'],
        [
          profileOk,
          ctx.profile?.validationStatus === 'SUBMITTED'
            ? 'Votre profil est en cours de validation par E-MPGT : la candidature sera possible après validation'
            : 'Votre profil doit être validé par E-MPGT avant de candidater',
        ],
      ]),
    ];
  }
  return [deny('apply', NOT_FOR_ROLE)];
}

export function missionPending(mission: Mission, ctx: MissionContext, applicationsCount: number): PendingItem[] {
  const link = `/entreprise/missions/${mission.id}`;
  const missing = missingForSubmission(mission, ctx.skillsCount);
  const verified = ctx.company.verificationStatus === 'VERIFIED' || !ctx.settings.companyVerificationRequiredForPublication;
  switch (mission.publicationStatus) {
    case 'DRAFT':
      return [
        {
          code: 'mission.draft',
          title: 'Brouillon',
          description: missing.length
            ? `Complétez la mission (${missing.join(', ')}) puis soumettez-la à E-MPGT.`
            : ctx.settings.missionApprovalRequired
              ? 'Soumettez la mission : E-MPGT la valide avant qu’elle soit visible des freelances.'
              : 'Soumettez la mission pour la publier.',
          severity: 'action',
          link,
        },
      ];
    case 'PENDING_REVIEW':
      return [
        {
          code: 'mission.pending_review',
          title: 'En attente de validation',
          description: verified
            ? 'E-MPGT vérifie la mission avant sa publication.'
            : 'E-MPGT vérifie la mission ; elle sera publiée une fois votre entreprise vérifiée.',
          severity: 'info',
          link,
        },
      ];
    case 'CHANGES_REQUESTED':
      return [{ code: 'mission.changes_requested', title: 'Corrections demandées', description: mission.reviewNote ?? '', severity: 'action', link }];
    case 'REJECTED':
      return [{ code: 'mission.rejected', title: 'Mission refusée', description: mission.reviewNote ?? '', severity: 'blocked', link }];
    case 'UNPUBLISHED':
      return [
        {
          code: 'mission.unpublished',
          title: 'Mission dépubliée par E-MPGT',
          description: `${mission.reviewNote ?? ''} Corrigez-la puis soumettez-la de nouveau.`.trim(),
          severity: 'action',
          link,
        },
      ];
    default:
      break;
  }
  if (mission.status === 'OPEN') {
    return [
      {
        code: 'mission.published',
        title: 'Mission publiée',
        description: applicationsCount
          ? `${applicationsCount} candidature(s) reçue(s) : examinez-les et présélectionnez.`
          : 'Visible des freelances validés. Aucune candidature pour le moment.',
        severity: applicationsCount ? 'action' : 'info',
        link: `${link}#candidatures`,
      },
    ];
  }
  if (mission.status === 'SELECTION') {
    return [
      {
        code: 'mission.selection',
        title: 'Candidat retenu',
        description:
          'E-MPGT prépare la proposition commerciale. La mission ne démarre qu’après accord des parties, validation E-MPGT et dépôt du contrat signé.',
        severity: 'info',
        link,
      },
    ];
  }
  return [];
}
