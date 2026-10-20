'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { labels, type ApplicationView } from '@empgt/contracts';
import { formatDateTime } from '@/lib/format';
import { useApi } from '@/lib/hooks';
import { ActionButton, PendingList } from '@/components/ui/actions';
import { StatusBadge } from '@/components/ui/badge';
import { LinkButton } from '@/components/ui/button';
import { Card, DefinitionList } from '@/components/ui/card';
import { Alert, ResourceView } from '@/components/ui/feedback';
import { PageHeader } from '@/components/ui/page';
import { CandidateProfile } from '@/components/company/candidate-profile';
import { breadcrumbRoot } from '@/components/company/display';

export default function CandidaturePage() {
  const { id } = useParams<{ id: string }>();
  const application = useApi<ApplicationView>(`/applications/${id}`);

  return (
    <ResourceView resource={application} loadingLabel="Chargement de la candidature…">
      {(a) => {
        const name = a.candidate?.displayName ?? 'Candidat';
        return (
          <>
            <PageHeader
              title={`Candidature de ${name}`}
              description={
                <>
                  Mission{' '}
                  <Link
                    href={`/entreprise/missions/${a.missionId}`}
                    className="font-medium text-brand-700 underline"
                  >
                    {a.missionReference} — {a.missionTitle}
                  </Link>{' '}
                  ({labels.missionStatus[a.missionStatus]})
                </>
              }
              breadcrumbs={[
                breadcrumbRoot,
                { label: 'Candidatures', href: '/entreprise/candidatures' },
                { label: name },
              ]}
              badge={<StatusBadge status={a.status} label={labels.applicationStatus[a.status]} />}
              actions={
                <>
                  <ActionButton<ApplicationView>
                    actions={a.actions}
                    action="shortlist"
                    label="Présélectionner"
                    endpoint={`/applications/${id}/shortlist`}
                    variant="secondary"
                    success="Candidature présélectionnée"
                    onDone={application.setData}
                  />
                  <ActionButton<ApplicationView>
                    actions={a.actions}
                    action="select"
                    label="Retenir ce candidat"
                    endpoint={`/applications/${id}/select`}
                    variant="success"
                    confirm={{
                      title: 'Retenir ce candidat',
                      message: (
                        <div className="space-y-2">
                          <p>
                            <strong>Une mission = un poste</strong> : un seul candidat peut être
                            retenu pour cette mission.
                          </p>
                          <p>
                            La retenue <strong>n’active pas la mission</strong> : E-MPGT prépare
                            ensuite la proposition commerciale. La mission ne démarre qu’après
                            l’accord des deux parties, la validation d’E-MPGT et le dépôt du contrat
                            signé.
                          </p>
                        </div>
                      ),
                      confirmLabel: 'Retenir',
                    }}
                    success="Candidat retenu : E-MPGT prépare la proposition commerciale"
                    onDone={application.setData}
                  />
                  <ActionButton<ApplicationView>
                    actions={a.actions}
                    action="reject"
                    label="Décliner"
                    endpoint={`/applications/${id}/reject`}
                    variant="danger"
                    reason="required"
                    reasonLabel="Motif du refus (communiqué au candidat)"
                    confirm={{ title: 'Décliner la candidature', confirmLabel: 'Décliner' }}
                    success="Candidature déclinée"
                    onDone={application.setData}
                  />
                  <ActionButton<ApplicationView>
                    actions={a.actions}
                    action="deselect"
                    label="Annuler la retenue"
                    endpoint={`/applications/${id}/deselect`}
                    variant="danger"
                    reason="required"
                    reasonLabel="Motif (communiqué au candidat)"
                    confirm={{
                      title: 'Annuler la retenue',
                      message:
                        'La candidature redevient présélectionnée et la mission est de nouveau ouverte au choix d’un candidat.',
                      confirmLabel: 'Annuler la retenue',
                    }}
                    success="Retenue annulée"
                    onDone={application.setData}
                  />
                </>
              }
            />
            <div className="space-y-6">
              <PendingList items={a.pending} />
              {a.statusReason && (
                <Alert tone="info" title="Motif de la dernière décision">
                  <p className="whitespace-pre-line">{a.statusReason}</p>
                </Alert>
              )}
              {(a.proposalId || a.contractId) && (
                <Card title="Suite du recrutement">
                  <div className="flex flex-wrap gap-2">
                    {a.proposalId && (
                      <LinkButton
                        href={`/entreprise/propositions/${a.proposalId}`}
                        variant="secondary"
                      >
                        Voir la proposition commerciale
                      </LinkButton>
                    )}
                    {a.contractId && (
                      <LinkButton href={`/entreprise/contrats/${a.contractId}`} variant="secondary">
                        Voir le contrat
                      </LinkButton>
                    )}
                  </div>
                </Card>
              )}
              <Card title="Message du candidat">
                <p className="whitespace-pre-line text-sm text-gray-800">{a.message}</p>
                <div className="mt-4">
                  <DefinitionList
                    items={[
                      ['Disponibilité indiquée', a.availabilityNote],
                      ['Reçue le', formatDateTime(a.createdAt)],
                      ['Dernière décision', a.decidedAt ? formatDateTime(a.decidedAt) : null],
                    ]}
                  />
                </div>
              </Card>
              {a.candidate ? (
                <CandidateProfile candidate={a.candidate} />
              ) : (
                <Alert tone="info" title="Profil non consultable">
                  Le candidat a retiré sa candidature : son profil n’est plus accessible.
                </Alert>
              )}
            </div>
          </>
        );
      }}
    </ResourceView>
  );
}
