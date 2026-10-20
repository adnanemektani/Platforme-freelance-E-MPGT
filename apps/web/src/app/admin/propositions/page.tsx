'use client';

import Link from 'next/link';
import { Suspense } from 'react';
import { labels, ProposalStatus, type MissionListItem, type Page, type ProposalListItem } from '@empgt/contracts';
import { qs } from '@/lib/api';
import { formatDate } from '@/lib/format';
import { useApi } from '@/lib/hooks';
import { StatusBadge } from '@/components/ui/badge';
import { LinkButton } from '@/components/ui/button';
import { LoadingBlock, ResourceView } from '@/components/ui/feedback';
import { optionsFrom } from '@/components/ui/form';
import { PageHeader } from '@/components/ui/page';
import { DataTable, Pagination } from '@/components/ui/table';
import { BFilterBar, BFilterSelect, useUrlFilters } from '@/components/admin/b-common';

const FILTERS = ['status', 'missionId'] as const;

export default function AdminProposalsPage() {
  return (
    <>
      <PageHeader
        title="Propositions commerciales"
        description="Conditions préparées par E-MPGT pour une candidature retenue, acceptées par les deux parties puis validées : la validation fige les conditions dans un contrat."
        actions={<LinkButton href="/admin/propositions/nouvelle">Nouvelle proposition</LinkButton>}
      />
      <Suspense fallback={<LoadingBlock />}>
        <ProposalsList />
      </Suspense>
    </>
  );
}

function ProposalsList() {
  const { values, page, update } = useUrlFilters(FILTERS);
  const missions = useApi<Page<MissionListItem>>('/missions?pageSize=100');
  const proposals = useApi<Page<ProposalListItem>>(`/proposals${qs({ ...values, page, pageSize: 20 })}`);

  return (
    <>
      <BFilterBar>
        <BFilterSelect label="Statut" value={values.status} onChange={(status) => update({ status })} placeholder="Tous" options={optionsFrom(ProposalStatus, labels.proposalStatus)} />
        <BFilterSelect
          label="Mission"
          value={values.missionId}
          onChange={(missionId) => update({ missionId })}
          placeholder={missions.loading ? 'Chargement…' : 'Toutes'}
          options={(missions.data?.items ?? []).map((m) => ({ value: m.id, label: `${m.reference} — ${m.title}` }))}
        />
      </BFilterBar>
      <ResourceView resource={proposals}>
        {(data) => (
          <>
            <DataTable
              rows={data.items}
              rowKey={(p) => p.id}
              caption="Propositions commerciales"
              empty={{
                title: 'Aucune proposition',
                description: 'Une proposition se prépare à partir d’une candidature retenue.',
                action: <LinkButton href="/admin/candidatures?status=SELECTED" variant="secondary" size="sm">Candidatures retenues</LinkButton>,
              }}
              columns={[
                {
                  header: 'Proposition',
                  cell: (p) => (
                    <span className="flex flex-col">
                      <Link href={`/admin/propositions/${p.id}`} className="font-medium text-brand-700 hover:underline">
                        {p.reference}
                      </Link>
                      <span className="text-xs text-gray-500">Version {p.version}</span>
                    </span>
                  ),
                },
                { header: 'Mission', cell: (p) => p.missionTitle },
                { header: 'Entreprise', cell: (p) => p.companyName },
                { header: 'Candidat', cell: (p) => p.candidateName },
                { header: 'Statut', cell: (p) => <StatusBadge status={p.status} label={labels.proposalStatus[p.status]} /> },
                { header: 'Entreprise : décision', cell: (p) => <StatusBadge status={p.companyDecision} label={labels.partyDecision[p.companyDecision]} /> },
                { header: 'Freelance : décision', cell: (p) => <StatusBadge status={p.freelancerDecision} label={labels.partyDecision[p.freelancerDecision]} /> },
                { header: 'Mise à jour', cell: (p) => formatDate(p.updatedAt) },
              ]}
            />
            <Pagination page={data} onChange={(n) => update({ page: n })} />
          </>
        )}
      </ResourceView>
    </>
  );
}
