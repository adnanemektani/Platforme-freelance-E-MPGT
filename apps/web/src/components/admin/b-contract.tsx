'use client';

import { useState } from 'react';
import { AmendmentType, labels, type ActionState, type ContractView, type DocumentKind, type ReviewView } from '@empgt/contracts';
import { api, ApiError } from '@/lib/api';
import { formatDate, todayIso } from '@/lib/format';
import { useAction } from '@/lib/hooks';
import { Button } from '@/components/ui/button';
import { Alert } from '@/components/ui/feedback';
import { Field, FormError, formValue, Input, optionsFrom, Select, Textarea } from '@/components/ui/form';
import { FileInput } from '@/components/ui/file-upload';
import { BActionDialog, commissionValueLabel, rateLabel } from './b-common';

/**
 * Dépôt d'un document signé hors plateforme (contrat ou avenant) : PDF, date de signature,
 * preuve de signature. Ce n'est pas une signature électronique.
 */
export function BSignedDepositDialog({
  actions,
  endpoint,
  kind,
  label,
  subject,
  onDone,
  size = 'md',
}: {
  actions: ActionState[] | undefined;
  endpoint: string;
  kind: Extract<DocumentKind, 'SIGNED_CONTRACT' | 'SIGNED_AMENDMENT'>;
  label: string;
  subject: string;
  onDone: (view: ContractView) => void;
  size?: 'sm' | 'md';
}) {
  const [file, setFile] = useState<File | null>(null);
  return (
    <BActionDialog<ContractView>
      actions={actions}
      action="depositSigned"
      label={label}
      size={size}
      title={`Dépôt ${subject} signé hors plateforme`}
      submitLabel="Enregistrer le dépôt"
      success="Document signé enregistré"
      description={
        <Alert tone="warning" title="Dépôt d’un document signé hors plateforme">
          Ce n’est pas une signature électronique : la plateforme enregistre le PDF signé par les parties, sa date de signature et la preuve fournie.
        </Alert>
      }
      onSubmit={(form) => {
        if (!file) throw new ApiError(400, 'Joignez le PDF signé.');
        return api.upload<ContractView>(endpoint, file, {
          signedAt: formValue(form, 'signedAt'),
          signatureProofNote: formValue(form, 'signatureProofNote'),
        });
      }}
      onDone={(view) => {
        setFile(null);
        onDone(view);
      }}
    >
      <FileInput label="Document signé (PDF)" kind={kind} required onChange={setFile} />
      <Field label="Date de signature" required>{(p) => <Input {...p} type="date" name="signedAt" max={todayIso()} />}</Field>
      <Field label="Preuve de signature" required hint="Nature de la preuve, signataires, prestataire externe éventuel (5 caractères minimum).">
        {(p) => <Textarea {...p} name="signatureProofNote" rows={3} minLength={5} maxLength={2000} />}
      </Field>
    </BActionDialog>
  );
}

/** Création d'un avenant (action « amend ») : prolongation, modification des conditions ou autre. */
export function BAmendmentForm({ contract, onSaved, onCancel }: { contract: ContractView; onSaved: (view: ContractView) => void; onCancel: () => void }) {
  const action = useAction();
  const [type, setType] = useState<string>('');
  const c = contract;

  return (
    <form
      className="space-y-4"
      onSubmit={async (e) => {
        e.preventDefault();
        const form = new FormData(e.currentTarget);
        const v = (name: string) => formValue(form, name);
        const body = {
          type: v('type'),
          effectiveDate: v('effectiveDate'),
          reason: v('reason'),
          newEndDate: type === 'EXTENSION' ? v('newEndDate') : null,
          newFreelanceRate: type === 'TERMS_CHANGE' ? v('newFreelanceRate') : null,
          newClientRate: type === 'TERMS_CHANGE' ? v('newClientRate') : null,
          newHoursPerDay: type === 'TERMS_CHANGE' ? v('newHoursPerDay') : null,
          newCommissionValue: type === 'TERMS_CHANGE' ? v('newCommissionValue') : null,
          otherChanges: v('otherChanges'),
        };
        const result = await action.run(() => api.post<ContractView>(`/contracts/${c.id}/amendments`, body), { success: 'Avenant créé : déposez-le une fois signé' });
        if (result) onSaved(result);
      }}
    >
      <div className="grid gap-4 md:grid-cols-2">
        <Field label="Type d’avenant" required>
          {(p) => <Select {...p} name="type" value={type} onChange={(e) => setType(e.target.value)} placeholder="— Choisir —" options={optionsFrom(AmendmentType, labels.amendmentType)} />}
        </Field>
        <Field label="Date d’effet" required>{(p) => <Input {...p} type="date" name="effectiveDate" min={c.startDate} />}</Field>
      </div>

      {type === 'EXTENSION' && (
        <Field label="Nouvelle date de fin" required hint={`Fin actuelle : ${formatDate(c.currentEndDate ?? c.endDate)}`}>
          {(p) => <Input {...p} type="date" name="newEndDate" />}
        </Field>
      )}

      {type === 'TERMS_CHANGE' && (
        <div className="grid gap-4 rounded-md border border-gray-200 p-4 md:grid-cols-2">
          <p className="text-xs text-gray-600 md:col-span-2">Renseignez au moins une nouvelle valeur ; les valeurs laissées vides restent inchangées.</p>
          <Field label="Nouveau tarif freelance" hint={`Actuel : ${rateLabel(c.freelanceRate, c.currency, c.billingUnit)}`}>
            {(p) => <Input {...p} name="newFreelanceRate" inputMode="decimal" />}
          </Field>
          <Field label="Nouveau tarif client" hint={`Actuel : ${rateLabel(c.clientRate, c.currency, c.billingUnit)}`}>
            {(p) => <Input {...p} name="newClientRate" inputMode="decimal" />}
          </Field>
          <Field
            label="Nouvelles heures de référence par journée"
            hint={c.billingUnit === 'DAY' ? `Actuel : ${c.hoursPerDay ?? '—'} h` : 'Sans objet : contrat facturé à l’heure.'}
          >
            {(p) => <Input {...p} name="newHoursPerDay" inputMode="decimal" disabled={c.billingUnit !== 'DAY'} />}
          </Field>
          <Field
            label="Nouvelle valeur de commission"
            hint={c.commissionPayer === 'NONE' ? 'Sans objet : contrat sans commission.' : `Actuelle : ${commissionValueLabel(c.commissionValue, c.commissionMode, c.currency, c.billingUnit)}`}
          >
            {(p) => <Input {...p} name="newCommissionValue" inputMode="decimal" disabled={c.commissionPayer === 'NONE'} />}
          </Field>
        </div>
      )}

      <Field label="Autres modifications" required={type === 'OTHER'} hint={type === 'OTHER' ? 'Obligatoire : décrivez les modifications de l’avenant.' : 'Facultatif.'}>
        {(p) => <Textarea {...p} name="otherChanges" rows={3} maxLength={4000} />}
      </Field>
      <Field label="Motif" required hint="Conservé dans l’historique du contrat.">
        {(p) => <Textarea {...p} name="reason" rows={2} minLength={3} maxLength={2000} />}
      </Field>
      <FormError error={action.error} />
      <div className="flex flex-wrap gap-2">
        <Button type="submit" loading={action.pending}>
          Créer l’avenant
        </Button>
        <Button variant="secondary" onClick={onCancel} disabled={action.pending}>
          Annuler
        </Button>
      </div>
    </form>
  );
}

/** Évaluation interne d'une mission terminée (action « review »). */
export function BReviewDialog({ contract, onDone }: { contract: ContractView; onDone: (review: ReviewView) => void }) {
  return (
    <BActionDialog<ReviewView>
      actions={contract.actions}
      action="review"
      label="Évaluer la mission"
      variant="secondary"
      submitLabel="Enregistrer l’évaluation"
      success="Évaluation enregistrée"
      description="Évaluation interne à E-MPGT (visibilité interne par défaut)."
      onSubmit={(form) => api.post<ReviewView>(`/contracts/${contract.id}/reviews`, { rating: formValue(form, 'rating'), comment: formValue(form, 'comment') })}
      onDone={onDone}
    >
      <Field label="Note" required>
        {(p) => (
          <Select
            {...p}
            name="rating"
            defaultValue=""
            placeholder="— Choisir —"
            options={[5, 4, 3, 2, 1].map((n) => ({ value: String(n), label: `${n} / 5` }))}
          />
        )}
      </Field>
      <Field label="Commentaire">{(p) => <Textarea {...p} name="comment" rows={4} maxLength={4000} />}</Field>
    </BActionDialog>
  );
}
