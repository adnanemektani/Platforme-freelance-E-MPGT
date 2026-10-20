'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import {
  labels,
  type ContractView,
  type DisputeView,
  type DocumentView,
  type InvoiceListItem,
  type Page,
  type TimesheetListItem,
} from '@empgt/contracts';
import { documentUrl } from '@/lib/api';
import { formatDate, formatDateTime, formatMoney, formatMonth, formatNumber } from '@/lib/format';
import { useApi } from '@/lib/hooks';
import { PendingList } from '@/components/ui/actions';
import { StatusBadge } from '@/components/ui/badge';
import { Card, DefinitionList } from '@/components/ui/card';
import { Alert, EmptyState, ResourceView } from '@/components/ui/feedback';
import { PageHeader } from '@/components/ui/page';
import { DataTable, type Column } from '@/components/ui/table';
import { DisputeButton, DisputeList } from '@/components/freelancer/dispute';
import { DocumentList } from '@/components/freelancer/document-list';
import { DocumentUpload } from '@/components/freelancer/document-upload';
import { perUnit } from '@/components/freelancer/helpers';
import { OpenTimesheetForm } from '@/components/freelancer/open-timesheet';
import { ContractReview } from '@/components/freelancer/review';
import { TermsList } from '@/components/freelancer/terms';

const timesheetColumns: Column<TimesheetListItem>[] = [
  {
    header: 'Période',
    cell: (t) => (
      <Link href={`/freelance/cra/${t.id}`} className="font-medium capitalize text-brand-800 underline">
        {formatMonth(t.periodStart)}
      </Link>
    ),
  },
  { header: 'Version', cell: (t) => `v${t.version}` },
  { header: 'Statut', cell: (t) => <StatusBadge status={t.status} label={labels.timesheetStatus[t.status]} /> },
  { header: 'Heures', cell: (t) => `${formatNumber(t.totalHours)} h` },
  { header: 'Soumis le', cell: (t) => formatDateTime(t.submittedAt) },
];

function ContractDetail({ contract: c }: { contract: ContractView }) {
  const timesheets = useApi<Page<TimesheetListItem>>(`/timesheets?contractId=${c.id}&pageSize=100`);
  const invoices = useApi<Page<InvoiceListItem>>(`/invoices?contractId=${c.id}&pageSize=100`);
  const documents = useApi<Page<DocumentView>>(`/documents?contractId=${c.id}&pageSize=100`);
  const disputes = useApi<DisputeView[]>('/disputes');
  const contractDisputes = (disputes.data ?? []).filter((d) => d.contractId === c.id);

  return (
    <>
      <PageHeader
        title={`Contrat ${c.reference}`}
        description={`${c.missionTitle} — ${c.companyName}`}
        breadcrumbs={[{ label: 'Contrats', href: '/freelance/contrats' }, { label: c.reference }]}
        badge={<StatusBadge status={c.status} label={labels.contractStatus[c.status]} />}
      />
      <div className="space-y-6">
        <PendingList items={c.pending} />
        {c.statusReason && c.status !== 'SUSPENDED' && (
          <Alert tone={c.status === 'TERMINATED' || c.status === 'CANCELLED' ? 'warning' : 'info'} title="Motif communiqué par E-MPGT">
            {c.statusReason}
          </Alert>
        )}

        <div className="grid gap-6 lg:grid-cols-3">
          <Card title="Conditions figées" description="Conditions validées par E-MPGT et figées à la création du contrat ; seul un avenant signé les modifie." className="lg:col-span-2">
            <div className="space-y-4">
              <DefinitionList
                items={[
                  ['Mission', `${c.missionReference} — ${c.missionTitle}`],
                  ['Entreprise cliente', c.companyName],
                  ['Début', formatDate(c.startDate)],
                  ['Fin initiale', formatDate(c.endDate)],
                  ['Fin en vigueur (avenants compris)', formatDate(c.currentEndDate)],
                  ['Mission activée le', formatDateTime(c.activatedAt)],
                ]}
              />
              <hr className="border-gray-100" />
              <TermsList terms={c} />
              <p className="break-all text-xs text-gray-500">
                Empreinte des conditions : <code>{c.termsHash}</code> — elle permet de vérifier que les conditions n’ont pas été modifiées depuis leur validation.
              </p>
            </div>
          </Card>
          <Card title="Contrat signé">
            {c.signedDocumentId ? (
              <div className="space-y-3">
                <DefinitionList
                  columns={1}
                  items={[
                    ['Signé le', formatDate(c.signedAt)],
                    ['Preuve de signature', c.signatureProofNote],
                    ['Enregistré par E-MPGT le', formatDateTime(c.signatureRecordedAt)],
                  ]}
                />
                <div className="flex flex-wrap gap-2">
                  <a href={documentUrl(c.signedDocumentId)} className="rounded-md bg-brand-700 px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-800">
                    Télécharger le contrat signé
                  </a>
                  <a
                    href={documentUrl(c.signedDocumentId, true)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="rounded-md px-3 py-1.5 text-sm font-medium text-brand-700 hover:bg-brand-50"
                  >
                    Aperçu<span className="sr-only"> (nouvel onglet)</span>
                  </a>
                </div>
              </div>
            ) : (
              <p className="text-sm text-gray-700">
                Le contrat signé n’a pas encore été déposé. Les signatures sont recueillies hors plateforme, puis E-MPGT enregistre le document signé : la plateforme
                n’intègre pas de signature électronique.
              </p>
            )}
          </Card>
        </div>

        <Card title="Avenants">
          {c.amendments.length === 0 ? (
            <p className="text-sm text-gray-600">Aucun avenant.</p>
          ) : (
            <ul className="divide-y divide-gray-100">
              {c.amendments.map((a) => (
                <li key={a.id} className="space-y-2 py-3 text-sm">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold text-gray-900">
                      Avenant n° {a.number} — {labels.amendmentType[a.type]}
                    </span>
                    <StatusBadge status={a.status} label={labels.amendmentStatus[a.status]} />
                    <span className="text-xs text-gray-500">Effet au {formatDate(a.effectiveDate)}</span>
                  </div>
                  <p className="text-gray-700">{a.reason}</p>
                  <DefinitionList
                    columns={3}
                    items={[
                      ['Nouvelle date de fin', a.newEndDate ? formatDate(a.newEndDate) : null],
                      ['Nouveau tarif freelance', a.newFreelanceRate ? `${formatMoney(a.newFreelanceRate, c.currency)} ${perUnit(c.billingUnit)}` : null],
                      ['Nouvelle journée de référence', a.newHoursPerDay ? `${formatNumber(a.newHoursPerDay)} h` : null],
                      ['Autres modifications', a.otherChanges],
                      ['Signé le', formatDate(a.signedAt)],
                      ['Motif d’état', a.statusReason],
                    ]}
                  />
                  {a.signedDocumentId && (
                    <a href={documentUrl(a.signedDocumentId)} className="inline-block font-medium text-brand-700 underline">
                      Télécharger l’avenant signé n° {a.number}
                    </a>
                  )}
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card title="Activité / CRA" description="Un CRA par mois : vous saisissez les heures réellement travaillées, l’entreprise les valide.">
          <div className="space-y-4">
            {c.status === 'ACTIVE' ? (
              <OpenTimesheetForm contractId={c.id} submitLabel="Ouvrir le CRA du mois" />
            ) : (
              <Alert tone="info">La saisie des CRA est ouverte lorsque la mission est active (état actuel : {labels.contractStatus[c.status].toLowerCase()}).</Alert>
            )}
            <ResourceView resource={timesheets}>
              {(page) => (
                <DataTable
                  rows={page.items}
                  columns={timesheetColumns}
                  rowKey={(t) => t.id}
                  caption="CRA du contrat"
                  empty={{ title: 'Aucun CRA', description: 'Ouvrez le CRA du mois pour saisir vos heures.' }}
                />
              )}
            </ResourceView>
          </div>
        </Card>

        <Card title="Documents partagés" description="Documents rattachés au contrat : visibles des parties au contrat et d’E-MPGT.">
          <div className="space-y-4">
            <ResourceView resource={documents}>
              {(page) => <DocumentList documents={page.items} onChanged={() => void documents.reload()} showAttachment emptyTitle="Aucun document rattaché" />}
            </ResourceView>
            <details className="rounded-md border border-gray-200 p-3">
              <summary className="cursor-pointer text-sm font-medium text-brand-800">Déposer un document pour ce contrat</summary>
              <div className="mt-3">
                <DocumentUpload
                  target="contract"
                  targetId={c.id}
                  kinds={['OTHER']}
                  notice="Ce document sera visible de l’entreprise cliente et d’E-MPGT."
                  onUploaded={() => void documents.reload()}
                />
              </div>
            </details>
          </div>
        </Card>

        <div className="grid gap-6 lg:grid-cols-2">
          <Card title="Évaluation de la mission" description="Évaluation interne transmise à E-MPGT, possible une fois la mission terminée.">
            <ContractReview contractId={c.id} actions={c.actions} />
            {!c.actions.some((a) => a.action === 'review') && <EmptyState title="Évaluation non disponible" />}
          </Card>
          <Card
            title="Litiges"
            description="Un désaccord sur le contrat, un CRA ou une facture ? E-MPGT arbitre."
            actions={
              <DisputeButton
                contractId={c.id}
                timesheets={(timesheets.data?.items ?? []).map((t) => ({ id: t.id, label: `${formatMonth(t.periodStart)} (v${t.version}) — ${labels.timesheetStatus[t.status]}` }))}
                invoices={(invoices.data?.items ?? []).map((i) => ({ id: i.id, label: `Facture ${i.number} — ${formatMoney(i.amountInclTax, i.currency)}` }))}
                onOpened={() => void disputes.reload()}
              />
            }
          >
            <ResourceView resource={disputes}>{() => <DisputeList disputes={contractDisputes} />}</ResourceView>
          </Card>
        </div>
      </div>
    </>
  );
}

export default function FreelanceContractPage() {
  const { id } = useParams<{ id: string }>();
  const contract = useApi<ContractView>(`/contracts/${id}`);
  return <ResourceView resource={contract}>{(c) => <ContractDetail contract={c} />}</ResourceView>;
}
