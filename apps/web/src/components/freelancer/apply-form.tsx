'use client';

import { useRouter } from 'next/navigation';
import { CurrencyCode, labels, RateUnit, type ApplicationView } from '@empgt/contracts';
import { api } from '@/lib/api';
import { useAction } from '@/lib/hooks';
import { Button } from '@/components/ui/button';
import { Field, FormError, formValue, Input, Select, Textarea } from '@/components/ui/form';

/** Candidature à une mission (POST /missions/:id/applications). */
export function ApplyForm({ missionId }: { missionId: string }) {
  const router = useRouter();
  const action = useAction();

  return (
    <form
      className="space-y-4"
      onSubmit={async (e) => {
        e.preventDefault();
        const form = new FormData(e.currentTarget);
        const proposedRate = formValue(form, 'proposedRate');
        const application = await action.run(
          () =>
            api.post<ApplicationView>(`/missions/${missionId}/applications`, {
              message: formValue(form, 'message'),
              availabilityNote: formValue(form, 'availabilityNote'),
              proposedRate,
              proposedRateUnit: proposedRate ? formValue(form, 'proposedRateUnit') : null,
              proposedRateCurrency: proposedRate ? formValue(form, 'proposedRateCurrency') : null,
            }),
          { success: 'Candidature envoyée' },
        );
        if (application) router.push(`/freelance/candidatures/${application.id}`);
      }}
    >
      <Field label="Message de candidature" required hint="Expliquez en quoi votre expérience correspond à la mission (références de chantiers, logiciels, habilitations…).">
        {(p) => <Textarea {...p} name="message" maxLength={5000} rows={6} />}
      </Field>
      <Field label="Disponibilité pour cette mission" hint="Ex. « Disponible à partir du 3 novembre, 4 jours par semaine ».">
        {(p) => <Input {...p} name="availabilityNote" maxLength={1000} />}
      </Field>
      <fieldset className="rounded-md border border-gray-200 p-3">
        <legend className="px-1 text-sm font-medium text-gray-800">Tarif indicatif (facultatif)</legend>
        <p className="mb-3 text-xs text-gray-600">
          Visible uniquement par vous et E-MPGT : il n’est jamais communiqué tel quel à l’entreprise et ne vaut pas condition contractuelle.
        </p>
        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="Montant">{(p) => <Input {...p} name="proposedRate" inputMode="decimal" placeholder="Ex. 550" />}</Field>
          <Field label="Unité">
            {(p) => <Select {...p} name="proposedRateUnit" defaultValue="DAY" options={RateUnit.map((u) => ({ value: u, label: `Par ${labels.rateUnit[u]}` }))} />}
          </Field>
          <Field label="Devise">{(p) => <Select {...p} name="proposedRateCurrency" defaultValue="EUR" options={CurrencyCode.map((c) => ({ value: c, label: c }))} />}</Field>
        </div>
      </fieldset>
      <FormError error={action.error} />
      <Button type="submit" loading={action.pending}>
        Envoyer ma candidature
      </Button>
    </form>
  );
}
