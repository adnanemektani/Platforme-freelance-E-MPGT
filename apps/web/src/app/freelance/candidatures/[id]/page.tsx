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
import { Alert, ResourceView } from '@/components/ui/feedback';
import { PageHeader } from '@/components/ui/page';

function ApplicationDetail({ app, onChange }: { app: ApplicationView; onChange: (a: ApplicationView) => void }) {
  return (
    <>
      <PageHeader
        title={app.missionTitle}
        description={`Candidature à la mission ${app.missionReference}`}
        breadcrumbs={[{ label: 'Candidatures', href: '/freelance/candidatures' }, { label: app.missionReference }]}
        badge={<StatusBadge status={app.status} label={labels.applicationStatus[app.status]} />}
        actions={
          <ActionButton<ApplicationView>
            actions={app.actions}
            action="withdraw"
            label="Retirer ma candidature"
            variant="danger"
            endpoint={`/applications/${app.id}/withdraw`}
            reason="optional"
            reasonLabel="Motif du retrait"
            confirm={{
              title: 'Retirer ma candidature',
              message: 'L’entreprise et E-MPGT seront informées du retrait. Cette action est définitive pour cette mission.',
              confirmLabel: 'Retirer',
            }}
            success="Candidature retirée"
            onDone={onChange}
          />
        }
      />
      <div className="space-y-6">
        <PendingList items={app.pending} />
        {app.statusReason && (
          <Alert tone={app.status === 'REJECTED' ? 'warning' : 'info'} title="Motif communiqué">
            {app.statusReason}
          </Alert>
        )}
        {(app.proposalId || app.contractId) && (
          <div className="flex flex-wrap gap-2">
            {app.proposalId && <LinkButton href={`/freelance/propositions/${app.proposalId}`}>Voir la proposition commerciale</LinkButton>}
            {app.contractId && (
              <LinkButton href={`/freelance/contrats/${app.contractId}`} variant="secondary">
                Voir le contrat
              </LinkButton>
            )}
          </div>
        )}
        <div className="grid gap-6 lg:grid-cols-3">
          <Card title="Ma candidature" className="lg:col-span-2">
            <div className="space-y-4">
              <div>
                <h3 className="text-xs font-medium uppercase tracking-wide text-gray-500">Message</h3>
                <p className="mt-1 whitespace-pre-line text-sm text-gray-800">{app.message}</p>
              </div>
              <DefinitionList
                items={[
                  ['Disponibilité indiquée', app.availabilityNote],
                  [
                    'Tarif indicatif (vous et E-MPGT uniquement)',
                    app.proposedRate
                      ? `${formatMoney(app.proposedRate, app.proposedRateCurrency)}${app.proposedRateUnit ? ` par ${labels.rateUnit[app.proposedRateUnit]}` : ''}`
                      : 'Non indiqué',
                  ],
                  ['Envoyée le', formatDateTime(app.createdAt)],
                  ['Décision le', formatDateTime(app.decidedAt)],
                ]}
              />
            </div>
          </Card>
          <Card title="Mission">
            <DefinitionList
              columns={1}
              items={[
                ['Référence', app.missionReference],
                ['Intitulé', app.missionTitle],
                ['État de la mission', labels.missionStatus[app.missionStatus]],
                ['Entreprise', app.companyName ?? <span className="italic text-gray-600">Communiquée après sélection</span>],
              ]}
            />
            <Link href={`/freelance/missions/${app.missionId}`} className="mt-3 inline-block text-sm font-medium text-brand-700 underline">
              Voir la fiche de la mission
            </Link>
          </Card>
        </div>
      </div>
    </>
  );
}

export default function FreelanceApplicationPage() {
  const { id } = useParams<{ id: string }>();
  const application = useApi<ApplicationView>(`/applications/${id}`);
  return <ResourceView resource={application}>{(a) => <ApplicationDetail app={a} onChange={application.setData} />}</ResourceView>;
}
