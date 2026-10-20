'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import { labels, WorkMode, type MissionListItem, type OwnProfileView, type Page } from '@empgt/contracts';
import { qs } from '@/lib/api';
import { useApi } from '@/lib/hooks';
import { findAction } from '@/components/ui/actions';
import { Button } from '@/components/ui/button';
import { Alert, EmptyState, LoadingBlock, ResourceView } from '@/components/ui/feedback';
import { Field, Input, optionsFrom, Select } from '@/components/ui/form';
import { PageHeader } from '@/components/ui/page';
import { Pagination } from '@/components/ui/table';
import { MissionCard } from '@/components/freelancer/mission-card';

const FILTERS = ['q', 'city', 'country', 'skill', 'workMode', 'startFrom'] as const;

function MissionSearch() {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const filters = Object.fromEntries(FILTERS.map((f) => [f, params.get(f) ?? ''])) as Record<(typeof FILTERS)[number], string>;
  const page = Number(params.get('page') ?? '1') || 1;
  const missions = useApi<Page<MissionListItem>>(`/missions${qs({ ...filters, page, pageSize: 12 })}`);
  const profile = useApi<OwnProfileView>('/profile');
  const apply = findAction(profile.data?.actions, 'apply');
  const navigate = (next: Record<string, string | number>) => router.replace(`${pathname}${qs(next)}`, { scroll: false });

  return (
    <>
      {apply && !apply.allowed && (
        <div className="mb-4">
          <Alert tone="warning" title="Candidature pas encore possible">
            {apply.reason}
          </Alert>
        </div>
      )}
      <form
        key={params.toString()}
        role="search"
        aria-label="Rechercher une mission"
        className="mb-6 grid gap-3 rounded-lg border border-gray-200 bg-white p-4 sm:grid-cols-2 lg:grid-cols-6"
        onSubmit={(e) => {
          e.preventDefault();
          const form = new FormData(e.currentTarget);
          navigate(Object.fromEntries(FILTERS.map((f) => [f, String(form.get(f) ?? '').trim()])));
        }}
      >
        <div className="sm:col-span-2">
          <Field label="Mot-clé">{(p) => <Input {...p} name="q" defaultValue={filters.q} placeholder="Métier, référence, compétence…" />}</Field>
        </div>
        <Field label="Ville">{(p) => <Input {...p} name="city" defaultValue={filters.city} />}</Field>
        <Field label="Pays (code ISO)">
          {(p) => <Input {...p} name="country" defaultValue={filters.country} maxLength={2} placeholder="FR" className="uppercase" />}
        </Field>
        <Field label="Compétence">{(p) => <Input {...p} name="skill" defaultValue={filters.skill} placeholder="Ex. Revit" />}</Field>
        <Field label="Modalité">
          {(p) => <Select {...p} name="workMode" defaultValue={filters.workMode} placeholder="Toutes" options={optionsFrom(WorkMode, labels.workMode)} />}
        </Field>
        <Field label="Début à partir du">{(p) => <Input {...p} name="startFrom" type="date" defaultValue={filters.startFrom} />}</Field>
        <div className="flex items-end gap-2 sm:col-span-2 lg:col-span-5 lg:justify-end">
          <Button type="button" variant="ghost" onClick={() => navigate({})}>
            Réinitialiser
          </Button>
          <Button type="submit">Rechercher</Button>
        </div>
      </form>

      <ResourceView resource={missions} loadingLabel="Recherche des missions…">
        {(data) =>
          data.items.length === 0 ? (
            <EmptyState
              title="Aucune mission ne correspond"
              description="Seules les missions validées par E-MPGT et ouvertes aux candidatures apparaissent ici. Élargissez vos critères."
            />
          ) : (
            <>
              <p className="mb-3 text-sm text-gray-600" aria-live="polite">
                {data.total} mission(s) ouverte(s)
              </p>
              <ul className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {data.items.map((m) => (
                  <MissionCard key={m.id} mission={m} />
                ))}
              </ul>
              <Pagination page={data} onChange={(p) => navigate({ ...filters, page: p })} />
            </>
          )
        }
      </ResourceView>
    </>
  );
}

export default function FreelanceMissionsPage() {
  return (
    <>
      <PageHeader title="Missions" description="Missions publiées par les entreprises du BTP et validées par E-MPGT." />
      <Suspense fallback={<LoadingBlock />}>
        <MissionSearch />
      </Suspense>
    </>
  );
}
