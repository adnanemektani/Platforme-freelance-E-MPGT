'use client';

import { useId, useState } from 'react';
import {
  labels,
  PaymentConfigStatus,
  PayoutMethodType,
  type AdminProfileView,
  type PaymentConfigurationView,
} from '@empgt/contracts';
import { api } from '@/lib/api';
import { formatDate, formatDateTime } from '@/lib/format';
import { useAction, useApi } from '@/lib/hooks';
import { findAction } from '@/components/ui/actions';
import { StatusBadge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, DefinitionList } from '@/components/ui/card';
import { Dialog } from '@/components/ui/dialog';
import { Alert, ResourceView } from '@/components/ui/feedback';
import {
  Field,
  FormError,
  formValue,
  Input,
  optionsFrom,
  Select,
  Textarea,
} from '@/components/ui/form';
import { AStateButton, AText, AVerifyButton } from './a-shared';

// ── Invitation à rattacher un profil historique ─────────────────────────────

/** Invitation explicite (action « inviteClaim ») : saisie puis confirmation de l'envoi de l'e-mail. */
export function AClaimInvite({
  profile,
  onDone,
}: {
  profile: AdminProfileView;
  onDone: (p: AdminProfileView) => void;
}) {
  const state = findAction(profile.actions, 'inviteClaim');
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<'form' | 'confirm'>('form');
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const action = useAction();
  const formId = useId();
  const close = () => {
    setOpen(false);
    setStep('form');
    action.clearError();
  };

  return (
    <>
      <AStateButton
        state={state}
        label="Inviter la personne à rattacher ce profil"
        variant="primary"
        onClick={() => setOpen(true)}
      />
      <Dialog
        open={open}
        onClose={close}
        title="Inviter à rattacher le profil"
        footer={
          step === 'form' ? (
            <>
              <Button variant="secondary" onClick={close}>
                Annuler
              </Button>
              <Button type="submit" form={formId}>
                Continuer
              </Button>
            </>
          ) : (
            <>
              <Button variant="secondary" onClick={() => setStep('form')} disabled={action.pending}>
                Retour
              </Button>
              <Button
                loading={action.pending}
                onClick={async () => {
                  const result = await action.run(
                    () =>
                      api.post<AdminProfileView>(`/admin/freelancers/${profile.id}/invite-claim`, {
                        email: email.trim(),
                        message: message.trim() || null,
                      }),
                    { success: 'Invitation envoyée' },
                  );
                  if (result) {
                    close();
                    setEmail('');
                    setMessage('');
                    onDone(result);
                  }
                }}
              >
                Envoyer l’invitation
              </Button>
            </>
          )
        }
      >
        {step === 'form' ? (
          <form
            id={formId}
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              setStep('confirm');
            }}
          >
            <p className="text-sm text-gray-700">
              La personne recevra un lien personnel (valable 7 jours) pour créer son compte et
              rattacher ce profil. Elle complétera elle-même son identité, sa disponibilité, ses
              tarifs et son consentement avant toute soumission. Une invitation précédente encore en
              attente sera révoquée.
            </p>
            <Field label="Adresse e-mail de la personne" required>
              {(p) => (
                <Input
                  {...p}
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="off"
                />
              )}
            </Field>
            <Field label="Message personnel" hint="Facultatif, 1000 caractères maximum.">
              {(p) => (
                <Textarea
                  {...p}
                  value={message}
                  maxLength={1000}
                  onChange={(e) => setMessage(e.target.value)}
                />
              )}
            </Field>
          </form>
        ) : (
          <div className="space-y-3">
            <Alert tone="warning" title="Un e-mail sera envoyé à cette adresse">
              <p>
                Un e-mail d’invitation va être envoyé à <strong>{email.trim()}</strong>. Vérifiez
                qu’il s’agit bien de la personne concernée par ce profil historique.
              </p>
            </Alert>
            {message.trim() && (
              <p className="text-sm text-gray-700">
                Message joint : <AText value={message.trim()} />
              </p>
            )}
            <FormError error={action.error} />
          </div>
        )}
      </Dialog>
    </>
  );
}

// ── Qualifications ───────────────────────────────────────────────────────────

export function AQualificationsCard({
  profile,
  onChange,
}: {
  profile: AdminProfileView;
  onChange: (p: AdminProfileView) => void;
}) {
  return (
    <Card
      title="Qualifications"
      description="Déclarées par le freelance. Vérifiez-les au vu des justificatifs déposés (liste « Documents » ci-dessous)."
    >
      {profile.qualifications.length === 0 ? (
        <p className="text-sm text-gray-600">Aucune qualification déclarée.</p>
      ) : (
        <ul className="divide-y divide-gray-100">
          {profile.qualifications.map((q) => (
            <li
              key={q.id}
              className="flex flex-wrap items-start justify-between gap-3 py-3 text-sm"
            >
              <span className="min-w-0">
                <span className="flex flex-wrap items-center gap-2 font-medium text-gray-900">
                  {q.name}
                  <StatusBadge status={q.status} label={labels.qualificationStatus[q.status]} />
                </span>
                <span className="block text-gray-600">
                  {[
                    q.issuer,
                    q.reference ? `réf. ${q.reference}` : null,
                    q.obtainedAt ? `obtenue le ${formatDate(q.obtainedAt)}` : null,
                    q.expiresAt ? `expire le ${formatDate(q.expiresAt)}` : null,
                  ]
                    .filter(Boolean)
                    .join(' · ') || '—'}
                </span>
                {q.verificationNote && (
                  <span className="mt-1 block text-gray-700">Note : {q.verificationNote}</span>
                )}
              </span>
              <AVerifyButton<AdminProfileView>
                ungated
                endpoint={`/admin/freelancers/${profile.id}/qualifications/${q.id}/verify`}
                title={`Vérifier « ${q.name} »`}
                defaultExpiresAt={q.expiresAt}
                onDone={onChange}
              />
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

// ── Configuration de règlement ──────────────────────────────────────────────

export function APaymentConfigCard({ profileId }: { profileId: string }) {
  const config = useApi<PaymentConfigurationView>(
    `/freelancers/${profileId}/payment-configuration`,
  );
  const action = useAction();
  const [editing, setEditing] = useState(false);

  return (
    <Card
      title="Configuration de règlement"
      description="Modalités de règlement de ce freelance. En V1, les règlements sont manuels (virement hors plateforme) tant qu’aucun prestataire n’est configuré."
      actions={
        !editing && config.data ? (
          <Button size="sm" variant="secondary" onClick={() => setEditing(true)}>
            Modifier (motif obligatoire)
          </Button>
        ) : undefined
      }
    >
      <ResourceView resource={config} loadingLabel="Chargement de la configuration…">
        {(c) => (
          <div className="space-y-4">
            <DefinitionList
              items={[
                ['Méthode', labels.payoutMethod[c.method]],
                [
                  'Statut',
                  <StatusBadge
                    key="s"
                    status={c.status}
                    label={labels.paymentConfigStatus[c.status]}
                  />,
                ],
                [
                  'Prestataire',
                  c.provider
                    ? `${c.provider}${c.providerMode ? ` (${c.providerMode})` : ''}`
                    : null,
                ],
                ['Confirmée le', formatDateTime(c.confirmedAt)],
                ['Note', c.note],
              ]}
            />
            <Alert tone="info">{c.explanation}</Alert>
            {editing && (
              <form
                className="space-y-4 border-t border-gray-100 pt-4"
                onSubmit={async (e) => {
                  e.preventDefault();
                  const form = new FormData(e.currentTarget);
                  const result = await action.run(
                    () =>
                      api.put<PaymentConfigurationView>(
                        `/freelancers/${profileId}/payment-configuration`,
                        {
                          method: formValue(form, 'method'),
                          status: formValue(form, 'status'),
                          note: formValue(form, 'note'),
                          reason: formValue(form, 'reason'),
                        },
                      ),
                    { success: 'Configuration de règlement enregistrée' },
                  );
                  if (result) {
                    config.setData(result);
                    setEditing(false);
                  }
                }}
              >
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field
                    label="Méthode"
                    required
                    hint="« Prestataire de paiement » est refusé par le serveur tant qu’aucun prestataire n’est configuré (décision D-11)."
                  >
                    {(p) => (
                      <Select
                        {...p}
                        name="method"
                        defaultValue={c.method}
                        options={optionsFrom(PayoutMethodType, labels.payoutMethod)}
                      />
                    )}
                  </Field>
                  <Field label="Statut" required>
                    {(p) => (
                      <Select
                        {...p}
                        name="status"
                        defaultValue={c.status}
                        options={optionsFrom(PaymentConfigStatus, labels.paymentConfigStatus)}
                      />
                    )}
                  </Field>
                </div>
                <Field label="Note" hint="Facultatif. Ne saisissez pas de coordonnées bancaires.">
                  {(p) => <Textarea {...p} name="note" rows={2} defaultValue={c.note ?? ''} />}
                </Field>
                <Field
                  label="Motif"
                  required
                  hint="Obligatoire : conservé dans le journal d’audit."
                >
                  {(p) => <Textarea {...p} name="reason" rows={2} minLength={3} />}
                </Field>
                <FormError error={action.error} />
                <div className="flex flex-wrap gap-2">
                  <Button type="submit" loading={action.pending}>
                    Enregistrer
                  </Button>
                  <Button
                    variant="secondary"
                    disabled={action.pending}
                    onClick={() => {
                      action.clearError();
                      setEditing(false);
                    }}
                  >
                    Annuler
                  </Button>
                </div>
              </form>
            )}
          </div>
        )}
      </ResourceView>
    </Card>
  );
}
