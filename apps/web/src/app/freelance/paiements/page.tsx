'use client';

import Link from 'next/link';
import { useState } from 'react';
import {
  labels,
  type ContractListItem,
  type FreelancerPaymentsOverview,
  type InvoiceListItem,
  type MoneyRecordView,
  type Page,
} from '@empgt/contracts';
import { documentUrl } from '@/lib/api';
import { formatDate, formatDateTime, formatMoney, formatMonth, formatNumber } from '@/lib/format';
import { useApi } from '@/lib/hooks';
import { Badge, StatusBadge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, DefinitionList } from '@/components/ui/card';
import { Alert, ResourceView } from '@/components/ui/feedback';
import { PageHeader } from '@/components/ui/page';
import { DataTable, type Column } from '@/components/ui/table';
import { InvoiceDepositForm } from '@/components/freelancer/invoice-deposit';

type Approved = FreelancerPaymentsOverview['approvedAmounts'][number];
type Totals = FreelancerPaymentsOverview['totals'][number];

const totalColumns: Column<Totals>[] = [
  { header: 'Devise', cell: (t) => <span className="font-medium">{t.currency}</span> },
  { header: 'Net approuvé (CRA validés, HT)', cell: (t) => formatMoney(t.approvedNet, t.currency) },
  { header: 'Facturé (TTC)', cell: (t) => formatMoney(t.invoiced, t.currency) },
  { header: 'Réglé', cell: (t) => formatMoney(t.paid, t.currency) },
  { header: 'Restant à régler', cell: (t) => <strong>{formatMoney(t.outstanding, t.currency)}</strong> },
];

const invoiceColumns: Column<InvoiceListItem>[] = [
  {
    header: 'Facture',
    cell: (i) => (
      <Link href={`/freelance/paiements/factures/${i.id}`} className="font-medium text-brand-800 underline">
        {i.number}
      </Link>
    ),
  },
  { header: 'Contrat', cell: (i) => i.contractReference },
  { header: 'Émise le', cell: (i) => formatDate(i.issueDate) },
  {
    header: 'Échéance',
    cell: (i) => (
      <span>
        {formatDate(i.dueDate)} {i.overdue && <Badge tone="red">En retard</Badge>}
      </span>
    ),
  },
  { header: 'Montant TTC', cell: (i) => formatMoney(i.amountInclTax, i.currency) },
  { header: 'Réglé', cell: (i) => formatMoney(i.paidAmount, i.currency) },
  { header: 'Contrôle', cell: (i) => <StatusBadge status={i.status} label={labels.invoiceStatus[i.status]} /> },
  { header: 'Règlement', cell: (i) => <StatusBadge status={i.paymentState} label={labels.paymentState[i.paymentState]} /> },
];

const payoutColumns: Column<MoneyRecordView>[] = [
  { header: 'Date', cell: (p) => formatDate(p.date) },
  { header: 'Facture', cell: (p) => <Link href={`/freelance/paiements/factures/${p.invoiceId}`} className="text-brand-800 underline">{p.invoiceNumber}</Link> },
  { header: 'Montant', cell: (p) => <span className={p.status === 'CANCELLED' ? 'line-through' : ''}>{formatMoney(p.amount, p.currency)}</span> },
  { header: 'Mode', cell: (p) => labels.paymentMethod[p.method] },
  { header: 'Référence', cell: (p) => p.reference },
  {
    header: 'État',
    cell: (p) => (
      <span>
        <StatusBadge status={p.status} label={labels.recordStatus[p.status]} />
        {p.cancelReason && <span className="block text-xs text-gray-600">{p.cancelReason}</span>}
      </span>
    ),
  },
  {
    header: 'Justificatif',
    cell: (p) => (
      <a href={documentUrl(p.proofDocumentId)} className="text-brand-700 underline">
        Télécharger<span className="sr-only"> le justificatif du règlement {p.reference}</span>
      </a>
    ),
  },
];

function PaymentsContent({ overview: o }: { overview: FreelancerPaymentsOverview }) {
  const contracts = useApi<Page<ContractListItem>>('/contracts?pageSize=100');
  const [prefill, setPrefill] = useState<string | null>(null);

  const approvedColumns: Column<Approved>[] = [
    {
      header: 'Période',
      cell: (a) => (
        <Link href={`/freelance/cra/${a.timesheetId}`} className="font-medium capitalize text-brand-800 underline">
          {formatMonth(a.periodStart)}
        </Link>
      ),
    },
    { header: 'Contrat', cell: (a) => a.contractReference },
    { header: 'Heures validées', cell: (a) => `${formatNumber(a.hours)} h` },
    { header: 'Net freelance (HT)', cell: (a) => formatMoney(a.freelanceNetExclTax, a.currency || null) },
    { header: 'Facturé', cell: (a) => (a.invoiced ? <Badge tone="green">Facturé</Badge> : <Badge tone="amber">À facturer</Badge>) },
    {
      header: 'Action',
      cell: (a) =>
        a.invoiced ? null : (
          <Button
            size="sm"
            variant="secondary"
            onClick={() => {
              setPrefill(a.timesheetId);
              document.getElementById('deposer-facture')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }}
          >
            Déposer la facture
          </Button>
        ),
    },
  ];

  return (
    <div className="space-y-6">
      <Alert tone="warning" title="Suivi manuel — aucune promesse de paiement">
        <p>{o.disclaimer}</p>
      </Alert>

      <Card
        title="Modalités de règlement"
        actions={
          <>
            <Badge tone="purple">Mode {o.mode === 'MANUAL' ? 'manuel' : o.mode}</Badge>
            <StatusBadge status={o.configuration.status} label={labels.paymentConfigStatus[o.configuration.status]} />
          </>
        }
      >
        <div className="space-y-3">
          <p className="text-sm text-gray-800">{o.configuration.explanation}</p>
          <DefinitionList
            columns={3}
            items={[
              ['Méthode prévue', labels.payoutMethod[o.configuration.method]],
              ['État de la configuration', labels.paymentConfigStatus[o.configuration.status]],
              ['Confirmée le', formatDateTime(o.configuration.confirmedAt)],
              ['Prestataire', o.configuration.provider],
              ['Note d’E-MPGT', o.configuration.note],
            ]}
          />
          <p className="text-xs text-gray-600">Aucune coordonnée bancaire n’est collectée sur la plateforme : E-MPGT vous contacte directement si nécessaire.</p>
        </div>
      </Card>

      <Card title="Totaux par devise" description="Calculés par E-MPGT à partir des CRA validés, des factures déposées et des règlements enregistrés.">
        <DataTable rows={o.totals} columns={totalColumns} rowKey={(t) => t.currency} caption="Totaux par devise" empty={{ title: 'Aucun montant pour le moment' }} />
      </Card>

      <Card title="Montants approuvés" description="CRA validés par l’entreprise : base de votre facturation. Un CRA validé ne vaut pas paiement.">
        <DataTable
          rows={o.approvedAmounts}
          columns={approvedColumns}
          rowKey={(a) => a.timesheetId}
          caption="Montants approuvés"
          empty={{ title: 'Aucun CRA validé', description: 'Les montants apparaissent ici après validation de vos CRA.' }}
        />
      </Card>

      <Card title="Factures et échéances" description="Vos factures déposées, leur contrôle par E-MPGT et leur état de règlement.">
        <DataTable
          rows={o.invoices}
          columns={invoiceColumns}
          rowKey={(i) => i.id}
          caption="Mes factures"
          empty={{ title: 'Aucune facture déposée', description: 'Déposez votre facture une fois votre CRA validé.' }}
        />
      </Card>

      <Card title="Règlements enregistrés" description="Règlements enregistrés par E-MPGT avec leur référence et leur justificatif.">
        <DataTable
          rows={o.payouts}
          columns={payoutColumns}
          rowKey={(p) => p.id}
          caption="Règlements reçus"
          empty={{ title: 'Aucun règlement enregistré', description: 'Un règlement n’apparaît ici qu’une fois enregistré par E-MPGT, justificatif à l’appui.' }}
        />
      </Card>

      <section id="deposer-facture" className="scroll-mt-20">
        <Card title="Déposer une facture" description="Facture au format PDF, rattachée à un contrat et, de préférence, au CRA validé correspondant.">
          <ResourceView resource={contracts} loadingLabel="Chargement des contrats…">
            {(page) => <InvoiceDepositForm key={prefill ?? 'nouvelle'} contracts={page.items} approvedAmounts={o.approvedAmounts} initialTimesheetId={prefill} />}
          </ResourceView>
        </Card>
      </section>
    </div>
  );
}

export default function FreelancePaymentsPage() {
  const overview = useApi<FreelancerPaymentsOverview>('/freelancer/payments');
  return (
    <>
      <PageHeader
        title="Factures et paiements"
        description="Montants approuvés, factures, échéances et règlements enregistrés par E-MPGT."
      />
      <ResourceView resource={overview} loadingLabel="Chargement de vos paiements…">
        {(o) => <PaymentsContent overview={o} />}
      </ResourceView>
    </>
  );
}
