'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { CurrencyCode, labels, type ContractListItem, type ContractView, type FreelancerPaymentsOverview, type InvoiceView } from '@empgt/contracts';
import { api } from '@/lib/api';
import { formatMoney, formatMonth, formatNumber, todayIso } from '@/lib/format';
import { useAction, useApi } from '@/lib/hooks';
import { Button } from '@/components/ui/button';
import { Alert } from '@/components/ui/feedback';
import { FileInput } from '@/components/ui/file-upload';
import { Field, FormError, formValue, Input, Select } from '@/components/ui/form';

/**
 * Dépôt d'une facture freelance (multipart POST /invoices, kind FREELANCER_INVOICE).
 * Les montants sont déclarés tels qu'ils figurent sur la facture : la plateforme ne calcule pas les taxes ;
 * la cohérence (TTC = HT + taxes, devise du contrat, CRA validé) est contrôlée par le serveur.
 */
export function InvoiceDepositForm({
  contracts,
  approvedAmounts,
  initialTimesheetId,
}: {
  contracts: ContractListItem[];
  approvedAmounts: FreelancerPaymentsOverview['approvedAmounts'];
  initialTimesheetId?: string | null;
}) {
  const router = useRouter();
  const action = useAction();
  const initial = approvedAmounts.find((a) => a.timesheetId === initialTimesheetId);
  const [contractId, setContractId] = useState(() => (initial ? (contracts.find((c) => c.reference === initial.contractReference)?.id ?? '') : ''));
  const [timesheetId, setTimesheetId] = useState(initial?.timesheetId ?? '');
  const [file, setFile] = useState<File | null>(null);
  const [today] = useState(todayIso);
  const contract = useApi<ContractView>(contractId ? `/contracts/${contractId}` : null);
  const selected = contracts.find((c) => c.id === contractId);
  const timesheets = approvedAmounts.filter((a) => selected && a.contractReference === selected.reference && (!a.invoiced || a.timesheetId === timesheetId));
  const chosen = approvedAmounts.find((a) => a.timesheetId === timesheetId);
  const terms = contract.data && contract.data.id === contractId ? contract.data : null;

  if (contracts.length === 0) {
    return <p className="text-sm text-gray-600">Aucun contrat : la facturation est possible une fois une mission démarrée.</p>;
  }

  return (
    <form
      className="space-y-4"
      onSubmit={async (e) => {
        e.preventDefault();
        const form = new FormData(e.currentTarget);
        const invoice = await action.run(
          () =>
            api.upload<InvoiceView>('/invoices', file, {
              kind: 'FREELANCER_INVOICE',
              contractId,
              timesheetId: timesheetId || null,
              number: formValue(form, 'number'),
              issuerLabel: formValue(form, 'issuerLabel'),
              issueDate: formValue(form, 'issueDate'),
              dueDate: formValue(form, 'dueDate'),
              currency: formValue(form, 'currency'),
              amountExclTax: formValue(form, 'amountExclTax'),
              taxAmount: formValue(form, 'taxAmount'),
              amountInclTax: formValue(form, 'amountInclTax'),
            }),
          { success: 'Facture déposée : E-MPGT va la contrôler' },
        );
        if (invoice) router.push(`/freelance/paiements/factures/${invoice.id}`);
      }}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Contrat" required>
          {(p) => (
            <Select
              {...p}
              value={contractId}
              placeholder="Choisir un contrat"
              onChange={(e) => {
                setContractId(e.target.value);
                setTimesheetId('');
              }}
              options={contracts.map((c) => ({ value: c.id, label: `${c.reference} — ${c.missionTitle} (${labels.contractStatus[c.status].toLowerCase()})` }))}
            />
          )}
        </Field>
        <Field label="CRA validé concerné" hint="CRA validés non encore facturés pour ce contrat. Facultatif, mais recommandé pour le rapprochement.">
          {(p) => (
            <Select
              {...p}
              value={timesheetId}
              disabled={!contractId}
              placeholder={timesheets.length ? 'Sans rattachement à un CRA' : 'Aucun CRA validé non facturé'}
              onChange={(e) => setTimesheetId(e.target.value)}
              options={timesheets.map((a) => ({
                value: a.timesheetId,
                label: `${formatMonth(a.periodStart)} — ${formatNumber(a.hours)} h${a.freelanceNetExclTax ? ` — net ${formatMoney(a.freelanceNetExclTax, a.currency)} HT` : ''}`,
              }))}
            />
          )}
        </Field>
      </div>

      {terms && (
        <Alert tone="info">
          Factures à adresser à : <strong>{labels.invoiceAddressee[terms.freelancerInvoiceAddressee]}</strong> · devise du contrat : <strong>{terms.currency}</strong>
          {terms.freelancerPaymentTermsDays !== null && <> · délai de règlement prévu : {terms.freelancerPaymentTermsDays} jour(s)</>}
          {chosen?.freelanceNetExclTax && (
            <>
              <br />
              Montant net freelance HT du CRA validé : <strong>{formatMoney(chosen.freelanceNetExclTax, chosen.currency)}</strong> (rapprochement effectué par E-MPGT).
            </>
          )}
        </Alert>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Field label="Numéro de facture" required>
          {(p) => <Input {...p} name="number" maxLength={100} />}
        </Field>
        <div className="lg:col-span-3">
          <Field label="Émetteur" required hint="Nom ou raison sociale figurant sur la facture.">
            {(p) => <Input {...p} name="issuerLabel" maxLength={200} />}
          </Field>
        </div>
        <Field label="Date d’émission" required>
          {(p) => <Input {...p} name="issueDate" type="date" defaultValue={today} />}
        </Field>
        <Field label="Date d’échéance" required>
          {(p) => <Input {...p} name="dueDate" type="date" />}
        </Field>
        <Field label="Devise" required hint="Celle du contrat.">
          {(p) => <Select key={terms?.id ?? 'none'} {...p} name="currency" defaultValue={terms?.currency ?? ''} placeholder="—" options={CurrencyCode.map((c) => ({ value: c, label: c }))} />}
        </Field>
      </div>

      <fieldset className="rounded-md border border-gray-200 p-3">
        <legend className="px-1 text-sm font-medium text-gray-800">Montants déclarés (tels qu’indiqués sur votre facture)</legend>
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Montant HT" required>
            {(p) => <Input {...p} name="amountExclTax" inputMode="decimal" placeholder="Ex. 7800,00" />}
          </Field>
          <Field label="Taxes" required hint="0 si vous n’êtes pas assujetti.">
            {(p) => <Input {...p} name="taxAmount" inputMode="decimal" placeholder="Ex. 1560,00" />}
          </Field>
          <Field label="Montant TTC" required hint="Doit être égal au HT plus les taxes (contrôlé à l’envoi).">
            {(p) => <Input {...p} name="amountInclTax" inputMode="decimal" placeholder="Ex. 9360,00" />}
          </Field>
        </div>
        <p className="mt-2 text-xs text-gray-600">La plateforme ne calcule pas les taxes : vous restez responsable des mentions et montants de votre facture.</p>
      </fieldset>

      <FileInput label="Facture (PDF)" kind="INVOICE" required onChange={setFile} />
      <FormError error={action.error} />
      <Button type="submit" loading={action.pending} disabled={!contractId || !file}>
        Déposer la facture
      </Button>
    </form>
  );
}
