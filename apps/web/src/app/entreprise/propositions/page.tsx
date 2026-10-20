'use client';

import Link from 'next/link';
import { Suspense } from 'react';
import { labels, ProposalStatus, type Page, type ProposalListItem } from '@empgt/contracts';
import { qs } from '@/lib/api';
import { formatDate } from '@/lib/format';
import { useApi } from '@/lib/hooks';
import { StatusBadge } from '@/components/ui/badge';
import { LoadingBlock, ResourceView } from '@/components/ui/feedback';
import { Field, Select } from '@/components/ui/form';
import { PageHeader } from '@/components/ui/page';
import { DataTable, Pagination, type Column } from '@/components/ui/table';
import { breadcrumbRoot } from '@/components/company/display';
import { useQueryFilters } from '@/components/company/query-filters';
import { Refreshing } from '@/components/company/widgets';

// Les brouillons restent internes à E-MPGT : l'entreprise ne voit que les propositions envoyées.
const statusOptions = ProposalStatus.filter((s) => s !== 'DRAFT').map((s) => ({
  value: s,
  label: labels.proposalStatus[s],
}));

const columns: Column<ProposalListItem>[] = [
  {
    header: 'Proposition',
    cell: (p) => (
      <span className="inline-flex flex-col items-end md:items-start">
        <Link
          href={`/entreprise/propositions/${p.id}`}
          className="font-medium text-brand-700 hover:underline"
        >
          {p.reference}
        </Link>
        <span className="text-xs text-gray-500">Version {p.version}</span>
      </span>
    ),
  },
  { header: 'Mission', cell: (p) => p.missionTitle },
  { header: 'Candidat', cell: (p) => p.candidateName },
  {
    header: 'Statut',
    cell: (p) => <StatusBadge status={p.status} label={labels.proposalStatus[p.status]} />,
  },
  {
    header: 'Votre décision',
    cell: (p) => (
      <StatusBadge status={p.companyDecision} label={labels.partyDecision[p.companyDecision]} />
    ),
  },
  {
    header: 'Décision du freelance',
    cell: (p) => (
      <StatusBadge
        status={p.freelancerDecision}
        label={labels.partyDecision[p.freelancerDecision]}
      />
    ),
  },
  { header: 'Mise à jour', cell: (p) => formatDate(p.updatedAt) },
];

function ProposalsList() {
  const { values, page, active, update } = useQueryFilters(['status'] as const);
  const proposals = useApi<Page<ProposalListItem>>(
    `/proposals${qs({ ...values, page, pageSize: 20 })}`,
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
              options={statusOptions}
              onChange={(e) => update({ status: e.target.value })}
            />
          )}
        </Field>
      </div>
      <Refreshing loading={proposals.loading && Boolean(proposals.data)} />
      <ResourceView resource={proposals} loadingLabel="Chargement des propositions…">
        {(data) => (
          <>
            <DataTable
              rows={data.items}
              columns={columns}
              rowKey={(p) => p.id}
              caption="Propositions commerciales"
              empty={
                active
                  ? { title: 'Aucune proposition avec ce statut' }
                  : {
                      title: 'Aucune proposition commerciale',
                      description:
                        'Après la retenue d’un candidat, E-MPGT prépare une proposition que vous pourrez accepter ou décliner.',
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

export default function PropositionsPage() {
  return (
    <>
      <PageHeader
        title="Propositions commerciales"
        description="Conditions préparées par E-MPGT pour chaque candidat retenu. Le contrat est généré après l’accord des deux parties et la validation d’E-MPGT."
        breadcrumbs={[breadcrumbRoot, { label: 'Propositions' }]}
      />
      <Suspense fallback={<LoadingBlock />}>
        <ProposalsList />
      </Suspense>
    </>
  );
}
