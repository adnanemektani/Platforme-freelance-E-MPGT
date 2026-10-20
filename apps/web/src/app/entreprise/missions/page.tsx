'use client';

import Link from 'next/link';
import { Suspense, useState } from 'react';
import {
  labels,
  MissionPublicationStatus,
  MissionStatus,
  type MissionListItem,
  type Page,
} from '@empgt/contracts';
import { qs } from '@/lib/api';
import { formatDate } from '@/lib/format';
import { useApi } from '@/lib/hooks';
import { StatusBadge } from '@/components/ui/badge';
import { LinkButton } from '@/components/ui/button';
import { LoadingBlock, ResourceView } from '@/components/ui/feedback';
import { Field, Input, optionsFrom, Select } from '@/components/ui/form';
import { PageHeader } from '@/components/ui/page';
import { DataTable, Pagination, type Column } from '@/components/ui/table';
import { breadcrumbRoot, joinParts } from '@/components/company/display';
import { useQueryFilters } from '@/components/company/query-filters';
import { FilterBar, Refreshing } from '@/components/company/widgets';

const FILTER_KEYS = ['q', 'publicationStatus', 'status'] as const;

const columns: Column<MissionListItem>[] = [
  {
    header: 'Mission',
    cell: (m) => (
      <span className="inline-flex flex-col items-end md:items-start">
        <Link
          href={`/entreprise/missions/${m.id}`}
          className="font-medium text-brand-700 hover:underline"
        >
          {m.title}
        </Link>
        <span className="text-xs text-gray-500">{m.reference}</span>
      </span>
    ),
  },
  {
    header: 'Publication',
    cell: (m) => (
      <StatusBadge
        status={m.publicationStatus}
        label={labels.missionPublication[m.publicationStatus]}
      />
    ),
  },
  {
    header: 'Avancement',
    cell: (m) => <StatusBadge status={m.status} label={labels.missionStatus[m.status]} />,
  },
  {
    header: 'Lieu',
    cell: (m) => (
      <span className="inline-flex flex-col items-end md:items-start">
        <span>{joinParts([m.city, m.country])}</span>
        {m.workMode && <span className="text-xs text-gray-500">{labels.workMode[m.workMode]}</span>}
      </span>
    ),
  },
  { header: 'Début', cell: (m) => formatDate(m.startDate) },
  {
    header: 'Candidatures',
    cell: (m) =>
      m.applicationsCount ? (
        <Link
          href={`/entreprise/candidatures?missionId=${m.id}`}
          className="font-medium text-brand-700 underline"
        >
          {m.applicationsCount}
        </Link>
      ) : (
        <span>{m.applicationsCount ?? '—'}</span>
      ),
  },
  { header: 'Mise à jour', cell: (m) => formatDate(m.updatedAt) },
];

function MissionsList() {
  const { values, page, active, update, reset } = useQueryFilters(FILTER_KEYS);
  const [text, setText] = useState(values.q);
  const missions = useApi<Page<MissionListItem>>(
    `/missions${qs({ ...values, page, pageSize: 20 })}`,
  );

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
              placeholder="Titre, référence, compétence…"
              onChange={(e) => setText(e.target.value)}
            />
          )}
        </Field>
        <Field label="Publication">
          {(p) => (
            <Select
              {...p}
              value={values.publicationStatus}
              placeholder="Toutes"
              options={optionsFrom(MissionPublicationStatus, labels.missionPublication)}
              onChange={(e) => update({ publicationStatus: e.target.value })}
            />
          )}
        </Field>
        <Field label="Avancement">
          {(p) => (
            <Select
              {...p}
              value={values.status}
              placeholder="Tous"
              options={optionsFrom(MissionStatus, labels.missionStatus)}
              onChange={(e) => update({ status: e.target.value })}
            />
          )}
        </Field>
      </FilterBar>
      <Refreshing loading={missions.loading && Boolean(missions.data)} />
      <ResourceView resource={missions} loadingLabel="Chargement des missions…">
        {(data) => (
          <>
            <DataTable
              rows={data.items}
              columns={columns}
              rowKey={(m) => m.id}
              caption="Missions de votre entreprise"
              empty={
                active
                  ? {
                      title: 'Aucune mission ne correspond aux filtres',
                      description: 'Modifiez ou réinitialisez les filtres.',
                    }
                  : {
                      title: 'Aucune mission pour le moment',
                      description:
                        'Créez votre première mission : elle sera enregistrée en brouillon, puis soumise à la validation d’E-MPGT.',
                      action: (
                        <LinkButton href="/entreprise/missions/nouvelle">
                          Créer une mission
                        </LinkButton>
                      ),
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

export default function MissionsPage() {
  return (
    <>
      <PageHeader
        title="Mes missions"
        description="Une mission correspond à un poste. Préparez-la, soumettez-la à E-MPGT, puis suivez les candidatures reçues."
        breadcrumbs={[breadcrumbRoot, { label: 'Mes missions' }]}
        actions={<LinkButton href="/entreprise/missions/nouvelle">Nouvelle mission</LinkButton>}
      />
      <Suspense fallback={<LoadingBlock />}>
        <MissionsList />
      </Suspense>
    </>
  );
}
