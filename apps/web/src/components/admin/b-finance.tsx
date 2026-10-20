'use client';

import { useState } from 'react';
import {
  CurrencyCode,
  labels,
  PaymentMethod,
  type ContractListItem,
  type ContractView,
  type InvoiceView,
  type MoneyRecordView,
  type Page,
  type TimesheetListItem,
  type TimesheetView,
} from '@empgt/contracts';
import { api, ApiError, qs } from '@/lib/api';
import { formatDate, formatDateTime, formatMoney, formatMonth, todayIso } from '@/lib/format';
import { useAction, useApi } from '@/lib/hooks';
import { ActionButton } from '@/components/ui/actions';
import { StatusBadge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Alert, Spinner } from '@/components/ui/feedback';
import { Field, FormError, formValue, Input, optionsFrom, Select, Textarea } from '@/components/ui/form';
import { FileInput } from '@/components/ui/file-upload';
import { DataTable } from '@/components/ui/table';
import { BActionDialog, BDocumentLinks } from './b-common';

/** Totaux par devise renvoyés par GET /admin/finance/overview (montants en chaînes décimales). */
export interface BFinanceOverview {
  disclaimer: string;
  provider: { code: string; label: string; mode: 'NONE' | 'TEST' | 'LIVE'; automationEnabled: boolean };
  totals: Array<{
    currency: string;
    approvedClientTotal: string;
    approvedFreelanceNet: string;
    approvedCommission: string;
    approvedMargin: string;
    clientInvoiced: string;
    clientCollected: string;
    freelancerInvoiced: string;
    freelancerPaid: string;
    overdue: string;
  }>;
}

/**
 * Enregistrement d'un encaissement client (« payment ») ou d'un règlement freelance (« payout ») :
 * justificatif, montant, date, méthode et référence obligatoires. Aucun mouvement d'argent.
 */
export function BMoneyRecordDialog({ invoice, kind, onDone }: { invoice: InvoiceView; kind: 'payment' | 'payout'; onDone: (view: InvoiceView) => void }) {
  const [file, setFile] = useState<File | null>(null);
  const payment = kind === 'payment';
  return (
    <BActionDialog<InvoiceView>
      actions={invoice.actions}
      action={payment ? 'recordPayment' : 'recordPayout'}
      label={payment ? 'Enregistrer un encaissement client' : 'Enregistrer un règlement freelance'}
      variant="success"
      submitLabel="Enregistrer"
      success={payment ? 'Encaissement enregistré' : 'Règlement enregistré'}
      description={
        <>
          <p>
            Suivi manuel : la plateforme n’effectue aucun mouvement d’argent. Reste dû : <strong>{formatMoney(invoice.outstandingAmount, invoice.currency)}</strong> (paiement partiel
            possible).
          </p>
        </>
      }
      onSubmit={(form) => {
        if (!file) throw new ApiError(400, 'Le justificatif est obligatoire.');
        return api.upload<InvoiceView>(`/invoices/${invoice.id}/${payment ? 'payments' : 'payouts'}`, file, {
          amount: formValue(form, 'amount'),
          date: formValue(form, 'date'),
          method: formValue(form, 'method'),
          reference: formValue(form, 'reference'),
          note: formValue(form, 'note'),
        });
      }}
      onDone={(view) => {
        setFile(null);
        onDone(view);
      }}
    >
      <FileInput label="Justificatif (avis de virement, copie de chèque…)" kind="PAYMENT_PROOF" required onChange={setFile} />
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={`Montant (${invoice.currency})`} required>{(p) => <Input {...p} name="amount" inputMode="decimal" />}</Field>
        <Field label={payment ? 'Date de réception' : 'Date du règlement'} required>{(p) => <Input {...p} type="date" name="date" max={todayIso()} />}</Field>
        <Field label="Méthode" required>
          {(p) => <Select {...p} name="method" defaultValue="" placeholder="— Choisir —" options={optionsFrom(PaymentMethod, labels.paymentMethod)} />}
        </Field>
        <Field label="Référence" required hint="Référence bancaire, numéro de chèque…">{(p) => <Input {...p} name="reference" maxLength={200} />}</Field>
      </div>
      <Field label="Note">{(p) => <Textarea {...p} name="note" rows={2} maxLength={2000} />}</Field>
    </BActionDialog>
  );
}

/** Liste des encaissements ou règlements d'une facture, avec annulation motivée. */
export function BMoneyRecordsTable({ records, kind, onDone }: { records: MoneyRecordView[]; kind: 'payment' | 'payout'; onDone: (view: InvoiceView) => void }) {
  return (
    <DataTable
      rows={records}
      rowKey={(r) => r.id}
      caption={kind === 'payment' ? 'Encaissements client' : 'Règlements freelance'}
      empty={{ title: kind === 'payment' ? 'Aucun encaissement enregistré' : 'Aucun règlement enregistré' }}
      columns={[
        { header: 'Date', cell: (r) => formatDate(r.date) },
        { header: 'Montant', cell: (r) => <span className={r.status === 'CANCELLED' ? 'line-through' : 'font-medium'}>{formatMoney(r.amount, r.currency)}</span> },
        { header: 'Méthode', cell: (r) => labels.paymentMethod[r.method] },
        { header: 'Référence', cell: (r) => r.reference },
        { header: 'Justificatif', cell: (r) => <BDocumentLinks id={r.proofDocumentId} /> },
        {
          header: 'Statut',
          cell: (r) => (
            <span className="flex flex-col gap-0.5">
              <StatusBadge status={r.status} label={labels.recordStatus[r.status]} />
              <span className="text-xs text-gray-500">Saisi le {formatDateTime(r.recordedAt)}</span>
              {r.note && <span className="text-xs text-gray-600">{r.note}</span>}
              {r.cancelReason && <span className="text-xs text-red-700">Annulé : {r.cancelReason}</span>}
            </span>
          ),
        },
        {
          header: 'Action',
          cell: (r) => (
            <ActionButton<InvoiceView>
              actions={r.actions}
              action="cancel"
              label="Annuler"
              size="sm"
              variant="danger"
              reason="required"
              reasonLabel="Motif de l’annulation"
              endpoint={`/${kind === 'payment' ? 'payments' : 'payouts'}/${r.id}/cancel`}
              confirm={{ title: kind === 'payment' ? 'Annuler l’encaissement' : 'Annuler le règlement', message: 'L’enregistrement est conservé, marqué « annulé », et le reste dû est recalculé.' }}
              success="Enregistrement annulé"
              onDone={onDone}
            />
          ),
        },
      ]}
    />
  );
}

/** Dépôt d'une facture client (PDF + montants déclarés) par E-MPGT. Les taxes ne sont pas calculées. */
export function BClientInvoiceForm({ onCreated, onCancel }: { onCreated: (view: InvoiceView) => void; onCancel: () => void }) {
  const action = useAction();
  const [file, setFile] = useState<File | null>(null);
  const [contractId, setContractId] = useState('');
  const [timesheetId, setTimesheetId] = useState('');
  const contracts = useApi<Page<ContractListItem>>('/contracts?pageSize=100');
  const contract = useApi<ContractView>(contractId ? `/contracts/${contractId}` : null);
  const timesheets = useApi<Page<TimesheetListItem>>(contractId ? `/timesheets${qs({ contractId, status: 'APPROVED', pageSize: 100 })}` : null);
  const timesheet = useApi<TimesheetView>(timesheetId ? `/timesheets/${timesheetId}` : null);
  const currentContract = contract.data?.id === contractId ? contract.data : undefined;
  const currentTimesheet = timesheet.data?.id === timesheetId ? timesheet.data : undefined;

  return (
    <form
      className="space-y-4"
      onSubmit={async (e) => {
        e.preventDefault();
        const form = new FormData(e.currentTarget);
        const v = (name: string) => formValue(form, name);
        const result = await action.run(
          () => {
            if (!file) throw new ApiError(400, 'Joignez la facture (PDF).');
            return api.upload<InvoiceView>('/invoices', file, {
              kind: 'CLIENT_INVOICE',
              contractId: v('contractId'),
              timesheetId: v('timesheetId'),
              number: v('number'),
              issuerLabel: v('issuerLabel'),
              issueDate: v('issueDate'),
              dueDate: v('dueDate'),
              currency: v('currency'),
              amountExclTax: v('amountExclTax'),
              taxAmount: v('taxAmount'),
              amountInclTax: v('amountInclTax'),
            });
          },
          { success: 'Facture client déposée' },
        );
        if (result) onCreated(result);
      }}
    >
      <Alert tone="info">La plateforme ne calcule pas les taxes : saisissez les montants tels qu’ils figurent sur la facture (TTC = HT + taxes, contrôlé par le serveur).</Alert>
      <div className="grid gap-4 md:grid-cols-2">
        <Field label="Contrat" required hint="La facturation est possible une fois la mission démarrée.">
          {(p) => (
            <Select
              {...p}
              name="contractId"
              value={contractId}
              onChange={(e) => {
                setContractId(e.target.value);
                setTimesheetId('');
              }}
              placeholder={contracts.loading ? 'Chargement…' : '— Choisir —'}
              options={(contracts.data?.items ?? []).map((c) => ({ value: c.id, label: `${c.reference} — ${c.missionTitle} (${c.companyName}) · ${labels.contractStatus[c.status]}` }))}
            />
          )}
        </Field>
        <Field label="CRA validé rattaché" hint="Permet le rapprochement avec le montant attendu.">
          {(p) => (
            <Select
              {...p}
              name="timesheetId"
              value={timesheetId}
              disabled={!contractId}
              onChange={(e) => setTimesheetId(e.target.value)}
              placeholder={timesheets.loading ? 'Chargement…' : '— Aucun —'}
              options={(timesheets.data?.items ?? []).map((t) => ({ value: t.id, label: `${formatMonth(t.periodStart)} — v${t.version} · ${t.totalHours} h` }))}
            />
          )}
        </Field>
      </div>
      {contracts.error && <FormError error={contracts.error} />}
      {contractId && contract.loading && <Spinner label="Chargement du contrat…" />}
      {currentTimesheet?.amounts && (
        <p className="rounded-md bg-gray-50 p-3 text-sm text-gray-700">
          Montant HT attendu d’après le CRA validé : <strong>{formatMoney(currentTimesheet.amounts.clientTotalExclTax, currentTimesheet.amounts.currency)}</strong>
        </p>
      )}
      <div className="grid gap-4 md:grid-cols-3">
        <Field label="Numéro de facture" required>{(p) => <Input {...p} name="number" maxLength={100} />}</Field>
        <Field label="Émetteur" required>{(p) => <Input {...p} name="issuerLabel" maxLength={200} />}</Field>
        <Field label="Devise" required hint={currentContract ? `Devise du contrat : ${currentContract.currency}` : undefined}>
          {(p) => (
            <Select
              key={currentContract?.id ?? 'none'}
              {...p}
              name="currency"
              defaultValue={currentContract?.currency ?? ''}
              placeholder="— Choisir —"
              options={CurrencyCode.map((c) => ({ value: c, label: c }))}
            />
          )}
        </Field>
        <Field label="Date d’émission" required>{(p) => <Input {...p} type="date" name="issueDate" />}</Field>
        <Field label="Échéance" required>{(p) => <Input {...p} type="date" name="dueDate" />}</Field>
        <div className="hidden md:block" />
        <Field label="Montant HT déclaré" required>{(p) => <Input {...p} name="amountExclTax" inputMode="decimal" />}</Field>
        <Field label="Taxes déclarées" required>{(p) => <Input {...p} name="taxAmount" inputMode="decimal" />}</Field>
        <Field label="Montant TTC déclaré" required>{(p) => <Input {...p} name="amountInclTax" inputMode="decimal" />}</Field>
      </div>
      <FileInput label="Facture (PDF)" kind="INVOICE" required onChange={setFile} />
      <FormError error={action.error} />
      <div className="flex flex-wrap gap-2">
        <Button type="submit" loading={action.pending}>
          Déposer la facture
        </Button>
        <Button variant="secondary" onClick={onCancel} disabled={action.pending}>
          Annuler
        </Button>
      </div>
    </form>
  );
}
