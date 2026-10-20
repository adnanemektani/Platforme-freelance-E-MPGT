'use client';

import { useId, useState } from 'react';
import type { OwnProfileView } from '@empgt/contracts';
import { api } from '@/lib/api';
import { useAction } from '@/lib/hooks';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/feedback';
import { Field, FormError, Input } from '@/components/ui/form';
import { editState, EditLock, type ProfileSectionProps } from './shared';

interface LanguageRow {
  key: number;
  name: string;
  level: string;
}

const LEVELS = ['Langue maternelle', 'Bilingue', 'Courant (C1-C2)', 'Professionnel (B2)', 'Intermédiaire (B1)', 'Notions (A1-A2)'];

/** Langues parlées : liste éditable enregistrée en une fois (PUT /profile/languages). */
export function LanguagesEditor({ profile, onSaved }: ProfileSectionProps) {
  const { editable, reason } = editState(profile.actions);
  const toRows = (p: OwnProfileView) => p.languages.map((l, i) => ({ key: i, name: l.name, level: l.level ?? '' }));
  const [rows, setRows] = useState<LanguageRow[]>(() => toRows(profile));
  const [nextKey, setNextKey] = useState(profile.languages.length);
  const [dirty, setDirty] = useState(false);
  const levelsId = useId();
  const action = useAction();

  const update = (next: LanguageRow[]) => {
    setRows(next);
    setDirty(true);
  };

  const save = async () => {
    const result = await action.run(
      () =>
        api.put<OwnProfileView>('/profile/languages', {
          languages: rows.filter((r) => r.name.trim()).map((r) => ({ name: r.name.trim(), level: r.level.trim() || null })),
        }),
      { success: 'Langues enregistrées' },
    );
    if (result) {
      setRows(toRows(result));
      setNextKey(result.languages.length);
      setDirty(false);
      onSaved(result);
    }
  };

  return (
    <div className="space-y-4">
      <EditLock reason={reason} />
      <datalist id={levelsId}>
        {LEVELS.map((l) => (
          <option key={l} value={l} />
        ))}
      </datalist>
      {rows.length === 0 && !editable ? (
        <EmptyState title="Aucune langue renseignée" />
      ) : (
        <ul className="space-y-2">
          {rows.map((row, index) => (
            <li key={row.key} className="grid gap-2 sm:grid-cols-[2fr_2fr_auto] sm:items-end">
              {editable ? (
                <>
                  <Field label={`Langue ${index + 1}`}>
                    {(p) => (
                      <Input {...p} value={row.name} maxLength={100} onChange={(e) => update(rows.map((r) => (r.key === row.key ? { ...r, name: e.target.value } : r)))} />
                    )}
                  </Field>
                  <Field label="Niveau">
                    {(p) => (
                      <Input
                        {...p}
                        list={levelsId}
                        value={row.level}
                        maxLength={100}
                        onChange={(e) => update(rows.map((r) => (r.key === row.key ? { ...r, level: e.target.value } : r)))}
                      />
                    )}
                  </Field>
                  <Button variant="ghost" size="sm" onClick={() => update(rows.filter((r) => r.key !== row.key))}>
                    Retirer<span className="sr-only"> {row.name}</span>
                  </Button>
                </>
              ) : (
                <p className="text-sm text-gray-900 sm:col-span-3">
                  <span className="font-medium">{row.name}</span>
                  {row.level && <span className="text-gray-600"> — {row.level}</span>}
                </p>
              )}
            </li>
          ))}
        </ul>
      )}
      <FormError error={action.error} />
      {editable && (
        <div className="flex flex-wrap items-center gap-3">
          <Button
            variant="secondary"
            onClick={() => {
              update([...rows, { key: nextKey, name: '', level: '' }]);
              setNextKey((k) => k + 1);
            }}
          >
            Ajouter une langue
          </Button>
          <Button onClick={save} loading={action.pending} disabled={!dirty}>
            Enregistrer les langues
          </Button>
          {dirty && <span className="text-sm text-amber-800">Modifications non enregistrées</span>}
        </div>
      )}
    </div>
  );
}
