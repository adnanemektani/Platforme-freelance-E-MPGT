'use client';

import Link from 'next/link';
import { Suspense, useState } from 'react';
import {
  ApplicationStatus,
  labels,
  type ApplicationListItem,
  type MissionListItem,
  type Page,
} from '@empgt/contracts';
import { qs } from '@/lib/api';
import { formatDate } from '@/lib/format';
import { useApi } from '@/lib/hooks';
import { StatusBadge } from '@/components/ui/badge';
import { LoadingBlock, ResourceView } from '@/components/ui/feedback';
import { Field, Input, optionsFrom, Select } from '@/components/ui/form';
import { PageHeader } from '@/components/ui/page';
import { DataTable, Pagination, type Column } from '@/components/ui/table';
import { breadcrumbRoot } from '@/components/company/display';
import { useQueryFilters } from '@/components/company/query-filters';
import { FilterBar, Refreshing } from '@/components/company/widgets';

const FILTER_KEYS = ['q', 'status', 'missionId'] as const;

const columns: Column<ApplicationListItem>[] = [
  {
    header: 'Candidat',
    cell: (a) => (
      <span className="inline-flex flex-col items-end md:items-start">
        <Link
          href={`/entreprise/candidatures/${a.id}`}
          className="font-medium text-brand-700 hover:underline"
        >
          {a.candidateName}
        </Link>
        {a.candidateHeadline && (
          <span className="text-xs text-gray-500">{a.candidateHeadline}</span>
        )}
      </span>
    ),
  },
  {
    header: 'Mission',
    cell: (a) => (
      <span className="inline-flex flex-col items-end md:items-start">
        <Link
          href={`/entreprise/missions/${a.missionId}`}
          className="text-brand-700 hover:underline"
        >
          {a.missionTitle}
        </Link>
        <span className="text-xs text-gray-500">{a.missionReference}</span>
      </span>
    ),
  },
  {
    header: 'Statut',
    cell: (a) => <StatusBadge status={a.status} label={labels.applicationStatus[a.status]} />,
  },
  { header: 'Reçue le', cell: (a) => formatDate(a.createdAt) },
  { header: 'Mise à jour', cell: (a) => formatDate(a.updatedAt) },
];

function ApplicationsList() {
  const { values, page, active, update, reset } = useQueryFilters(FILTER_KEYS);
  const [text, setText] = useState(values.q);
  const missions = useApi<Page<MissionListItem>>(`/missions${qs({ pageSize: 100 })}`);
  const applications = useApi<Page<ApplicationListItem>>(
    `/applications${qs({ ...values, page, pageSize: 20 })}`,
  );
  const missionOptions = (missions.data?.items ?? []).map((m) => ({
    value: m.id,
    label: `${m.reference} — ${m.title}`,
  }));

  return (
    <>
      <FilterBar
        onSubmit={() => update({ q: text })}
        onReset={() => {
          setText('');
          reset();
        }}
        active={active}
      >
        <Field label="Recherche">
          {(p) => (
            <Input
              {...p}
              type="search"
              value={text}
              placeholder="Mission, référence, intitulé du candidat…"
              onChange={(e) => setText(e.target.value)}
            />
          )}
        </Field>
        <Field label="Statut">
          {(p) => (
            <Select
              {...p}
              value={values.status}
              placeholder="Tous"
              options={optionsFrom(ApplicationStatus, labels.applicationStatus)}
              onChange={(e) => update({ status: e.target.value })}
            />
          )}
        </Field>
        <Field label="Mission">
          {(p) => (
            <Select
              {...p}
              value={values.missionId}
              placeholder="Toutes les missions"
              options={missionOptions}
              onChange={(e) => update({ missionId: e.target.value })}
            />
          )}
        </Field>
      </FilterBar>
      <Refreshing loading={applications.loading && Boolean(applications.data)} />
      <ResourceView resource={applications} loadingLabel="Chargement des candidatures…">
        {(data) => (
          <>
            <DataTable
              rows={data.items}
              columns={columns}
              rowKey={(a) => a.id}
              caption="Candidatures reçues"
              empty={
                active
                  ? {
                      title: 'Aucune candidature ne correspond aux filtres',
                      description: 'Modifiez ou réinitialisez les filtres.',
                    }
                  : {
                      title: 'Aucune candidature reçue',
                      description:
                        'Les freelances validés candidatent une fois vos missions publiées par E-MPGT.',
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

export default function CandidaturesPage() {
  return (
    <>
      <PageHeader
        title="Candidatures"
        description="Candidatures reçues sur vos missions. Les profils sont présentés sans coordonnées : E-MPGT assure la mise en relation."
        breadcrumbs={[breadcrumbRoot, { label: 'Candidatures' }]}
      />
      <Suspense fallback={<LoadingBlock />}>
        <ApplicationsList />
      </Suspense>
    </>
  );
}
