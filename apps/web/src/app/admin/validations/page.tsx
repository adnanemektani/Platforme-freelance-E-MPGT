'use client';

import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useState } from 'react';
import {
  labels,
  type AdminCompanyListItem,
  type AdminOverview,
  type AdminProfileListItem,
  type MissionListItem,
  type Page,
} from '@empgt/contracts';
import { qs } from '@/lib/api';
import { formatDate, formatDateTime } from '@/lib/format';
import { useApi } from '@/lib/hooks';
import { Badge, StatusBadge } from '@/components/ui/badge';
import { LoadingBlock, ResourceView } from '@/components/ui/feedback';
import { PageHeader, Tabs } from '@/components/ui/page';
import { DataTable, Pagination } from '@/components/ui/table';

const TABS = ['entreprises', 'profils', 'missions'] as const;
type Tab = (typeof TABS)[number];

export default function ValidationsPage() {
  return (
    <>
      <PageHeader
        title="Validations"
        description="Entreprises en attente de vérification, profils freelances soumis et missions en attente de publication. Ouvrez une fiche pour décider (motif obligatoire pour toute demande de correction ou tout refus)."
      />
      <Suspense fallback={<LoadingBlock />}>
        <ValidationsContent />
      </Suspense>
    </>
  );
}

function ValidationsContent() {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const requested = params.get('onglet');
  const tab: Tab = TABS.includes(requested as Tab) ? (requested as Tab) : 'entreprises';
  const overview = useApi<AdminOverview>('/admin/overview');
  const counts = overview.data?.counts;

  return (
    <>
      <Tabs
        current={tab}
        onChange={(id) => router.replace(`${pathname}?onglet=${id}`)}
        tabs={[
          { id: 'entreprises', label: 'Entreprises', count: counts?.companiesToVerify },
          { id: 'profils', label: 'Profils freelances', count: counts?.profilesToReview },
          { id: 'missions', label: 'Missions', count: counts?.missionsToReview },
        ]}
      />
      {tab === 'entreprises' && <CompaniesTab />}
      {tab === 'profils' && <ProfilesTab />}
      {tab === 'missions' && <MissionsTab />}
    </>
  );
}

function CompaniesTab() {
  const [page, setPage] = useState(1);
  const list = useApi<Page<AdminCompanyListItem>>(
    `/admin/companies${qs({ verificationStatus: 'PENDING', page })}`,
  );
  return (
    <ResourceView resource={list}>
      {(data) => (
        <>
          <DataTable
            rows={data.items}
            rowKey={(c) => c.id}
            caption="Entreprises en attente de vérification"
            empty={{
              title: 'Aucune entreprise en attente',
              description: 'Les demandes de vérification apparaîtront ici.',
            }}
            columns={[
              {
                header: 'Entreprise',
                cell: (c) => (
                  <span className="flex flex-wrap items-center gap-1.5">
                    <Link
                      href={`/admin/entreprises/${c.id}`}
                      className="font-medium text-brand-700 underline"
                    >
                      {c.legalName}
                    </Link>
                    {c.isDemo && <Badge tone="purple">Démo</Badge>}
                  </span>
                ),
              },
              {
                header: 'Localisation',
                cell: (c) => [c.city, c.country].filter(Boolean).join(', ') || '—',
              },
              { header: 'Responsable', cell: (c) => c.ownerEmail ?? '—' },
              { header: 'Missions', cell: (c) => c.missions },
              { header: 'Demande reçue', cell: (c) => formatDateTime(c.verificationSubmittedAt) },
              {
                header: 'Statut',
                cell: (c) => (
                  <StatusBadge
                    status={c.verificationStatus}
                    label={labels.companyVerification[c.verificationStatus]}
                  />
                ),
              },
            ]}
          />
          <Pagination page={data} onChange={setPage} />
        </>
      )}
    </ResourceView>
  );
}

function ProfilesTab() {
  const [page, setPage] = useState(1);
  const list = useApi<Page<AdminProfileListItem>>(
    `/admin/freelancers${qs({ validationStatus: 'SUBMITTED', page })}`,
  );
  return (
    <ResourceView resource={list}>
      {(data) => (
        <>
          <DataTable
            rows={data.items}
            rowKey={(p) => p.id}
            caption="Profils soumis à validation"
            empty={{
              title: 'Aucun profil soumis',
              description: 'Les profils soumis par les freelances apparaîtront ici.',
            }}
            columns={[
              {
                header: 'Profil',
                cell: (p) => (
                  <span className="flex flex-wrap items-center gap-1.5">
                    <Link
                      href={`/admin/freelances/${p.id}`}
                      className="font-medium text-brand-700 underline"
                    >
                      {p.headline ?? 'Profil sans titre'}
                    </Link>
                    {p.isDemo && <Badge tone="purple">Démo</Badge>}
                    {p.changedSinceReview && (
                      <Badge tone="amber">Modifié depuis la validation</Badge>
                    )}
                  </span>
                ),
              },
              {
                header: 'Compte',
                cell: (p) =>
                  p.userEmail
                    ? `${p.userName ?? ''} — ${p.userEmail}`
                    : 'Profil historique sans compte',
              },
              { header: 'Origine', cell: (p) => labels.profileOrigin[p.origin] },
              {
                header: 'Localisation',
                cell: (p) => [p.city, p.country].filter(Boolean).join(', ') || '—',
              },
              { header: 'Soumis le', cell: (p) => formatDateTime(p.submittedAt) },
            ]}
          />
          <Pagination page={data} onChange={setPage} />
        </>
      )}
    </ResourceView>
  );
}

function MissionsTab() {
  const [page, setPage] = useState(1);
  const list = useApi<Page<MissionListItem>>(
    `/missions${qs({ publicationStatus: 'PENDING_REVIEW', page })}`,
  );
  return (
    <ResourceView resource={list}>
      {(data) => (
        <>
          <DataTable
            rows={data.items}
            rowKey={(m) => m.id}
            caption="Missions en attente de validation"
            empty={{
              title: 'Aucune mission en attente',
              description: 'Les missions soumises par les entreprises apparaîtront ici.',
            }}
            columns={[
              {
                header: 'Référence',
                cell: (m) => <span className="font-mono text-xs">{m.reference}</span>,
              },
              {
                header: 'Mission',
                cell: (m) => (
                  <Link
                    href={`/admin/missions/${m.id}`}
                    className="font-medium text-brand-700 underline"
                  >
                    {m.title}
                  </Link>
                ),
              },
              {
                header: 'Entreprise',
                cell: (m) => (
                  <Link
                    href={`/admin/entreprises/${m.companyId}`}
                    className="text-brand-700 underline"
                  >
                    {m.companyName ?? 'Voir l’entreprise'}
                  </Link>
                ),
              },
              {
                header: 'Lieu',
                cell: (m) => [m.city, m.country].filter(Boolean).join(', ') || '—',
              },
              { header: 'Début', cell: (m) => formatDate(m.startDate) },
              { header: 'Mise à jour', cell: (m) => formatDateTime(m.updatedAt) },
            ]}
          />
          <Pagination page={data} onChange={setPage} />
        </>
      )}
    </ResourceView>
  );
}
