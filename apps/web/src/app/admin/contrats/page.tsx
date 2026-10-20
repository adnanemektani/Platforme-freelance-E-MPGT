'use client';

import Link from 'next/link';
import { Suspense } from 'react';
import { ContractStatus, labels, type ContractListItem, type Page } from '@empgt/contracts';
import { qs } from '@/lib/api';
import { formatDate } from '@/lib/format';
import { useApi } from '@/lib/hooks';
import { StatusBadge } from '@/components/ui/badge';
import { LoadingBlock, ResourceView } from '@/components/ui/feedback';
import { optionsFrom } from '@/components/ui/form';
import { PageHeader } from '@/components/ui/page';
import { DataTable, Pagination } from '@/components/ui/table';
import { BFilterBar, BFilterSelect, BSearch, useUrlFilters } from '@/components/admin/b-common';

const FILTERS = ['q', 'status'] as const;

export default function AdminContractsPage() {
  return (
    <>
      <PageHeader
        title="Contrats et avenants"
        description="Contrats générés à la validation des propositions : dépôt du contrat signé hors plateforme, activation, suspension, clôture et avenants."
      />
      <Suspense fallback={<LoadingBlock />}>
        <ContractsList />
      </Suspense>
    </>
  );
}

function ContractsList() {
  const { values, page, update } = useUrlFilters(FILTERS);
  const contracts = useApi<Page<ContractListItem>>(`/contracts${qs({ ...values, page, pageSize: 20 })}`);

  return (
    <>
      <BFilterBar>
        <BSearch key={values.q} value={values.q} onSearch={(q) => update({ q })} placeholder="Référence du contrat, titre de mission…" />
        <BFilterSelect label="Statut" value={values.status} onChange={(status) => update({ status })} placeholder="Tous" options={optionsFrom(ContractStatus, labels.contractStatus)} />
      </BFilterBar>
      <ResourceView resource={contracts}>
        {(data) => (
          <>
            <DataTable
              rows={data.items}
              rowKey={(c) => c.id}
              caption="Contrats"
              empty={{ title: 'Aucun contrat ne correspond', description: 'Un contrat est généré lorsqu’E-MPGT valide une proposition acceptée par les deux parties.' }}
              columns={[
                {
                  header: 'Contrat',
                  cell: (c) => (
                    <Link href={`/admin/contrats/${c.id}`} className="font-medium text-brand-700 hover:underline">
                      {c.reference}
                    </Link>
                  ),
                },
                { header: 'Mission', cell: (c) => c.missionTitle },
                { header: 'Entreprise', cell: (c) => c.companyName },
                { header: 'Freelance', cell: (c) => c.freelancerName },
                { header: 'Statut', cell: (c) => <StatusBadge status={c.status} label={labels.contractStatus[c.status]} /> },
                { header: 'Période', cell: (c) => `${formatDate(c.startDate)} → ${formatDate(c.currentEndDate)}` },
                { header: 'Mise à jour', cell: (c) => formatDate(c.updatedAt) },
              ]}
            />
            <Pagination page={data} onChange={(p) => update({ page: p })} />
          </>
        )}
      </ResourceView>
    </>
  );
}
