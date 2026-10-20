'use client';

import Link from 'next/link';
import { Suspense } from 'react';
import { ApplicationStatus, labels, type ApplicationListItem, type MissionListItem, type Page } from '@empgt/contracts';
import { qs } from '@/lib/api';
import { formatDate } from '@/lib/format';
import { useApi } from '@/lib/hooks';
import { StatusBadge } from '@/components/ui/badge';
import { LoadingBlock, ResourceView } from '@/components/ui/feedback';
import { optionsFrom } from '@/components/ui/form';
import { PageHeader } from '@/components/ui/page';
import { DataTable, Pagination } from '@/components/ui/table';
import { BFilterBar, BFilterSelect, BSearch, useUrlFilters } from '@/components/admin/b-common';

const FILTERS = ['q', 'status', 'missionId'] as const;

export default function AdminApplicationsPage() {
  return (
    <>
      <PageHeader
        title="Candidatures"
        description="Toutes les candidatures. E-MPGT peut décider à la place de l’entreprise, avec un motif obligatoire, puis préparer la proposition commerciale."
      />
      <Suspense fallback={<LoadingBlock />}>
        <ApplicationsList />
      </Suspense>
    </>
  );
}

function ApplicationsList() {
  const { values, page, update } = useUrlFilters(FILTERS);
  const missions = useApi<Page<MissionListItem>>('/missions?pageSize=100');
  const applications = useApi<Page<ApplicationListItem>>(`/applications${qs({ ...values, page, pageSize: 20 })}`);

  return (
    <>
      <BFilterBar>
        <BSearch key={values.q} value={values.q} onSearch={(q) => update({ q })} placeholder="Mission, référence, titre du profil…" />
        <BFilterSelect label="Statut" value={values.status} onChange={(status) => update({ status })} placeholder="Tous" options={optionsFrom(ApplicationStatus, labels.applicationStatus)} />
        <BFilterSelect
          label="Mission"
          value={values.missionId}
          onChange={(missionId) => update({ missionId })}
          placeholder={missions.loading ? 'Chargement…' : 'Toutes'}
          options={(missions.data?.items ?? []).map((m) => ({ value: m.id, label: `${m.reference} — ${m.title}` }))}
        />
      </BFilterBar>
      <ResourceView resource={applications}>
        {(data) => (
          <>
            <DataTable
              rows={data.items}
              rowKey={(a) => a.id}
              caption="Candidatures"
              empty={{ title: 'Aucune candidature ne correspond', description: 'Modifiez les filtres pour élargir la recherche.' }}
              columns={[
                {
                  header: 'Candidat',
                  cell: (a) => (
                    <span className="flex flex-col">
                      <Link href={`/admin/candidatures/${a.id}`} className="font-medium text-brand-700 hover:underline">
                        {a.candidateName}
                      </Link>
                      {a.candidateHeadline && <span className="text-xs text-gray-500">{a.candidateHeadline}</span>}
                    </span>
                  ),
                },
                {
                  header: 'Mission',
                  cell: (a) => (
                    <span className="flex flex-col">
                      <Link href={`/admin/missions/${a.missionId}`} className="hover:underline">
                        {a.missionTitle}
                      </Link>
                      <span className="text-xs text-gray-500">{a.missionReference}</span>
                    </span>
                  ),
                },
                { header: 'Entreprise', cell: (a) => a.companyName ?? '—' },
                { header: 'Statut', cell: (a) => <StatusBadge status={a.status} label={labels.applicationStatus[a.status]} /> },
                { header: 'Reçue le', cell: (a) => formatDate(a.createdAt) },
                { header: 'Mise à jour', cell: (a) => formatDate(a.updatedAt) },
              ]}
            />
            <Pagination page={data} onChange={(p) => update({ page: p })} />
          </>
        )}
      </ResourceView>
    </>
  );
}
