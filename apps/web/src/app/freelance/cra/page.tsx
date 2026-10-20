'use client';

import Link from 'next/link';
import { useState } from 'react';
import { labels, TimesheetStatus, type ContractListItem, type Page, type TimesheetListItem } from '@empgt/contracts';
import { qs } from '@/lib/api';
import { formatDateTime, formatMonth, formatNumber } from '@/lib/format';
import { useApi } from '@/lib/hooks';
import { StatusBadge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { ResourceView } from '@/components/ui/feedback';
import { Field, optionsFrom, Select } from '@/components/ui/form';
import { PageHeader } from '@/components/ui/page';
import { DataTable, Pagination, type Column } from '@/components/ui/table';
import { OpenTimesheetForm } from '@/components/freelancer/open-timesheet';

const columns: Column<TimesheetListItem>[] = [
  {
    header: 'Période',
    cell: (t) => (
      <Link href={`/freelance/cra/${t.id}`} className="font-medium capitalize text-brand-800 underline">
        {formatMonth(t.periodStart)}
      </Link>
    ),
  },
  {
    header: 'Contrat',
    cell: (t) => (
      <span>
        {t.contractReference}
        <span className="block text-xs text-gray-500">{t.missionTitle}</span>
      </span>
    ),
  },
  { header: 'Entreprise', cell: (t) => t.companyName },
  { header: 'Version', cell: (t) => `v${t.version}` },
  { header: 'Statut', cell: (t) => <StatusBadge status={t.status} label={labels.timesheetStatus[t.status]} /> },
  { header: 'Heures', cell: (t) => `${formatNumber(t.totalHours)} h` },
  { header: 'Soumis le', cell: (t) => formatDateTime(t.submittedAt) },
];

function OpenTimesheetCard() {
  const contracts = useApi<Page<ContractListItem>>('/contracts?status=ACTIVE&pageSize=100');
  return (
    <Card title="Ouvrir un CRA" description="Choisissez la mission active et le mois concerné (le mois en cours par défaut).">
      <ResourceView resource={contracts}>
        {(page) =>
          page.items.length === 0 ? (
            <p className="text-sm text-gray-600">Aucune mission active : la saisie des CRA s’ouvre lorsque E-MPGT active la mission après dépôt du contrat signé.</p>
          ) : (
            <OpenTimesheetForm contracts={page.items.map((c) => ({ id: c.id, label: `${c.reference} — ${c.missionTitle} (${c.companyName})` }))} />
          )
        }
      </ResourceView>
    </Card>
  );
}

export default function FreelanceTimesheetsPage() {
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const resource = useApi<Page<TimesheetListItem>>(`/timesheets${qs({ status, page })}`);

  return (
    <>
      <PageHeader
        title="Activité / CRA"
        description="Comptes rendus d’activité mensuels : saisie des heures, soumission à l’entreprise, corrections. Un CRA validé ne vaut pas paiement."
      />
      <div className="space-y-6">
        <OpenTimesheetCard />
        <section aria-labelledby="mes-cra" className="space-y-3">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <h2 id="mes-cra" className="text-base font-semibold text-gray-900">
              Mes CRA
            </h2>
            <div className="w-full max-w-xs">
              <Field label="Filtrer par statut">
                {(p) => (
                  <Select
                    {...p}
                    value={status}
                    placeholder="Tous les statuts"
                    options={optionsFrom(TimesheetStatus, labels.timesheetStatus)}
                    onChange={(e) => {
                      setStatus(e.target.value);
                      setPage(1);
                    }}
                  />
                )}
              </Field>
            </div>
          </div>
          <ResourceView resource={resource}>
            {(data) => (
              <>
                <DataTable
                  rows={data.items}
                  columns={columns}
                  rowKey={(t) => t.id}
                  caption="Mes comptes rendus d’activité"
                  empty={{ title: 'Aucun CRA', description: 'Ouvrez le CRA du mois depuis une mission active.' }}
                />
                <Pagination page={data} onChange={setPage} />
              </>
            )}
          </ResourceView>
        </section>
      </div>
    </>
  );
}
