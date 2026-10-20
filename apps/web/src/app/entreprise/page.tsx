'use client';

import type { CompanyOverview } from '@empgt/contracts';
import { useApi } from '@/lib/hooks';
import { useSession } from '@/lib/session';
import { PendingList } from '@/components/ui/actions';
import { LinkButton } from '@/components/ui/button';
import { Card, StatTile } from '@/components/ui/card';
import { EmptyState, ResourceView } from '@/components/ui/feedback';
import { PageHeader } from '@/components/ui/page';

const TILES: Array<{
  key: keyof CompanyOverview['counts'];
  label: string;
  hint: string;
  href: string;
}> = [
  {
    key: 'applicationsToReview',
    label: 'Candidatures à examiner',
    hint: 'Envoyées ou présélectionnées, missions ouvertes',
    href: '/entreprise/candidatures',
  },
  {
    key: 'proposalsToAnswer',
    label: 'Propositions à examiner',
    hint: 'En attente de votre réponse',
    href: '/entreprise/propositions?status=SENT',
  },
  {
    key: 'timesheetsToValidate',
    label: 'CRA à valider',
    hint: 'Soumis par les freelances',
    href: '/entreprise/cra',
  },
  {
    key: 'unpaidInvoices',
    label: 'Factures non réglées',
    hint: 'Factures contrôlées en attente de règlement',
    href: '/entreprise/factures',
  },
  {
    key: 'draftMissions',
    label: 'Missions en préparation',
    hint: 'Brouillons et corrections demandées',
    href: '/entreprise/missions',
  },
  {
    key: 'missionsInReview',
    label: 'Missions en validation',
    hint: 'En cours de vérification par E-MPGT',
    href: '/entreprise/missions?publicationStatus=PENDING_REVIEW',
  },
  {
    key: 'publishedMissions',
    label: 'Missions publiées',
    hint: 'Ouvertes aux candidatures',
    href: '/entreprise/missions?publicationStatus=PUBLISHED&status=OPEN',
  },
  {
    key: 'activeContracts',
    label: 'Missions en cours',
    hint: 'Contrats actifs',
    href: '/entreprise/contrats?status=ACTIVE',
  },
];

export default function EntrepriseDashboardPage() {
  const { user } = useSession();
  const overview = useApi<CompanyOverview>('/company/overview');

  return (
    <>
      <PageHeader
        title="Tableau de bord"
        description={
          user?.company
            ? `${user.company.legalName} — ce qui vous attend et l’état de vos recrutements.`
            : 'Ce qui vous attend et l’état de vos recrutements.'
        }
        actions={<LinkButton href="/entreprise/missions/nouvelle">Nouvelle mission</LinkButton>}
      />
      <ResourceView resource={overview} loadingLabel="Chargement du tableau de bord…">
        {(o) => (
          <div className="space-y-8">
            <section aria-labelledby="attente-titre" className="space-y-3">
              <h2 id="attente-titre" className="text-lg font-semibold text-gray-900">
                À faire / en attente
              </h2>
              {o.pending.length > 0 ? (
                <PendingList items={o.pending} title="À faire / en attente" />
              ) : (
                <EmptyState
                  title="Rien en attente"
                  description="Aucune action n’est requise de votre part pour le moment."
                />
              )}
            </section>

            <section aria-labelledby="synthese-titre" className="space-y-3">
              <h2 id="synthese-titre" className="text-lg font-semibold text-gray-900">
                Vue d’ensemble
              </h2>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {TILES.map((t) => (
                  <StatTile
                    key={t.key}
                    label={t.label}
                    value={o.counts[t.key]}
                    hint={t.hint}
                    href={t.href}
                  />
                ))}
              </div>
            </section>

            <Card title="Raccourcis">
              <div className="flex flex-wrap gap-2">
                <LinkButton href="/entreprise/missions/nouvelle">Nouvelle mission</LinkButton>
                <LinkButton href="/entreprise/cra" variant="secondary">
                  Valider les CRA
                </LinkButton>
                <LinkButton href="/entreprise/organisation#membres" variant="secondary">
                  Inviter un collègue
                </LinkButton>
                <LinkButton href="/entreprise/documents" variant="secondary">
                  Déposer un document
                </LinkButton>
                <LinkButton href="/entreprise/factures" variant="secondary">
                  Factures et règlements
                </LinkButton>
              </div>
            </Card>
          </div>
        )}
      </ResourceView>
    </>
  );
}
