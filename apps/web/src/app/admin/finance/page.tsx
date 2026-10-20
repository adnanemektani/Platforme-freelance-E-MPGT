'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Suspense, useState } from 'react';
import { InvoiceKind, InvoiceStatus, labels, PaymentState, type InvoiceListItem, type Page } from '@empgt/contracts';
import { qs } from '@/lib/api';
import { formatDate, formatMoney } from '@/lib/format';
import { useApi } from '@/lib/hooks';
import { Badge, StatusBadge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, StatTile } from '@/components/ui/card';
import { Alert, EmptyState, LoadingBlock, ResourceView } from '@/components/ui/feedback';
import { Checkbox, optionsFrom } from '@/components/ui/form';
import { PageHeader } from '@/components/ui/page';
import { DataTable, Pagination } from '@/components/ui/table';
import { BFilterBar, BFilterSelect, BSearch, isNonZeroAmount, useUrlFilters } from '@/components/admin/b-common';
import { BClientInvoiceForm, type BFinanceOverview } from '@/components/admin/b-finance';

const FILTERS = ['q', 'kind', 'status', 'paymentState', 'overdue'] as const;

export default function AdminFinancePage() {
  return (
    <>
      <PageHeader title="Finance" description="Synthèse des montants approuvés, facturés, encaissés et réglés ; dépôt et contrôle des factures ; enregistrement manuel des règlements." />
      <div className="space-y-6">
        <Overview />
        <Suspense fallback={<LoadingBlock />}>
          <Invoices />
        </Suspense>
      </div>
    </>
  );
}

function Overview() {
  const overview = useApi<BFinanceOverview>('/admin/finance/overview');
  return (
    <ResourceView resource={overview}>
      {(o) => (
        <div className="space-y-4">
          <Alert tone="warning" title="Suivi manuel — aucun mouvement d’argent automatique">
            <p>{o.disclaimer}</p>
          </Alert>
          <Card
            title="Prestataire de paiement"
            actions={
              o.provider.mode === 'TEST' ? (
                <Badge tone="red">MODE TEST</Badge>
              ) : o.provider.mode === 'LIVE' ? (
                <Badge tone="green">Production</Badge>
              ) : (
                <Badge>Aucun prestataire</Badge>
              )
            }
          >
            <p className="text-sm text-gray-800">
              {o.provider.label} <span className="text-gray-500">(code : {o.provider.code})</span>
            </p>
            <p className="mt-1 text-xs text-gray-600">
              {o.provider.automationEnabled ? 'Opérations automatiques activées.' : 'Opérations financières automatiques désactivées : encaissements et règlements sont saisis manuellement avec justificatif.'}
            </p>
            {o.provider.mode === 'TEST' && <p className="mt-1 text-xs font-medium text-red-700">Mode test : aucun paiement réel n’est effectué.</p>}
          </Card>
          {o.totals.length === 0 ? (
            <EmptyState title="Aucun montant à ce jour" description="Les totaux apparaissent dès qu’un CRA est validé ou qu’une facture est déposée." />
          ) : (
            o.totals.map((t) => (
              <Card key={t.currency} title={`Totaux en ${t.currency}`} description="Montants HT approuvés (CRA validés) ; montants facturés TTC (factures déposées ou contrôlées).">
                <div className="space-y-4">
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                    <StatTile label="Approuvé — total client HT" value={formatMoney(t.approvedClientTotal, t.currency)} />
                    <StatTile label="Approuvé — net freelance HT" value={formatMoney(t.approvedFreelanceNet, t.currency)} />
                    <StatTile label="Commissions approuvées" value={formatMoney(t.approvedCommission, t.currency)} />
                    <StatTile label="Marge E-MPGT (interne)" value={formatMoney(t.approvedMargin, t.currency)} />
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
                    <StatTile label="Facturé au client" value={formatMoney(t.clientInvoiced, t.currency)} />
                    <StatTile label="Encaissé" value={formatMoney(t.clientCollected, t.currency)} />
                    <StatTile label="Facturé par les freelances" value={formatMoney(t.freelancerInvoiced, t.currency)} />
                    <StatTile label="Réglé aux freelances" value={formatMoney(t.freelancerPaid, t.currency)} />
                    <StatTile
                      label="En retard (reste dû)"
                      value={<span className={isNonZeroAmount(t.overdue) ? 'text-red-700' : ''}>{formatMoney(t.overdue, t.currency)}</span>}
                      hint="Factures échues non entièrement réglées"
                    />
                  </div>
                </div>
              </Card>
            ))
          )}
        </div>
      )}
    </ResourceView>
  );
}

function Invoices() {
  const router = useRouter();
  const { values, page, update } = useUrlFilters(FILTERS);
  const [depositing, setDepositing] = useState(false);
  const invoices = useApi<Page<InvoiceListItem>>(`/invoices${qs({ ...values, overdue: values.overdue === 'true' ? 'true' : undefined, page, pageSize: 20 })}`);

  return (
    <Card
      title="Factures"
      description="Factures client déposées par E-MPGT et factures déposées par les freelances."
      actions={!depositing && <Button onClick={() => setDepositing(true)}>Déposer une facture client</Button>}
    >
      <div className="space-y-4">
        {depositing && (
          <div className="rounded-md border border-brand-200 bg-brand-50/40 p-4">
            <h3 className="mb-3 text-sm font-semibold text-gray-900">Dépôt d’une facture client</h3>
            <BClientInvoiceForm onCancel={() => setDepositing(false)} onCreated={(view) => router.push(`/admin/finance/factures/${view.id}`)} />
          </div>
        )}
        <BFilterBar>
          <BSearch key={values.q} value={values.q} onSearch={(q) => update({ q })} placeholder="Numéro de facture, référence de contrat…" />
          <BFilterSelect label="Type" value={values.kind} onChange={(kind) => update({ kind })} placeholder="Tous" options={optionsFrom(InvoiceKind, labels.invoiceKind)} />
          <BFilterSelect label="Statut" value={values.status} onChange={(status) => update({ status })} placeholder="Tous" options={optionsFrom(InvoiceStatus, labels.invoiceStatus)} />
          <BFilterSelect
            label="État de paiement"
            value={values.paymentState}
            onChange={(paymentState) => update({ paymentState })}
            placeholder="Tous"
            options={optionsFrom(PaymentState, labels.paymentState)}
          />
          <div className="pb-2">
            <Checkbox checked={values.overdue === 'true'} onChange={(e) => update({ overdue: e.target.checked ? 'true' : null })} label="En retard uniquement" />
          </div>
        </BFilterBar>
        <ResourceView resource={invoices}>
          {(data) => (
            <>
              <DataTable
                rows={data.items}
                rowKey={(i) => i.id}
                caption="Factures"
                empty={{ title: 'Aucune facture ne correspond' }}
                columns={[
                  {
                    header: 'Facture',
                    cell: (i) => (
                      <span className="flex flex-col">
                        <Link href={`/admin/finance/factures/${i.id}`} className="font-medium text-brand-700 hover:underline">
                          {i.number}
                        </Link>
                        <span className="text-xs text-gray-500">
                          {labels.invoiceKind[i.kind]} · {i.contractReference}
                        </span>
                      </span>
                    ),
                  },
                  { header: 'Entreprise', cell: (i) => i.companyName },
                  { header: 'Freelance', cell: (i) => i.freelancerName },
                  { header: 'Émise / échéance', cell: (i) => `${formatDate(i.issueDate)} → ${formatDate(i.dueDate)}` },
                  { header: 'TTC', cell: (i) => formatMoney(i.amountInclTax, i.currency) },
                  { header: 'Réglé', cell: (i) => formatMoney(i.paidAmount, i.currency) },
                  { header: 'Statut', cell: (i) => <StatusBadge status={i.status} label={labels.invoiceStatus[i.status]} /> },
                  {
                    header: 'Paiement',
                    cell: (i) => (
                      <span className="flex flex-wrap gap-1">
                        <StatusBadge status={i.paymentState} label={labels.paymentState[i.paymentState]} />
                        {i.overdue && <Badge tone="red">En retard</Badge>}
                      </span>
                    ),
                  },
                ]}
              />
              <Pagination page={data} onChange={(p) => update({ page: p })} />
            </>
          )}
        </ResourceView>
      </div>
    </Card>
  );
}
