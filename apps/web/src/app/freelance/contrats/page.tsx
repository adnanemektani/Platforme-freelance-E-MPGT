'use client';

import Link from 'next/link';
import { useState } from 'react';
import { ContractStatus, labels, type ContractListItem, type Page } from '@empgt/contracts';
import { qs } from '@/lib/api';
import { formatDate } from '@/lib/format';
import { useApi } from '@/lib/hooks';
import { StatusBadge } from '@/components/ui/badge';
import { ResourceView } from '@/components/ui/feedback';
import { Field, optionsFrom, Select } from '@/components/ui/form';
import { PageHeader } from '@/components/ui/page';
import { DataTable, Pagination, type Column } from '@/components/ui/table';

const columns: Column<ContractListItem>[] = [
  {
    header: 'Contrat',
    cell: (c) => (
      <Link href={`/freelance/contrats/${c.id}`} className="font-medium text-brand-800 underline">
        {c.reference}
      </Link>
    ),
  },
  { header: 'Mission', cell: (c) => c.missionTitle },
  { header: 'Entreprise', cell: (c) => c.companyName },
  { header: 'Statut', cell: (c) => <StatusBadge status={c.status} label={labels.contractStatus[c.status]} /> },
  { header: 'Début', cell: (c) => formatDate(c.startDate) },
  { header: 'Fin prévue', cell: (c) => formatDate(c.currentEndDate) },
];

export default function FreelanceContractsPage() {
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const resource = useApi<Page<ContractListItem>>(`/contracts${qs({ status, page })}`);

  return (
    <>
      <PageHeader
        title="Contrats"
        description="Conditions figées après validation d’E-MPGT, contrat signé, avenants, CRA et évaluations."
      />
      <div className="mb-4 max-w-xs">
        <Field label="Filtrer par statut">
          {(p) => (
            <Select
              {...p}
              value={status}
              placeholder="Tous les statuts"
              options={optionsFrom(ContractStatus, labels.contractStatus)}
              onChange={(e) => {
                setStatus(e.target.value);
                setPage(1);
              }}
            />
          )}
        </Field>
      </div>
      <ResourceView resource={resource}>
        {(data) => (
          <>
            <DataTable
              rows={data.items}
              columns={columns}
              rowKey={(c) => c.id}
              caption="Mes contrats"
              empty={{ title: 'Aucun contrat', description: 'Un contrat est établi après acceptation d’une proposition commerciale par les deux parties et validation d’E-MPGT.' }}
            />
            <Pagination page={data} onChange={setPage} />
          </>
        )}
      </ResourceView>
    </>
  );
}
