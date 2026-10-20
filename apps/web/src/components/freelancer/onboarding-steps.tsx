import Link from 'next/link';
import { labels, type OwnProfileView } from '@empgt/contracts';
import { formatDateTime } from '@/lib/format';

type StepState = 'done' | 'current' | 'waiting' | 'blocked';

interface Step {
  title: string;
  state: StepState;
  detail: string;
  link?: { href: string; label: string };
}

const STATE_STYLE: Record<StepState, { dot: string; label: string }> = {
  done: { dot: 'bg-accent-700 text-white', label: 'Terminé' },
  current: { dot: 'bg-amber-500 text-white', label: 'À faire' },
  waiting: { dot: 'bg-brand-600 text-white', label: 'En attente' },
  blocked: { dot: 'bg-red-700 text-white', label: 'Bloqué' },
};

/**
 * Parcours d'accès aux missions : inscription → vérification → profil → soumission → validation.
 * Affiche l'état tel que renvoyé par l'API (statut de validation, éléments manquants) sans le recalculer.
 */
export function OnboardingSteps({ profile, emailVerified }: { profile: OwnProfileView; emailVerified: boolean }) {
  const status = profile.validationStatus;
  const missing = profile.missingForSubmission;
  const submitted = status === 'SUBMITTED' || status === 'APPROVED' || status === 'SUSPENDED';

  const steps: Step[] = [
    { title: 'Inscription', state: 'done', detail: 'Votre compte freelance est créé.' },
    {
      title: 'Vérification de l’adresse e-mail',
      state: emailVerified ? 'done' : 'current',
      detail: emailVerified ? 'Adresse e-mail confirmée.' : 'Cliquez sur le lien reçu par e-mail pour confirmer votre adresse.',
    },
    {
      title: 'Profil complété',
      state: missing.length === 0 ? 'done' : 'current',
      detail: missing.length === 0 ? 'Les éléments requis pour la soumission sont renseignés.' : `À compléter : ${missing.join(', ')}.`,
      link: missing.length > 0 ? { href: '/freelance/profil', label: 'Compléter mon profil' } : undefined,
    },
    {
      title: 'Soumission à E-MPGT',
      state: submitted ? 'done' : status === 'REJECTED' ? 'blocked' : 'current',
      detail: submitted
        ? `Profil soumis${profile.submittedAt ? ` le ${formatDateTime(profile.submittedAt)}` : ''}.`
        : status === 'CHANGES_REQUESTED'
          ? 'E-MPGT a demandé des corrections : corrigez puis soumettez de nouveau votre profil.'
          : status === 'REJECTED'
            ? 'Profil refusé : contactez E-MPGT.'
            : 'Soumettez votre profil depuis la page « Mon profil » une fois complet.',
      link: !submitted && status !== 'REJECTED' ? { href: '/freelance/profil', label: 'Aller à mon profil' } : undefined,
    },
    {
      title: 'Validation par E-MPGT',
      state: status === 'APPROVED' ? 'done' : status === 'SUBMITTED' ? 'waiting' : status === 'REJECTED' || status === 'SUSPENDED' ? 'blocked' : 'waiting',
      detail:
        status === 'APPROVED'
          ? `Profil validé${profile.reviewedAt ? ` le ${formatDateTime(profile.reviewedAt)}` : ''} : vous pouvez candidater aux missions.`
          : status === 'SUBMITTED'
            ? 'E-MPGT examine votre profil. La candidature aux missions sera possible après validation.'
            : `${labels.profileValidation[status]}${profile.validationNote ? ` — ${profile.validationNote}` : ''}`,
    },
  ];

  return (
    <ol className="grid gap-3 md:grid-cols-5" aria-label="Parcours d’accès aux missions">
      {steps.map((step, i) => {
        const style = STATE_STYLE[step.state];
        return (
          <li key={step.title} className="rounded-lg border border-gray-200 bg-white p-3 shadow-sm">
            <div className="flex items-center gap-2">
              <span className={`inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${style.dot}`} aria-hidden="true">
                {step.state === 'done' ? '✓' : i + 1}
              </span>
              <p className="text-sm font-semibold text-gray-900">{step.title}</p>
            </div>
            <p className="mt-1 text-xs font-medium text-gray-600">
              <span className="sr-only">État : </span>
              {style.label}
            </p>
            <p className="mt-1 text-xs text-gray-700">{step.detail}</p>
            {step.link && (
              <Link href={step.link.href} className="mt-1 inline-block text-xs font-medium text-brand-700 underline">
                {step.link.label}
              </Link>
            )}
          </li>
        );
      })}
    </ol>
  );
}
