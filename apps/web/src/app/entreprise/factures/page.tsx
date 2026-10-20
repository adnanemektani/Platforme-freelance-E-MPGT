'use client';

import Link from 'next/link';
import {
  labels,
  type CompanyBillingOverview,
  type InvoiceListItem,
  type MoneyRecordView,
} from '@empgt/contracts';
import { formatDate, formatMoney } from '@/lib/format';
import { useApi } from '@/lib/hooks';
import { Badge, StatusBadge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Alert, ResourceView } from '@/components/ui/feedback';
import { PageHeader } from '@/components/ui/page';
import { DataTable, type Column } from '@/components/ui/table';
import { breadcrumbRoot } from '@/components/company/display';
import { DownloadLinks } from '@/components/company/documents';

type Totals = CompanyBillingOverview['totals'][number];

const totalsColumns: Column<Totals>[] = [
  { header: 'Devise', cell: (t) => <span className="font-medium">{t.currency}</span> },
  { header: 'Facturé (TTC)', cell: (t) => formatMoney(t.invoiced, t.currency) },
  { header: 'Réglé', cell: (t) => formatMoney(t.paid, t.currency) },
  { header: 'Reste dû', cell: (t) => <strong>{formatMoney(t.outstanding, t.currency)}</strong> },
  {
    header: 'Dont en retard',
    cell: (t) => <span className="text-red-700">{formatMoney(t.overdue, t.currency)}</span>,
  },
];

const invoiceColumns: Column<InvoiceListItem>[] = [
  {
    header: 'Facture',
    cell: (i) => (
      <span className="inline-flex flex-col items-end md:items-start">
        <Link
          href={`/entreprise/factures/${i.id}`}
          className="font-medium text-brand-700 hover:underline"
        >
          {i.number}
        </Link>
        <span className="text-xs text-gray-500">{labels.invoiceKind[i.kind]}</span>
      </span>
    ),
  },
  {
    header: 'Contrat',
    cell: (i) => (
      <span className="inline-flex flex-col items-end md:items-start">
        <span>{i.contractReference}</span>
        <span className="text-xs text-gray-500">{i.freelancerName}</span>
      </span>
    ),
  },
  { header: 'Émise le', cell: (i) => formatDate(i.issueDate) },
  {
    header: 'Échéance',
    cell: (i) => (
      <span className="inline-flex flex-col items-end gap-0.5 md:items-start">
        <span>{formatDate(i.dueDate)}</span>
        {i.overdue && <Badge tone="red">En retard</Badge>}
      </span>
    ),
  },
  { header: 'Montant TTC', cell: (i) => formatMoney(i.amountInclTax, i.currency) },
  { header: 'Réglé', cell: (i) => formatMoney(i.paidAmount, i.currency) },
  {
    header: 'Paiement',
    cell: (i) => (
      <StatusBadge status={i.paymentState} label={labels.paymentState[i.paymentState]} />
    ),
  },
  {
    header: 'Contrôle',
    cell: (i) => <StatusBadge status={i.status} label={labels.invoiceStatus[i.status]} />,
  },
];

const paymentColumns: Column<MoneyRecordView>[] = [
  {
    header: 'Facture',
    cell: (p) => (
      <Link
        href={`/entreprise/factures/${p.invoiceId}`}
        className="font-medium text-brand-700 hover:underline"
      >
        {p.invoiceNumber}
      </Link>
    ),
  },
  { header: 'Date', cell: (p) => formatDate(p.date) },
  { header: 'Montant', cell: (p) => formatMoney(p.amount, p.currency) },
  { header: 'Mode', cell: (p) => labels.paymentMethod[p.method] },
  { header: 'Référence', cell: (p) => <span className="break-all">{p.reference}</span> },
  {
    header: 'État',
    cell: (p) => <StatusBadge status={p.status} label={labels.recordStatus[p.status]} />,
  },
  { header: 'Justificatif', cell: (p) => <DownloadLinks documentId={p.proofDocumentId} /> },
];

export default function FacturesPage() {
  const billing = useApi<CompanyBillingOverview>('/company/billing');
  return (
    <>
      <PageHeader
        title="Factures et règlements"
        description="Factures adressées à votre entreprise et règlements enregistrés par E-MPGT."
        breadcrumbs={[breadcrumbRoot, { label: 'Factures et règlements' }]}
      />
      <ResourceView resource={billing} loadingLabel="Chargement des factures…">
        {(b) => (
          <div className="space-y-6">
            <Alert tone="warning" title="Suivi manuel">
              {b.disclaimer}
            </Alert>
            <Card
              title="Synthèse par devise"
              description="Factures déposées ou contrôlées (hors factures refusées ou annulées)."
            >
              <DataTable
                rows={b.totals}
                columns={totalsColumns}
                rowKey={(t) => t.currency}
                caption="Totaux par devise"
                empty={{ title: 'Aucune facture pour le moment' }}
              />
            </Card>
            <Card title="Factures">
              <DataTable
                rows={b.invoices}
                columns={invoiceColumns}
                rowKey={(i) => i.id}
                caption="Factures adressées à votre entreprise"
                empty={{
                  title: 'Aucune facture',
                  description:
                    'Les factures apparaissent ici une fois déposées par E-MPGT (ou par le freelance lorsqu’il vous facture directement).',
                }}
              />
            </Card>
            <Card
              title="Règlements enregistrés"
              description="Encaissements de vos règlements, enregistrés par E-MPGT avec leur référence et leur justificatif."
            >
              <DataTable
                rows={b.payments}
                columns={paymentColumns}
                rowKey={(p) => p.id}
                caption="Règlements enregistrés"
                empty={{ title: 'Aucun règlement enregistré' }}
              />
            </Card>
          </div>
        )}
      </ResourceView>
    </>
  );
}
