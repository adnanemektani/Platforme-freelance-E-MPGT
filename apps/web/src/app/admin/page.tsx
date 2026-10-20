'use client';

import Link from 'next/link';
import type { AdminOverview } from '@empgt/contracts';
import { useApi } from '@/lib/hooks';
import { PendingList } from '@/components/ui/actions';
import { Card, StatTile } from '@/components/ui/card';
import { EmptyState, ResourceView } from '@/components/ui/feedback';
import { PageHeader } from '@/components/ui/page';

type Counts = AdminOverview['counts'];

const GROUPS: Array<{
  title: string;
  tiles: Array<{ key: keyof Counts; label: string; href: string; hint?: string }>;
}> = [
  {
    title: 'Validations et comptes',
    tiles: [
      {
        key: 'companiesToVerify',
        label: 'Entreprises à vérifier',
        href: '/admin/validations?onglet=entreprises',
      },
      {
        key: 'profilesToReview',
        label: 'Profils à valider',
        href: '/admin/validations?onglet=profils',
      },
      {
        key: 'missionsToReview',
        label: 'Missions à valider',
        href: '/admin/validations?onglet=missions',
      },
      {
        key: 'usersPendingVerification',
        label: 'Comptes : e-mail à vérifier',
        href: '/admin/utilisateurs',
        hint: 'Adresse e-mail non encore confirmée',
      },
    ],
  },
  {
    title: 'Activité commerciale',
    tiles: [
      { key: 'applicationsActive', label: 'Candidatures en cours', href: '/admin/candidatures' },
      {
        key: 'proposalsAwaitingApproval',
        label: 'Propositions à valider',
        href: '/admin/propositions',
        hint: 'Acceptées par les deux parties',
      },
      {
        key: 'contractsAwaitingSignature',
        label: 'Contrats à finaliser',
        href: '/admin/contrats',
        hint: 'En attente de signature ou d’activation',
      },
      { key: 'contractsActive', label: 'Contrats actifs', href: '/admin/contrats' },
    ],
  },
  {
    title: 'Suivi opérationnel',
    tiles: [
      { key: 'timesheetsSubmitted', label: 'CRA soumis', href: '/admin/cra' },
      { key: 'disputesOpen', label: 'Litiges ouverts', href: '/admin/cra?onglet=litiges' },
      { key: 'documentsToVerify', label: 'Documents à vérifier', href: '/admin/documents' },
      {
        key: 'documentsExpiringSoon',
        label: 'Documents arrivant à échéance',
        href: '/admin/documents',
        hint: 'Dans les 30 jours ou échus',
      },
    ],
  },
  {
    title: 'Finance, imports et contact',
    tiles: [
      { key: 'invoicesToVerify', label: 'Factures à contrôler', href: '/admin/finance' },
      { key: 'invoicesOverdue', label: 'Factures en retard', href: '/admin/finance' },
      { key: 'importItemsToReview', label: 'Profils importés à examiner', href: '/admin/imports' },
      { key: 'contactRequestsNew', label: 'Nouvelles demandes de contact', href: '/admin/contact' },
    ],
  },
];

const SHORTCUTS = [
  { href: '/admin/entreprises', label: 'Entreprises' },
  { href: '/admin/freelances', label: 'Freelances' },
  { href: '/admin/missions', label: 'Missions' },
  { href: '/admin/propositions', label: 'Propositions' },
  { href: '/admin/contrats', label: 'Contrats et avenants' },
  { href: '/admin/cra', label: 'CRA et litiges' },
  { href: '/admin/documents', label: 'Documents' },
  { href: '/admin/finance', label: 'Finance' },
  { href: '/admin/imports', label: 'Imports' },
  { href: '/admin/contact', label: 'Demandes de contact' },
  { href: '/admin/audit', label: 'Journal d’audit' },
];

export default function AdminOverviewPage() {
  const overview = useApi<AdminOverview>('/admin/overview');
  return (
    <>
      <PageHeader
        title="Vue globale"
        description="Ce qui attend une action d’E-MPGT et les compteurs de la plateforme. Les chiffres sont calculés par le serveur."
      />
      <ResourceView resource={overview} loadingLabel="Chargement de la vue globale…">
        {(data) => (
          <div className="space-y-8">
            <section aria-labelledby="pending-title" className="space-y-3">
              <h2 id="pending-title" className="text-lg font-semibold text-gray-900">
                Éléments à traiter
              </h2>
              {data.pending.length === 0 ? (
                <EmptyState
                  title="Rien à traiter pour le moment"
                  description="Aucune validation, vérification ni demande n’est en attente."
                />
              ) : (
                <PendingList items={data.pending} title="Éléments à traiter" />
              )}
            </section>

            {GROUPS.map((group) => (
              <section key={group.title} aria-label={group.title} className="space-y-3">
                <h2 className="text-lg font-semibold text-gray-900">{group.title}</h2>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  {group.tiles.map((t) => (
                    <StatTile
                      key={t.key}
                      label={t.label}
                      value={data.counts[t.key]}
                      hint={t.hint}
                      href={t.href}
                    />
                  ))}
                </div>
              </section>
            ))}

            <div className="grid gap-6 lg:grid-cols-2">
              <Card
                title="Finance"
                description="Encours, factures et règlements par devise (règlements manuels en V1)."
              >
                <Link href="/admin/finance" className="font-medium text-brand-700 underline">
                  Ouvrir la vue financière
                </Link>
              </Card>
              <Card title="Accès rapides">
                <ul className="flex flex-wrap gap-x-4 gap-y-2 text-sm">
                  {SHORTCUTS.map((s) => (
                    <li key={s.href}>
                      <Link href={s.href} className="font-medium text-brand-700 underline">
                        {s.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </Card>
            </div>
          </div>
        )}
      </ResourceView>
    </>
  );
}
