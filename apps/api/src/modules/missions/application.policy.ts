import type { ActionState, PendingItem } from '@empgt/contracts';
import type { Application, Mission } from '../../generated/prisma/client.js';
import { check, deny, NOT_FOR_ROLE } from '../../common/actions.js';
import { isCompanyMember, ownsProfile, type Actor } from '../auth/actor.js';

export interface ApplicationContext {
  mission: Mission;
  /** Une autre candidature est déjà retenue pour la mission. */
  otherSelected: boolean;
  /** Proposition commerciale envoyée aux parties (non retirée). */
  hasSentProposal: boolean;
  hasLiveContract: boolean;
}

export function applicationActions(actor: Actor, app: Application, ctx: ApplicationContext): ActionState[] {
  const missionOpen = ctx.mission.status === 'OPEN';
  const undecided = app.status === 'SUBMITTED' || app.status === 'SHORTLISTED';
  const decider = actor.isAdmin || isCompanyMember(actor, ctx.mission.companyId);

  if (decider) {
    return [
      check('shortlist', [
        [app.status === 'SUBMITTED', app.status === 'SHORTLISTED' ? 'Déjà présélectionnée' : 'Candidature déjà traitée'],
        [missionOpen, 'La mission n’est plus ouverte'],
      ]),
      check('select', [
        [undecided, 'Candidature déjà traitée'],
        [missionOpen, ctx.mission.status === 'SELECTION' ? 'Un candidat est déjà retenu pour cette mission' : 'La mission n’est plus ouverte'],
        [!ctx.otherSelected, 'Un candidat est déjà retenu pour cette mission'],
      ]),
      check('reject', [[undecided, 'Candidature déjà traitée']]),
      check('deselect', [
        [app.status === 'SELECTED', "Cette candidature n'est pas retenue"],
        [!ctx.hasLiveContract, 'Un contrat existe : il doit être annulé par E-MPGT'],
        [actor.isAdmin || !ctx.hasSentProposal, 'Une proposition commerciale est en cours : contactez E-MPGT'],
      ]),
    ];
  }
  if (ownsProfile(actor, app.profileId)) {
    return [
      check('withdraw', [
        [undecided || app.status === 'SELECTED', 'Candidature déjà clôturée'],
        [!ctx.hasLiveContract, 'Un contrat est en cours : contactez E-MPGT'],
      ]),
    ];
  }
  return [deny('withdraw', NOT_FOR_ROLE)];
}

export function applicationPending(actor: Actor, app: Application, ctx: ApplicationContext): PendingItem[] {
  const own = ownsProfile(actor, app.profileId);
  const link = own ? `/freelance/candidatures/${app.id}` : actor.isAdmin ? `/admin/candidatures/${app.id}` : `/entreprise/candidatures/${app.id}`;
  switch (app.status) {
    case 'SUBMITTED':
      return own
        ? [{ code: 'application.submitted', title: 'Candidature envoyée', description: "L'entreprise examine votre candidature.", severity: 'info', link }]
        : [{ code: 'application.to_review', title: 'Candidature à examiner', description: 'Présélectionnez, retenez ou déclinez cette candidature.', severity: 'action', link }];
    case 'SHORTLISTED':
      return own
        ? [{ code: 'application.shortlisted', title: 'Candidature présélectionnée', description: "Vous faites partie des candidats présélectionnés par l'entreprise.", severity: 'info', link }]
        : [{ code: 'application.shortlisted', title: 'Présélectionnée', description: 'Retenez ce candidat ou déclinez la candidature.', severity: 'action', link }];
    case 'SELECTED':
      return [
        {
          code: 'application.selected',
          title: 'Candidat retenu',
          description: ctx.hasLiveContract
            ? 'Le contrat est en cours de finalisation.'
            : 'E-MPGT prépare la proposition commerciale ; la mission démarre après accord des parties, validation E-MPGT et dépôt du contrat signé.',
          severity: 'info',
          link,
        },
      ];
    default:
      return [];
  }
}
