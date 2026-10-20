'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { labels, type ApplicationView } from '@empgt/contracts';
import { formatDateTime, formatMoney } from '@/lib/format';
import { useApi } from '@/lib/hooks';
import { ActionButton, PendingList } from '@/components/ui/actions';
import { StatusBadge } from '@/components/ui/badge';
import { LinkButton } from '@/components/ui/button';
import { Card, DefinitionList } from '@/components/ui/card';
import { Alert, EmptyState, ResourceView } from '@/components/ui/feedback';
import { PageHeader } from '@/components/ui/page';
import { adminPending, BText } from '@/components/admin/b-common';
import { BCandidateProfile } from '@/components/admin/b-candidate';

const ON_BEHALF = 'E-MPGT décide à la place de l’entreprise : le motif est obligatoire, conservé dans l’audit et communiqué.';

export default function AdminApplicationPage() {
  const { id } = useParams<{ id: string }>();
  const application = useApi<ApplicationView>(`/applications/${id}`);

  return (
    <ResourceView resource={application}>
      {(a) => {
        const name = a.candidate?.displayName ?? 'Candidat';
        const decision = (action: string, label: string, endpoint: string, success: string, variant: 'primary' | 'secondary' | 'danger' | 'success') => (
          <ActionButton<ApplicationView>
            actions={a.actions}
            action={action}
            label={label}
            variant={variant}
            endpoint={`/applications/${id}/${endpoint}`}
            reason="required"
            reasonLabel="Motif (intervention E-MPGT)"
            confirm={{ title: `${label} — ${name}`, message: ON_BEHALF }}
            success={success}
            onDone={application.setData}
          />
        );
        return (
          <>
            <PageHeader
              breadcrumbs={[{ label: 'Candidatures', href: '/admin/candidatures' }, { label: name }]}
              title={`Candidature de ${name}`}
              badge={<StatusBadge status={a.status} label={labels.applicationStatus[a.status]} />}
              description={
                <>
                  Mission{' '}
                  <Link href={`/admin/missions/${a.missionId}`} className="text-brand-700 underline">
                    {a.missionReference} — {a.missionTitle}
                  </Link>{' '}
                  · {a.companyName ?? 'Entreprise'} · {labels.missionStatus[a.missionStatus]}
                </>
              }
              actions={
                <>
                  {decision('shortlist', 'Présélectionner', 'shortlist', 'Candidature présélectionnée', 'secondary')}
                  {decision('select', 'Retenir le candidat', 'select', 'Candidat retenu', 'success')}
                  {decision('reject', 'Décliner', 'reject', 'Candidature déclinée', 'danger')}
                  {decision('deselect', 'Annuler la sélection', 'deselect', 'Sélection annulée', 'danger')}
                </>
              }
            />

            <div className="space-y-6">
              <PendingList items={adminPending(a.pending)} />

              {a.status === 'SELECTED' && !a.proposalId && (
                <Alert tone="info" title="Candidat retenu : proposition commerciale à préparer">
                  <p>Préparez les conditions commerciales (tarifs, commission, délais) puis envoyez-les aux deux parties.</p>
                  <LinkButton href={`/admin/propositions/nouvelle?applicationId=${a.id}`} size="sm" className="mt-2">
                    Préparer la proposition
                  </LinkButton>
                </Alert>
              )}
              {(a.proposalId || a.contractId) && (
                <div className="flex flex-wrap gap-2">
                  {a.proposalId && (
                    <LinkButton href={`/admin/propositions/${a.proposalId}`} variant="secondary" size="sm">
                      Voir la proposition commerciale
                    </LinkButton>
                  )}
                  {a.contractId && (
                    <LinkButton href={`/admin/contrats/${a.contractId}`} variant="secondary" size="sm">
                      Voir le contrat
                    </LinkButton>
                  )}
                </div>
              )}

              <div className="grid gap-6 lg:grid-cols-3">
                <Card title="Candidature" className="lg:col-span-2">
                  <div className="space-y-4">
                    <div>
                      <h3 className="text-sm font-semibold text-gray-900">Message du candidat</h3>
                      <BText value={a.message} />
                    </div>
                    {a.availabilityNote && (
                      <div>
                        <h3 className="text-sm font-semibold text-gray-900">Disponibilité</h3>
                        <BText value={a.availabilityNote} />
                      </div>
                    )}
                  </div>
                </Card>
                <Card title="Suivi">
                  <DefinitionList
                    columns={1}
                    items={[
                      [
                        'Tarif indicatif proposé',
                        a.proposedRate ? `${formatMoney(a.proposedRate, a.proposedRateCurrency)}${a.proposedRateUnit ? ` / ${labels.rateUnit[a.proposedRateUnit]}` : ''}` : 'Non communiqué',
                      ],
                      ['Reçue le', formatDateTime(a.createdAt)],
                      ['Décision le', formatDateTime(a.decidedAt)],
                      ['Motif de la décision', a.statusReason],
                      [
                        'Profil freelance',
                        <Link key="p" href={`/admin/freelances/${a.profileId}`} className="text-brand-700 underline">
                          Fiche administrative du profil
                        </Link>,
                      ],
                    ]}
                  />
                  <p className="mt-3 text-xs text-gray-500">Le tarif indicatif n’est visible que d’E-MPGT et du freelance ; il n’engage aucune condition commerciale.</p>
                </Card>
              </div>

              <Card title="Profil du candidat">
                {a.candidate ? <BCandidateProfile candidate={a.candidate} /> : <EmptyState title="Profil non disponible" />}
              </Card>
            </div>
          </>
        );
      }}
    </ResourceView>
  );
}
