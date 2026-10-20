'use client';

import Link from 'next/link';
import { labels, type TimesheetListItem } from '@empgt/contracts';
import { formatDateTime, formatMonth } from '@/lib/format';
import { StatusBadge } from '@/components/ui/badge';
import { DataTable, type Column } from '@/components/ui/table';
import { hoursText } from './display';

export function TimesheetTable({
  timesheets,
  showContract = true,
  empty,
}: {
  timesheets: TimesheetListItem[];
  showContract?: boolean;
  empty?: { title: string; description?: string };
}) {
  const columns: Column<TimesheetListItem>[] = [
    {
      header: 'Période',
      cell: (t) => (
        <span className="inline-flex flex-col items-end md:items-start">
          <Link
            href={`/entreprise/cra/${t.id}`}
            className="font-medium capitalize text-brand-700 hover:underline"
          >
            {formatMonth(t.periodStart)}
          </Link>
          {t.version > 1 && (
            <span className="text-xs text-gray-500">Version {t.version} (correction)</span>
          )}
        </span>
      ),
    },
    ...(showContract
      ? [
          {
            header: 'Contrat',
            cell: (t: TimesheetListItem) => (
              <span className="inline-flex flex-col items-end md:items-start">
                <span>{t.contractReference}</span>
                <span className="text-xs text-gray-500">{t.missionTitle}</span>
              </span>
            ),
          },
          { header: 'Freelance', cell: (t: TimesheetListItem) => t.freelancerName },
        ]
      : []),
    {
      header: 'Statut',
      cell: (t) => <StatusBadge status={t.status} label={labels.timesheetStatus[t.status]} />,
    },
    { header: 'Total', cell: (t) => hoursText(t.totalHours) },
    { header: 'Soumis le', cell: (t) => (t.submittedAt ? formatDateTime(t.submittedAt) : '—') },
  ];
  return (
    <DataTable
      rows={timesheets}
      columns={columns}
      rowKey={(t) => t.id}
      caption="Comptes rendus d’activité"
      empty={empty ?? { title: 'Aucun CRA' }}
    />
  );
}
