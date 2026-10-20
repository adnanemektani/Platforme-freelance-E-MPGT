'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useState } from 'react';
import { labels, type DocumentView, type Page, type TimesheetView } from '@empgt/contracts';
import { formatDate, formatDateTime, formatMonth, formatNumber } from '@/lib/format';
import { useApi } from '@/lib/hooks';
import { ActionButton, can, PendingList } from '@/components/ui/actions';
import { Badge, StatusBadge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, DefinitionList } from '@/components/ui/card';
import { Alert, ResourceView } from '@/components/ui/feedback';
import { PageHeader } from '@/components/ui/page';
import { DeleteButton } from '@/components/freelancer/delete-button';
import { DisputeButton } from '@/components/freelancer/dispute';
import { DocumentList } from '@/components/freelancer/document-list';
import { DocumentUpload } from '@/components/freelancer/document-upload';
import { AmountsView } from '@/components/freelancer/terms';
import { TimesheetChecks, TimesheetEditor, TimesheetEntriesTable } from '@/components/freelancer/timesheet-editor';

function TimesheetDetail({ timesheet: t, onChange }: { timesheet: TimesheetView; onChange: (v: TimesheetView) => void }) {
  const router = useRouter();
  const [dirty, setDirty] = useState(false);
  const attachments = useApi<Page<DocumentView>>(`/documents?contractId=${t.contractId}&kind=TIMESHEET_ATTACHMENT&pageSize=100`);
  const editable = can(t.actions, 'edit');
  const month = formatMonth(t.periodStart);

  return (
    <>
      <PageHeader
        title={<span className="capitalize">CRA — {month}</span>}
        description={`${t.contractReference} · ${t.missionTitle} · ${t.companyName}`}
        breadcrumbs={[{ label: 'Activité / CRA', href: '/freelance/cra' }, { label: `${month} (v${t.version})` }]}
        badge={
          <>
            <StatusBadge status={t.status} label={labels.timesheetStatus[t.status]} />
            {t.version > 1 && <Badge tone="purple">Version {t.version}</Badge>}
          </>
        }
        actions={
          <>
            {dirty && can(t.actions, 'submit') ? (
              <div className="inline-flex flex-col">
                <Button disabled>Soumettre à validation</Button>
                <span className="mt-1 max-w-xs text-xs text-gray-600">Enregistrez d’abord vos modifications.</span>
              </div>
            ) : (
              <ActionButton<TimesheetView>
                actions={t.actions}
                action="submit"
                label="Soumettre à validation"
                endpoint={`/timesheets/${t.id}/submit`}
                confirm={{
                  title: 'Soumettre le CRA',
                  message: `Le CRA de ${month} (${formatNumber(t.totalHours)} h) sera transmis à l’entreprise pour validation. Vous ne pourrez plus le modifier, sauf si une correction est demandée.`,
                  confirmLabel: 'Soumettre',
                }}
                success="CRA soumis à l’entreprise"
                onDone={onChange}
              />
            )}
            <ActionButton<TimesheetView>
              actions={t.actions}
              action="correct"
              label="Corriger ce CRA validé"
              variant="secondary"
              endpoint={`/timesheets/${t.id}/correct`}
              reason="required"
              reasonLabel="Motif de la correction"
              confirm={{
                title: 'Ouvrir une correction',
                message: 'Une nouvelle version du CRA sera créée et soumise à nouveau à l’entreprise. La version validée reste en vigueur et consultable jusqu’à validation de la correction.',
                confirmLabel: 'Ouvrir la correction',
              }}
              success="Correction ouverte : modifiez la nouvelle version"
              onDone={(next) => router.push(`/freelance/cra/${next.id}`)}
            />
            <DeleteButton
              actions={t.actions}
              label="Supprimer le brouillon"
              size="md"
              endpoint={`/timesheets/${t.id}`}
              confirmTitle="Supprimer le brouillon de CRA"
              confirmMessage={`Le brouillon du CRA de ${month} et ses heures saisies seront supprimés.`}
              success="Brouillon supprimé"
              onDone={() => router.push('/freelance/cra')}
            />
          </>
        }
      />
      <div className="space-y-6">
        {t.correctionReason && (
          <Alert tone="info" title={`Version corrigée (v${t.version})`}>
            Motif de la correction : {t.correctionReason}
            {t.supersedesId && (
              <>
                {' '}
                —{' '}
                <Link href={`/freelance/cra/${t.supersedesId}`} className="font-medium underline">
                  voir la version précédente
                </Link>
              </>
            )}
          </Alert>
        )}
        {t.correctedById && (
          <Alert tone="info" title="Une correction de ce CRA existe">
            <Link href={`/freelance/cra/${t.correctedById}`} className="font-medium underline">
              Voir la version corrigée
            </Link>
          </Alert>
        )}
        {t.approvedOnBehalf && (
          <Alert tone="info" title="Validé par E-MPGT pour le compte de l’entreprise">
            {t.approvalReason}
          </Alert>
        )}
        <PendingList items={t.pending} />
        <TimesheetChecks checks={t.checks} />

        <div className="grid gap-6 lg:grid-cols-3">
          <Card title={editable ? 'Saisie des heures' : 'Heures déclarées'} className="lg:col-span-2">
            {editable ? (
              <TimesheetEditor key={t.updatedAt} timesheet={t} onSaved={onChange} onDirtyChange={setDirty} />
            ) : (
              <TimesheetEntriesTable timesheet={t} />
            )}
          </Card>
          <div className="space-y-6">
            <Card title="Récapitulatif">
              <DefinitionList
                columns={1}
                items={[
                  ['Contrat', <Link key="c" href={`/freelance/contrats/${t.contractId}`} className="text-brand-700 underline">{t.contractReference}</Link>],
                  ['Période', `Du ${formatDate(t.periodStart)} au ${formatDate(t.periodEnd)}`],
                  ['Saisie autorisée', t.allowedRange ? `Du ${formatDate(t.allowedRange.from)} au ${formatDate(t.allowedRange.to)}` : 'Aucune journée'],
                  ['Soumis le', formatDateTime(t.submittedAt)],
                  ['Validé le', formatDateTime(t.approvedAt)],
                  ...(t.changesRequestedAt
                    ? ([
                        ['Correction demandée le', formatDateTime(t.changesRequestedAt)],
                        ['Motif de la demande de l’entreprise', t.changesRequestedReason],
                      ] as Array<[string, React.ReactNode]>)
                    : []),
                ]}
              />
            </Card>
            <Card
              title="Montants"
              description={
                t.status === 'APPROVED' || t.status === 'SUPERSEDED'
                  ? 'Figés à la validation du CRA.'
                  : 'Aperçu calculé par le serveur sur les heures enregistrées ; définitif à la validation.'
              }
            >
              {t.amounts ? <AmountsView amounts={t.amounts} note="Un CRA validé ne vaut pas paiement." /> : <p className="text-sm text-gray-600">Montants indisponibles.</p>}
            </Card>
          </div>
        </div>

        <Card title="Pièces jointes" description="Justificatifs d’activité (feuilles d’émargement, bons d’intervention…) : visibles de l’entreprise et d’E-MPGT.">
          <div className="space-y-4">
            <ResourceView resource={attachments}>
              {(page) => (
                <DocumentList
                  documents={page.items.filter((d) => d.timesheetId === t.id)}
                  onChanged={() => void attachments.reload()}
                  emptyTitle="Aucune pièce jointe"
                />
              )}
            </ResourceView>
            <details className="rounded-md border border-gray-200 p-3">
              <summary className="cursor-pointer text-sm font-medium text-brand-800">Ajouter une pièce jointe</summary>
              <div className="mt-3">
                <DocumentUpload target="timesheet" targetId={t.id} kinds={['TIMESHEET_ATTACHMENT']} submitLabel="Joindre au CRA" onUploaded={() => void attachments.reload()} />
              </div>
            </details>
          </div>
        </Card>

        <div className="flex flex-wrap items-center gap-3 text-sm text-gray-700">
          <span>Un désaccord avec l’entreprise sur ce CRA ?</span>
          <DisputeButton contractId={t.contractId} subjectType="TIMESHEET" timesheetId={t.id} label="Signaler un désaccord à E-MPGT" />
        </div>
      </div>
    </>
  );
}

export default function FreelanceTimesheetPage() {
  const { id } = useParams<{ id: string }>();
  const timesheet = useApi<TimesheetView>(`/timesheets/${id}`);
  return <ResourceView resource={timesheet}>{(t) => <TimesheetDetail key={t.id} timesheet={t} onChange={timesheet.setData} />}</ResourceView>;
}
