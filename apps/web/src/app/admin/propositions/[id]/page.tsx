'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { labels, type PartyDecision, type ProposalView } from '@empgt/contracts';
import { api } from '@/lib/api';
import { formatDateTime, formatNumber } from '@/lib/format';
import { useAction, useApi } from '@/lib/hooks';
import { ActionButton, findAction, PendingList } from '@/components/ui/actions';
import { StatusBadge } from '@/components/ui/badge';
import { LinkButton } from '@/components/ui/button';
import { Card, DefinitionList } from '@/components/ui/card';
import { Alert, ResourceView } from '@/components/ui/feedback';
import { PageHeader } from '@/components/ui/page';
import { adminPending, BAmountBreakdown, BCommissionPolicyNotice, BTermsList, BText, quantityLabel } from '@/components/admin/b-common';
import { BProposalTermsForm } from '@/components/admin/b-proposal-form';

function Decision({ who, decision, at, comment }: { who: string; decision: PartyDecision; at: string | null; comment: string | null }) {
  return (
    <div className="rounded-md border border-gray-200 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-semibold text-gray-900">{who}</p>
        <StatusBadge status={decision} label={labels.partyDecision[decision]} />
      </div>
      {at && <p className="mt-1 text-xs text-gray-500">Le {formatDateTime(at)}</p>}
      {comment && <p className="mt-1 whitespace-pre-line text-sm text-gray-700">{comment}</p>}
    </div>
  );
}

export default function AdminProposalPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const proposal = useApi<ProposalView>(`/proposals/${id}`);
  const save = useAction();

  return (
    <ResourceView resource={proposal}>
      {(p) => {
        const update = findAction(p.actions, 'update');
        const editable = Boolean(update?.allowed);
        return (
          <>
            <PageHeader
              breadcrumbs={[{ label: 'Propositions', href: '/admin/propositions' }, { label: `${p.reference} v${p.version}` }]}
              title={`Proposition ${p.reference} — version ${p.version}`}
              badge={<StatusBadge status={p.status} label={labels.proposalStatus[p.status]} />}
              description={
                <>
                  <Link href={`/admin/missions/${p.missionId}`} className="text-brand-700 underline">
                    {p.missionReference} — {p.missionTitle}
                  </Link>{' '}
                  · {p.companyName} ·{' '}
                  <Link href={`/admin/candidatures/${p.applicationId}`} className="text-brand-700 underline">
                    {p.candidateName}
                  </Link>
                </>
              }
              actions={
                <>
                  <ActionButton<ProposalView>
                    actions={p.actions}
                    action="send"
                    label="Envoyer aux parties"
                    endpoint={`/proposals/${id}/send`}
                    confirm={{ title: 'Envoyer la proposition', message: 'L’entreprise et le freelance sont notifiés et peuvent accepter ou refuser. Les conditions ne sont plus modifiables (nouvelle version nécessaire).' }}
                    success="Proposition envoyée aux parties"
                    onDone={proposal.setData}
                  />
                  <ActionButton<ProposalView>
                    actions={p.actions}
                    action="approve"
                    label="Valider (E-MPGT)"
                    variant="success"
                    endpoint={`/proposals/${id}/approve`}
                    confirm={{
                      title: 'Valider la proposition',
                      message: 'La validation fige les conditions dans un contrat (empreinte des conditions), en attente de signature hors plateforme. Elle ne peut pas être annulée.',
                      confirmLabel: 'Valider et générer le contrat',
                    }}
                    success="Proposition validée : contrat généré"
                    onDone={proposal.setData}
                  />
                  <ActionButton<ProposalView>
                    actions={p.actions}
                    action="revise"
                    label="Créer une nouvelle version"
                    variant="secondary"
                    endpoint={`/proposals/${id}/revise`}
                    confirm={{ title: 'Réviser la proposition', message: 'Une nouvelle version modifiable est créée à partir de celle-ci, qui sera marquée « remplacée ». Les décisions des parties sont réinitialisées.' }}
                    success="Nouvelle version créée"
                    onDone={(next) => router.push(`/admin/propositions/${next.id}`)}
                  />
                  <ActionButton<ProposalView>
                    actions={p.actions}
                    action="withdraw"
                    label="Retirer"
                    variant="danger"
                    endpoint={`/proposals/${id}/withdraw`}
                    reason="required"
                    reasonLabel="Motif du retrait"
                    success="Proposition retirée"
                    onDone={proposal.setData}
                  />
                </>
              }
            />

            <div className="space-y-6">
              <PendingList items={adminPending(p.pending)} />

              {p.contractId && (
                <Alert tone="success" title="Contrat généré">
                  <p>Les conditions validées sont figées dans le contrat.</p>
                  <LinkButton href={`/admin/contrats/${p.contractId}`} size="sm" className="mt-2">
                    Ouvrir le contrat
                  </LinkButton>
                </Alert>
              )}
              {p.statusReason && (
                <Alert tone="warning" title="Motif">
                  <p className="whitespace-pre-line">{p.statusReason}</p>
                </Alert>
              )}
              {p.missingTerms.length > 0 && (
                <Alert tone="warning" title="Conditions à compléter avant l’envoi et la validation">
                  <ul className="list-disc pl-5">
                    {p.missingTerms.map((t) => (
                      <li key={t}>{t}</li>
                    ))}
                  </ul>
                </Alert>
              )}

              <div className="grid gap-6 lg:grid-cols-3">
                <Card title="Décisions des parties" className="lg:col-span-2">
                  <div className="grid gap-3 md:grid-cols-2">
                    <Decision who={`Entreprise — ${p.companyName}`} decision={p.companyDecision} at={p.companyDecisionAt} comment={p.companyDecisionComment} />
                    <Decision who={`Freelance — ${p.candidateName}`} decision={p.freelancerDecision} at={p.freelancerDecisionAt} comment={p.freelancerDecisionComment} />
                  </div>
                </Card>
                <Card title="Historique">
                  <DefinitionList
                    columns={1}
                    items={[
                      ['Créée le', formatDateTime(p.createdAt)],
                      ['Envoyée le', formatDateTime(p.sentAt)],
                      ['Validée le', formatDateTime(p.approvedAt)],
                      ['Mise à jour', formatDateTime(p.updatedAt)],
                      [
                        'Version précédente',
                        p.previousId ? (
                          <Link key="prev" href={`/admin/propositions/${p.previousId}`} className="text-brand-700 underline">
                            Voir la version {p.version - 1}
                          </Link>
                        ) : null,
                      ],
                    ]}
                  />
                </Card>
              </div>

              <Card
                title="Aperçu des montants"
                description={
                  p.estimatedQuantity && p.billingUnit
                    ? `Calcul serveur sur la quantité estimée : ${formatNumber(p.estimatedQuantity)} ${quantityLabel(p.billingUnit)}.`
                    : 'Renseignez la quantité estimée et les conditions tarifaires pour obtenir un aperçu.'
                }
              >
                <BAmountBreakdown amounts={p.preview} empty="Aperçu indisponible : conditions tarifaires ou quantité estimée incomplètes." />
              </Card>

              {editable ? (
                <>
                  <BCommissionPolicyNotice />
                  <Card title="Conditions (brouillon modifiable)" description="Les modifications sont enregistrées dans le journal d’audit.">
                    <BProposalTermsForm
                      key={p.updatedAt}
                      initial={p}
                      submitLabel="Enregistrer les conditions"
                      pending={save.pending}
                      error={save.error}
                      onSubmit={async (terms) => {
                        const result = await save.run(() => api.patch<ProposalView>(`/proposals/${id}`, terms), { success: 'Conditions enregistrées' });
                        if (result) proposal.setData(result);
                      }}
                    />
                  </Card>
                </>
              ) : (
                <Card title="Conditions" description={update && !update.allowed ? update.reason : undefined}>
                  <div className="space-y-5">
                    <BTermsList
                      terms={p}
                      extra={[['Quantité estimée', p.estimatedQuantity && p.billingUnit ? `${formatNumber(p.estimatedQuantity)} ${quantityLabel(p.billingUnit)}` : p.estimatedQuantity]]}
                    />
                    <DefinitionList
                      items={[
                        ['Commission visible de l’entreprise', p.commissionVisibleToCompany ? 'Oui' : 'Non (sauf si elle la paie)'],
                        ['Commission visible du freelance', p.commissionVisibleToFreelancer ? 'Oui' : 'Non (sauf s’il la paie)'],
                      ]}
                    />
                    <div>
                      <h3 className="text-xs font-medium uppercase tracking-wide text-gray-500">Notes internes E-MPGT</h3>
                      <BText value={p.internalNotes} />
                    </div>
                  </div>
                </Card>
              )}
            </div>
          </>
        );
      }}
    </ResourceView>
  );
}
