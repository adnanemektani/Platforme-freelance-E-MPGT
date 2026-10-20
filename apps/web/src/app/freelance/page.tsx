'use client';

import type { FreelancerOverview, OwnProfileView } from '@empgt/contracts';
import { useApi } from '@/lib/hooks';
import { useSession } from '@/lib/session';
import { PendingList } from '@/components/ui/actions';
import { Card, StatTile } from '@/components/ui/card';
import { Alert, ResourceView } from '@/components/ui/feedback';
import { PageHeader } from '@/components/ui/page';
import { OnboardingSteps } from '@/components/freelancer/onboarding-steps';

export default function FreelanceDashboardPage() {
  const { user } = useSession();
  const overview = useApi<FreelancerOverview>('/freelancer/overview');
  const profile = useApi<OwnProfileView>('/profile');

  return (
    <>
      <PageHeader
        title={`Bonjour ${user?.firstName ?? ''}`.trim()}
        description={overview.data?.headline ?? 'Suivez votre profil, vos candidatures, vos contrats, vos CRA et vos règlements.'}
      />
      <div className="space-y-6">
        <section aria-labelledby="parcours" className="space-y-3">
          <h2 id="parcours" className="text-base font-semibold text-gray-900">
            Mon parcours
          </h2>
          <ResourceView resource={profile} loadingLabel="Chargement du profil…">
            {(p) =>
              p.validationStatus === 'APPROVED' ? (
                <Alert tone="success" title="Profil validé par E-MPGT">
                  Vous pouvez candidater aux missions publiées. Pensez à tenir vos disponibilités à jour.
                </Alert>
              ) : (
                <OnboardingSteps profile={p} emailVerified={user?.emailVerified ?? false} />
              )
            }
          </ResourceView>
        </section>

        <ResourceView resource={overview}>
          {(o) => (
            <>
              <Card title="À faire / en attente" description="Ce qui attend une action de votre part, ou ce qui est en cours chez E-MPGT ou chez l’entreprise.">
                {o.pending.length === 0 ? (
                  <Alert tone="success">Rien en attente pour le moment.</Alert>
                ) : (
                  <PendingList items={o.pending} title="Éléments en attente" />
                )}
              </Card>

              <section aria-labelledby="indicateurs">
                <h2 id="indicateurs" className="mb-3 text-base font-semibold text-gray-900">
                  Indicateurs
                </h2>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  <StatTile label="Missions ouvertes" value={o.counts.openMissions} hint="Publiées et ouvertes aux candidatures" href="/freelance/missions" />
                  <StatTile label="Candidatures en cours" value={o.counts.activeApplications} hint="Envoyées, présélectionnées ou retenues" href="/freelance/candidatures" />
                  <StatTile label="Propositions à examiner" value={o.counts.proposalsToAnswer} hint="En attente de votre réponse" href="/freelance/propositions" />
                  <StatTile label="Contrats actifs" value={o.counts.activeContracts} href="/freelance/contrats" />
                  <StatTile label="CRA à compléter" value={o.counts.timesheetsToComplete} hint="Brouillons et CRA du mois à ouvrir" href="/freelance/cra" />
                  <StatTile label="CRA à corriger" value={o.counts.timesheetsChangesRequested} hint="Correction demandée" href="/freelance/cra" />
                  <StatTile label="Factures contrôlées non réglées" value={o.counts.unpaidInvoices} hint="Suivi manuel par E-MPGT" href="/freelance/paiements" />
                </div>
              </section>
            </>
          )}
        </ResourceView>
      </div>
    </>
  );
}
