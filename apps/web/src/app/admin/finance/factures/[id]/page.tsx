'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { labels, type InvoiceView } from '@empgt/contracts';
import { formatDate, formatDateTime, formatMoney } from '@/lib/format';
import { useApi } from '@/lib/hooks';
import { ActionButton, PendingList } from '@/components/ui/actions';
import { Badge, StatusBadge } from '@/components/ui/badge';
import { Card, DefinitionList, StatTile } from '@/components/ui/card';
import { Alert, ResourceView } from '@/components/ui/feedback';
import { PageHeader } from '@/components/ui/page';
import { adminPending, BDocumentLinks, isNonZeroAmount } from '@/components/admin/b-common';
import { BMoneyRecordDialog, BMoneyRecordsTable } from '@/components/admin/b-finance';

export default function AdminInvoicePage() {
  const { id } = useParams<{ id: string }>();
  const invoice = useApi<InvoiceView>(`/invoices/${id}`);

  return (
    <ResourceView resource={invoice}>
      {(inv) => {
        const gap = isNonZeroAmount(inv.discrepancy);
        return (
          <>
            <PageHeader
              breadcrumbs={[{ label: 'Finance', href: '/admin/finance' }, { label: `Facture ${inv.number}` }]}
              title={`${labels.invoiceKind[inv.kind]} ${inv.number}`}
              badge={
                <span className="flex flex-wrap gap-1.5">
                  <StatusBadge status={inv.status} label={labels.invoiceStatus[inv.status]} />
                  <StatusBadge status={inv.paymentState} label={labels.paymentState[inv.paymentState]} />
                  {inv.overdue && <Badge tone="red">En retard</Badge>}
                </span>
              }
              description={
                <>
                  <Link href={`/admin/contrats/${inv.contractId}`} className="text-brand-700 underline">
                    {inv.contractReference}
                  </Link>{' '}
                  · {inv.missionTitle} · {inv.companyName} · {inv.freelancerName}
                </>
              }
              actions={
                <>
                  <ActionButton<InvoiceView>
                    actions={inv.actions}
                    action="verify"
                    label="Marquer comme contrôlée"
                    variant="success"
                    endpoint={`/invoices/${id}/verify`}
                    reason="optional"
                    reasonLabel="Note de contrôle"
                    confirm={{ title: 'Contrôler la facture', message: 'Vérifiez les montants déclarés et le rapprochement avec le CRA validé avant de confirmer.' }}
                    success="Facture contrôlée"
                    onDone={invoice.setData}
                  />
                  <ActionButton<InvoiceView>
                    actions={inv.actions}
                    action="reject"
                    label="Refuser"
                    variant="danger"
                    endpoint={`/invoices/${id}/reject`}
                    reason="required"
                    reasonLabel="Motif du refus"
                    success="Facture refusée"
                    onDone={invoice.setData}
                  />
                  <ActionButton<InvoiceView>
                    actions={inv.actions}
                    action="cancel"
                    label="Annuler la facture"
                    variant="danger"
                    endpoint={`/invoices/${id}/cancel`}
                    reason="required"
                    reasonLabel="Motif de l’annulation"
                    success="Facture annulée"
                    onDone={invoice.setData}
                  />
                </>
              }
            />

            <div className="space-y-6">
              <PendingList items={adminPending(inv.pending)} />
              {inv.statusReason && (
                <Alert tone="warning" title="Motif">
                  <p className="whitespace-pre-line">{inv.statusReason}</p>
                </Alert>
              )}
              <Alert tone="info">Suivi manuel : enregistrer un encaissement ou un règlement ne déclenche aucun mouvement d’argent ; un justificatif est exigé.</Alert>

              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <StatTile label="Montant TTC déclaré" value={formatMoney(inv.amountInclTax, inv.currency)} />
                <StatTile label="Déjà réglé" value={formatMoney(inv.paidAmount, inv.currency)} />
                <StatTile label="Reste dû" value={<span className={inv.overdue ? 'text-red-700' : ''}>{formatMoney(inv.outstandingAmount, inv.currency)}</span>} hint={`Échéance ${formatDate(inv.dueDate)}`} />
                <StatTile
                  label="Écart avec le montant attendu (HT)"
                  value={<span className={gap ? 'text-amber-800' : ''}>{inv.discrepancy ? formatMoney(inv.discrepancy, inv.currency) : '—'}</span>}
                  hint={inv.expectedAmountExclTax ? `Attendu : ${formatMoney(inv.expectedAmountExclTax, inv.currency)}` : 'Aucun CRA validé rattaché'}
                />
              </div>

              <div className="grid gap-6 lg:grid-cols-3">
                <Card title="Montants déclarés et rapprochement" className="lg:col-span-2">
                  <DefinitionList
                    columns={3}
                    items={[
                      ['Montant HT déclaré', formatMoney(inv.amountExclTax, inv.currency)],
                      ['Taxes déclarées', formatMoney(inv.taxAmount, inv.currency)],
                      ['Montant TTC déclaré', formatMoney(inv.amountInclTax, inv.currency)],
                      ['Montant HT attendu (CRA validé)', inv.expectedAmountExclTax ? formatMoney(inv.expectedAmountExclTax, inv.currency) : null],
                      [
                        'Écart déclaré − attendu (HT)',
                        inv.discrepancy ? (
                          <span key="g" className={gap ? 'font-semibold text-amber-800' : ''}>
                            {formatMoney(inv.discrepancy, inv.currency)}
                            {gap && ' — à justifier avant contrôle'}
                          </span>
                        ) : null,
                      ],
                      ['Devise', inv.currency],
                    ]}
                  />
                  <p className="mt-3 text-xs text-gray-500">Les taxes ne sont pas calculées par la plateforme : elles sont reprises de la facture déposée. Le rapprochement est indicatif.</p>
                </Card>
                <Card title="Facture">
                  <DefinitionList
                    columns={1}
                    items={[
                      ['Émetteur', inv.issuerLabel],
                      ['Adressée à', labels.invoiceAddressee[inv.addressee]],
                      ['Date d’émission', formatDate(inv.issueDate)],
                      ['Échéance', formatDate(inv.dueDate)],
                      [
                        'CRA rattaché',
                        inv.timesheetId ? (
                          <Link key="t" href={`/admin/cra/${inv.timesheetId}`} className="text-brand-700 underline">
                            {inv.timesheetPeriod ?? 'Voir le CRA'}
                          </Link>
                        ) : null,
                      ],
                      ['Document', <BDocumentLinks key="d" id={inv.documentId} />],
                      ['Déposée le', formatDateTime(inv.createdAt)],
                      ['Contrôlée le', formatDateTime(inv.verifiedAt)],
                    ]}
                  />
                </Card>
              </div>

              <Card title="Encaissements client" description="Sommes reçues de l’entreprise cliente (paiements partiels possibles)." actions={<BMoneyRecordDialog invoice={inv} kind="payment" onDone={invoice.setData} />}>
                <BMoneyRecordsTable records={inv.payments} kind="payment" onDone={invoice.setData} />
              </Card>
              <Card title="Règlements au freelance" description="Sommes versées par E-MPGT au freelance." actions={<BMoneyRecordDialog invoice={inv} kind="payout" onDone={invoice.setData} />}>
                <BMoneyRecordsTable records={inv.payouts} kind="payout" onDone={invoice.setData} />
              </Card>
            </div>
          </>
        );
      }}
    </ResourceView>
  );
}
