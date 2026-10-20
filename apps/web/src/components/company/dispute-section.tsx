'use client';

import { useState } from 'react';
import {
  DisputeSubject,
  labels,
  type DisputeView,
  type InvoiceListItem,
  type OpenDisputeInput,
  type Page,
  type TimesheetListItem,
} from '@empgt/contracts';
import { api, qs } from '@/lib/api';
import { formatDate, formatDateTime, formatMonth } from '@/lib/format';
import { useAction, useApi } from '@/lib/hooks';
import { StatusBadge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Dialog } from '@/components/ui/dialog';
import { Field, FormError, formValue, optionsFrom, Select, Textarea } from '@/components/ui/form';

const subjectOptions = optionsFrom(DisputeSubject, labels.disputeSubject);

/**
 * Litiges d'un contrat (ou d'un CRA / d'une facture précise) : liste et signalement à E-MPGT.
 * Avec `timesheetId` ou `invoiceId`, l'objet du litige est imposé.
 */
export function DisputeSection({
  contractId,
  timesheetId,
  invoiceId,
}: {
  contractId: string;
  timesheetId?: string;
  invoiceId?: string;
}) {
  const fixed: DisputeSubject | null = timesheetId ? 'TIMESHEET' : invoiceId ? 'INVOICE' : null;
  const disputes = useApi<DisputeView[]>('/disputes');
  const [open, setOpen] = useState(false);
  const [subject, setSubject] = useState<DisputeSubject>(fixed ?? 'CONTRACT');
  const [formKey, setFormKey] = useState(0);
  const action = useAction();
  const timesheets = useApi<Page<TimesheetListItem>>(
    open && !fixed && subject === 'TIMESHEET'
      ? `/timesheets${qs({ contractId, pageSize: 100 })}`
      : null,
  );
  const invoices = useApi<Page<InvoiceListItem>>(
    open && !fixed && subject === 'INVOICE'
      ? `/invoices${qs({ contractId, pageSize: 100 })}`
      : null,
  );

  const list = (disputes.data ?? []).filter(
    (d) =>
      d.contractId === contractId &&
      (!timesheetId || d.timesheetId === timesheetId) &&
      (!invoiceId || d.invoiceId === invoiceId),
  );
  const close = () => {
    setOpen(false);
    action.clearError();
  };

  return (
    <Card
      title="Litiges"
      description="En cas de désaccord, signalez-le : E-MPGT est notifié et instruit le litige avec les parties."
      actions={
        <Button size="sm" variant="secondary" onClick={() => setOpen(true)}>
          Signaler un litige
        </Button>
      }
    >
      {disputes.error && !disputes.data ? (
        <p className="text-sm text-red-700">
          Impossible de charger les litiges : {disputes.error.message}
        </p>
      ) : list.length === 0 ? (
        <p className="text-sm text-gray-600">
          {disputes.loading ? 'Chargement…' : 'Aucun litige signalé.'}
        </p>
      ) : (
        <ul className="divide-y divide-gray-100">
          {list.map((d) => (
            <li key={d.id} className="space-y-1 py-3 text-sm">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-medium text-gray-900">
                  {labels.disputeSubject[d.subjectType]}
                </span>
                <StatusBadge status={d.status} label={labels.disputeStatus[d.status]} />
                <span className="text-xs text-gray-500">
                  Signalé le {formatDateTime(d.createdAt)} par {d.openedByName || '—'}
                </span>
              </div>
              <p className="whitespace-pre-line text-gray-800">{d.reason}</p>
              {d.resolution && (
                <p className="rounded-md bg-gray-50 p-2 text-gray-700">
                  <span className="font-medium">
                    Traitement E-MPGT{d.resolvedAt ? ` (${formatDate(d.resolvedAt)})` : ''} :{' '}
                  </span>
                  {d.resolution}
                </p>
              )}
            </li>
          ))}
        </ul>
      )}

      <Dialog open={open} onClose={close} title="Signaler un litige">
        <form
          key={formKey}
          className="space-y-4"
          onSubmit={async (e) => {
            e.preventDefault();
            const form = new FormData(e.currentTarget);
            const body: OpenDisputeInput = {
              subjectType: subject,
              contractId,
              timesheetId:
                subject === 'TIMESHEET' ? (timesheetId ?? formValue(form, 'timesheetId')) : null,
              invoiceId: subject === 'INVOICE' ? (invoiceId ?? formValue(form, 'invoiceId')) : null,
              reason: String(form.get('reason') ?? '').trim(),
            };
            const created = await action.run(() => api.post<DisputeView>('/disputes', body), {
              success: 'Litige transmis à E-MPGT',
            });
            if (created) {
              setOpen(false);
              setFormKey((k) => k + 1);
              await disputes.reload();
            }
          }}
        >
          {fixed ? (
            <p className="text-sm text-gray-700">
              Objet : <span className="font-medium">{labels.disputeSubject[fixed]}</span>
            </p>
          ) : (
            <Field label="Objet du litige" required>
              {(p) => (
                <Select
                  {...p}
                  value={subject}
                  options={subjectOptions}
                  onChange={(e) => setSubject(e.target.value as DisputeSubject)}
                />
              )}
            </Field>
          )}
          {!fixed && subject === 'TIMESHEET' && (
            <Field
              label="CRA concerné"
              required
              hint={timesheets.loading ? 'Chargement des CRA…' : undefined}
            >
              {(p) => (
                <Select
                  {...p}
                  name="timesheetId"
                  placeholder="Choisir un CRA"
                  options={(timesheets.data?.items ?? []).map((t) => ({
                    value: t.id,
                    label: `${formatMonth(t.periodStart)} — version ${t.version} (${labels.timesheetStatus[t.status]})`,
                  }))}
                />
              )}
            </Field>
          )}
          {!fixed && subject === 'INVOICE' && (
            <Field
              label="Facture concernée"
              required
              hint={invoices.loading ? 'Chargement des factures…' : undefined}
            >
              {(p) => (
                <Select
                  {...p}
                  name="invoiceId"
                  placeholder="Choisir une facture"
                  options={(invoices.data?.items ?? []).map((i) => ({
                    value: i.id,
                    label: `${i.number} — échéance ${formatDate(i.dueDate)}`,
                  }))}
                />
              )}
            </Field>
          )}
          <Field
            label="Motif"
            required
            hint="3 caractères minimum. Décrivez précisément le désaccord ; le motif est conservé dans l’historique."
          >
            {(p) => <Textarea {...p} name="reason" minLength={3} maxLength={2000} />}
          </Field>
          <FormError error={action.error} />
          <div className="flex justify-end gap-2 border-t border-gray-100 pt-3">
            <Button variant="secondary" onClick={close} disabled={action.pending}>
              Annuler
            </Button>
            <Button type="submit" variant="danger" loading={action.pending}>
              Signaler le litige
            </Button>
          </div>
        </form>
      </Dialog>
    </Card>
  );
}
