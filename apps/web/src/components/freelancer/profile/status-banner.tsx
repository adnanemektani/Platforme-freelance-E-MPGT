import { labels, type OwnProfileView, type ProfileValidationStatus } from '@empgt/contracts';
import { formatDateTime } from '@/lib/format';
import { Alert } from '@/components/ui/feedback';
import { fieldToConfirmLabel } from '../helpers';

const TONE: Record<ProfileValidationStatus, 'info' | 'success' | 'warning' | 'danger'> = {
  DRAFT: 'info',
  SUBMITTED: 'info',
  APPROVED: 'success',
  CHANGES_REQUESTED: 'warning',
  REJECTED: 'danger',
  SUSPENDED: 'danger',
};

const EXPLANATION: Record<ProfileValidationStatus, string> = {
  DRAFT: 'Complétez votre profil puis soumettez-le à E-MPGT : la validation est nécessaire pour candidater aux missions.',
  SUBMITTED: 'E-MPGT examine votre profil. Vous pouvez consulter les missions ; la candidature sera possible après validation.',
  APPROVED: 'Votre profil est validé : vous pouvez candidater aux missions publiées.',
  CHANGES_REQUESTED: 'E-MPGT a demandé des corrections. Modifiez votre profil puis soumettez-le de nouveau.',
  REJECTED: 'Votre profil a été refusé. Contactez E-MPGT pour en savoir plus.',
  SUSPENDED: 'Votre profil est suspendu : vos candidatures sont suspendues. Contactez E-MPGT.',
};

/** État de validation du profil, éléments manquants et rubriques à confirmer (profil historique importé). */
export function ProfileStatusBanner({ profile }: { profile: OwnProfileView }) {
  const status = profile.validationStatus;
  return (
    <div className="space-y-3">
      <Alert tone={TONE[status]} title={labels.profileValidation[status]}>
        <p>{EXPLANATION[status]}</p>
        {profile.validationNote && (
          <p className="mt-1">
            <span className="font-medium">Message d’E-MPGT :</span> {profile.validationNote}
          </p>
        )}
        {(profile.submittedAt || profile.reviewedAt) && (
          <p className="mt-1 text-xs opacity-80">
            {profile.submittedAt && `Soumis le ${formatDateTime(profile.submittedAt)}`}
            {profile.submittedAt && profile.reviewedAt && ' · '}
            {profile.reviewedAt && `Examiné le ${formatDateTime(profile.reviewedAt)}`}
          </p>
        )}
      </Alert>

      {profile.missingForSubmission.length > 0 && (
        <Alert tone="warning" title="À compléter avant la soumission">
          <ul className="list-disc pl-5">
            {profile.missingForSubmission.map((m) => (
              <li key={m}>{m}</li>
            ))}
          </ul>
        </Alert>
      )}

      {profile.fieldsToConfirm.length > 0 && (
        <Alert tone="warning" title={`${labels.profileOrigin[profile.origin]} : informations à confirmer`}>
          <p>
            Ce profil a été constitué à partir de données historiques. Vérifiez, corrigez ou complétez les rubriques suivantes : elles n’ont pas encore été
            confirmées par vous.
          </p>
          <ul className="mt-1 list-disc pl-5">
            {profile.fieldsToConfirm.map((f) => (
              <li key={f}>{fieldToConfirmLabel(f)}</li>
            ))}
          </ul>
        </Alert>
      )}
    </div>
  );
}
