'use client';

import {
  BusinessStatus,
  CurrencyCode,
  labels,
  Mobility,
  RateUnit,
  WorkMode,
  type AdminProfileView,
} from '@empgt/contracts';
import { api } from '@/lib/api';
import { useAction } from '@/lib/hooks';
import { Button } from '@/components/ui/button';
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
import { useToast } from '@/components/ui/toast';

const TEXT_FIELDS = [
  'headline',
  'summary',
  'city',
  'region',
  'country',
  'mobility',
  'mobilityNote',
  'businessStatus',
  'rateMin',
  'rateMax',
  'rateUnit',
  'rateCurrency',
  'rateNote',
  'internalNotes',
] as const;

/**
 * Modification administrative d'un profil (PATCH /admin/freelancers/:id), motif obligatoire.
 * Seuls les champs réellement modifiés sont envoyés : sur un profil importé, le serveur
 * verrouille chaque champ transmis vis-à-vis des imports suivants (correction humaine).
 */
export function AProfileForm({
  profile,
  onSaved,
  onCancel,
}: {
  profile: AdminProfileView;
  onSaved: (p: AdminProfileView) => void;
  onCancel: () => void;
}) {
  const action = useAction();
  const toast = useToast();
  return (
    <form
      className="space-y-4"
      onSubmit={async (e) => {
        e.preventDefault();
        const form = new FormData(e.currentTarget);
        const changes: Record<string, unknown> = {};
        const current = profile as unknown as Record<string, string | null>;
        for (const key of TEXT_FIELDS) {
          const value = formValue(form, key);
          if (value !== (current[key] ?? null)) changes[key] = value;
        }
        const years = formValue(form, 'yearsOfExperience');
        if (
          years !== (profile.yearsOfExperience === null ? null : String(profile.yearsOfExperience))
        )
          changes.yearsOfExperience = years;
        const modes = form.getAll('workModes').map(String).sort();
        if (modes.join(',') !== [...profile.workModes].sort().join(',')) changes.workModes = modes;
        if (Object.keys(changes).length === 0) {
          toast.info('Aucune modification à enregistrer.');
          return;
        }
        const result = await action.run(
          () =>
            api.patch<AdminProfileView>(`/admin/freelancers/${profile.id}`, {
              ...changes,
              reason: formValue(form, 'reason'),
            }),
          {
            success: 'Profil modifié',
          },
        );
        if (result) onSaved(result);
      }}
    >
      {profile.origin === 'IMPORTED' && (
        <p className="text-sm text-gray-700">
          Profil historique importé : chaque champ modifié ici sera verrouillé et ne sera plus
          écrasé par un nouvel import.
        </p>
      )}
      <Field label="Titre du profil">
        {(p) => (
          <Input {...p} name="headline" defaultValue={profile.headline ?? ''} maxLength={200} />
        )}
      </Field>
      <Field label="Résumé">
        {(p) => (
          <Textarea
            {...p}
            name="summary"
            rows={6}
            defaultValue={profile.summary ?? ''}
            maxLength={5000}
          />
        )}
      </Field>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Field label="Années d’expérience">
          {(p) => (
            <Input
              {...p}
              name="yearsOfExperience"
              type="number"
              min={0}
              max={70}
              defaultValue={profile.yearsOfExperience ?? ''}
            />
          )}
        </Field>
        <Field label="Ville">
          {(p) => <Input {...p} name="city" defaultValue={profile.city ?? ''} />}
        </Field>
        <Field label="Région">
          {(p) => <Input {...p} name="region" defaultValue={profile.region ?? ''} />}
        </Field>
        <Field label="Pays" hint="Code ISO à deux lettres">
          {(p) => (
            <Input {...p} name="country" defaultValue={profile.country ?? ''} maxLength={2} />
          )}
        </Field>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Mobilité">
          {(p) => (
            <Select
              {...p}
              name="mobility"
              defaultValue={profile.mobility ?? ''}
              placeholder="Non précisée"
              options={optionsFrom(Mobility, labels.mobility)}
            />
          )}
        </Field>
        <Field label="Précisions sur la mobilité">
          {(p) => <Input {...p} name="mobilityNote" defaultValue={profile.mobilityNote ?? ''} />}
        </Field>
      </div>
      <fieldset className="space-y-2">
        <legend className="text-sm font-medium text-gray-800">Modes de travail</legend>
        <div className="flex flex-wrap gap-4">
          {WorkMode.map((w) => (
            <Checkbox
              key={w}
              name="workModes"
              value={w}
              label={labels.workMode[w]}
              defaultChecked={profile.workModes.includes(w)}
            />
          ))}
        </div>
      </fieldset>
      <Field label="Statut d’exercice">
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
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Field label="Tarif minimum">
          {(p) => (
            <Input {...p} name="rateMin" inputMode="decimal" defaultValue={profile.rateMin ?? ''} />
          )}
        </Field>
        <Field label="Tarif maximum">
          {(p) => (
            <Input {...p} name="rateMax" inputMode="decimal" defaultValue={profile.rateMax ?? ''} />
          )}
        </Field>
        <Field label="Unité">
          {(p) => (
            <Select
              {...p}
              name="rateUnit"
              defaultValue={profile.rateUnit ?? ''}
              placeholder="—"
              options={optionsFrom(RateUnit, labels.rateUnit)}
            />
          )}
        </Field>
        <Field label="Devise">
          {(p) => (
            <Select
              {...p}
              name="rateCurrency"
              defaultValue={profile.rateCurrency ?? ''}
              placeholder="—"
              options={CurrencyCode.map((c) => ({ value: c, label: c }))}
            />
          )}
        </Field>
      </div>
      <Field label="Précisions sur le tarif">
        {(p) => <Input {...p} name="rateNote" defaultValue={profile.rateNote ?? ''} />}
      </Field>
      <Field label="Notes internes" hint="Visibles uniquement par E-MPGT.">
        {(p) => <Textarea {...p} name="internalNotes" defaultValue={profile.internalNotes ?? ''} />}
      </Field>
      <Field
        label="Motif de la modification"
        required
        hint="Obligatoire : conservé dans le journal d’audit ; si le profil est rattaché à un compte, le freelance en est informé."
      >
        {(p) => <Textarea {...p} name="reason" rows={2} minLength={3} />}
      </Field>
      <FormError error={action.error} />
      <div className="flex flex-wrap gap-2">
        <Button type="submit" loading={action.pending}>
          Enregistrer les modifications
        </Button>
        <Button variant="secondary" onClick={onCancel} disabled={action.pending}>
          Annuler
        </Button>
      </div>
    </form>
  );
}
