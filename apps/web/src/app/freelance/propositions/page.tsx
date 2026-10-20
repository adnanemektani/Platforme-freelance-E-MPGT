'use client';

import Link from 'next/link';
import { useState } from 'react';
import { labels, ProposalStatus, type Page, type ProposalListItem } from '@empgt/contracts';
import { qs } from '@/lib/api';
import { formatDateTime } from '@/lib/format';
import { useApi } from '@/lib/hooks';
import { StatusBadge } from '@/components/ui/badge';
import { ResourceView } from '@/components/ui/feedback';
import { Field, Select } from '@/components/ui/form';
import { PageHeader } from '@/components/ui/page';
import { DataTable, Pagination, type Column } from '@/components/ui/table';

const columns: Column<ProposalListItem>[] = [
  {
    header: 'Proposition',
    cell: (p) => (
      <span>
        <Link href={`/freelance/propositions/${p.id}`} className="font-medium text-brand-800 underline">
          {p.reference}
        </Link>
        <span className="block text-xs text-gray-500">Version {p.version}</span>
      </span>
    ),
  },
  { header: 'Mission', cell: (p) => p.missionTitle },
  { header: 'Entreprise', cell: (p) => p.companyName },
  { header: 'Statut', cell: (p) => <StatusBadge status={p.status} label={labels.proposalStatus[p.status]} /> },
  { header: 'Ma réponse', cell: (p) => <StatusBadge status={p.freelancerDecision} label={labels.partyDecision[p.freelancerDecision]} /> },
  { header: 'Réponse de l’entreprise', cell: (p) => <StatusBadge status={p.companyDecision} label={labels.partyDecision[p.companyDecision]} /> },
  { header: 'Mise à jour', cell: (p) => formatDateTime(p.updatedAt) },
];

export default function FreelanceProposalsPage() {
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const resource = useApi<Page<ProposalListItem>>(`/proposals${qs({ status, page })}`);

  return (
    <>
      <PageHeader
        title="Propositions commerciales"
        description="Conditions préparées par E-MPGT après votre sélection : tarif, dates, délais de règlement. Le contrat est établi après accord des deux parties et validation d’E-MPGT."
      />
      <div className="mb-4 max-w-xs">
        <Field label="Filtrer par statut">
          {(p) => (
            <Select
              {...p}
              value={status}
              placeholder="Tous les statuts"
              options={ProposalStatus.filter((s) => s !== 'DRAFT').map((s) => ({ value: s, label: labels.proposalStatus[s] }))}
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
              rowKey={(p) => p.id}
              caption="Propositions commerciales"
              empty={{ title: 'Aucune proposition', description: 'Une proposition vous est adressée lorsque votre candidature est retenue par une entreprise.' }}
            />
            <Pagination page={data} onChange={setPage} />
          </>
        )}
      </ResourceView>
    </>
  );
}
