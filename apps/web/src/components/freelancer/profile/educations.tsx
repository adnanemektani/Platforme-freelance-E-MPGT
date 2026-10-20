'use client';

import { useState } from 'react';
import type { EducationView, OwnProfileView } from '@empgt/contracts';
import { api } from '@/lib/api';
import { useAction } from '@/lib/hooks';
import { ActionButton } from '@/components/ui/actions';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/feedback';
import { Field, formValue, Input, Textarea } from '@/components/ui/form';
import { ItemDialog } from './item-dialog';
import { editState, EditLock, type ProfileSectionProps } from './shared';

type Editing = { mode: 'create' } | { mode: 'edit'; item: EducationView } | null;

/** Formations et diplômes (POST|PATCH|DELETE /profile/educations). */
export function EducationsSection({ profile, onSaved }: ProfileSectionProps) {
  const { editable, reason } = editState(profile.actions);
  const [editing, setEditing] = useState<Editing>(null);
  const action = useAction();
  const item = editing?.mode === 'edit' ? editing.item : null;

  const submit = async (form: FormData) => {
    const body = {
      title: formValue(form, 'title'),
      institution: formValue(form, 'institution'),
      periodLabel: formValue(form, 'periodLabel'),
      year: formValue(form, 'year'),
      description: formValue(form, 'description'),
    };
    const result = await action.run(
      () => (item ? api.patch<OwnProfileView>(`/profile/educations/${item.id}`, body) : api.post<OwnProfileView>('/profile/educations', body)),
      { success: item ? 'Formation modifiée' : 'Formation ajoutée' },
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
          Ajouter une formation
        </Button>
      )}
      {profile.educations.length === 0 ? (
        <EmptyState title="Aucune formation" description="Diplômes, certifications professionnelles, formations qualifiantes." />
      ) : (
        <ul className="space-y-3">
          {profile.educations.map((e) => (
            <li key={e.id} className="rounded-lg border border-gray-200 bg-white p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-semibold text-gray-900">{e.title}</p>
                  <p className="text-sm text-gray-700">{e.institution ?? 'Établissement non précisé'}</p>
                  <p className="text-xs text-gray-500">{e.periodLabel ?? (e.year ? String(e.year) : 'Année non précisée')}</p>
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
                      endpoint={`/profile/educations/${e.id}`}
                      confirm={{ title: 'Supprimer la formation', message: `La formation « ${e.title} » sera retirée de votre profil.`, confirmLabel: 'Supprimer' }}
                      success="Formation supprimée"
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
        title={item ? 'Modifier la formation' : 'Ajouter une formation'}
        submitLabel="Enregistrer"
        pending={action.pending}
        error={action.error}
        onClose={() => setEditing(null)}
        onSubmit={submit}
      >
        <Field label="Diplôme ou formation" required>
          {(p) => <Input {...p} name="title" defaultValue={item?.title ?? ''} maxLength={300} />}
        </Field>
        <Field label="Établissement / organisme">{(p) => <Input {...p} name="institution" defaultValue={item?.institution ?? ''} maxLength={200} />}</Field>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Période (texte libre)" hint="Ex. « 2008 – 2011 »">
            {(p) => <Input {...p} name="periodLabel" defaultValue={item?.periodLabel ?? ''} maxLength={100} />}
          </Field>
          <Field label="Année d’obtention">{(p) => <Input {...p} name="year" type="number" min={1950} max={2100} defaultValue={item?.year ?? ''} />}</Field>
        </div>
        <Field label="Description">{(p) => <Textarea {...p} name="description" defaultValue={item?.description ?? ''} maxLength={2000} rows={3} />}</Field>
      </ItemDialog>
    </div>
  );
}
