'use client';

import { Suspense } from 'react';
import { labels, TimesheetStatus, type Page, type TimesheetListItem } from '@empgt/contracts';
import { qs } from '@/lib/api';
import { useApi } from '@/lib/hooks';
import { Alert, LoadingBlock, ResourceView } from '@/components/ui/feedback';
import { Field, optionsFrom, Select } from '@/components/ui/form';
import { PageHeader, Tabs } from '@/components/ui/page';
import { Pagination } from '@/components/ui/table';
import { breadcrumbRoot } from '@/components/company/display';
import { useQueryFilters } from '@/components/company/query-filters';
import { TimesheetTable } from '@/components/company/timesheet-table';
import { Refreshing } from '@/components/company/widgets';

const statusOptions = optionsFrom(TimesheetStatus, labels.timesheetStatus);

function TimesheetsList() {
  const { values, page, update } = useQueryFilters(['tab', 'status'] as const);
  const all = values.tab === 'tous';
  const status = all ? values.status : 'SUBMITTED';
  const timesheets = useApi<Page<TimesheetListItem>>(
    `/timesheets${qs({ status, page, pageSize: 20 })}`,
  );
  // Compteur de l'onglet « À valider » : la liste affichée le fournit déjà sur cet onglet.
  const toValidate = useApi<Page<TimesheetListItem>>(
    all ? `/timesheets${qs({ status: 'SUBMITTED', pageSize: 1 })}` : null,
  );
  const toValidateCount = all ? toValidate.data?.total : timesheets.data?.total;

  return (
    <>
      <Tabs
        tabs={[
          { id: 'a-valider', label: 'À valider', count: toValidateCount },
          { id: 'tous', label: 'Tous les CRA' },
        ]}
        current={all ? 'tous' : 'a-valider'}
        onChange={(tab) => update({ tab: tab === 'tous' ? 'tous' : null, status: null })}
      />
      {all && (
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
      )}
      <Refreshing loading={timesheets.loading && Boolean(timesheets.data)} />
      <ResourceView resource={timesheets} loadingLabel="Chargement des CRA…">
        {(data) => (
          <>
            <TimesheetTable
              timesheets={data.items}
              empty={
                all
                  ? {
                      title: 'Aucun CRA',
                      description: 'Les CRA soumis par vos freelances apparaîtront ici.',
                    }
                  : {
                      title: 'Aucun CRA à valider',
                      description: 'Vous serez notifié lorsqu’un freelance soumettra son CRA.',
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

export default function CraPage() {
  return (
    <>
      <PageHeader
        title="Comptes rendus d’activité"
        description="Validez les heures déclarées par vos freelances ou demandez une correction motivée."
        breadcrumbs={[breadcrumbRoot, { label: 'CRA' }]}
      />
      <div className="mb-4">
        <Alert tone="info">
          Un CRA validé ne vaut pas paiement : la facturation et les règlements sont suivis
          séparément, dans « Factures et règlements ».
        </Alert>
      </div>
      <Suspense fallback={<LoadingBlock />}>
        <TimesheetsList />
      </Suspense>
    </>
  );
}
