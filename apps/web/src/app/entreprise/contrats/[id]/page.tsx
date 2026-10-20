'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import type { ReactNode } from 'react';
import {
  labels,
  type AmendmentView,
  type ContractView,
  type Page,
  type TimesheetListItem,
} from '@empgt/contracts';
import { qs } from '@/lib/api';
import { formatDate, formatDateTime } from '@/lib/format';
import { useApi } from '@/lib/hooks';
import { PendingList } from '@/components/ui/actions';
import { StatusBadge } from '@/components/ui/badge';
import { Card, DefinitionList } from '@/components/ui/card';
import { Alert, ResourceView } from '@/components/ui/feedback';
import { PageHeader } from '@/components/ui/page';
import { ContractReviews } from '@/components/company/contract-reviews';
import {
  breadcrumbRoot,
  commissionValueText,
  daysText,
  hoursText,
  rateText,
} from '@/components/company/display';
import { DisputeSection } from '@/components/company/dispute-section';
import { DownloadLinks } from '@/components/company/documents';
import { TimesheetTable } from '@/components/company/timesheet-table';
import { Anchor, MultiLine } from '@/components/company/widgets';

function AmendmentItem({ a, contract }: { a: AmendmentView; contract: ContractView }) {
  const changes: Array<[string, ReactNode]> = [
    ['Date d’effet', formatDate(a.effectiveDate)],
    ['Motif', <MultiLine key="motif" text={a.reason} />],
  ];
  if (a.newEndDate) changes.push(['Nouvelle date de fin', formatDate(a.newEndDate)]);
  if (a.newClientRate)
    changes.push([
      'Nouveau tarif client',
      rateText(a.newClientRate, contract.currency, contract.billingUnit),
    ]);
  if (a.newHoursPerDay) changes.push(['Nouvelles heures par jour', hoursText(a.newHoursPerDay)]);
  if (a.otherChanges)
    changes.push(['Autres modifications', <MultiLine key="autres" text={a.otherChanges} />]);
  if (a.signedAt) changes.push(['Signé le', formatDate(a.signedAt)]);
  if (a.signatureProofNote)
    changes.push(['Preuve de signature', <MultiLine key="preuve" text={a.signatureProofNote} />]);
  if (a.statusReason) changes.push(['Motif du statut', a.statusReason]);
  return (
    <li className="space-y-3 py-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-medium text-gray-900">
          Avenant n° {a.number} — {labels.amendmentType[a.type]}
        </span>
        <StatusBadge status={a.status} label={labels.amendmentStatus[a.status]} />
      </div>
      <DefinitionList items={changes} />
      {a.signedDocumentId && (
        <DownloadLinks documentId={a.signedDocumentId} label="Télécharger l’avenant signé" />
      )}
    </li>
  );
}

export default function ContratPage() {
  const { id } = useParams<{ id: string }>();
  const contract = useApi<ContractView>(`/contracts/${id}`);
  const timesheets = useApi<Page<TimesheetListItem>>(
    `/timesheets${qs({ contractId: id, pageSize: 50 })}`,
  );

  return (
    <ResourceView resource={contract} loadingLabel="Chargement du contrat…">
      {(c) => {
        const terms: Array<[string, ReactNode]> = [
          [
            'Mission',
            <Link
              key="mission"
              href={`/entreprise/missions/${c.missionId}`}
              className="text-brand-700 underline"
            >{`${c.missionReference} — ${c.missionTitle}`}</Link>,
          ],
          ['Freelance', c.freelancerName],
          ['Début', formatDate(c.startDate)],
          ['Fin initiale', formatDate(c.endDate)],
          ['Fin effective (avenants inclus)', formatDate(c.currentEndDate)],
          ['Devise', c.currency],
          ['Unité de facturation', labels.billingUnit[c.billingUnit]],
          ['Heures par jour', hoursText(c.hoursPerDay)],
          ['Tarif facturé à votre entreprise', rateText(c.clientRate, c.currency, c.billingUnit)],
        ];
        if (c.commissionPayer) {
          terms.push(['Commission E-MPGT', labels.commissionPayer[c.commissionPayer]]);
          if (c.commissionMode)
            terms.push(['Mode de commission', labels.commissionMode[c.commissionMode]]);
          if (c.commissionBase)
            terms.push(['Base de la commission', labels.commissionBase[c.commissionBase]]);
          if (c.commissionValue)
            terms.push([
              'Valeur de la commission',
              commissionValueText(c.commissionMode, c.commissionValue, c.currency),
            ]);
        }
        terms.push(
          ['Délai de règlement de vos factures', daysText(c.clientPaymentTermsDays)],
          [
            'Factures du freelance adressées à',
            labels.invoiceAddressee[c.freelancerInvoiceAddressee],
          ],
          ['Politique de frais', <MultiLine key="frais" text={c.expensesPolicy} />],
          ['Fiscalité et taxes', <MultiLine key="taxes" text={c.taxNote} />],
          ['Règle de validation des CRA', <MultiLine key="cra" text={c.timesheetValidationRule} />],
          ['Modalités de règlement', <MultiLine key="reglement" text={c.paymentTermsNote} />],
        );
        return (
          <>
            <PageHeader
              title={`Contrat ${c.reference}`}
              description={`${c.missionTitle} · ${c.freelancerName}`}
              breadcrumbs={[
                breadcrumbRoot,
                { label: 'Contrats', href: '/entreprise/contrats' },
                { label: c.reference },
              ]}
              badge={<StatusBadge status={c.status} label={labels.contractStatus[c.status]} />}
            />
            <div className="space-y-6">
              <Alert tone="info" title="Pas de signature électronique intégrée">
                Le contrat est signé hors plateforme par les parties ; E-MPGT dépose ensuite le
                document signé avec la date et la preuve de signature.
              </Alert>
              <PendingList items={c.pending} />
              {c.statusReason && (
                <Alert tone="warning" title="Motif du statut">
                  <p className="whitespace-pre-line">{c.statusReason}</p>
                </Alert>
              )}

              <Card
                title="Conditions figées"
                description="Conditions arrêtées à la validation de la proposition ; elles ne changent que par avenant signé."
              >
                <DefinitionList items={terms} />
                <div className="mt-4 rounded-md bg-gray-50 p-3">
                  <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
                    Empreinte des conditions (SHA-256)
                  </p>
                  <p className="mt-1 break-all font-mono text-xs text-gray-800">{c.termsHash}</p>
                  <p className="mt-1 text-xs text-gray-500">
                    Permet de vérifier que les conditions n’ont pas été modifiées depuis la
                    génération du contrat.
                  </p>
                </div>
              </Card>

              <Card title="Signature">
                <div className="space-y-4">
                  {c.signedDocumentId ? (
                    <DownloadLinks
                      documentId={c.signedDocumentId}
                      label="Télécharger le contrat signé"
                    />
                  ) : (
                    <p className="text-sm text-gray-600">
                      Le contrat signé n’a pas encore été déposé par E-MPGT.
                    </p>
                  )}
                  <DefinitionList
                    items={[
                      ['Date de signature', c.signedAt ? formatDate(c.signedAt) : null],
                      [
                        'Preuve de signature',
                        <MultiLine key="preuve" text={c.signatureProofNote} />,
                      ],
                      [
                        'Dépôt enregistré le',
                        c.signatureRecordedAt ? formatDateTime(c.signatureRecordedAt) : null,
                      ],
                      ['Mission activée le', c.activatedAt ? formatDateTime(c.activatedAt) : null],
                      ['Clôturé le', c.closedAt ? formatDateTime(c.closedAt) : null],
                      ['Contrat généré le', formatDateTime(c.createdAt)],
                    ]}
                  />
                  <Link
                    href={`/entreprise/propositions/${c.proposalId}`}
                    className="inline-block text-sm font-medium text-brand-700 underline"
                  >
                    Voir la proposition d’origine
                  </Link>
                </div>
              </Card>

              <Card title="Avenants">
                {c.amendments.length === 0 ? (
                  <p className="text-sm text-gray-600">Aucun avenant.</p>
                ) : (
                  <ul className="divide-y divide-gray-100">
                    {c.amendments.map((a) => (
                      <AmendmentItem key={a.id} a={a} contract={c} />
                    ))}
                  </ul>
                )}
              </Card>

              <Card
                title="CRA du contrat"
                description="Comptes rendus d’activité soumis par le freelance."
              >
                <ResourceView resource={timesheets}>
                  {(page) => (
                    <TimesheetTable
                      timesheets={page.items}
                      showContract={false}
                      empty={{
                        title: 'Aucun CRA',
                        description:
                          'Les CRA apparaissent ici une fois la mission active et le premier CRA soumis.',
                      }}
                    />
                  )}
                </ResourceView>
              </Card>

              <ContractReviews contract={c} />
              <Anchor id="litiges">
                <DisputeSection contractId={c.id} />
              </Anchor>
            </div>
          </>
        );
      }}
    </ResourceView>
  );
}
