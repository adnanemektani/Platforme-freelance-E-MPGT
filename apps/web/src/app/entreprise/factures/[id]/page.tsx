'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import type { ReactNode } from 'react';
import { labels, type InvoiceView, type MoneyRecordView } from '@empgt/contracts';
import { formatDate, formatDateTime, formatMoney } from '@/lib/format';
import { useApi } from '@/lib/hooks';
import { PendingList } from '@/components/ui/actions';
import { Badge, StatusBadge } from '@/components/ui/badge';
import { Card, DefinitionList } from '@/components/ui/card';
import { Alert, ResourceView } from '@/components/ui/feedback';
import { PageHeader } from '@/components/ui/page';
import { DataTable, type Column } from '@/components/ui/table';
import { breadcrumbRoot } from '@/components/company/display';
import { DisputeSection } from '@/components/company/dispute-section';
import { DownloadLinks } from '@/components/company/documents';

const paymentColumns: Column<MoneyRecordView>[] = [
  { header: 'Date', cell: (p) => formatDate(p.date) },
  { header: 'Montant', cell: (p) => <strong>{formatMoney(p.amount, p.currency)}</strong> },
  { header: 'Mode', cell: (p) => labels.paymentMethod[p.method] },
  { header: 'Référence', cell: (p) => <span className="break-all">{p.reference}</span> },
  {
    header: 'État',
    cell: (p) => (
      <span className="inline-flex flex-col items-end gap-0.5 md:items-start">
        <StatusBadge status={p.status} label={labels.recordStatus[p.status]} />
        {p.cancelReason && <span className="text-xs text-gray-600">{p.cancelReason}</span>}
      </span>
    ),
  },
  { header: 'Enregistré le', cell: (p) => formatDateTime(p.recordedAt) },
  { header: 'Justificatif', cell: (p) => <DownloadLinks documentId={p.proofDocumentId} /> },
];

export default function FacturePage() {
  const { id } = useParams<{ id: string }>();
  const invoice = useApi<InvoiceView>(`/invoices/${id}`);

  return (
    <ResourceView resource={invoice} loadingLabel="Chargement de la facture…">
      {(i) => {
        const money = (value: string | null) => formatMoney(value, i.currency);
        const details: Array<[string, ReactNode]> = [
          ['Type', labels.invoiceKind[i.kind]],
          ['Émetteur', i.issuerLabel],
          ['Destinataire', labels.invoiceAddressee[i.addressee]],
          [
            'Contrat',
            <Link
              key="contrat"
              href={`/entreprise/contrats/${i.contractId}`}
              className="text-brand-700 underline"
            >
              {i.contractReference}
            </Link>,
          ],
          ['Mission', i.missionTitle],
          ['Freelance', i.freelancerName],
          [
            'CRA rattaché',
            i.timesheetId ? (
              <Link
                key="cra"
                href={`/entreprise/cra/${i.timesheetId}`}
                className="text-brand-700 underline"
              >
                {i.timesheetPeriod ?? 'Voir le CRA'}
              </Link>
            ) : null,
          ],
          ['Émise le', formatDate(i.issueDate)],
          ['Échéance', formatDate(i.dueDate)],
          ['Contrôlée par E-MPGT le', i.verifiedAt ? formatDateTime(i.verifiedAt) : null],
        ];
        const amounts: Array<[string, ReactNode]> = [
          ['Montant HT déclaré', money(i.amountExclTax)],
          ['TVA déclarée', money(i.taxAmount)],
          ['Montant TTC déclaré', <strong key="ttc">{money(i.amountInclTax)}</strong>],
          ['Déjà réglé', money(i.paidAmount)],
          [
            'Reste dû',
            <strong key="reste" className={i.overdue ? 'text-red-700' : undefined}>
              {money(i.outstandingAmount)}
            </strong>,
          ],
        ];
        if (i.expectedAmountExclTax)
          amounts.push([
            'Montant HT attendu d’après le CRA validé',
            money(i.expectedAmountExclTax),
          ]);
        if (i.discrepancy) amounts.push(['Écart avec le CRA (HT)', money(i.discrepancy)]);

        return (
          <>
            <PageHeader
              title={`Facture ${i.number}`}
              description={`${i.issuerLabel} · ${i.contractReference} · ${i.missionTitle}`}
              breadcrumbs={[
                breadcrumbRoot,
                { label: 'Factures et règlements', href: '/entreprise/factures' },
                { label: i.number },
              ]}
              badge={
                <span className="flex flex-wrap gap-2">
                  <StatusBadge status={i.status} label={labels.invoiceStatus[i.status]} />
                  <StatusBadge
                    status={i.paymentState}
                    label={labels.paymentState[i.paymentState]}
                  />
                  {i.overdue && <Badge tone="red">En retard</Badge>}
                </span>
              }
            />
            <div className="space-y-6">
              <Alert tone="info">
                Suivi manuel : la plateforme n’effectue aucun paiement. Les montants sont ceux
                déclarés sur la facture ; les règlements sont enregistrés par E-MPGT avec leur
                justificatif.
              </Alert>
              <PendingList items={i.pending} />
              {i.statusReason && (
                <Alert tone="warning" title="Motif">
                  <p className="whitespace-pre-line">{i.statusReason}</p>
                </Alert>
              )}
              <div className="grid gap-6 lg:grid-cols-2">
                <Card title="Facture">
                  <div className="space-y-4">
                    <DefinitionList items={details} />
                    <DownloadLinks documentId={i.documentId} label="Télécharger la facture" />
                  </div>
                </Card>
                <Card
                  title="Montants"
                  description={`En ${i.currency}. La plateforme ne calcule pas les taxes : montants déclarés par l’émetteur.`}
                >
                  <DefinitionList items={amounts} columns={1} />
                </Card>
              </div>
              <Card title="Règlements enregistrés">
                <DataTable
                  rows={i.payments}
                  columns={paymentColumns}
                  rowKey={(p) => p.id}
                  caption="Règlements de la facture"
                  empty={{ title: 'Aucun règlement enregistré pour cette facture' }}
                />
              </Card>
              <DisputeSection contractId={i.contractId} invoiceId={i.id} />
            </div>
          </>
        );
      }}
    </ResourceView>
  );
}
