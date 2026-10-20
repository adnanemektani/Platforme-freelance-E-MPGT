'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useState } from 'react';
import {
  labels,
  type AmendmentView,
  type ContractView,
  type InvoiceListItem,
  type Page,
  type ReviewView,
  type TimesheetListItem,
} from '@empgt/contracts';
import { formatDate, formatDateTime, formatMoney, formatMonth, formatNumber } from '@/lib/format';
import { useApi } from '@/lib/hooks';
import { ActionButton, findAction, PendingList } from '@/components/ui/actions';
import { Badge, StatusBadge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, DefinitionList } from '@/components/ui/card';
import { Alert, EmptyState, ResourceView } from '@/components/ui/feedback';
import { PageHeader } from '@/components/ui/page';
import { DataTable } from '@/components/ui/table';
import { adminPending, BDocumentLinks, BTermsList, commissionValueLabel, rateLabel } from '@/components/admin/b-common';
import { BAmendmentForm, BReviewDialog, BSignedDepositDialog } from '@/components/admin/b-contract';

const NOT_ESIGNATURE = 'Dépôt d’un contrat signé hors plateforme — ce n’est pas une signature électronique.';

export default function AdminContractPage() {
  const { id } = useParams<{ id: string }>();
  const contract = useApi<ContractView>(`/contracts/${id}`);
  const timesheets = useApi<Page<TimesheetListItem>>(`/timesheets?contractId=${id}&pageSize=100`);
  const invoices = useApi<Page<InvoiceListItem>>(`/invoices?contractId=${id}&pageSize=100`);
  const reviews = useApi<ReviewView[]>(`/contracts/reviews?contractId=${id}`);
  const [amending, setAmending] = useState(false);

  return (
    <ResourceView resource={contract}>
      {(c) => {
        const amend = findAction(c.actions, 'amend');
        const decide = (action: string, label: string, endpoint: string, success: string, variant: 'primary' | 'secondary' | 'danger' | 'success', reason: 'required' | 'optional', message?: string) => (
          <ActionButton<ContractView>
            actions={c.actions}
            action={action}
            label={label}
            variant={variant}
            endpoint={`/contracts/${id}/${endpoint}`}
            reason={reason}
            reasonLabel={reason === 'required' ? 'Motif (obligatoire)' : 'Note (facultative)'}
            confirm={{ title: `${label} — ${c.reference}`, message }}
            success={success}
            onDone={contract.setData}
          />
        );
        return (
          <>
            <PageHeader
              breadcrumbs={[{ label: 'Contrats', href: '/admin/contrats' }, { label: c.reference }]}
              title={`Contrat ${c.reference}`}
              badge={<StatusBadge status={c.status} label={labels.contractStatus[c.status]} />}
              description={
                <>
                  <Link href={`/admin/missions/${c.missionId}`} className="text-brand-700 underline">
                    {c.missionReference} — {c.missionTitle}
                  </Link>{' '}
                  · {c.companyName} · {c.freelancerName}
                </>
              }
              actions={
                <>
                  <BSignedDepositDialog actions={c.actions} endpoint={`/contracts/${id}/signed-document`} kind="SIGNED_CONTRACT" label="Déposer le contrat signé" subject="du contrat" onDone={contract.setData} />
                  {decide('activate', 'Activer la mission', 'activate', 'Mission activée', 'success', 'optional', 'La saisie des CRA est ouverte au freelance.')}
                  {decide('suspend', 'Suspendre', 'suspend', 'Mission suspendue', 'secondary', 'required', 'La mission est suspendue jusqu’à sa reprise ; la décision est tracée et notifiée aux parties.')}
                  {decide('resume', 'Reprendre', 'resume', 'Mission reprise', 'primary', 'required')}
                  {decide('complete', 'Terminer la mission', 'complete', 'Mission terminée', 'success', 'optional')}
                  {decide('terminate', 'Résilier', 'terminate', 'Contrat résilié', 'danger', 'required', 'La résiliation met fin au contrat avant son terme.')}
                  {decide('cancel', 'Annuler le contrat', 'cancel', 'Contrat annulé', 'danger', 'required', 'L’annulation concerne un contrat non démarré ; elle est tracée et notifiée aux parties.')}
                </>
              }
            />

            <div className="space-y-6">
              <PendingList items={adminPending(c.pending)} />
              {c.statusReason && (
                <Alert tone="warning" title="Motif du statut">
                  <p className="whitespace-pre-line">{c.statusReason}</p>
                </Alert>
              )}

              <div className="grid gap-6 lg:grid-cols-3">
                <Card title="Contrat signé" description={NOT_ESIGNATURE} className="lg:col-span-2">
                  {c.signedDocumentId ? (
                    <DefinitionList
                      items={[
                        ['Document signé', <BDocumentLinks key="d" id={c.signedDocumentId} />],
                        ['Date de signature', formatDate(c.signedAt)],
                        ['Preuve de signature', c.signatureProofNote],
                        ['Dépôt enregistré le', formatDateTime(c.signatureRecordedAt)],
                        ['Activé le', formatDateTime(c.activatedAt)],
                        ['Clôturé le', formatDateTime(c.closedAt)],
                      ]}
                    />
                  ) : (
                    <EmptyState title="Contrat signé non déposé" description="Recueillez les signatures hors plateforme puis déposez le PDF signé avec sa date et la preuve de signature." />
                  )}
                </Card>
                <Card title="Parties">
                  <DefinitionList
                    columns={1}
                    items={[
                      [
                        'Entreprise',
                        <Link key="co" href={`/admin/entreprises/${c.companyId}`} className="text-brand-700 underline">
                          {c.companyName}
                        </Link>,
                      ],
                      [
                        'Freelance',
                        <Link key="fr" href={`/admin/freelances/${c.profileId}`} className="text-brand-700 underline">
                          {c.freelancerName}
                        </Link>,
                      ],
                      [
                        'Proposition d’origine',
                        <Link key="pr" href={`/admin/propositions/${c.proposalId}`} className="text-brand-700 underline">
                          Voir la proposition validée
                        </Link>,
                      ],
                      ['Contrat créé le', formatDateTime(c.createdAt)],
                    ]}
                  />
                </Card>
              </div>

              <Card title="Conditions figées" description="Conditions validées par E-MPGT, modifiables uniquement par avenant signé.">
                <div className="space-y-4">
                  <BTermsList terms={c} extra={[['Fin effective (avenants signés inclus)', formatDate(c.currentEndDate)]]} />
                  <div>
                    <p className="text-xs font-medium uppercase tracking-wide text-gray-500">Empreinte des conditions (termsHash)</p>
                    <p className="mt-0.5 break-all font-mono text-xs text-gray-800">{c.termsHash}</p>
                  </div>
                </div>
              </Card>

              <Card
                title="Avenants"
                description={`${c.amendments.length} avenant(s). Un avenant prend effet une fois son exemplaire signé déposé.`}
                actions={
                  amend &&
                  !amending && (
                    <span className="inline-flex flex-col">
                      <Button variant="secondary" disabled={!amend.allowed} onClick={() => setAmending(true)}>
                        Créer un avenant
                      </Button>
                      {!amend.allowed && amend.reason && <span className="mt-1 max-w-xs text-xs text-gray-600">{amend.reason}</span>}
                    </span>
                  )
                }
              >
                <div className="space-y-4">
                  {amending && amend?.allowed && (
                    <div className="rounded-md border border-brand-200 bg-brand-50/40 p-4">
                      <BAmendmentForm
                        contract={c}
                        onCancel={() => setAmending(false)}
                        onSaved={(view) => {
                          contract.setData(view);
                          setAmending(false);
                        }}
                      />
                    </div>
                  )}
                  {c.amendments.length === 0 ? (
                    <p className="text-sm text-gray-600">Aucun avenant.</p>
                  ) : (
                    <ul className="space-y-3">
                      {[...c.amendments]
                        .sort((x, y) => y.number - x.number)
                        .map((a) => (
                          <AmendmentItem key={a.id} amendment={a} contract={c} onDone={contract.setData} />
                        ))}
                    </ul>
                  )}
                </div>
              </Card>

              <Card title="Comptes rendus d’activité (CRA)" description={`${c.timesheetsCount} CRA`}>
                <ResourceView resource={timesheets}>
                  {(list) => (
                    <DataTable
                      rows={list.items}
                      rowKey={(t) => t.id}
                      caption="CRA du contrat"
                      empty={{ title: 'Aucun CRA', description: 'Le freelance ouvre un CRA par mois une fois la mission activée.' }}
                      columns={[
                        {
                          header: 'Période',
                          cell: (t) => (
                            <Link href={`/admin/cra/${t.id}`} className="font-medium text-brand-700 hover:underline">
                              {formatMonth(t.periodStart)}
                            </Link>
                          ),
                        },
                        { header: 'Version', cell: (t) => `v${t.version}` },
                        { header: 'Statut', cell: (t) => <StatusBadge status={t.status} label={labels.timesheetStatus[t.status]} /> },
                        { header: 'Heures', cell: (t) => `${formatNumber(t.totalHours)} h` },
                        { header: 'Soumis le', cell: (t) => formatDateTime(t.submittedAt) },
                      ]}
                    />
                  )}
                </ResourceView>
              </Card>

              <Card title="Factures du contrat">
                <ResourceView resource={invoices}>
                  {(list) => (
                    <DataTable
                      rows={list.items}
                      rowKey={(i) => i.id}
                      caption="Factures du contrat"
                      empty={{ title: 'Aucune facture' }}
                      columns={[
                        {
                          header: 'Facture',
                          cell: (i) => (
                            <Link href={`/admin/finance/factures/${i.id}`} className="font-medium text-brand-700 hover:underline">
                              {i.number}
                            </Link>
                          ),
                        },
                        { header: 'Type', cell: (i) => labels.invoiceKind[i.kind] },
                        { header: 'Montant TTC', cell: (i) => formatMoney(i.amountInclTax, i.currency) },
                        { header: 'Statut', cell: (i) => <StatusBadge status={i.status} label={labels.invoiceStatus[i.status]} /> },
                        {
                          header: 'Règlement',
                          cell: (i) => (
                            <span className="flex flex-wrap gap-1">
                              <StatusBadge status={i.paymentState} label={labels.paymentState[i.paymentState]} />
                              {i.overdue && <Badge tone="red">En retard</Badge>}
                            </span>
                          ),
                        },
                      ]}
                    />
                  )}
                </ResourceView>
              </Card>

              <Card title="Évaluations" description="Évaluations internes (E-MPGT voit toutes les évaluations du contrat)." actions={<BReviewDialog contract={c} onDone={() => void reviews.reload()} />}>
                <ResourceView resource={reviews}>
                  {(list) =>
                    list.length === 0 ? (
                      <p className="text-sm text-gray-600">Aucune évaluation.</p>
                    ) : (
                      <ul className="divide-y divide-gray-100">
                        {list.map((r) => (
                          <li key={r.id} className="py-3">
                            <p className="text-sm font-medium text-gray-900">
                              {r.rating} / 5 — par {r.authorRole === 'ADMIN' ? 'E-MPGT' : r.authorRole === 'COMPANY' ? 'l’entreprise' : 'le freelance'}, sur {r.subject === 'COMPANY' ? 'l’entreprise' : 'le freelance'}
                            </p>
                            <p className="text-xs text-gray-500">
                              {formatDateTime(r.createdAt)} · visibilité : {r.visibility}
                            </p>
                            {r.comment && <p className="mt-1 whitespace-pre-line text-sm text-gray-700">{r.comment}</p>}
                          </li>
                        ))}
                      </ul>
                    )
                  }
                </ResourceView>
              </Card>
            </div>
          </>
        );
      }}
    </ResourceView>
  );
}

function AmendmentItem({ amendment: a, contract: c, onDone }: { amendment: AmendmentView; contract: ContractView; onDone: (view: ContractView) => void }) {
  return (
    <li className="rounded-md border border-gray-200 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="flex flex-wrap items-center gap-2 text-sm font-semibold text-gray-900">
            Avenant n° {a.number} — {labels.amendmentType[a.type]}
            <StatusBadge status={a.status} label={labels.amendmentStatus[a.status]} />
          </p>
          <p className="text-xs text-gray-500">
            Effet au {formatDate(a.effectiveDate)} · créé le {formatDateTime(a.createdAt)}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <BSignedDepositDialog actions={a.actions} endpoint={`/amendments/${a.id}/signed-document`} kind="SIGNED_AMENDMENT" label="Déposer l’avenant signé" subject="de l’avenant" size="sm" onDone={onDone} />
          <ActionButton<ContractView>
            actions={a.actions}
            action="cancel"
            label="Annuler l’avenant"
            size="sm"
            variant="danger"
            endpoint={`/amendments/${a.id}/cancel`}
            reason="required"
            reasonLabel="Motif de l’annulation"
            success="Avenant annulé"
            onDone={onDone}
          />
        </div>
      </div>
      <div className="mt-3">
        <DefinitionList
          columns={3}
          items={[
            ['Motif', a.reason],
            ['Nouvelle fin', a.newEndDate ? formatDate(a.newEndDate) : null],
            ['Nouveau tarif freelance', a.newFreelanceRate ? rateLabel(a.newFreelanceRate, c.currency, c.billingUnit) : null],
            ['Nouveau tarif client', a.newClientRate ? rateLabel(a.newClientRate, c.currency, c.billingUnit) : null],
            ['Nouvelles heures par journée', a.newHoursPerDay ? `${formatNumber(a.newHoursPerDay)} h` : null],
            ['Nouvelle commission', a.newCommissionValue ? commissionValueLabel(a.newCommissionValue, c.commissionMode, c.currency, c.billingUnit) : null],
            ['Autres modifications', a.otherChanges],
            ['Avenant signé', a.signedDocumentId ? <BDocumentLinks key="d" id={a.signedDocumentId} /> : 'Non déposé'],
            ['Signé le', formatDate(a.signedAt)],
            ['Preuve de signature', a.signatureProofNote],
            ['Motif du statut', a.statusReason],
          ]}
        />
      </div>
    </li>
  );
}
