'use client';

import { useEffect, useId, useState } from 'react';
import { labels, SkillCategory, type OwnProfileView, type SkillSuggestion } from '@empgt/contracts';
import { api, qs } from '@/lib/api';
import { useAction, useApi } from '@/lib/hooks';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/feedback';
import { Field, FormError, Input, optionsFrom, Select } from '@/components/ui/form';
import { editState, EditLock, type ProfileSectionProps } from './shared';

interface SkillRow {
  name: string;
  category: SkillCategory;
  level: string;
  yearsOfExperience: string;
}

const LEVELS = ['Notions', 'Intermédiaire', 'Confirmé', 'Expert'];

function useDebounced(value: string, delay = 300): string {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}

function fromProfile(profile: OwnProfileView): SkillRow[] {
  return profile.skills.map((s) => ({ name: s.name, category: s.category, level: s.level ?? '', yearsOfExperience: s.yearsOfExperience?.toString() ?? '' }));
}

/** Compétences et logiciels : liste éditable, enregistrée en une fois (PUT /profile/skills, jeu complet). */
export function SkillsEditor({ profile, onSaved }: ProfileSectionProps) {
  const { editable, reason } = editState(profile.actions);
  const [rows, setRows] = useState<SkillRow[]>(() => fromProfile(profile));
  const [dirty, setDirty] = useState(false);
  const [draft, setDraft] = useState<SkillRow>({ name: '', category: 'TECHNICAL', level: '', yearsOfExperience: '' });
  const query = useDebounced(draft.name.trim());
  const suggestions = useApi<SkillSuggestion[]>(editable && query.length >= 2 ? `/skills${qs({ q: query })}` : null);
  const levelsId = useId();
  const action = useAction();

  const update = (next: SkillRow[]) => {
    setRows(next);
    setDirty(true);
  };
  const exists = (name: string) => rows.some((r) => r.name.trim().toLowerCase() === name.trim().toLowerCase());
  const add = () => {
    if (!draft.name.trim() || exists(draft.name)) return;
    update([...rows, { ...draft, name: draft.name.trim() }]);
    setDraft({ name: '', category: draft.category, level: '', yearsOfExperience: '' });
  };

  const save = async () => {
    const result = await action.run(
      () =>
        api.put<OwnProfileView>('/profile/skills', {
          skills: rows.map((r) => ({
            name: r.name,
            category: r.category,
            level: r.level.trim() || null,
            yearsOfExperience: r.yearsOfExperience.trim() || null,
          })),
        }),
      { success: 'Compétences enregistrées' },
    );
    if (result) {
      setRows(fromProfile(result));
      setDirty(false);
      onSaved(result);
    }
  };

  const shownSuggestions = query.length >= 2 && draft.name.trim() ? (suggestions.data ?? []).filter((s) => !exists(s.name)).slice(0, 8) : [];

  return (
    <div className="space-y-5">
      <EditLock reason={reason} />
      <datalist id={levelsId}>
        {LEVELS.map((l) => (
          <option key={l} value={l} />
        ))}
      </datalist>

      {editable && (
        <div className="rounded-md border border-gray-200 bg-gray-50 p-4">
          <p className="mb-3 text-sm font-medium text-gray-900">Ajouter une compétence ou un logiciel</p>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[2fr_1fr_1fr_1fr_auto] lg:items-end">
            <Field label="Nom" hint="Ex. Revit, Métré, OPC, Gros œuvre…">
              {(p) => (
                <Input
                  {...p}
                  value={draft.name}
                  maxLength={100}
                  onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      add();
                    }
                  }}
                />
              )}
            </Field>
            <Field label="Catégorie">
              {(p) => (
                <Select
                  {...p}
                  value={draft.category}
                  onChange={(e) => setDraft({ ...draft, category: e.target.value as SkillCategory })}
                  options={optionsFrom(SkillCategory, labels.skillCategory)}
                />
              )}
            </Field>
            <Field label="Niveau">
              {(p) => <Input {...p} list={levelsId} value={draft.level} maxLength={50} onChange={(e) => setDraft({ ...draft, level: e.target.value })} />}
            </Field>
            <Field label="Années">
              {(p) => (
                <Input {...p} type="number" min={0} max={70} value={draft.yearsOfExperience} onChange={(e) => setDraft({ ...draft, yearsOfExperience: e.target.value })} />
              )}
            </Field>
            <Button variant="secondary" onClick={add} disabled={!draft.name.trim() || exists(draft.name)}>
              Ajouter
            </Button>
          </div>
          {shownSuggestions.length > 0 && (
            <div className="mt-3" aria-live="polite">
              <p className="text-xs text-gray-600">Suggestions du référentiel :</p>
              <div className="mt-1 flex flex-wrap gap-1.5">
                {shownSuggestions.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    className="rounded-full border border-brand-200 bg-white px-2.5 py-0.5 text-xs font-medium text-brand-800 hover:bg-brand-50"
                    onClick={() => setDraft({ ...draft, name: s.name, category: s.category })}
                  >
                    {s.name} <span className="text-gray-500">({labels.skillCategory[s.category]})</span>
                  </button>
                ))}
              </div>
            </div>
          )}
          <p className="mt-2 text-xs text-gray-600">Une compétence déjà présente dans le référentiel E-MPGT conserve sa catégorie de référence.</p>
        </div>
      )}

      {rows.length === 0 ? (
        <EmptyState title="Aucune compétence" description="Au moins une compétence est requise pour soumettre votre profil." />
      ) : (
        <ul className="divide-y divide-gray-100 rounded-lg border border-gray-200 bg-white">
          {rows.map((row, index) => (
            <li key={row.name} className="grid gap-2 px-4 py-3 sm:grid-cols-[2fr_1fr_1fr_1fr_auto] sm:items-center">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-medium text-gray-900">{row.name}</span>
                <Badge tone={row.category === 'SOFTWARE' ? 'purple' : 'gray'}>{labels.skillCategory[row.category]}</Badge>
              </div>
              {editable ? (
                <>
                  <label className="text-xs text-gray-600">
                    <span className="sr-only">Catégorie de {row.name}</span>
                    <Select
                      value={row.category}
                      onChange={(e) => update(rows.map((r, i) => (i === index ? { ...r, category: e.target.value as SkillCategory } : r)))}
                      options={optionsFrom(SkillCategory, labels.skillCategory)}
                    />
                  </label>
                  <label className="text-xs text-gray-600">
                    <span className="sr-only">Niveau en {row.name}</span>
                    <Input
                      list={levelsId}
                      value={row.level}
                      placeholder="Niveau"
                      maxLength={50}
                      onChange={(e) => update(rows.map((r, i) => (i === index ? { ...r, level: e.target.value } : r)))}
                    />
                  </label>
                  <label className="text-xs text-gray-600">
                    <span className="sr-only">Années d’expérience en {row.name}</span>
                    <Input
                      type="number"
                      min={0}
                      max={70}
                      value={row.yearsOfExperience}
                      placeholder="Années"
                      onChange={(e) => update(rows.map((r, i) => (i === index ? { ...r, yearsOfExperience: e.target.value } : r)))}
                    />
                  </label>
                  <Button variant="ghost" size="sm" onClick={() => update(rows.filter((_, i) => i !== index))}>
                    Retirer<span className="sr-only"> {row.name}</span>
                  </Button>
                </>
              ) : (
                <span className="text-sm text-gray-700 sm:col-span-4">
                  {[row.level, row.yearsOfExperience ? `${row.yearsOfExperience} an(s)` : null].filter(Boolean).join(' · ') || '—'}
                </span>
              )}
            </li>
          ))}
        </ul>
      )}

      <FormError error={action.error} />
      {editable && (
        <div className="flex flex-wrap items-center gap-3">
          <Button onClick={save} loading={action.pending} disabled={!dirty}>
            Enregistrer les compétences
          </Button>
          {dirty && <span className="text-sm text-amber-800">Modifications non enregistrées</span>}
        </div>
      )}
    </div>
  );
}
