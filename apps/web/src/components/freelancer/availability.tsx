'use client';

import { useState } from 'react';
import { AvailabilityKind, CurrencyCode, labels, RateUnit, type AvailabilityStatus, type AvailabilityView, type OwnProfileView } from '@empgt/contracts';
import { api } from '@/lib/api';
import { formatDate, formatMoney, formatNumber } from '@/lib/format';
import { useAction } from '@/lib/hooks';
import { ActionButton } from '@/components/ui/actions';
import { Badge, StatusBadge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Alert, EmptyState } from '@/components/ui/feedback';
import { Field, FormError, formValue, Input, Select, Textarea } from '@/components/ui/form';
import { ItemDialog } from './profile/item-dialog';
import { editState, EditLock, type ProfileSectionProps } from './profile/shared';

const STATUS_CHOICES: Array<{ value: Exclude<AvailabilityStatus, 'UNKNOWN'>; hint: string }> = [
  { value: 'AVAILABLE_NOW', hint: 'Vous pouvez démarrer une mission dès maintenant.' },
  { value: 'AVAILABLE_FROM', hint: 'Précisez la date à partir de laquelle vous êtes disponible.' },
  { value: 'UNAVAILABLE', hint: 'Vous ne recherchez pas de mission pour le moment.' },
];

/** Statut de disponibilité affiché aux entreprises et à E-MPGT (PATCH /profile/availability-status). */
export function AvailabilityStatusForm({ profile, onSaved }: ProfileSectionProps) {
  const { editable, reason } = editState(profile.actions);
  const [status, setStatus] = useState<AvailabilityStatus>(profile.availabilityStatus);
  const action = useAction();

  return (
    <form
      className="space-y-4"
      onSubmit={async (e) => {
        e.preventDefault();
        const form = new FormData(e.currentTarget);
        const result = await action.run(
          () =>
            api.patch<OwnProfileView>('/profile/availability-status', {
              availabilityStatus: status,
              availableFrom: status === 'AVAILABLE_FROM' ? formValue(form, 'availableFrom') : null,
            }),
          { success: 'Disponibilité enregistrée' },
        );
        if (result) onSaved(result);
      }}
    >
      <p className="flex flex-wrap items-center gap-2 text-sm text-gray-800">
        Statut actuel :
        <StatusBadge
          status={profile.availabilityStatus}
          label={`${labels.availabilityStatus[profile.availabilityStatus]}${profile.availabilityStatus === 'AVAILABLE_FROM' && profile.availableFrom ? ` ${formatDate(profile.availableFrom)}` : ''}`}
        />
      </p>
      <EditLock reason={reason} />
      <fieldset disabled={!editable} className="space-y-2">
        <legend className="text-sm font-medium text-gray-800">Ma disponibilité</legend>
        {STATUS_CHOICES.map((choice) => (
          <label key={choice.value} className="flex items-start gap-2 text-sm text-gray-800">
            <input
              type="radio"
              name="availabilityStatus"
              value={choice.value}
              checked={status === choice.value}
              onChange={() => setStatus(choice.value)}
              className="mt-0.5 h-4 w-4"
            />
            <span>
              <span className="font-medium">{labels.availabilityStatus[choice.value]}</span>
              <span className="block text-xs text-gray-600">{choice.hint}</span>
            </span>
          </label>
        ))}
        {status === 'AVAILABLE_FROM' && (
          <div className="max-w-xs pl-6">
            <Field label="Disponible à partir du" required>
              {(p) => <Input {...p} name="availableFrom" type="date" defaultValue={profile.availableFrom ?? ''} />}
            </Field>
          </div>
        )}
      </fieldset>
      <FormError error={action.error} />
      {editable && (
        <Button type="submit" loading={action.pending} disabled={status === 'UNKNOWN'}>
          Enregistrer ma disponibilité
        </Button>
      )}
    </form>
  );
}

type Editing = { mode: 'create' } | { mode: 'edit'; item: AvailabilityView } | null;

const KIND_TONE: Record<AvailabilityView['kind'], 'green' | 'amber' | 'red'> = { AVAILABLE: 'green', PARTIAL: 'amber', UNAVAILABLE: 'red' };

function PeriodForm({ item }: { item: AvailabilityView | null }) {
  const [kind, setKind] = useState<AvailabilityView['kind']>(item?.kind ?? 'AVAILABLE');
  return (
    <>
      <Field label="Type de période" required>
        {(p) => (
          <Select
            {...p}
            name="kind"
            value={kind}
            onChange={(e) => setKind(e.target.value as AvailabilityView['kind'])}
            options={AvailabilityKind.map((k) => ({ value: k, label: labels.availabilityKind[k] }))}
          />
        )}
      </Field>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Début" required>
          {(p) => <Input {...p} name="startDate" type="date" defaultValue={item?.startDate ?? ''} />}
        </Field>
        <Field label="Fin" hint="Facultatif : laissez vide pour une période sans fin connue.">
          {(p) => <Input {...p} name="endDate" type="date" defaultValue={item?.endDate ?? ''} />}
        </Field>
      </div>
      {kind === 'PARTIAL' && (
        <Field label="Jours par semaine" required hint="De 0,5 à 7 (ex. 2,5).">
          {(p) => <Input {...p} name="daysPerWeek" inputMode="decimal" defaultValue={item?.daysPerWeek ?? ''} maxLength={4} />}
        </Field>
      )}
      <Field label="Note" hint="Ex. « Disponible le matin uniquement », « Congés ».">
        {(p) => <Textarea {...p} name="note" defaultValue={item?.note ?? ''} maxLength={500} rows={2} />}
      </Field>
    </>
  );
}

/** Périodes de disponibilité (POST|PATCH|DELETE /profile/availabilities). */
export function AvailabilityPeriods({ profile, onSaved }: ProfileSectionProps) {
  const { editable, reason } = editState(profile.actions);
  const [editing, setEditing] = useState<Editing>(null);
  const action = useAction();
  const item = editing?.mode === 'edit' ? editing.item : null;

  const submit = async (form: FormData) => {
    const kind = formValue(form, 'kind');
    const body = {
      kind,
      startDate: formValue(form, 'startDate'),
      endDate: formValue(form, 'endDate'),
      daysPerWeek: kind === 'PARTIAL' ? formValue(form, 'daysPerWeek') : null,
      note: formValue(form, 'note'),
    };
    const result = await action.run(
      () => (item ? api.patch<OwnProfileView>(`/profile/availabilities/${item.id}`, body) : api.post<OwnProfileView>('/profile/availabilities', body)),
      { success: item ? 'Période modifiée' : 'Période ajoutée' },
    );
    if (result) {
      setEditing(null);
      onSaved(result);
    }
  };

  return (
    <div className="space-y-4">
      <EditLock reason={reason} />
      {editable && (
        <Button
          variant="secondary"
          onClick={() => {
            action.clearError();
            setEditing({ mode: 'create' });
          }}
        >
          Ajouter une période
        </Button>
      )}
      {profile.availabilities.length === 0 ? (
        <EmptyState title="Aucune période renseignée" description="Indiquez vos périodes de disponibilité, de disponibilité partielle ou d’indisponibilité (congés, autre mission…)." />
      ) : (
        <ul className="divide-y divide-gray-100 rounded-lg border border-gray-200 bg-white">
          {profile.availabilities.map((a) => (
            <li key={a.id} className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-start sm:justify-between">
              <div className="space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge tone={KIND_TONE[a.kind]}>{labels.availabilityKind[a.kind]}</Badge>
                  <span className="text-sm font-medium text-gray-900">
                    {a.endDate ? `Du ${formatDate(a.startDate)} au ${formatDate(a.endDate)}` : `À partir du ${formatDate(a.startDate)}`}
                  </span>
                  {a.daysPerWeek && <span className="text-sm text-gray-700">· {formatNumber(a.daysPerWeek, 1)} jour(s) / semaine</span>}
                </div>
                {a.note && <p className="text-sm text-gray-700">{a.note}</p>}
              </div>
              {editable && (
                <div className="flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => {
                      action.clearError();
                      setEditing({ mode: 'edit', item: a });
                    }}
                  >
                    Modifier
                  </Button>
                  <ActionButton<OwnProfileView>
                    actions={profile.actions}
                    action="update"
                    label="Supprimer"
                    size="sm"
                    variant="danger"
                    method="delete"
                    endpoint={`/profile/availabilities/${a.id}`}
                    confirm={{ title: 'Supprimer la période', message: 'Cette période de disponibilité sera retirée.', confirmLabel: 'Supprimer' }}
                    success="Période supprimée"
                    onDone={onSaved}
                  />
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
      <ItemDialog
        open={editing !== null}
        title={item ? 'Modifier la période' : 'Ajouter une période'}
        submitLabel="Enregistrer"
        pending={action.pending}
        error={action.error}
        onClose={() => setEditing(null)}
        onSubmit={submit}
      >
        <PeriodForm item={item} />
      </ItemDialog>
    </div>
  );
}

/** Préférences tarifaires privées (PATCH /profile) : jamais substituées aux conditions d'un contrat. */
export function RatePreferencesForm({ profile, onSaved }: ProfileSectionProps) {
  const { editable, reason } = editState(profile.actions);
  const action = useAction();
  const current =
    profile.rateMin || profile.rateMax
      ? [
          profile.rateMin && profile.rateMax
            ? `${formatMoney(profile.rateMin, profile.rateCurrency)} – ${formatMoney(profile.rateMax, profile.rateCurrency)}`
            : formatMoney(profile.rateMin ?? profile.rateMax, profile.rateCurrency),
          profile.rateUnit ? `par ${labels.rateUnit[profile.rateUnit]}` : '',
        ].join(' ')
      : null;

  return (
    <form
      className="space-y-4"
      onSubmit={async (e) => {
        e.preventDefault();
        const form = new FormData(e.currentTarget);
        const result = await action.run(
          () =>
            api.patch<OwnProfileView>('/profile', {
              rateMin: formValue(form, 'rateMin'),
              rateMax: formValue(form, 'rateMax'),
              rateUnit: formValue(form, 'rateUnit'),
              rateCurrency: formValue(form, 'rateCurrency'),
              rateNote: formValue(form, 'rateNote'),
            }),
          { success: 'Préférences tarifaires enregistrées' },
        );
        if (result) onSaved(result);
      }}
    >
      <Alert tone="info" title="Informations privées">
        Vos préférences tarifaires sont visibles uniquement par vous et E-MPGT. Elles servent d’indication et ne remplacent jamais les conditions d’un contrat, qui
        seules font foi.
      </Alert>
      {current && <p className="text-sm text-gray-800">Préférence enregistrée : {current}</p>}
      <EditLock reason={reason} />
      <fieldset disabled={!editable} className="space-y-4">
        <legend className="sr-only">Préférences tarifaires</legend>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="Tarif minimal" hint="Ex. 450 ou 450,50">
            {(p) => <Input {...p} name="rateMin" inputMode="decimal" defaultValue={profile.rateMin ?? ''} />}
          </Field>
          <Field label="Tarif maximal">{(p) => <Input {...p} name="rateMax" inputMode="decimal" defaultValue={profile.rateMax ?? ''} />}</Field>
          <Field label="Unité">
            {(p) => (
              <Select
                {...p}
                name="rateUnit"
                defaultValue={profile.rateUnit ?? ''}
                placeholder="—"
                options={RateUnit.map((u) => ({ value: u, label: `Par ${labels.rateUnit[u]}` }))}
              />
            )}
          </Field>
          <Field label="Devise">
            {(p) => <Select {...p} name="rateCurrency" defaultValue={profile.rateCurrency ?? ''} placeholder="—" options={CurrencyCode.map((c) => ({ value: c, label: c }))} />}
          </Field>
        </div>
        <Field label="Note" hint="Ex. « Hors frais de déplacement », « Tarif dégressif pour une mission longue ».">
          {(p) => <Textarea {...p} name="rateNote" defaultValue={profile.rateNote ?? ''} maxLength={500} rows={2} />}
        </Field>
      </fieldset>
      <FormError error={action.error} />
      {editable && (
        <Button type="submit" loading={action.pending}>
          Enregistrer mes préférences
        </Button>
      )}
    </form>
  );
}
