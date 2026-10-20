'use client';

import Link from 'next/link';
import { Suspense } from 'react';
import { ContractStatus, labels, type ContractListItem, type Page } from '@empgt/contracts';
import { qs } from '@/lib/api';
import { formatDate } from '@/lib/format';
import { useApi } from '@/lib/hooks';
import { StatusBadge } from '@/components/ui/badge';
import { LoadingBlock, ResourceView } from '@/components/ui/feedback';
import { Field, optionsFrom, Select } from '@/components/ui/form';
import { PageHeader } from '@/components/ui/page';
import { DataTable, Pagination, type Column } from '@/components/ui/table';
import { breadcrumbRoot } from '@/components/company/display';
import { useQueryFilters } from '@/components/company/query-filters';
import { Refreshing } from '@/components/company/widgets';

const columns: Column<ContractListItem>[] = [
  {
    header: 'Contrat',
    cell: (c) => (
      <Link
        href={`/entreprise/contrats/${c.id}`}
        className="font-medium text-brand-700 hover:underline"
      >
        {c.reference}
      </Link>
    ),
  },
  { header: 'Mission', cell: (c) => c.missionTitle },
  { header: 'Freelance', cell: (c) => c.freelancerName },
  {
    header: 'Statut',
    cell: (c) => <StatusBadge status={c.status} label={labels.contractStatus[c.status]} />,
  },
  { header: 'Début', cell: (c) => formatDate(c.startDate) },
  { header: 'Fin', cell: (c) => formatDate(c.currentEndDate) },
  { header: 'Mise à jour', cell: (c) => formatDate(c.updatedAt) },
];

function ContractsList() {
  const { values, page, active, update } = useQueryFilters(['status'] as const);
  const contracts = useApi<Page<ContractListItem>>(
    `/contracts${qs({ ...values, page, pageSize: 20 })}`,
  );
  return (
    <>
      <div className="mb-4 max-w-xs">
        <Field label="Statut">
          {(p) => (
            <Select
              {...p}
              value={values.status}
              placeholder="Tous"
              options={optionsFrom(ContractStatus, labels.contractStatus)}
              onChange={(e) => update({ status: e.target.value })}
            />
          )}
        </Field>
      </div>
      <Refreshing loading={contracts.loading && Boolean(contracts.data)} />
      <ResourceView resource={contracts} loadingLabel="Chargement des contrats…">
        {(data) => (
          <>
            <DataTable
              rows={data.items}
              columns={columns}
              rowKey={(c) => c.id}
              caption="Contrats"
              empty={
                active
                  ? { title: 'Aucun contrat avec ce statut' }
                  : {
                      title: 'Aucun contrat',
                      description:
                        'Un contrat est généré par E-MPGT après l’accord des parties sur une proposition commerciale.',
                    }
              }
            />
            <Pagination page={data} onChange={(p) => update({ page: p })} />
          </>
        )}
      </ResourceView>
    </>
  );
}

export default function ContratsPage() {
  return (
    <>
      <PageHeader
        title="Contrats"
        description="Contrats aux conditions figées. La signature a lieu hors plateforme ; E-MPGT enregistre le contrat signé et sa preuve de signature."
        breadcrumbs={[breadcrumbRoot, { label: 'Contrats' }]}
      />
      <Suspense fallback={<LoadingBlock />}>
        <ContractsList />
      </Suspense>
    </>
  );
}
