'use client';

import Link from 'next/link';
import { Suspense } from 'react';
import { DisputeStatus, labels, TimesheetStatus, type DisputeView, type Page, type TimesheetListItem } from '@empgt/contracts';
import { qs } from '@/lib/api';
import { formatDateTime, formatMonth, formatNumber } from '@/lib/format';
import { useApi } from '@/lib/hooks';
import { StatusBadge } from '@/components/ui/badge';
import { LoadingBlock, ResourceView } from '@/components/ui/feedback';
import { optionsFrom } from '@/components/ui/form';
import { PageHeader, Tabs } from '@/components/ui/page';
import { DataTable, Pagination } from '@/components/ui/table';
import { BFilterBar, BFilterSelect, useUrlFilters } from '@/components/admin/b-common';
import { BResolveDisputeDialog } from '@/components/admin/b-documents';

const FILTERS = ['onglet', 'status', 'contractId', 'litige'] as const;
const ALL = 'ALL';

export default function AdminTimesheetsPage() {
  return (
    <>
      <PageHeader
        title="CRA et litiges"
        description="Comptes rendus d’activité soumis à validation, corrections tracées et litiges ouverts par les parties."
      />
      <Suspense fallback={<LoadingBlock />}>
        <TimesheetsAndDisputes />
      </Suspense>
    </>
  );
}

function TimesheetsAndDisputes() {
  const filters = useUrlFilters(FILTERS);
  const tab = filters.values.onglet === 'litiges' ? 'litiges' : 'cra';
  return (
    <>
      <Tabs
        tabs={[
          { id: 'cra', label: 'CRA' },
          { id: 'litiges', label: 'Litiges' },
        ]}
        current={tab}
        onChange={(id) => filters.update({ onglet: id === 'cra' ? null : id, status: null, litige: null })}
      />
      {tab === 'cra' ? <TimesheetsTab filters={filters} /> : <DisputesTab filters={filters} />}
    </>
  );
}

type Filters = ReturnType<typeof useUrlFilters<(typeof FILTERS)[number]>>;

function TimesheetsTab({ filters }: { filters: Filters }) {
  const { values, page, update } = filters;
  // Par défaut : CRA soumis, en attente de validation.
  const status = values.status === '' ? 'SUBMITTED' : values.status === ALL ? '' : values.status;
  const timesheets = useApi<Page<TimesheetListItem>>(`/timesheets${qs({ status, contractId: values.contractId, page, pageSize: 20 })}`);

  return (
    <>
      <BFilterBar>
        <BFilterSelect
          label="Statut"
          value={values.status === '' ? 'SUBMITTED' : values.status}
          onChange={(value) => update({ status: value === 'SUBMITTED' ? null : value })}
          options={[{ value: ALL, label: 'Tous les statuts' }, ...optionsFrom(TimesheetStatus, labels.timesheetStatus)]}
        />
        {values.contractId && (
          <div className="flex items-end">
            <button type="button" className="text-sm font-medium text-brand-700 underline" onClick={() => update({ contractId: null })}>
              Retirer le filtre sur le contrat
            </button>
          </div>
        )}
      </BFilterBar>
      <ResourceView resource={timesheets}>
        {(data) => (
          <>
            <DataTable
              rows={data.items}
              rowKey={(t) => t.id}
              caption="CRA"
              empty={{ title: status === 'SUBMITTED' ? 'Aucun CRA en attente de validation' : 'Aucun CRA ne correspond' }}
              columns={[
                {
                  header: 'Période',
                  cell: (t) => (
                    <span className="flex flex-col">
                      <Link href={`/admin/cra/${t.id}`} className="font-medium text-brand-700 hover:underline">
                        {formatMonth(t.periodStart)}
                      </Link>
                      <span className="text-xs text-gray-500">Version {t.version}</span>
                    </span>
                  ),
                },
                {
                  header: 'Contrat',
                  cell: (t) => (
                    <span className="flex flex-col">
                      <Link href={`/admin/contrats/${t.contractId}`} className="hover:underline">
                        {t.contractReference}
                      </Link>
                      <span className="text-xs text-gray-500">{t.missionTitle}</span>
                    </span>
                  ),
                },
                { header: 'Entreprise', cell: (t) => t.companyName },
                { header: 'Freelance', cell: (t) => t.freelancerName },
                { header: 'Heures', cell: (t) => `${formatNumber(t.totalHours)} h` },
                { header: 'Statut', cell: (t) => <StatusBadge status={t.status} label={labels.timesheetStatus[t.status]} /> },
                { header: 'Soumis le', cell: (t) => formatDateTime(t.submittedAt) },
              ]}
            />
            <Pagination page={data} onChange={(p) => update({ page: p })} />
          </>
        )}
      </ResourceView>
    </>
  );
}

function DisputesTab({ filters }: { filters: Filters }) {
  const { values, update } = filters;
  const disputes = useApi<DisputeView[]>('/disputes');
  const status = values.litige;

  return (
    <>
      <BFilterBar>
        <BFilterSelect label="Statut" value={status} onChange={(litige) => update({ litige })} placeholder="Tous" options={optionsFrom(DisputeStatus, labels.disputeStatus)} />
      </BFilterBar>
      <ResourceView resource={disputes}>
        {(list) => {
          const rows = status ? list.filter((d) => d.status === status) : list;
          return (
            <DataTable
              rows={rows}
              rowKey={(d) => d.id}
              caption="Litiges"
              empty={{ title: 'Aucun litige', description: 'Les litiges sont ouverts par l’entreprise ou le freelance sur un CRA, une facture ou un contrat.' }}
              columns={[
                {
                  header: 'Objet',
                  cell: (d) => (
                    <span className="flex flex-col">
                      <span className="font-medium text-gray-900">{labels.disputeSubject[d.subjectType]}</span>
                      {d.timesheetId && (
                        <Link href={`/admin/cra/${d.timesheetId}`} className="text-xs text-brand-700 underline">
                          Voir le CRA
                        </Link>
                      )}
                      {d.invoiceId && (
                        <Link href={`/admin/finance/factures/${d.invoiceId}`} className="text-xs text-brand-700 underline">
                          Voir la facture
                        </Link>
                      )}
                    </span>
                  ),
                },
                {
                  header: 'Contrat',
                  cell: (d) => (
                    <Link href={`/admin/contrats/${d.contractId}`} className="hover:underline">
                      {d.contractReference}
                    </Link>
                  ),
                },
                {
                  header: 'Motif',
                  cell: (d) => (
                    <span className="flex max-w-md flex-col">
                      <span className="whitespace-pre-line">{d.reason}</span>
                      <span className="text-xs text-gray-500">
                        Ouvert par {d.openedByName} le {formatDateTime(d.createdAt)}
                      </span>
                      {d.resolution && (
                        <span className="mt-1 text-xs text-gray-700">
                          Résolution ({formatDateTime(d.resolvedAt)}) : {d.resolution}
                        </span>
                      )}
                    </span>
                  ),
                },
                { header: 'Statut', cell: (d) => <StatusBadge status={d.status === 'OPEN' ? 'OPEN_DISPUTE' : d.status} label={labels.disputeStatus[d.status]} /> },
                { header: 'Action', cell: (d) => <BResolveDisputeDialog dispute={d} onDone={() => void disputes.reload()} /> },
              ]}
            />
          );
        }}
      </ResourceView>
    </>
  );
}
