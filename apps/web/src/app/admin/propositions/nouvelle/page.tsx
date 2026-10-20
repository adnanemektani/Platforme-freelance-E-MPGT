'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import { labels, type ApplicationListItem, type ApplicationView, type Page, type ProposalView } from '@empgt/contracts';
import { api } from '@/lib/api';
import { formatDate, formatMoney } from '@/lib/format';
import { useAction, useApi } from '@/lib/hooks';
import { StatusBadge } from '@/components/ui/badge';
import { LinkButton } from '@/components/ui/button';
import { Card, DefinitionList } from '@/components/ui/card';
import { Alert, LoadingBlock, ResourceView } from '@/components/ui/feedback';
import { PageHeader } from '@/components/ui/page';
import { DataTable } from '@/components/ui/table';
import { BCommissionPolicyNotice } from '@/components/admin/b-common';
import { BProposalTermsForm } from '@/components/admin/b-proposal-form';

export default function NewProposalPage() {
  return (
    <>
      <PageHeader
        breadcrumbs={[{ label: 'Propositions', href: '/admin/propositions' }, { label: 'Nouvelle proposition' }]}
        title="Préparer une proposition commerciale"
        description="La proposition se prépare pour une candidature retenue. Elle reste interne à E-MPGT tant qu’elle n’est pas envoyée aux parties."
      />
      <Suspense fallback={<LoadingBlock />}>
        <NewProposal />
      </Suspense>
    </>
  );
}

function NewProposal() {
  const applicationId = useSearchParams().get('applicationId');
  return applicationId ? <ProposalForApplication applicationId={applicationId} /> : <SelectedApplications />;
}

function SelectedApplications() {
  const selected = useApi<Page<ApplicationListItem>>('/applications?status=SELECTED&pageSize=100');
  return (
    <Card title="Choisir une candidature retenue">
      <ResourceView resource={selected}>
        {(data) => (
          <DataTable
            rows={data.items}
            rowKey={(a) => a.id}
            caption="Candidatures retenues"
            empty={{ title: 'Aucune candidature retenue', description: 'Une candidature doit être retenue (par l’entreprise ou par E-MPGT) avant de préparer une proposition.' }}
            columns={[
              { header: 'Candidat', cell: (a) => a.candidateName },
              { header: 'Mission', cell: (a) => `${a.missionReference} — ${a.missionTitle}` },
              { header: 'Entreprise', cell: (a) => a.companyName ?? '—' },
              { header: 'Retenue le', cell: (a) => formatDate(a.updatedAt) },
              {
                header: 'Action',
                cell: (a) => (
                  <LinkButton href={`/admin/propositions/nouvelle?applicationId=${a.id}`} size="sm">
                    Préparer
                  </LinkButton>
                ),
              },
            ]}
          />
        )}
      </ResourceView>
    </Card>
  );
}

function ProposalForApplication({ applicationId }: { applicationId: string }) {
  const router = useRouter();
  const application = useApi<ApplicationView>(`/applications/${applicationId}`);
  const action = useAction();

  return (
    <ResourceView resource={application}>
      {(a) => (
        <div className="space-y-6">
          <Card title="Candidature concernée" actions={<StatusBadge status={a.status} label={labels.applicationStatus[a.status]} />}>
            <DefinitionList
              columns={3}
              items={[
                [
                  'Candidat',
                  <Link key="c" href={`/admin/candidatures/${a.id}`} className="text-brand-700 underline">
                    {a.candidate?.displayName ?? 'Candidat'}
                  </Link>,
                ],
                [
                  'Mission',
                  <Link key="m" href={`/admin/missions/${a.missionId}`} className="text-brand-700 underline">
                    {a.missionReference} — {a.missionTitle}
                  </Link>,
                ],
                ['Entreprise', a.companyName],
                [
                  'Tarif indicatif du candidat',
                  a.proposedRate ? `${formatMoney(a.proposedRate, a.proposedRateCurrency)}${a.proposedRateUnit ? ` / ${labels.rateUnit[a.proposedRateUnit]}` : ''} (non repris automatiquement)` : 'Non communiqué',
                ],
              ]}
            />
          </Card>

          {a.status !== 'SELECTED' && (
            <Alert tone="warning" title="Candidature non retenue">
              Une proposition se prépare pour une candidature retenue ; l’enregistrement sera refusé par le serveur dans l’état actuel.
            </Alert>
          )}
          {a.proposalId && (
            <Alert tone="info" title="Une proposition existe déjà pour cette candidature">
              <Link href={`/admin/propositions/${a.proposalId}`} className="font-medium underline">
                Ouvrir la proposition existante
              </Link>{' '}
              — pour modifier des conditions envoyées, créez-en une nouvelle version depuis sa fiche.
            </Alert>
          )}

          <BCommissionPolicyNotice />

          <Card title="Conditions de la proposition" description="Brouillon : tous les champs peuvent être complétés plus tard. Les éléments manquants sont listés par le serveur avant l’envoi.">
            <BProposalTermsForm
              submitLabel="Créer le brouillon"
              pending={action.pending}
              error={action.error}
              onCancel={() => router.push(`/admin/candidatures/${a.id}`)}
              onSubmit={async (terms) => {
                const created = await action.run(() => api.post<ProposalView>('/proposals', { applicationId: a.id, ...terms }), { success: 'Proposition créée (brouillon)' });
                if (created) router.push(`/admin/propositions/${created.id}`);
              }}
            />
          </Card>
        </div>
      )}
    </ResourceView>
  );
}
