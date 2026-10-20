'use client';

import Link from 'next/link';
import { Suspense } from 'react';
import {
  labels,
  MissionPublicationStatus,
  MissionStatus,
  type AdminCompanyListItem,
  type MissionListItem,
  type Page,
} from '@empgt/contracts';
import { qs } from '@/lib/api';
import { formatDate } from '@/lib/format';
import { useApi } from '@/lib/hooks';
import { StatusBadge } from '@/components/ui/badge';
import { LoadingBlock, ResourceView } from '@/components/ui/feedback';
import { optionsFrom } from '@/components/ui/form';
import { PageHeader } from '@/components/ui/page';
import { DataTable, Pagination } from '@/components/ui/table';
import { BFilterBar, BFilterSelect, BSearch, useUrlFilters } from '@/components/admin/b-common';

const FILTERS = ['q', 'publicationStatus', 'status', 'companyId'] as const;

export default function AdminMissionsPage() {
  return (
    <>
      <PageHeader title="Missions" description="Toutes les missions des entreprises : validation avant publication, suivi de l’avancement, interventions E-MPGT." />
      <Suspense fallback={<LoadingBlock />}>
        <MissionsList />
      </Suspense>
    </>
  );
}

function MissionsList() {
  const { values, page, update } = useUrlFilters(FILTERS);
  const companies = useApi<Page<AdminCompanyListItem>>('/admin/companies?pageSize=100');
  const missions = useApi<Page<MissionListItem>>(`/missions${qs({ ...values, page, pageSize: 20 })}`);

  return (
    <>
      <BFilterBar>
        <BSearch key={values.q} value={values.q} onSearch={(q) => update({ q })} placeholder="Titre, référence, compétence…" />
        <BFilterSelect
          label="Publication"
          value={values.publicationStatus}
          onChange={(publicationStatus) => update({ publicationStatus })}
          placeholder="Toutes"
          options={optionsFrom(MissionPublicationStatus, labels.missionPublication)}
        />
        <BFilterSelect label="Avancement" value={values.status} onChange={(status) => update({ status })} placeholder="Tous" options={optionsFrom(MissionStatus, labels.missionStatus)} />
        <BFilterSelect
          label="Entreprise"
          value={values.companyId}
          onChange={(companyId) => update({ companyId })}
          placeholder={companies.loading ? 'Chargement…' : 'Toutes'}
          options={(companies.data?.items ?? []).map((c) => ({ value: c.id, label: c.legalName }))}
        />
      </BFilterBar>
      <ResourceView resource={missions}>
        {(data) => (
          <>
            <DataTable
              rows={data.items}
              rowKey={(m) => m.id}
              caption="Missions"
              empty={{ title: 'Aucune mission ne correspond', description: 'Modifiez les filtres pour élargir la recherche.' }}
              columns={[
                {
                  header: 'Mission',
                  cell: (m) => (
                    <span className="flex flex-col">
                      <Link href={`/admin/missions/${m.id}`} className="font-medium text-brand-700 hover:underline">
                        {m.title}
                      </Link>
                      <span className="text-xs text-gray-500">{m.reference}</span>
                    </span>
                  ),
                },
                { header: 'Entreprise', cell: (m) => m.companyName ?? '—' },
                { header: 'Publication', cell: (m) => <StatusBadge status={m.publicationStatus} label={labels.missionPublication[m.publicationStatus]} /> },
                { header: 'Avancement', cell: (m) => <StatusBadge status={m.status} label={labels.missionStatus[m.status]} /> },
                { header: 'Lieu', cell: (m) => [m.city, m.country].filter(Boolean).join(', ') || '—' },
                { header: 'Candidatures', cell: (m) => m.applicationsCount ?? '—' },
                { header: 'Mise à jour', cell: (m) => formatDate(m.updatedAt) },
              ]}
            />
            <Pagination page={data} onChange={(p) => update({ page: p })} />
          </>
        )}
      </ResourceView>
    </>
  );
}
