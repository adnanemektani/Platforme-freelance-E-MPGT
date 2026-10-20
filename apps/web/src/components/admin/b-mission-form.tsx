'use client';

import { useState } from 'react';
import { CurrencyCode, labels, RateUnit, SkillCategory, WorkMode, type MissionView } from '@empgt/contracts';
import { api } from '@/lib/api';
import { useAction } from '@/lib/hooks';
import { Button } from '@/components/ui/button';
import { Checkbox, Field, FormError, formValue, Input, optionsFrom, Select, Textarea } from '@/components/ui/form';
import { formChecked } from './b-common';

interface SkillRow {
  key: number;
  name: string;
  category: SkillCategory;
  required: boolean;
}

const currencyOptions = CurrencyCode.map((c) => ({ value: c, label: c }));

/**
 * Modification administrative d'une mission (PATCH /missions/:id/admin) : mêmes champs que la
 * création, motif obligatoire, intervention tracée et notifiée à l'entreprise.
 */
export function BMissionAdminForm({ mission, onSaved, onCancel }: { mission: MissionView; onSaved: (view: MissionView) => void; onCancel: () => void }) {
  const action = useAction();
  const [skills, setSkills] = useState<SkillRow[]>(() => mission.skills.map((s, i) => ({ key: i, name: s.name, category: s.category, required: s.required })));
  const [nextKey, setNextKey] = useState(mission.skills.length);

  const updateSkill = (key: number, patch: Partial<SkillRow>) => setSkills((list) => list.map((s) => (s.key === key ? { ...s, ...patch } : s)));

  return (
    <form
      className="space-y-5"
      onSubmit={async (e) => {
        e.preventDefault();
        const form = new FormData(e.currentTarget);
        const v = (name: string) => formValue(form, name);
        const body = {
          reason: v('reason'),
          title: v('title'),
          description: v('description'),
          profileSought: v('profileSought'),
          sector: v('sector'),
          city: v('city'),
          region: v('region'),
          country: v('country'),
          workMode: v('workMode'),
          startDate: v('startDate'),
          endDate: v('endDate'),
          durationLabel: v('durationLabel'),
          budgetMin: v('budgetMin'),
          budgetMax: v('budgetMax'),
          budgetUnit: v('budgetUnit'),
          budgetCurrency: v('budgetCurrency'),
          budgetVisibleToFreelancers: formChecked(form, 'budgetVisibleToFreelancers'),
          applicationDeadline: v('applicationDeadline'),
          skills: skills.filter((s) => s.name.trim() !== '').map((s) => ({ name: s.name.trim(), category: s.category, required: s.required })),
        };
        const result = await action.run(() => api.patch<MissionView>(`/missions/${mission.id}/admin`, body), { success: 'Mission modifiée (intervention E-MPGT tracée)' });
        if (result) onSaved(result);
      }}
    >
      <div className="grid gap-4 md:grid-cols-2">
        <div className="md:col-span-2">
          <Field label="Titre" required>{(p) => <Input {...p} name="title" defaultValue={mission.title} maxLength={200} />}</Field>
        </div>
        <div className="md:col-span-2">
          <Field label="Description" required>{(p) => <Textarea {...p} name="description" rows={8} defaultValue={mission.description} maxLength={10000} />}</Field>
        </div>
        <div className="md:col-span-2">
          <Field label="Profil recherché">{(p) => <Textarea {...p} name="profileSought" rows={3} defaultValue={mission.profileSought ?? ''} maxLength={2000} />}</Field>
        </div>
        <Field label="Secteur">{(p) => <Input {...p} name="sector" defaultValue={mission.sector ?? ''} maxLength={200} />}</Field>
        <Field label="Modalité d’intervention">
          {(p) => <Select {...p} name="workMode" defaultValue={mission.workMode ?? ''} placeholder="— Non précisée —" options={optionsFrom(WorkMode, labels.workMode)} />}
        </Field>
        <Field label="Ville">{(p) => <Input {...p} name="city" defaultValue={mission.city ?? ''} maxLength={100} />}</Field>
        <Field label="Région">{(p) => <Input {...p} name="region" defaultValue={mission.region ?? ''} maxLength={100} />}</Field>
        <Field label="Pays" hint="Code ISO à deux lettres (ex. FR, MA, CI)">
          {(p) => <Input {...p} name="country" defaultValue={mission.country ?? ''} maxLength={2} className="uppercase" />}
        </Field>
        <Field label="Durée (libellé)">{(p) => <Input {...p} name="durationLabel" defaultValue={mission.durationLabel ?? ''} maxLength={100} />}</Field>
        <Field label="Début">{(p) => <Input {...p} type="date" name="startDate" defaultValue={mission.startDate ?? ''} />}</Field>
        <Field label="Fin">{(p) => <Input {...p} type="date" name="endDate" defaultValue={mission.endDate ?? ''} />}</Field>
        <Field label="Date limite de candidature">{(p) => <Input {...p} type="date" name="applicationDeadline" defaultValue={mission.applicationDeadline ?? ''} />}</Field>
      </div>

      <fieldset className="space-y-3 rounded-md border border-gray-200 p-4">
        <legend className="px-1 text-sm font-semibold text-gray-900">Budget indicatif</legend>
        <div className="grid gap-4 md:grid-cols-4">
          <Field label="Minimum">{(p) => <Input {...p} name="budgetMin" inputMode="decimal" defaultValue={mission.budgetMin ?? ''} />}</Field>
          <Field label="Maximum">{(p) => <Input {...p} name="budgetMax" inputMode="decimal" defaultValue={mission.budgetMax ?? ''} />}</Field>
          <Field label="Unité">
            {(p) => <Select {...p} name="budgetUnit" defaultValue={mission.budgetUnit ?? ''} placeholder="—" options={optionsFrom(RateUnit, labels.rateUnit)} />}
          </Field>
          <Field label="Devise">{(p) => <Select {...p} name="budgetCurrency" defaultValue={mission.budgetCurrency ?? ''} placeholder="—" options={currencyOptions} />}</Field>
        </div>
        <Checkbox name="budgetVisibleToFreelancers" defaultChecked={Boolean(mission.budgetVisibleToFreelancers)} label="Budget visible des freelances" />
      </fieldset>

      <fieldset className="space-y-3 rounded-md border border-gray-200 p-4">
        <legend className="px-1 text-sm font-semibold text-gray-900">Compétences</legend>
        {skills.length === 0 && <p className="text-sm text-gray-600">Aucune compétence.</p>}
        <ul className="space-y-2">
          {skills.map((s, index) => (
            <li key={s.key} className="grid items-end gap-2 sm:grid-cols-[1fr_12rem_auto_auto]">
              <Field label={`Compétence ${index + 1}`}>
                {(p) => <Input {...p} value={s.name} maxLength={100} onChange={(e) => updateSkill(s.key, { name: e.target.value })} />}
              </Field>
              <Field label="Catégorie">
                {(p) => (
                  <Select {...p} value={s.category} options={optionsFrom(SkillCategory, labels.skillCategory)} onChange={(e) => updateSkill(s.key, { category: e.target.value as SkillCategory })} />
                )}
              </Field>
              <div className="pb-2">
                <Checkbox checked={s.required} onChange={(e) => updateSkill(s.key, { required: e.target.checked })} label="Requise" />
              </div>
              <Button variant="ghost" size="sm" onClick={() => setSkills((list) => list.filter((x) => x.key !== s.key))}>
                Retirer
              </Button>
            </li>
          ))}
        </ul>
        <Button
          variant="secondary"
          size="sm"
          onClick={() => {
            setSkills((list) => [...list, { key: nextKey, name: '', category: 'TECHNICAL', required: true }]);
            setNextKey((k) => k + 1);
          }}
        >
          Ajouter une compétence
        </Button>
      </fieldset>

      <Field label="Motif de la modification" required hint="Obligatoire : conservé dans le journal d’audit et communiqué à l’entreprise.">
        {(p) => <Textarea {...p} name="reason" rows={3} minLength={3} maxLength={2000} />}
      </Field>
      <FormError error={action.error} />
      <div className="flex flex-wrap gap-2">
        <Button type="submit" loading={action.pending}>
          Enregistrer la modification
        </Button>
        <Button variant="secondary" onClick={onCancel} disabled={action.pending}>
          Annuler
        </Button>
      </div>
    </form>
  );
}
