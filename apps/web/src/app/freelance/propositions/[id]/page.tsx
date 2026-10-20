'use client';

import { useParams } from 'next/navigation';
import { labels, type ProposalView } from '@empgt/contracts';
import { formatDate, formatDateTime } from '@/lib/format';
import { useApi } from '@/lib/hooks';
import { ActionButton, PendingList } from '@/components/ui/actions';
import { StatusBadge } from '@/components/ui/badge';
import { LinkButton } from '@/components/ui/button';
import { Card, DefinitionList } from '@/components/ui/card';
import { Alert, ResourceView } from '@/components/ui/feedback';
import { PageHeader } from '@/components/ui/page';
import { AmountsView, TermsList } from '@/components/freelancer/terms';

function ProposalDetail({ proposal: p, onChange }: { proposal: ProposalView; onChange: (v: ProposalView) => void }) {
  return (
    <>
      <PageHeader
        title={`Proposition ${p.reference}`}
        description={`${p.missionTitle} — ${p.companyName}`}
        breadcrumbs={[{ label: 'Propositions', href: '/freelance/propositions' }, { label: `${p.reference} (v${p.version})` }]}
        badge={<StatusBadge status={p.status} label={labels.proposalStatus[p.status]} />}
        actions={
          <>
            <ActionButton<ProposalView>
              actions={p.actions}
              action="accept"
              label="Accepter la proposition"
              variant="success"
              endpoint={`/proposals/${p.id}/accept`}
              reason="optional"
              reasonField="comment"
              reasonLabel="Commentaire"
              confirm={{
                title: 'Accepter la proposition',
                message:
                  'Vous donnez votre accord sur ces conditions. Le contrat est établi après l’accord de l’entreprise et la validation d’E-MPGT ; la mission démarre une fois le contrat signé déposé.',
                confirmLabel: 'Accepter',
              }}
              success="Proposition acceptée"
              onDone={onChange}
            />
            <ActionButton<ProposalView>
              actions={p.actions}
              action="decline"
              label="Refuser"
              variant="danger"
              endpoint={`/proposals/${p.id}/decline`}
              reason="required"
              reasonField="comment"
              reasonLabel="Motif du refus"
              confirm={{ title: 'Refuser la proposition', message: 'Indiquez à E-MPGT ce qui ne vous convient pas : une nouvelle version pourra vous être proposée.', confirmLabel: 'Refuser' }}
              success="Proposition refusée"
              onDone={onChange}
            />
          </>
        }
      />
      <div className="space-y-6">
        <PendingList items={p.pending} />
        {p.statusReason && (
          <Alert tone="info" title="Motif">
            {p.statusReason}
          </Alert>
        )}
        {p.status === 'SUPERSEDED' && <Alert tone="info">Cette version a été remplacée par une version plus récente : consultez la liste des propositions.</Alert>}
        {p.contractId && (
          <LinkButton href={`/freelance/contrats/${p.contractId}`}>Voir le contrat</LinkButton>
        )}

        <div className="grid gap-6 lg:grid-cols-3">
          <Card title="Conditions proposées" description="Seules les conditions du contrat signé font foi." className="lg:col-span-2">
            <TermsList terms={p} />
          </Card>
          <div className="space-y-6">
            <Card title="Mission">
              <DefinitionList
                columns={1}
                items={[
                  ['Mission', `${p.missionReference} — ${p.missionTitle}`],
                  ['Entreprise', p.companyName],
                  ['Début', formatDate(p.startDate)],
                  ['Fin', formatDate(p.endDate)],
                  ['Envoyée le', formatDateTime(p.sentAt)],
                ]}
              />
            </Card>
            <Card title="Réponses">
              <DefinitionList
                columns={1}
                items={[
                  [
                    'Votre réponse',
                    <span key="f">
                      <StatusBadge status={p.freelancerDecision} label={labels.partyDecision[p.freelancerDecision]} />
                      {p.freelancerDecisionAt && <span className="ml-2 text-xs text-gray-500">{formatDateTime(p.freelancerDecisionAt)}</span>}
                      {p.freelancerDecisionComment && <span className="mt-1 block text-gray-700">« {p.freelancerDecisionComment} »</span>}
                    </span>,
                  ],
                  [
                    'Réponse de l’entreprise',
                    <span key="c">
                      <StatusBadge status={p.companyDecision} label={labels.partyDecision[p.companyDecision]} />
                      {p.companyDecisionAt && <span className="ml-2 text-xs text-gray-500">{formatDateTime(p.companyDecisionAt)}</span>}
                    </span>,
                  ],
                  ['Validation E-MPGT', p.approvedAt ? `Validée le ${formatDateTime(p.approvedAt)}` : 'En attente'],
                ]}
              />
            </Card>
          </div>
        </div>

        <Card title="Aperçu des montants" description="Calculé par E-MPGT sur la quantité estimée : indicatif, seuls les CRA validés donnent lieu à facturation.">
          {p.preview ? <AmountsView amounts={p.preview} /> : <p className="text-sm text-gray-600">Aperçu indisponible : quantité estimée ou conditions incomplètes.</p>}
        </Card>
      </div>
    </>
  );
}

export default function FreelanceProposalPage() {
  const { id } = useParams<{ id: string }>();
  const proposal = useApi<ProposalView>(`/proposals/${id}`);
  return <ResourceView resource={proposal}>{(p) => <ProposalDetail proposal={p} onChange={proposal.setData} />}</ResourceView>;
}
