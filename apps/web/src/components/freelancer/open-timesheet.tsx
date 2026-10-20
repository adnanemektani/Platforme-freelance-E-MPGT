'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import type { TimesheetView } from '@empgt/contracts';
import { api } from '@/lib/api';
import { firstOfMonthIso } from '@/lib/format';
import { useAction } from '@/lib/hooks';
import { Button } from '@/components/ui/button';
import { Field, FormError, Select } from '@/components/ui/form';
import { recentMonths } from './helpers';

/**
 * Ouverture du CRA d'un mois pour un contrat (le mois en cours par défaut).
 * La possibilité réelle (mission active, mois couvert par le contrat, CRA déjà existant) est vérifiée par le serveur.
 */
export function OpenTimesheetForm({
  contractId,
  contracts,
  submitLabel = 'Ouvrir le CRA',
}: {
  /** Contrat imposé (page contrat)… */
  contractId?: string;
  /** …ou liste de contrats actifs parmi lesquels choisir (page CRA). */
  contracts?: Array<{ id: string; label: string }>;
  submitLabel?: string;
}) {
  const router = useRouter();
  const action = useAction();
  const [months] = useState(() => recentMonths(12));
  const [selectedContract, setSelectedContract] = useState(contractId ?? contracts?.[0]?.id ?? '');

  return (
    <form
      className="grid items-end gap-3 sm:grid-cols-[1fr_auto] lg:grid-cols-[2fr_1fr_auto]"
      onSubmit={async (e) => {
        e.preventDefault();
        const form = new FormData(e.currentTarget);
        const target = contractId ?? selectedContract;
        const created = await action.run(
          () => api.post<TimesheetView>(`/contracts/${target}/timesheets`, { periodStart: String(form.get('periodStart') ?? firstOfMonthIso(0)) }),
          { success: 'CRA ouvert : saisissez vos heures' },
        );
        if (created) router.push(`/freelance/cra/${created.id}`);
      }}
    >
      {!contractId && contracts && (
        <Field label="Contrat" required>
          {(p) => <Select {...p} value={selectedContract} onChange={(e) => setSelectedContract(e.target.value)} options={contracts.map((c) => ({ value: c.id, label: c.label }))} />}
        </Field>
      )}
      <Field label="Mois" required>
        {(p) => <Select {...p} name="periodStart" defaultValue={months[0]?.value} options={months} />}
      </Field>
      <Button type="submit" loading={action.pending} disabled={!contractId && !selectedContract}>
        {submitLabel}
      </Button>
      <div className="sm:col-span-2 lg:col-span-3">
        <FormError error={action.error} />
      </div>
    </form>
  );
}
