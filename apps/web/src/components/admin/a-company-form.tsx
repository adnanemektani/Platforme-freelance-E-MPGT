'use client';

import type { AdminCompanyView } from '@empgt/contracts';
import { api } from '@/lib/api';
import { useAction } from '@/lib/hooks';
import { Button } from '@/components/ui/button';
import { Field, FormError, formValue, Input, Textarea } from '@/components/ui/form';

const FIELDS: Array<{
  name: keyof AdminCompanyView & string;
  label: string;
  type?: string;
  hint?: string;
  wide?: boolean;
}> = [
  { name: 'legalName', label: 'Raison sociale' },
  { name: 'tradeName', label: 'Nom commercial' },
  { name: 'legalForm', label: 'Forme juridique' },
  { name: 'registrationType', label: 'Type d’immatriculation', hint: 'Ex. SIREN, RC, RCCM…' },
  { name: 'registrationNumber', label: 'Numéro d’immatriculation' },
  { name: 'vatNumber', label: 'Numéro de TVA' },
  { name: 'addressLine1', label: 'Adresse' },
  { name: 'addressLine2', label: 'Complément d’adresse' },
  { name: 'postalCode', label: 'Code postal' },
  { name: 'city', label: 'Ville' },
  { name: 'country', label: 'Pays', hint: 'Code ISO à deux lettres (FR, MA, CI…)' },
  { name: 'sector', label: 'Secteur' },
  { name: 'sizeRange', label: 'Effectif' },
  { name: 'website', label: 'Site web', type: 'url' },
];

/**
 * Modification administrative d'une entreprise (PATCH /admin/companies/:id).
 * Motif obligatoire : la modification et son motif sont tracés dans le journal d'audit.
 */
export function ACompanyForm({
  company,
  onSaved,
  onCancel,
}: {
  company: AdminCompanyView;
  onSaved: (c: AdminCompanyView) => void;
  onCancel: () => void;
}) {
  const action = useAction();
  return (
    <form
      className="space-y-4"
      onSubmit={async (e) => {
        e.preventDefault();
        const form = new FormData(e.currentTarget);
        const body: Record<string, string | null> = {};
        for (const f of FIELDS) body[f.name] = formValue(form, f.name);
        body.description = formValue(form, 'description');
        body.internalNotes = formValue(form, 'internalNotes');
        body.reason = formValue(form, 'reason');
        const result = await action.run(
          () => api.patch<AdminCompanyView>(`/admin/companies/${company.id}`, body),
          { success: 'Entreprise modifiée' },
        );
        if (result) onSaved(result);
      }}
    >
      {company.lockedFields.length > 0 && (
        <p className="text-sm text-gray-700">
          Les champs d’identité légale sont verrouillés pour l’entreprise depuis sa vérification :
          seule E-MPGT peut les modifier, avec un motif.
        </p>
      )}
      <div className="grid gap-4 sm:grid-cols-2">
        {FIELDS.map((f) => (
          <Field key={f.name} label={f.label} hint={f.hint} required={f.name === 'legalName'}>
            {(p) => (
              <Input
                {...p}
                name={f.name}
                type={f.type ?? 'text'}
                defaultValue={(company[f.name] as string | null) ?? ''}
              />
            )}
          </Field>
        ))}
      </div>
      <Field label="Description">
        {(p) => <Textarea {...p} name="description" defaultValue={company.description ?? ''} />}
      </Field>
      <Field label="Notes internes" hint="Visibles uniquement par E-MPGT.">
        {(p) => <Textarea {...p} name="internalNotes" defaultValue={company.internalNotes ?? ''} />}
      </Field>
      <Field
        label="Motif de la modification"
        required
        hint="Obligatoire : conservé dans le journal d’audit (3 caractères minimum)."
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
