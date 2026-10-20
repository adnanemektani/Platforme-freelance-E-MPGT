'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { labels, type TimesheetView } from '@empgt/contracts';
import { formatDate, formatDateTime, formatMonth, formatNumber } from '@/lib/format';
import { useApi } from '@/lib/hooks';
import { ActionButton, PendingList } from '@/components/ui/actions';
import { StatusBadge } from '@/components/ui/badge';
import { Card, DefinitionList } from '@/components/ui/card';
import { Alert, EmptyState, ResourceView } from '@/components/ui/feedback';
import { PageHeader } from '@/components/ui/page';
import { AmountsSummary } from '@/components/company/amounts';
import { breadcrumbRoot, hoursText } from '@/components/company/display';
import { DisputeSection } from '@/components/company/dispute-section';

function EntriesTable({ t }: { t: TimesheetView }) {
  if (t.entries.length === 0) return <EmptyState title="Aucune journée déclarée" />;
  return (
    <div className="overflow-x-auto rounded-lg border border-gray-200">
      <table className="min-w-full divide-y divide-gray-200 text-sm">
        <caption className="sr-only">Heures déclarées par date</caption>
        <thead className="bg-gray-50">
          <tr>
            <th
              scope="col"
              className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-gray-600"
            >
              Date
            </th>
            <th
              scope="col"
              className="px-4 py-2.5 text-right text-xs font-semibold uppercase tracking-wide text-gray-600"
            >
              Heures
            </th>
            <th
              scope="col"
              className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-gray-600"
            >
              Commentaire
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100 bg-white">
          {t.entries.map((e) => (
            <tr key={e.id}>
              <td className="whitespace-nowrap px-4 py-2">{formatDate(e.date)}</td>
              <td className="whitespace-nowrap px-4 py-2 text-right tabular-nums">
                {formatNumber(e.hours)}
              </td>
              <td className="px-4 py-2 text-gray-700">{e.comment ?? ''}</td>
            </tr>
          ))}
        </tbody>
        <tfoot className="bg-gray-50 font-semibold">
          <tr>
            <th scope="row" className="px-4 py-2 text-left">
              Total
            </th>
            <td className="px-4 py-2 text-right tabular-nums">{formatNumber(t.totalHours)}</td>
            <td className="px-4 py-2 text-xs font-normal text-gray-600">
              {t.entries.length} journée(s)
            </td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

export default function CraDetailPage() {
  const { id } = useParams<{ id: string }>();
  const timesheet = useApi<TimesheetView>(`/timesheets/${id}`);

  return (
    <ResourceView resource={timesheet} loadingLabel="Chargement du CRA…">
      {(t) => {
        const period = formatMonth(t.periodStart);
        return (
          <>
            <PageHeader
              title={`CRA de ${period}`}
              description={
                <>
                  {t.freelancerName} · contrat{' '}
                  <Link
                    href={`/entreprise/contrats/${t.contractId}`}
                    className="font-medium text-brand-700 underline"
                  >
                    {t.contractReference}
                  </Link>{' '}
                  · {t.missionTitle}
                </>
              }
              breadcrumbs={[
                breadcrumbRoot,
                { label: 'CRA', href: '/entreprise/cra' },
                { label: `${period} — ${t.contractReference}` },
              ]}
              badge={<StatusBadge status={t.status} label={labels.timesheetStatus[t.status]} />}
              actions={
                <>
                  <ActionButton<TimesheetView>
                    actions={t.actions}
                    action="approve"
                    label="Valider le CRA"
                    endpoint={`/timesheets/${id}/approve`}
                    variant="success"
                    confirm={{
                      title: 'Valider le CRA',
                      message: (
                        <div className="space-y-2">
                          <p>
                            Vous confirmez les <strong>{hoursText(t.totalHours)}</strong> déclarées
                            pour {period}.
                          </p>
                          <p>
                            Un CRA validé ne vaut pas paiement : la facturation et les règlements
                            sont suivis séparément.
                          </p>
                        </div>
                      ),
                      confirmLabel: 'Valider',
                    }}
                    success="CRA validé"
                    onDone={timesheet.setData}
                  />
                  <ActionButton<TimesheetView>
                    actions={t.actions}
                    action="requestChanges"
                    label="Demander une correction"
                    endpoint={`/timesheets/${id}/request-changes`}
                    variant="secondary"
                    reason="required"
                    reasonLabel="Motif de la correction (communiqué au freelance)"
                    confirm={{
                      title: 'Demander une correction',
                      message:
                        'Le CRA est renvoyé au freelance pour correction puis nouvelle soumission.',
                      confirmLabel: 'Demander la correction',
                    }}
                    success="Correction demandée au freelance"
                    onDone={timesheet.setData}
                  />
                </>
              }
            />
            <div className="space-y-6">
              <Alert tone="info">
                Un CRA validé ne vaut pas paiement : la facturation et les règlements sont suivis
                séparément.
              </Alert>
              <PendingList items={t.pending} />
              {t.approvedOnBehalf && (
                <Alert tone="warning" title="Validé par E-MPGT à votre place">
                  <p>
                    {t.approvalReason ? `Motif : ${t.approvalReason}` : 'Aucun motif communiqué.'}
                  </p>
                </Alert>
              )}
              {t.checks.length > 0 && (
                <Card
                  title="Contrôles de cohérence"
                  description="Points relevés automatiquement par la plateforme."
                >
                  <ul className="space-y-2">
                    {t.checks.map((c, i) => (
                      <li
                        key={`${c.code}-${c.date ?? i}`}
                        className={`rounded-md border p-2 text-sm ${c.level === 'error' ? 'border-red-200 bg-red-50 text-red-800' : 'border-amber-200 bg-amber-50 text-amber-900'}`}
                      >
                        <span className="font-medium">
                          {c.level === 'error' ? 'Bloquant' : 'Avertissement'} :{' '}
                        </span>
                        {c.message}
                      </li>
                    ))}
                  </ul>
                </Card>
              )}

              <Card
                title="Détail des heures"
                description={`Période du ${formatDate(t.periodStart)} au ${formatDate(t.periodEnd)}.`}
              >
                <div className="space-y-4">
                  <EntriesTable t={t} />
                  {t.freelancerComment && (
                    <div>
                      <h3 className="text-sm font-semibold text-gray-900">
                        Commentaire du freelance
                      </h3>
                      <p className="mt-1 whitespace-pre-line text-sm text-gray-800">
                        {t.freelancerComment}
                      </p>
                    </div>
                  )}
                </div>
              </Card>

              <div className="grid gap-6 lg:grid-cols-2">
                <Card
                  title="Montants"
                  description={
                    t.status === 'APPROVED'
                      ? 'Montants figés à la validation.'
                      : 'Estimation sur les heures déclarées.'
                  }
                >
                  {t.amounts ? (
                    <AmountsSummary amounts={t.amounts} />
                  ) : (
                    <p className="text-sm text-gray-600">Montants non disponibles pour ce CRA.</p>
                  )}
                </Card>
                <Card title="Historique">
                  <DefinitionList
                    columns={1}
                    items={[
                      [
                        'Version',
                        t.version > 1 ? `${t.version} (version corrigée)` : String(t.version),
                      ],
                      ['Soumis le', t.submittedAt ? formatDateTime(t.submittedAt) : null],
                      [
                        'Correction demandée le',
                        t.changesRequestedAt ? formatDateTime(t.changesRequestedAt) : null,
                      ],
                      ['Motif de la correction demandée', t.changesRequestedReason],
                      ['Validé le', t.approvedAt ? formatDateTime(t.approvedAt) : null],
                      [
                        'Validé par',
                        t.approvedAt
                          ? t.approvedOnBehalf
                            ? 'E-MPGT, à la place de votre entreprise'
                            : 'Votre entreprise'
                          : null,
                      ],
                      ['Motif de la version corrigée', t.correctionReason],
                    ]}
                  />
                  <div className="mt-4 flex flex-wrap gap-3 text-sm">
                    {t.supersedesId && (
                      <Link
                        href={`/entreprise/cra/${t.supersedesId}`}
                        className="font-medium text-brand-700 underline"
                      >
                        Voir la version précédente
                      </Link>
                    )}
                    {t.correctedById && (
                      <Link
                        href={`/entreprise/cra/${t.correctedById}`}
                        className="font-medium text-brand-700 underline"
                      >
                        Voir la version corrigée
                      </Link>
                    )}
                  </div>
                </Card>
              </div>

              <DisputeSection contractId={t.contractId} timesheetId={t.id} />
            </div>
          </>
        );
      }}
    </ResourceView>
  );
}
