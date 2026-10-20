'use client';

import { useState } from 'react';
import type { CompanyView, UpdateCompanyInput } from '@empgt/contracts';
import { api } from '@/lib/api';
import { useAction } from '@/lib/hooks';
import { findAction } from '@/components/ui/actions';
import { Button } from '@/components/ui/button';
import { DefinitionList } from '@/components/ui/card';
import { Alert } from '@/components/ui/feedback';
import { Field, FormError, formValue, Input, Textarea } from '@/components/ui/form';
import { ActionUnavailable } from './widgets';

type CompanyField = keyof UpdateCompanyInput & keyof CompanyView;

const FIELDS: Array<{
  name: CompanyField;
  label: string;
  hint?: string;
  required?: boolean;
  maxLength: number;
  type?: 'text' | 'url';
  textarea?: boolean;
  wide?: boolean;
  autoComplete?: string;
  uppercase?: boolean;
}> = [
  {
    name: 'legalName',
    label: 'Raison sociale',
    required: true,
    maxLength: 200,
    autoComplete: 'organization',
  },
  { name: 'tradeName', label: 'Nom commercial', maxLength: 200 },
  { name: 'legalForm', label: 'Forme juridique', hint: 'Ex. SAS, SARL, SA…', maxLength: 100 },
  {
    name: 'registrationType',
    label: 'Type d’immatriculation',
    hint: 'Ex. RCS, RC, ICE, RCCM…',
    maxLength: 100,
  },
  { name: 'registrationNumber', label: 'Numéro d’immatriculation', maxLength: 100 },
  { name: 'vatNumber', label: 'Numéro de TVA', maxLength: 100 },
  {
    name: 'addressLine1',
    label: 'Adresse',
    maxLength: 200,
    wide: true,
    autoComplete: 'address-line1',
  },
  {
    name: 'addressLine2',
    label: 'Complément d’adresse',
    maxLength: 200,
    wide: true,
    autoComplete: 'address-line2',
  },
  { name: 'postalCode', label: 'Code postal', maxLength: 20, autoComplete: 'postal-code' },
  { name: 'city', label: 'Ville', maxLength: 100, autoComplete: 'address-level2' },
  {
    name: 'country',
    label: 'Pays (code ISO)',
    hint: 'Deux lettres : FR, MA, CI, SN…',
    maxLength: 2,
    uppercase: true,
  },
  { name: 'sector', label: 'Secteur d’activité', maxLength: 200 },
  { name: 'sizeRange', label: 'Effectif', hint: 'Ex. 10-49 salariés.', maxLength: 50 },
  {
    name: 'website',
    label: 'Site web',
    hint: 'Adresse complète, commençant par https://',
    maxLength: 500,
    type: 'url',
    autoComplete: 'url',
  },
  { name: 'description', label: 'Présentation', maxLength: 4000, textarea: true, wide: true },
];

/**
 * Informations de l'organisation. Les champs verrouillés (entreprise vérifiée) ne sont ni
 * modifiables ni envoyés ; l'API refuse de toute façon leur modification.
 */
export function CompanyInfoForm({
  company,
  onSaved,
}: {
  company: CompanyView;
  onSaved: (company: CompanyView) => void;
}) {
  const update = findAction(company.actions, 'update');
  const action = useAction();
  const [formKey, setFormKey] = useState(0);

  if (!update) {
    return (
      <DefinitionList
        items={FIELDS.map((f): [string, string | null] => [f.label, company[f.name]])}
      />
    );
  }

  const locked = new Set(company.lockedFields);
  const editable = update.allowed;
  return (
    <form
      key={formKey}
      className="space-y-4"
      onSubmit={async (e) => {
        e.preventDefault();
        const form = new FormData(e.currentTarget);
        const input: Record<string, string | null> = {};
        for (const f of FIELDS) {
          // Un champ désactivé (verrouillé) n'apparaît pas dans le formulaire envoyé.
          if (!form.has(f.name)) continue;
          const value =
            f.name === 'legalName'
              ? String(form.get(f.name) ?? '').trim()
              : formValue(form, f.name);
          input[f.name] = value && f.uppercase ? value.toUpperCase() : value;
        }
        const saved = await action.run(() => api.patch<CompanyView>('/company', input), {
          success: 'Informations de l’entreprise enregistrées',
        });
        if (saved) {
          onSaved(saved);
          setFormKey((k) => k + 1);
        }
      }}
    >
      <ActionUnavailable state={update} />
      {locked.size > 0 && (
        <Alert tone="info" title="Identité légale verrouillée">
          Votre entreprise est vérifiée : la raison sociale, la forme juridique, l’immatriculation
          et le pays ne peuvent être modifiés que par E-MPGT. Contactez E-MPGT pour toute
          correction.
        </Alert>
      )}
      <fieldset disabled={!editable} className="grid gap-4 sm:grid-cols-2">
        <legend className="sr-only">Informations de l’entreprise</legend>
        {FIELDS.map((f) => {
          const isLocked = locked.has(f.name);
          const hint = isLocked
            ? 'Verrouillé (entreprise vérifiée) : modification par E-MPGT uniquement.'
            : f.hint;
          return (
            <div key={f.name} className={f.wide ? 'sm:col-span-2' : undefined}>
              <Field label={f.label} required={f.required && !isLocked} hint={hint}>
                {(p) =>
                  f.textarea ? (
                    <Textarea
                      {...p}
                      name={f.name}
                      rows={5}
                      maxLength={f.maxLength}
                      defaultValue={company[f.name] ?? ''}
                      disabled={isLocked}
                    />
                  ) : (
                    <Input
                      {...p}
                      name={f.name}
                      type={f.type ?? 'text'}
                      maxLength={f.maxLength}
                      defaultValue={company[f.name] ?? ''}
                      disabled={isLocked}
                      autoComplete={f.autoComplete}
                      className={f.uppercase ? 'uppercase' : undefined}
                      pattern={f.name === 'country' ? '[A-Za-z]{2}' : undefined}
                    />
                  )
                }
              </Field>
            </div>
          );
        })}
      </fieldset>
      <FormError error={action.error} />
      {editable && (
        <Button type="submit" loading={action.pending}>
          Enregistrer les informations
        </Button>
      )}
    </form>
  );
}
