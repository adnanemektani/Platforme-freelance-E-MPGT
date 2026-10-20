'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import type { ReactNode } from 'react';
import { labels, type PartyDecision, type ProposalView } from '@empgt/contracts';
import { formatDate, formatDateTime } from '@/lib/format';
import { useApi } from '@/lib/hooks';
import { ActionButton, PendingList } from '@/components/ui/actions';
import { StatusBadge } from '@/components/ui/badge';
import { LinkButton } from '@/components/ui/button';
import { Card, DefinitionList } from '@/components/ui/card';
import { Alert, ResourceView } from '@/components/ui/feedback';
import { PageHeader } from '@/components/ui/page';
import { AmountsSummary } from '@/components/company/amounts';
import {
  breadcrumbRoot,
  commissionValueText,
  daysText,
  dateRange,
  hoursText,
  quantityText,
  rateText,
} from '@/components/company/display';
import { MultiLine } from '@/components/company/widgets';

function Decision({
  who,
  decision,
  at,
  comment,
}: {
  who: string;
  decision: PartyDecision;
  at: string | null;
  comment: string | null;
}) {
  return (
    <div className="rounded-md border border-gray-200 p-3 text-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="font-medium text-gray-900">{who}</span>
        <StatusBadge status={decision} label={labels.partyDecision[decision]} />
      </div>
      {at && <p className="mt-1 text-xs text-gray-500">Le {formatDateTime(at)}</p>}
      {comment && <p className="mt-2 whitespace-pre-line text-gray-700">{comment}</p>}
    </div>
  );
}

export default function PropositionPage() {
  const { id } = useParams<{ id: string }>();
  const proposal = useApi<ProposalView>(`/proposals/${id}`);

  return (
    <ResourceView resource={proposal} loadingLabel="Chargement de la proposition…">
      {(p) => {
        const terms: Array<[string, ReactNode]> = [
          [
            'Mission',
            <Link
              key="mission"
              href={`/entreprise/missions/${p.missionId}`}
              className="text-brand-700 underline"
            >{`${p.missionReference} — ${p.missionTitle}`}</Link>,
          ],
          [
            'Candidat',
            <Link
              key="candidat"
              href={`/entreprise/candidatures/${p.applicationId}`}
              className="text-brand-700 underline"
            >
              {p.candidateName}
            </Link>,
          ],
          ['Période', dateRange(p.startDate, p.endDate)],
          ['Devise', p.currency],
          ['Unité de facturation', p.billingUnit ? labels.billingUnit[p.billingUnit] : null],
          ['Heures par jour', hoursText(p.hoursPerDay)],
          ['Tarif facturé à votre entreprise', rateText(p.clientRate, p.currency, p.billingUnit)],
          [
            'Quantité estimée',
            p.estimatedQuantity && p.billingUnit
              ? quantityText(p.estimatedQuantity, p.billingUnit)
              : null,
          ],
        ];
        if (p.commissionPayer) {
          terms.push(['Commission E-MPGT', labels.commissionPayer[p.commissionPayer]]);
          if (p.commissionMode)
            terms.push(['Mode de commission', labels.commissionMode[p.commissionMode]]);
          if (p.commissionBase)
            terms.push(['Base de la commission', labels.commissionBase[p.commissionBase]]);
          if (p.commissionValue)
            terms.push([
              'Valeur de la commission',
              commissionValueText(p.commissionMode, p.commissionValue, p.currency),
            ]);
        }
        terms.push(
          ['Délai de règlement de vos factures', daysText(p.clientPaymentTermsDays)],
          [
            'Factures du freelance adressées à',
            p.freelancerInvoiceAddressee
              ? labels.invoiceAddressee[p.freelancerInvoiceAddressee]
              : null,
          ],
        );
        return (
          <>
            <PageHeader
              title={`Proposition ${p.reference}`}
              description={`Version ${p.version} · ${p.missionTitle} · ${p.candidateName}`}
              breadcrumbs={[
                breadcrumbRoot,
                { label: 'Propositions', href: '/entreprise/propositions' },
                { label: p.reference },
              ]}
              badge={<StatusBadge status={p.status} label={labels.proposalStatus[p.status]} />}
              actions={
                <>
                  <ActionButton<ProposalView>
                    actions={p.actions}
                    action="accept"
                    label="Accepter la proposition"
                    endpoint={`/proposals/${id}/accept`}
                    variant="success"
                    reason="optional"
                    reasonField="comment"
                    reasonLabel="Commentaire"
                    confirm={{
                      title: 'Accepter la proposition',
                      message:
                        'Après l’accord des deux parties, E-MPGT valide la proposition et génère le contrat aux conditions figées, à signer hors plateforme.',
                      confirmLabel: 'Accepter',
                    }}
                    success="Proposition acceptée"
                    onDone={proposal.setData}
                  />
                  <ActionButton<ProposalView>
                    actions={p.actions}
                    action="decline"
                    label="Décliner"
                    endpoint={`/proposals/${id}/decline`}
                    variant="danger"
                    reason="required"
                    reasonField="comment"
                    reasonLabel="Motif du refus"
                    confirm={{
                      title: 'Décliner la proposition',
                      message:
                        'E-MPGT et le freelance seront informés de votre refus et de son motif.',
                      confirmLabel: 'Décliner',
                    }}
                    success="Proposition déclinée"
                    onDone={proposal.setData}
                  />
                </>
              }
            />
            <div className="space-y-6">
              <PendingList items={p.pending} />
              {p.statusReason && (
                <Alert
                  tone={p.status === 'DECLINED' || p.status === 'WITHDRAWN' ? 'warning' : 'info'}
                  title="Motif"
                >
                  <p className="whitespace-pre-line">{p.statusReason}</p>
                </Alert>
              )}
              {(p.contractId || p.previousId) && (
                <div className="flex flex-wrap gap-2">
                  {p.contractId && (
                    <LinkButton href={`/entreprise/contrats/${p.contractId}`}>
                      Voir le contrat
                    </LinkButton>
                  )}
                  {p.previousId && (
                    <LinkButton
                      href={`/entreprise/propositions/${p.previousId}`}
                      variant="secondary"
                    >
                      Version précédente
                    </LinkButton>
                  )}
                </div>
              )}

              <Card title="Conditions proposées">
                <DefinitionList items={terms} />
              </Card>

              <div className="grid gap-6 lg:grid-cols-2">
                <Card
                  title="Aperçu des montants"
                  description="Calcul indicatif d’E-MPGT pour la quantité estimée."
                >
                  {p.preview ? (
                    <AmountsSummary amounts={p.preview} />
                  ) : (
                    <p className="text-sm text-gray-600">
                      Aperçu indisponible : quantité estimée ou conditions tarifaires non
                      renseignées.
                    </p>
                  )}
                </Card>
                <Card title="Décisions des parties">
                  <div className="space-y-3">
                    <Decision
                      who="Votre entreprise"
                      decision={p.companyDecision}
                      at={p.companyDecisionAt}
                      comment={p.companyDecisionComment}
                    />
                    <Decision
                      who="Le freelance"
                      decision={p.freelancerDecision}
                      at={p.freelancerDecisionAt}
                      comment={p.freelancerDecisionComment}
                    />
                    <DefinitionList
                      items={[
                        ['Envoyée le', p.sentAt ? formatDateTime(p.sentAt) : null],
                        [
                          'Validée par E-MPGT le',
                          p.approvedAt ? formatDateTime(p.approvedAt) : null,
                        ],
                      ]}
                    />
                  </div>
                </Card>
              </div>

              <Card title="Modalités">
                <DefinitionList
                  columns={1}
                  items={[
                    ['Politique de frais', <MultiLine key="frais" text={p.expensesPolicy} />],
                    ['Fiscalité et taxes', <MultiLine key="taxes" text={p.taxNote} />],
                    [
                      'Règle de validation des CRA',
                      <MultiLine key="cra" text={p.timesheetValidationRule} />,
                    ],
                    [
                      'Modalités de règlement',
                      <MultiLine key="reglement" text={p.paymentTermsNote} />,
                    ],
                  ]}
                />
                <p className="mt-4 text-xs text-gray-500">
                  Proposition créée le {formatDate(p.createdAt)}, mise à jour le{' '}
                  {formatDate(p.updatedAt)}.
                </p>
              </Card>
            </div>
          </>
        );
      }}
    </ResourceView>
  );
}
