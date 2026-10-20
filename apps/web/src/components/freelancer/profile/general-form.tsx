'use client';

import { BusinessStatus, labels, Mobility, WorkMode, type OwnProfileView } from '@empgt/contracts';
import { api } from '@/lib/api';
import { useAction } from '@/lib/hooks';
import { Button } from '@/components/ui/button';
import { Checkbox, Field, FormError, formValue, Input, optionsFrom, Select, Textarea } from '@/components/ui/form';
import { editState, EditLock, type ProfileSectionProps } from './shared';

/** Informations générales du profil (PATCH /profile). */
export function GeneralForm({ profile, onSaved }: ProfileSectionProps) {
  const { editable, reason } = editState(profile.actions);
  const action = useAction();

  return (
    <form
      className="space-y-5"
      onSubmit={async (e) => {
        e.preventDefault();
        const form = new FormData(e.currentTarget);
        const result = await action.run(
          () =>
            api.patch<OwnProfileView>('/profile', {
              headline: formValue(form, 'headline'),
              summary: formValue(form, 'summary'),
              yearsOfExperience: formValue(form, 'yearsOfExperience'),
              city: formValue(form, 'city'),
              region: formValue(form, 'region'),
              country: formValue(form, 'country'),
              mobility: formValue(form, 'mobility'),
              mobilityNote: formValue(form, 'mobilityNote'),
              workModes: form.getAll('workModes').map(String),
              businessStatus: formValue(form, 'businessStatus'),
            }),
          { success: 'Informations générales enregistrées' },
        );
        if (result) onSaved(result);
      }}
    >
      <EditLock reason={reason} />
      <fieldset disabled={!editable} className="space-y-5">
        <legend className="sr-only">Informations générales</legend>
        <Field label="Titre du profil" hint="Requis pour la soumission. Votre métier en quelques mots (ex. « Conducteur de travaux TCE — 15 ans »).">
          {(p) => <Input {...p} name="headline" defaultValue={profile.headline ?? ''} maxLength={200} />}
        </Field>
        <Field label="Résumé" hint="Requis pour la soumission (40 caractères minimum). Présentez votre parcours, vos spécialités et le type de missions recherchées.">
          {(p) => <Textarea {...p} name="summary" defaultValue={profile.summary ?? ''} maxLength={5000} rows={6} />}
        </Field>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="Années d’expérience">
            {(p) => <Input {...p} name="yearsOfExperience" type="number" min={0} max={70} step={1} defaultValue={profile.yearsOfExperience ?? ''} />}
          </Field>
          <Field label="Statut juridique">
            {(p) => (
              <Select
                {...p}
                name="businessStatus"
                defaultValue={profile.businessStatus ?? ''}
                placeholder="Non précisé"
                options={optionsFrom(BusinessStatus, labels.businessStatus)}
              />
            )}
          </Field>
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Ville">{(p) => <Input {...p} name="city" defaultValue={profile.city ?? ''} maxLength={100} autoComplete="address-level2" />}</Field>
          <Field label="Région">{(p) => <Input {...p} name="region" defaultValue={profile.region ?? ''} maxLength={100} autoComplete="address-level1" />}</Field>
          <Field label="Pays de résidence" hint="Requis pour la soumission. Code ISO à deux lettres : FR, MA, CI, SN, CM…">
            {(p) => (
              <Input
                {...p}
                name="country"
                defaultValue={profile.country ?? ''}
                maxLength={2}
                pattern="[A-Za-z]{2}"
                className="uppercase"
                autoComplete="country"
              />
            )}
          </Field>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Mobilité">
            {(p) => <Select {...p} name="mobility" defaultValue={profile.mobility ?? ''} placeholder="Non précisée" options={optionsFrom(Mobility, labels.mobility)} />}
          </Field>
          <Field label="Précision sur la mobilité" hint="Ex. « Île-de-France et Hauts-de-France », « déplacements à l’étranger possibles ».">
            {(p) => <Input {...p} name="mobilityNote" defaultValue={profile.mobilityNote ?? ''} maxLength={500} />}
          </Field>
        </div>
        <fieldset>
          <legend className="text-sm font-medium text-gray-800">Modalités d’intervention acceptées</legend>
          <div className="mt-2 flex flex-wrap gap-4">
            {WorkMode.map((mode) => (
              <Checkbox key={mode} name="workModes" value={mode} defaultChecked={profile.workModes.includes(mode)} label={labels.workMode[mode]} />
            ))}
          </div>
        </fieldset>
      </fieldset>
      <FormError error={action.error} />
      {editable && (
        <Button type="submit" loading={action.pending}>
          Enregistrer les informations générales
        </Button>
      )}
    </form>
  );
}
