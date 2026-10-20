'use client';

import { useState } from 'react';
import type { ExperienceView, OwnProfileView } from '@empgt/contracts';
import { api } from '@/lib/api';
import { useAction } from '@/lib/hooks';
import { ActionButton } from '@/components/ui/actions';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/feedback';
import { Checkbox, Field, formValue, Input, Select, Textarea } from '@/components/ui/form';
import { experiencePeriod, MONTH_OPTIONS } from '../helpers';
import { ItemDialog } from './item-dialog';
import { editState, EditLock, type ProfileSectionProps } from './shared';

type Editing = { mode: 'create' } | { mode: 'edit'; item: ExperienceView } | null;

/** Expériences professionnelles : ajout, modification, suppression (POST|PATCH|DELETE /profile/experiences). */
export function ExperiencesSection({ profile, onSaved }: ProfileSectionProps) {
  const { editable, reason } = editState(profile.actions);
  const [editing, setEditing] = useState<Editing>(null);
  const action = useAction();
  const item = editing?.mode === 'edit' ? editing.item : null;

  const submit = async (form: FormData) => {
    const body = {
      title: formValue(form, 'title'),
      organization: formValue(form, 'organization'),
      location: formValue(form, 'location'),
      periodLabel: formValue(form, 'periodLabel'),
      startMonth: formValue(form, 'startMonth'),
      startYear: formValue(form, 'startYear'),
      endMonth: formValue(form, 'endMonth'),
      endYear: formValue(form, 'endYear'),
      isCurrent: form.get('isCurrent') === 'on',
      description: formValue(form, 'description'),
    };
    const result = await action.run(
      () => (item ? api.patch<OwnProfileView>(`/profile/experiences/${item.id}`, body) : api.post<OwnProfileView>('/profile/experiences', body)),
      { success: item ? 'Expérience modifiée' : 'Expérience ajoutée' },
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
          Ajouter une expérience
        </Button>
      )}
      {profile.experiences.length === 0 ? (
        <EmptyState title="Aucune expérience" description="Au moins une expérience est requise pour soumettre votre profil." />
      ) : (
        <ul className="space-y-3">
          {profile.experiences.map((e) => (
            <li key={e.id} className="rounded-lg border border-gray-200 bg-white p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-semibold text-gray-900">{e.title}</p>
                  <p className="text-sm text-gray-700">{[e.organization, e.location].filter(Boolean).join(' · ') || 'Organisation non précisée'}</p>
                  <p className="text-xs text-gray-500">{experiencePeriod(e)}</p>
                </div>
                {editable && (
                  <div className="flex flex-wrap gap-2">
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => {
                        action.clearError();
                        setEditing({ mode: 'edit', item: e });
                      }}
                    >
                      Modifier<span className="sr-only"> {e.title}</span>
                    </Button>
                    <ActionButton<OwnProfileView>
                      actions={profile.actions}
                      action="update"
                      label="Supprimer"
                      size="sm"
                      variant="danger"
                      method="delete"
                      endpoint={`/profile/experiences/${e.id}`}
                      confirm={{ title: 'Supprimer l’expérience', message: `L’expérience « ${e.title} » sera retirée de votre profil.`, confirmLabel: 'Supprimer' }}
                      success="Expérience supprimée"
                      onDone={onSaved}
                    />
                  </div>
                )}
              </div>
              {e.description && <p className="mt-2 whitespace-pre-line text-sm text-gray-800">{e.description}</p>}
            </li>
          ))}
        </ul>
      )}

      <ItemDialog
        open={editing !== null}
        title={item ? 'Modifier l’expérience' : 'Ajouter une expérience'}
        submitLabel="Enregistrer"
        pending={action.pending}
        error={action.error}
        onClose={() => setEditing(null)}
        onSubmit={submit}
      >
        <Field label="Intitulé du poste ou de la mission" required>
          {(p) => <Input {...p} name="title" defaultValue={item?.title ?? ''} maxLength={200} />}
        </Field>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Entreprise / maître d’ouvrage">{(p) => <Input {...p} name="organization" defaultValue={item?.organization ?? ''} maxLength={200} />}</Field>
          <Field label="Lieu">{(p) => <Input {...p} name="location" defaultValue={item?.location ?? ''} maxLength={200} />}</Field>
        </div>
        <Field label="Période (texte libre)" hint="Ex. « 2019 – 2023 », « 18 mois ». Facultatif si vous renseignez les dates ci-dessous.">
          {(p) => <Input {...p} name="periodLabel" defaultValue={item?.periodLabel ?? ''} maxLength={100} />}
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Mois de début">
            {(p) => <Select {...p} name="startMonth" defaultValue={item?.startMonth?.toString() ?? ''} placeholder="—" options={MONTH_OPTIONS} />}
          </Field>
          <Field label="Année de début">
            {(p) => <Input {...p} name="startYear" type="number" min={1950} max={2100} defaultValue={item?.startYear ?? ''} />}
          </Field>
          <Field label="Mois de fin">
            {(p) => <Select {...p} name="endMonth" defaultValue={item?.endMonth?.toString() ?? ''} placeholder="—" options={MONTH_OPTIONS} />}
          </Field>
          <Field label="Année de fin">
            {(p) => <Input {...p} name="endYear" type="number" min={1950} max={2100} defaultValue={item?.endYear ?? ''} />}
          </Field>
        </div>
        <Checkbox name="isCurrent" defaultChecked={item?.isCurrent ?? false} label="Poste ou mission en cours" hint="La date de fin est alors ignorée." />
        <Field label="Description" hint="Missions, responsabilités, chantiers, logiciels utilisés…">
          {(p) => <Textarea {...p} name="description" defaultValue={item?.description ?? ''} maxLength={5000} rows={5} />}
        </Field>
      </ItemDialog>
    </div>
  );
}
