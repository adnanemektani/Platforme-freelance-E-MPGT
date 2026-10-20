'use client';

import { useState } from 'react';
import {
  CurrencyCode,
  labels,
  RateUnit,
  WorkMode,
  type CreateMissionInput,
  type Currency,
  type MissionView,
} from '@empgt/contracts';
import type { ApiError } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import {
  Checkbox,
  Field,
  FormError,
  formValue,
  Input,
  optionsFrom,
  Select,
  Textarea,
} from '@/components/ui/form';
import { SkillsEditor, type MissionSkillInput } from './skills-editor';

const workModeOptions = optionsFrom(WorkMode, labels.workMode);
const unitOptions = RateUnit.map((u) => ({ value: u, label: `Par ${labels.rateUnit[u]}` }));
const currencyOptions = CurrencyCode.map((c) => ({ value: c, label: c }));

/**
 * Formulaire complet d'une mission (création et modification : mêmes champs).
 * Les contrôles définitifs (cohérence des dates, budget, complétude) sont faits par l'API.
 */
export function MissionForm({
  initial,
  submitLabel,
  pending,
  error,
  onSubmit,
  onCancel,
}: {
  initial?: MissionView;
  submitLabel: string;
  pending: boolean;
  error?: ApiError | null;
  onSubmit: (input: CreateMissionInput) => void | Promise<void>;
  onCancel?: () => void;
}) {
  const [skills, setSkills] = useState<MissionSkillInput[]>(
    () =>
      initial?.skills.map((s) => ({ name: s.name, category: s.category, required: s.required })) ??
      [],
  );

  return (
    <form
      className="space-y-6"
      onSubmit={(e) => {
        e.preventDefault();
        const form = new FormData(e.currentTarget);
        const country = formValue(form, 'country');
        void onSubmit({
          title: String(form.get('title') ?? '').trim(),
          description: String(form.get('description') ?? '').trim(),
          profileSought: formValue(form, 'profileSought'),
          sector: formValue(form, 'sector'),
          city: formValue(form, 'city'),
          region: formValue(form, 'region'),
          country: country ? country.toUpperCase() : null,
          workMode: formValue(form, 'workMode') as WorkMode | null,
          startDate: formValue(form, 'startDate'),
          endDate: formValue(form, 'endDate'),
          durationLabel: formValue(form, 'durationLabel'),
          budgetMin: formValue(form, 'budgetMin'),
          budgetMax: formValue(form, 'budgetMax'),
          budgetUnit: formValue(form, 'budgetUnit') as RateUnit | null,
          budgetCurrency: formValue(form, 'budgetCurrency') as Currency | null,
          budgetVisibleToFreelancers: form.get('budgetVisibleToFreelancers') === 'on',
          applicationDeadline: formValue(form, 'applicationDeadline'),
          skills,
        });
      }}
    >
      <Card
        title="Le poste"
        description="Une mission correspond à un seul poste : un seul candidat sera retenu."
      >
        <div className="space-y-4">
          <Field label="Intitulé de la mission" required>
            {(p) => (
              <Input
                {...p}
                name="title"
                maxLength={200}
                defaultValue={initial?.title ?? ''}
                placeholder="Ex. Conducteur de travaux gros œuvre"
              />
            )}
          </Field>
          <Field
            label="Description"
            required
            hint="Contexte, livrables, environnement du chantier… 50 caractères minimum pour soumettre la mission."
          >
            {(p) => (
              <Textarea
                {...p}
                name="description"
                rows={8}
                maxLength={10000}
                defaultValue={initial?.description ?? ''}
              />
            )}
          </Field>
          <Field label="Profil recherché" hint="Expérience, habilitations, qualités attendues.">
            {(p) => (
              <Textarea
                {...p}
                name="profileSought"
                rows={4}
                maxLength={2000}
                defaultValue={initial?.profileSought ?? ''}
              />
            )}
          </Field>
          <Field label="Secteur">
            {(p) => (
              <Input
                {...p}
                name="sector"
                maxLength={200}
                defaultValue={initial?.sector ?? ''}
                placeholder="Ex. Bâtiment, génie civil, VRD…"
              />
            )}
          </Field>
        </div>
      </Card>

      <Card title="Lieu et modalités">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Ville">
            {(p) => (
              <Input
                {...p}
                name="city"
                maxLength={100}
                defaultValue={initial?.city ?? ''}
                autoComplete="address-level2"
              />
            )}
          </Field>
          <Field label="Région">
            {(p) => (
              <Input
                {...p}
                name="region"
                maxLength={100}
                defaultValue={initial?.region ?? ''}
                autoComplete="address-level1"
              />
            )}
          </Field>
          <Field
            label="Pays (code ISO)"
            hint="Deux lettres : FR, MA, CI, SN… Requis pour la soumission."
          >
            {(p) => (
              <Input
                {...p}
                name="country"
                maxLength={2}
                pattern="[A-Za-z]{2}"
                className="uppercase"
                defaultValue={initial?.country ?? ''}
                placeholder="FR"
              />
            )}
          </Field>
          <Field label="Modalité d’intervention" hint="Requise pour la soumission.">
            {(p) => (
              <Select
                {...p}
                name="workMode"
                defaultValue={initial?.workMode ?? ''}
                placeholder="Non précisée"
                options={workModeOptions}
              />
            )}
          </Field>
        </div>
      </Card>

      <Card title="Calendrier">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Date de début souhaitée">
            {(p) => (
              <Input {...p} type="date" name="startDate" defaultValue={initial?.startDate ?? ''} />
            )}
          </Field>
          <Field label="Date de fin prévue">
            {(p) => (
              <Input {...p} type="date" name="endDate" defaultValue={initial?.endDate ?? ''} />
            )}
          </Field>
          <Field label="Durée indicative" hint="Ex. 6 mois renouvelables.">
            {(p) => (
              <Input
                {...p}
                name="durationLabel"
                maxLength={100}
                defaultValue={initial?.durationLabel ?? ''}
              />
            )}
          </Field>
          <Field label="Date limite de candidature">
            {(p) => (
              <Input
                {...p}
                type="date"
                name="applicationDeadline"
                defaultValue={initial?.applicationDeadline ?? ''}
              />
            )}
          </Field>
        </div>
      </Card>

      <Card
        title="Budget indicatif"
        description="Facultatif. Si vous indiquez un montant, précisez l’unité et la devise."
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Budget minimum" hint="Nombre décimal, ex. 450 ou 450,50.">
            {(p) => (
              <Input
                {...p}
                name="budgetMin"
                inputMode="decimal"
                defaultValue={initial?.budgetMin ?? ''}
              />
            )}
          </Field>
          <Field label="Budget maximum">
            {(p) => (
              <Input
                {...p}
                name="budgetMax"
                inputMode="decimal"
                defaultValue={initial?.budgetMax ?? ''}
              />
            )}
          </Field>
          <Field label="Unité">
            {(p) => (
              <Select
                {...p}
                name="budgetUnit"
                defaultValue={initial?.budgetUnit ?? ''}
                placeholder="Non précisée"
                options={unitOptions}
              />
            )}
          </Field>
          <Field label="Devise">
            {(p) => (
              <Select
                {...p}
                name="budgetCurrency"
                defaultValue={initial?.budgetCurrency ?? ''}
                placeholder="Non précisée"
                options={currencyOptions}
              />
            )}
          </Field>
          <div className="sm:col-span-2">
            <Checkbox
              name="budgetVisibleToFreelancers"
              defaultChecked={initial?.budgetVisibleToFreelancers ?? false}
              label="Budget visible des freelances"
              hint="Sinon, le budget reste connu de votre entreprise et d’E-MPGT uniquement."
            />
          </div>
        </div>
      </Card>

      <Card
        title="Compétences"
        description="Indiquez pour chacune si elle est obligatoire ou simplement souhaitée."
      >
        <SkillsEditor value={skills} onChange={setSkills} />
      </Card>

      <FormError error={error} />
      <div className="flex flex-wrap gap-2">
        <Button type="submit" loading={pending}>
          {submitLabel}
        </Button>
        {onCancel && (
          <Button variant="secondary" onClick={onCancel} disabled={pending}>
            Annuler
          </Button>
        )}
      </div>
    </form>
  );
}
