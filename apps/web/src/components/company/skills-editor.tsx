'use client';

import { useEffect, useId, useState } from 'react';
import {
  labels,
  SkillCategory,
  type CreateMissionInput,
  type SkillSuggestion,
} from '@empgt/contracts';
import { qs } from '@/lib/api';
import { useApi } from '@/lib/hooks';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox, Input, optionsFrom, Select } from '@/components/ui/form';

export type MissionSkillInput = CreateMissionInput['skills'][number];

const MAX_SKILLS = 40;
const categoryOptions = optionsFrom(SkillCategory, labels.skillCategory);

/** Compétences d'une mission : saisie libre, suggestions du référentiel, caractère obligatoire. */
export function SkillsEditor({
  value,
  onChange,
}: {
  value: MissionSkillInput[];
  onChange: (next: MissionSkillInput[]) => void;
}) {
  const baseId = useId();
  const [text, setText] = useState('');
  const [category, setCategory] = useState<SkillCategory>('TECHNICAL');
  const [term, setTerm] = useState('');

  // Recherche différée pour ne pas interroger l'API à chaque frappe.
  useEffect(() => {
    const timer = setTimeout(() => setTerm(text.trim()), 250);
    return () => clearTimeout(timer);
  }, [text]);

  const suggestions = useApi<SkillSuggestion[]>(
    term.length >= 2 ? `/skills${qs({ q: term })}` : null,
  );
  const has = (name: string) =>
    value.some((s) => s.name.toLowerCase() === name.trim().toLowerCase());
  const full = value.length >= MAX_SKILLS;

  const add = (name: string, cat: SkillCategory) => {
    const clean = name.trim();
    if (!clean || has(clean) || full) return;
    onChange([...value, { name: clean, category: cat, required: true }]);
    setText('');
    setTerm('');
  };
  const patch = (index: number, changes: Partial<MissionSkillInput>) =>
    onChange(value.map((s, i) => (i === index ? { ...s, ...changes } : s)));
  const remove = (index: number) => onChange(value.filter((_, i) => i !== index));

  const visibleSuggestions =
    text.trim().length >= 2 && term.length >= 2
      ? (suggestions.data ?? []).filter((s) => !has(s.name))
      : [];

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-[1fr_12rem_auto] sm:items-end">
        <div className="space-y-1">
          <label htmlFor={`${baseId}-name`} className="block text-sm font-medium text-gray-800">
            Ajouter une compétence ou un logiciel
          </label>
          <Input
            id={`${baseId}-name`}
            value={text}
            maxLength={100}
            placeholder="Ex. Revit, OPC, métré, AutoCAD…"
            aria-describedby={`${baseId}-hint`}
            disabled={full}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                add(text, category);
              }
            }}
          />
        </div>
        <div className="space-y-1">
          <label htmlFor={`${baseId}-category`} className="block text-sm font-medium text-gray-800">
            Catégorie
          </label>
          <Select
            id={`${baseId}-category`}
            value={category}
            options={categoryOptions}
            disabled={full}
            onChange={(e) => setCategory(e.target.value as SkillCategory)}
          />
        </div>
        <Button
          variant="secondary"
          onClick={() => add(text, category)}
          disabled={!text.trim() || full}
        >
          Ajouter
        </Button>
      </div>
      <p id={`${baseId}-hint`} className="text-xs text-gray-600">
        Saisissez librement ou choisissez une suggestion du référentiel. {MAX_SKILLS} compétences
        maximum ; au moins une est requise pour soumettre la mission.
      </p>

      <div aria-live="polite">
        {visibleSuggestions.length > 0 && (
          <div>
            <p className="text-xs font-medium text-gray-600">Suggestions :</p>
            <ul className="mt-1 flex flex-wrap gap-1.5">
              {visibleSuggestions.map((s) => (
                <li key={s.id}>
                  <button
                    type="button"
                    onClick={() => add(s.name, s.category)}
                    className="rounded-full border border-brand-200 bg-white px-2.5 py-1 text-xs text-brand-800 hover:bg-brand-50"
                  >
                    {s.name}{' '}
                    <span className="text-gray-500">· {labels.skillCategory[s.category]}</span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {value.length === 0 ? (
        <p className="rounded-md border border-dashed border-gray-300 p-3 text-sm text-gray-600">
          Aucune compétence ajoutée.
        </p>
      ) : (
        <ul className="space-y-2" aria-label="Compétences de la mission">
          {value.map((skill, index) => (
            <li
              key={skill.name}
              className="flex flex-wrap items-center gap-3 rounded-md border border-gray-200 bg-white px-3 py-2"
            >
              <span className="min-w-0 flex-1 font-medium text-gray-900">
                {skill.name}{' '}
                {skill.required ? <Badge tone="blue">Obligatoire</Badge> : <Badge>Souhaitée</Badge>}
              </span>
              <div className="w-40">
                <label htmlFor={`${baseId}-cat-${index}`} className="sr-only">
                  Catégorie de {skill.name}
                </label>
                <Select
                  id={`${baseId}-cat-${index}`}
                  value={skill.category}
                  options={categoryOptions}
                  onChange={(e) => patch(index, { category: e.target.value as SkillCategory })}
                />
              </div>
              <Checkbox
                label="Obligatoire"
                checked={skill.required}
                onChange={(e) => patch(index, { required: e.target.checked })}
              />
              <Button
                size="sm"
                variant="ghost"
                onClick={() => remove(index)}
                aria-label={`Retirer ${skill.name}`}
              >
                Retirer
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
