'use client';

import { useId, useState } from 'react';
import { labels, type DisputeSubject, type DisputeView } from '@empgt/contracts';
import { api } from '@/lib/api';
import { formatDateTime } from '@/lib/format';
import { useAction } from '@/lib/hooks';
import { StatusBadge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { EmptyState } from '@/components/ui/feedback';
import { Field, FormError, Select, Textarea } from '@/components/ui/form';

/**
 * Signalement d'un désaccord (litige) à E-MPGT sur un contrat, un CRA ou une facture.
 * Le droit d'ouvrir un litige et la cohérence de la cible sont vérifiés par le serveur.
 */
export function DisputeButton({
  contractId,
  subjectType,
  timesheetId,
  invoiceId,
  timesheets,
  invoices,
  label = 'Signaler un désaccord',
  onOpened,
}: {
  contractId: string;
  /** Sujet imposé ; sinon le freelance choisit parmi contrat / CRA / facture. */
  subjectType?: DisputeSubject;
  timesheetId?: string;
  invoiceId?: string;
  timesheets?: Array<{ id: string; label: string }>;
  invoices?: Array<{ id: string; label: string }>;
  label?: string;
  onOpened?: (dispute: DisputeView) => void;
}) {
  const [open, setOpen] = useState(false);
  const [subject, setSubject] = useState<DisputeSubject>(subjectType ?? 'CONTRACT');
  const [formKey, setFormKey] = useState(0);
  const formId = useId();
  const action = useAction();

  const subjects: DisputeSubject[] = subjectType ? [subjectType] : ['CONTRACT', ...(timesheets?.length ? (['TIMESHEET'] as const) : []), ...(invoices?.length ? (['INVOICE'] as const) : [])];

  return (
    <>
      <Button variant="secondary" size="sm" onClick={() => setOpen(true)}>
        {label}
      </Button>
      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title="Signaler un désaccord à E-MPGT"
        footer={
          <>
            <Button variant="secondary" onClick={() => setOpen(false)} disabled={action.pending}>
              Annuler
            </Button>
            <Button type="submit" form={formId} variant="danger" loading={action.pending}>
              Ouvrir le litige
            </Button>
          </>
        }
      >
        <form
          key={formKey}
          id={formId}
          className="space-y-4"
          onSubmit={async (e) => {
            e.preventDefault();
            const form = new FormData(e.currentTarget);
            const dispute = await action.run(
              () =>
                api.post<DisputeView>('/disputes', {
                  subjectType: subject,
                  contractId,
                  timesheetId: subject === 'TIMESHEET' ? (timesheetId ?? form.get('timesheetId')) : null,
                  invoiceId: subject === 'INVOICE' ? (invoiceId ?? form.get('invoiceId')) : null,
                  reason: form.get('reason'),
                }),
              { success: 'Litige ouvert : E-MPGT a été prévenu' },
            );
            if (dispute) {
              setOpen(false);
              setFormKey((k) => k + 1);
              onOpened?.(dispute);
            }
          }}
        >
          <p className="text-sm text-gray-700">
            E-MPGT examine le désaccord avec les parties et consigne sa résolution. Décrivez précisément le problème (dates, montants, échanges).
          </p>
          {subjects.length > 1 && (
            <Field label="Objet du désaccord" required>
              {(p) => (
                <Select
                  {...p}
                  value={subject}
                  onChange={(e) => setSubject(e.target.value as DisputeSubject)}
                  options={subjects.map((s) => ({ value: s, label: labels.disputeSubject[s] }))}
                />
              )}
            </Field>
          )}
          {subject === 'TIMESHEET' && !timesheetId && timesheets && (
            <Field label="CRA concerné" required>
              {(p) => <Select {...p} name="timesheetId" required options={timesheets.map((t) => ({ value: t.id, label: t.label }))} />}
            </Field>
          )}
          {subject === 'INVOICE' && !invoiceId && invoices && (
            <Field label="Facture concernée" required>
              {(p) => <Select {...p} name="invoiceId" required options={invoices.map((i) => ({ value: i.id, label: i.label }))} />}
            </Field>
          )}
          <Field label="Description du désaccord" required hint="3 caractères minimum ; conservé dans l’historique.">
            {(p) => <Textarea {...p} name="reason" required minLength={3} maxLength={2000} />}
          </Field>
          <FormError error={action.error} />
        </form>
      </Dialog>
    </>
  );
}

/** Litiges ouverts sur un contrat (ou l'un de ses CRA / factures). */
export function DisputeList({ disputes }: { disputes: DisputeView[] }) {
  if (disputes.length === 0) return <EmptyState title="Aucun litige" description="Aucun désaccord n’a été signalé." />;
  return (
    <ul className="divide-y divide-gray-100">
      {disputes.map((d) => (
        <li key={d.id} className="space-y-1 py-3 text-sm">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-medium text-gray-900">{labels.disputeSubject[d.subjectType]}</span>
            <StatusBadge status={d.status === 'OPEN' ? 'OPEN_DISPUTE' : d.status} label={labels.disputeStatus[d.status]} />
            <span className="text-xs text-gray-500">
              Ouvert le {formatDateTime(d.createdAt)} par {d.openedByName}
            </span>
          </div>
          <p className="whitespace-pre-line text-gray-700">{d.reason}</p>
          {d.resolution && (
            <p className="rounded-md bg-gray-50 p-2 text-gray-800">
              <span className="font-medium">Résolution E-MPGT{d.resolvedAt ? ` (${formatDateTime(d.resolvedAt)})` : ''} :</span> {d.resolution}
            </p>
          )}
        </li>
      ))}
    </ul>
  );
}
