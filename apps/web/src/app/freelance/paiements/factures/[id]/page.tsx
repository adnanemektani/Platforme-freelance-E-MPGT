'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { labels, type InvoiceView, type MoneyRecordView } from '@empgt/contracts';
import { documentUrl } from '@/lib/api';
import { formatDate, formatDateTime, formatMoney } from '@/lib/format';
import { useApi } from '@/lib/hooks';
import { PendingList } from '@/components/ui/actions';
import { Badge, StatusBadge } from '@/components/ui/badge';
import { Card, DefinitionList } from '@/components/ui/card';
import { Alert, ResourceView } from '@/components/ui/feedback';
import { PageHeader } from '@/components/ui/page';
import { DataTable, type Column } from '@/components/ui/table';
import { DisputeButton } from '@/components/freelancer/dispute';

const recordColumns: Column<MoneyRecordView>[] = [
  { header: 'Date', cell: (p) => formatDate(p.date) },
  { header: 'Montant', cell: (p) => <span className={p.status === 'CANCELLED' ? 'line-through' : ''}>{formatMoney(p.amount, p.currency)}</span> },
  { header: 'Mode', cell: (p) => labels.paymentMethod[p.method] },
  { header: 'Référence', cell: (p) => p.reference },
  {
    header: 'État',
    cell: (p) => (
      <span>
        <StatusBadge status={p.status} label={labels.recordStatus[p.status]} />
        {p.cancelReason && <span className="block text-xs text-gray-600">Annulé : {p.cancelReason}</span>}
      </span>
    ),
  },
  { header: 'Enregistré le', cell: (p) => formatDateTime(p.recordedAt) },
  {
    header: 'Justificatif',
    cell: (p) => (
      <a href={documentUrl(p.proofDocumentId)} className="text-brand-700 underline">
        Télécharger<span className="sr-only"> le justificatif {p.reference}</span>
      </a>
    ),
  },
];

function InvoiceDetail({ invoice: i }: { invoice: InvoiceView }) {
  return (
    <>
      <PageHeader
        title={`Facture ${i.number}`}
        description={`${labels.invoiceKind[i.kind]} · ${i.contractReference} · ${i.missionTitle}`}
        breadcrumbs={[{ label: 'Factures et paiements', href: '/freelance/paiements' }, { label: i.number }]}
        badge={
          <>
            <StatusBadge status={i.status} label={labels.invoiceStatus[i.status]} />
            <StatusBadge status={i.paymentState} label={labels.paymentState[i.paymentState]} />
            {i.overdue && <Badge tone="red">Échéance dépassée</Badge>}
          </>
        }
        actions={
          <a href={documentUrl(i.documentId)} className="rounded-md bg-brand-700 px-4 py-2 text-sm font-medium text-white hover:bg-brand-800">
            Télécharger la facture
          </a>
        }
      />
      <div className="space-y-6">
        <PendingList items={i.pending} />
        {i.statusReason && (
          <Alert tone={i.status === 'REJECTED' || i.status === 'CANCELLED' ? 'warning' : 'info'} title="Motif communiqué par E-MPGT">
            {i.statusReason}
          </Alert>
        )}
        <Alert tone="info">
          Aucune promesse de paiement : un règlement n’apparaît qu’une fois enregistré par E-MPGT avec sa référence et son justificatif. La plateforme ne déclenche
          aucun virement.
        </Alert>

        <div className="grid gap-6 lg:grid-cols-3">
          <Card title="Montants" className="lg:col-span-2">
            <DefinitionList
              items={[
                ['Montant HT déclaré', formatMoney(i.amountExclTax, i.currency)],
                ['Taxes déclarées', formatMoney(i.taxAmount, i.currency)],
                ['Montant TTC', <strong key="ttc">{formatMoney(i.amountInclTax, i.currency)}</strong>],
                ['Montant HT attendu (CRA validé)', i.expectedAmountExclTax ? formatMoney(i.expectedAmountExclTax, i.currency) : null],
                ['Écart déclaré − attendu (HT)', i.discrepancy ? formatMoney(i.discrepancy, i.currency) : null],
                ['Déjà réglé', formatMoney(i.paidAmount, i.currency)],
                ['Restant à régler', formatMoney(i.outstandingAmount, i.currency)],
                ['Contrôlée par E-MPGT le', formatDateTime(i.verifiedAt)],
              ]}
            />
          </Card>
          <Card title="Informations">
            <DefinitionList
              columns={1}
              items={[
                ['Émetteur', i.issuerLabel],
                ['Destinataire', labels.invoiceAddressee[i.addressee]],
                ['Émise le', formatDate(i.issueDate)],
                ['Échéance', formatDate(i.dueDate)],
                ['Contrat', <Link key="c" href={`/freelance/contrats/${i.contractId}`} className="text-brand-700 underline">{i.contractReference}</Link>],
                [
                  'CRA rattaché',
                  i.timesheetId ? (
                    <Link key="t" href={`/freelance/cra/${i.timesheetId}`} className="capitalize text-brand-700 underline">
                      {i.timesheetPeriod ?? 'Voir le CRA'}
                    </Link>
                  ) : (
                    'Aucun'
                  ),
                ],
                ['Déposée le', formatDateTime(i.createdAt)],
              ]}
            />
          </Card>
        </div>

        <Card title="Règlements enregistrés">
          <DataTable
            rows={i.payouts}
            columns={recordColumns}
            rowKey={(p) => p.id}
            caption="Règlements de cette facture"
            empty={{ title: 'Aucun règlement enregistré', description: 'E-MPGT enregistre chaque règlement avec sa référence et son justificatif.' }}
          />
        </Card>

        <div className="flex flex-wrap items-center gap-3 text-sm text-gray-700">
          <span>Un désaccord sur cette facture ?</span>
          <DisputeButton contractId={i.contractId} subjectType="INVOICE" invoiceId={i.id} label="Signaler un désaccord à E-MPGT" />
        </div>
      </div>
    </>
  );
}

export default function FreelanceInvoicePage() {
  const { id } = useParams<{ id: string }>();
  const invoice = useApi<InvoiceView>(`/invoices/${id}`);
  return <ResourceView resource={invoice}>{(i) => <InvoiceDetail invoice={i} />}</ResourceView>;
}
