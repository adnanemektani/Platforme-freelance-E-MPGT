'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { labels, type DisputeView, type TimesheetView } from '@empgt/contracts';
import { formatDate, formatDateTime, formatMonth, formatNumber } from '@/lib/format';
import { useApi } from '@/lib/hooks';
import { ActionButton, PendingList } from '@/components/ui/actions';
import { Badge, StatusBadge } from '@/components/ui/badge';
import { Card, DefinitionList } from '@/components/ui/card';
import { Alert, ResourceView } from '@/components/ui/feedback';
import { PageHeader } from '@/components/ui/page';
import { DataTable } from '@/components/ui/table';
import { adminPending, BAmountBreakdown, BText } from '@/components/admin/b-common';
import { BResolveDisputeDialog } from '@/components/admin/b-documents';

export default function AdminTimesheetPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const timesheet = useApi<TimesheetView>(`/timesheets/${id}`);
  const disputes = useApi<DisputeView[]>('/disputes');

  return (
    <ResourceView resource={timesheet}>
      {(t) => {
        const related = (disputes.data ?? []).filter((d) => d.timesheetId === t.id);
        const errors = t.checks.filter((c) => c.level === 'error');
        const warnings = t.checks.filter((c) => c.level === 'warning');
        return (
          <>
            <PageHeader
              breadcrumbs={[{ label: 'CRA et litiges', href: '/admin/cra' }, { label: `${t.contractReference} — ${formatMonth(t.periodStart)}` }]}
              title={`CRA ${formatMonth(t.periodStart)} — version ${t.version}`}
              badge={
                <span className="flex flex-wrap gap-1.5">
                  <StatusBadge status={t.status} label={labels.timesheetStatus[t.status]} />
                  {t.approvedOnBehalf && <Badge tone="purple">Validé par E-MPGT à la place du client</Badge>}
                </span>
              }
              description={
                <>
                  <Link href={`/admin/contrats/${t.contractId}`} className="text-brand-700 underline">
                    {t.contractReference}
                  </Link>{' '}
                  · {t.missionTitle} · {t.companyName} · {t.freelancerName}
                </>
              }
              actions={
                <>
                  <ActionButton<TimesheetView>
                    actions={t.actions}
                    action="approve"
                    label="Valider à la place du client"
                    variant="success"
                    endpoint={`/timesheets/${id}/approve`}
                    reason="required"
                    reasonLabel="Motif de la validation par E-MPGT"
                    confirm={{
                      title: 'Valider le CRA à la place du client',
                      message: 'Cette validation est tracée comme effectuée par E-MPGT à la place de l’entreprise cliente ; les montants sont figés. Elle ne constitue pas un paiement.',
                    }}
                    success="CRA validé (à la place du client)"
                    onDone={timesheet.setData}
                  />
                  <ActionButton<TimesheetView>
                    actions={t.actions}
                    action="requestChanges"
                    label="Demander une correction"
                    variant="secondary"
                    endpoint={`/timesheets/${id}/request-changes`}
                    reason="required"
                    reasonLabel="Correction attendue"
                    success="Correction demandée au freelance"
                    onDone={timesheet.setData}
                  />
                  <ActionButton<TimesheetView>
                    actions={t.actions}
                    action="correct"
                    label="Ouvrir une correction"
                    variant="danger"
                    endpoint={`/timesheets/${id}/correct`}
                    reason="required"
                    reasonLabel="Motif de la correction"
                    confirm={{ title: 'Corriger un CRA validé', message: 'Une nouvelle version du CRA est créée (brouillon à compléter par le freelance puis à valider). La version validée reste en vigueur jusqu’à la validation de la correction.' }}
                    success="Version corrigée créée"
                    onDone={(next) => router.push(`/admin/cra/${next.id}`)}
                  />
                </>
              }
            />

            <div className="space-y-6">
              <PendingList items={adminPending(t.pending)} />

              {(t.supersedesId || t.correctedById) && (
                <Alert tone="info" title="Versions du CRA">
                  <ul className="space-y-1">
                    {t.supersedesId && (
                      <li>
                        Cette version corrige une version précédente :{' '}
                        <Link href={`/admin/cra/${t.supersedesId}`} className="font-medium underline">
                          voir la version {t.version - 1}
                        </Link>
                        {t.correctionReason && <> — motif : {t.correctionReason}</>}
                      </li>
                    )}
                    {t.correctedById && (
                      <li>
                        Une version corrigée existe :{' '}
                        <Link href={`/admin/cra/${t.correctedById}`} className="font-medium underline">
                          voir la version corrigée
                        </Link>
                      </li>
                    )}
                  </ul>
                </Alert>
              )}
              {t.changesRequestedReason && (
                <Alert tone="warning" title={`Correction demandée le ${formatDateTime(t.changesRequestedAt)}`}>
                  <p className="whitespace-pre-line">{t.changesRequestedReason}</p>
                </Alert>
              )}
              {errors.length > 0 && (
                <Alert tone="danger" title="Contrôles bloquants">
                  <ul className="list-disc pl-5">
                    {errors.map((c) => (
                      <li key={c.code + (c.date ?? '')}>
                        {c.date && `${formatDate(c.date)} : `}
                        {c.message}
                      </li>
                    ))}
                  </ul>
                </Alert>
              )}
              {warnings.length > 0 && (
                <Alert tone="warning" title="Avertissements">
                  <ul className="list-disc pl-5">
                    {warnings.map((c) => (
                      <li key={c.code + (c.date ?? '')}>
                        {c.date && `${formatDate(c.date)} : `}
                        {c.message}
                      </li>
                    ))}
                  </ul>
                </Alert>
              )}

              <div className="grid gap-6 lg:grid-cols-3">
                <Card title="Saisie" description={`Total : ${formatNumber(t.totalHours)} h`} className="lg:col-span-2">
                  <div className="space-y-4">
                    <DataTable
                      rows={[...t.entries].sort((a, b) => a.date.localeCompare(b.date))}
                      rowKey={(e) => e.id}
                      caption="Lignes du CRA"
                      empty={{ title: 'Aucune ligne saisie' }}
                      columns={[
                        { header: 'Date', cell: (e) => formatDate(e.date) },
                        { header: 'Heures', cell: (e) => `${formatNumber(e.hours)} h` },
                        { header: 'Commentaire', cell: (e) => e.comment ?? '—' },
                      ]}
                    />
                    <p className="text-right text-sm font-semibold text-gray-900">Total : {formatNumber(t.totalHours)} h</p>
                    {t.freelancerComment && (
                      <div>
                        <h3 className="text-sm font-semibold text-gray-900">Commentaire du freelance</h3>
                        <BText value={t.freelancerComment} />
                      </div>
                    )}
                  </div>
                </Card>
                <Card title="Suivi">
                  <DefinitionList
                    columns={1}
                    items={[
                      ['Période', `${formatDate(t.periodStart)} → ${formatDate(t.periodEnd)}`],
                      ['Saisie autorisée', t.allowedRange ? `${formatDate(t.allowedRange.from)} → ${formatDate(t.allowedRange.to)}` : null],
                      ['Soumis le', formatDateTime(t.submittedAt)],
                      ['Validé le', formatDateTime(t.approvedAt)],
                      ['Validation', t.approvedAt ? (t.approvedOnBehalf ? 'Par E-MPGT, à la place du client' : 'Par l’entreprise cliente') : null],
                      ['Motif de validation', t.approvalReason],
                      ['Motif de correction', t.correctionReason],
                      ['Créé le', formatDateTime(t.createdAt)],
                      ['Mise à jour', formatDateTime(t.updatedAt)],
                    ]}
                  />
                </Card>
              </div>

              <Card
                title="Montants"
                description={t.status === 'APPROVED' || t.status === 'SUPERSEDED' ? 'Montants figés à la validation.' : 'Montants calculés sur la saisie actuelle (indicatifs tant que le CRA n’est pas validé).'}
              >
                <BAmountBreakdown amounts={t.amounts} empty="Montants non calculables : conditions du contrat incomplètes ou saisie vide." />
              </Card>

              {related.length > 0 && (
                <Card title="Litiges liés à ce CRA">
                  <ul className="divide-y divide-gray-100">
                    {related.map((d) => (
                      <li key={d.id} className="flex flex-wrap items-start justify-between gap-3 py-3">
                        <div className="min-w-0">
                          <p className="flex items-center gap-2 text-sm font-medium text-gray-900">
                            <StatusBadge status={d.status === 'OPEN' ? 'OPEN_DISPUTE' : d.status} label={labels.disputeStatus[d.status]} />
                            Ouvert par {d.openedByName} le {formatDateTime(d.createdAt)}
                          </p>
                          <p className="mt-1 whitespace-pre-line text-sm text-gray-700">{d.reason}</p>
                          {d.resolution && <p className="mt-1 text-sm text-gray-600">Résolution : {d.resolution}</p>}
                        </div>
                        <BResolveDisputeDialog dispute={d} onDone={() => void disputes.reload()} />
                      </li>
                    ))}
                  </ul>
                </Card>
              )}
            </div>
          </>
        );
      }}
    </ResourceView>
  );
}
