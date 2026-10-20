'use client';

import Link from 'next/link';
import { useState } from 'react';
import { ApplicationStatus, labels, type ApplicationListItem, type Page } from '@empgt/contracts';
import { qs } from '@/lib/api';
import { formatDate, formatDateTime } from '@/lib/format';
import { useApi } from '@/lib/hooks';
import { StatusBadge } from '@/components/ui/badge';
import { LinkButton } from '@/components/ui/button';
import { ResourceView } from '@/components/ui/feedback';
import { Field, optionsFrom, Select } from '@/components/ui/form';
import { PageHeader } from '@/components/ui/page';
import { DataTable, Pagination, type Column } from '@/components/ui/table';

const columns: Column<ApplicationListItem>[] = [
  {
    header: 'Mission',
    cell: (a) => (
      <span>
        <Link href={`/freelance/candidatures/${a.id}`} className="font-medium text-brand-800 underline">
          {a.missionTitle}
        </Link>
        <span className="block text-xs text-gray-500">{a.missionReference}</span>
      </span>
    ),
  },
  { header: 'Entreprise', cell: (a) => a.companyName ?? <span className="italic text-gray-600">Communiquée après sélection</span> },
  { header: 'Statut', cell: (a) => <StatusBadge status={a.status} label={labels.applicationStatus[a.status]} /> },
  { header: 'Envoyée le', cell: (a) => formatDate(a.createdAt) },
  { header: 'Mise à jour', cell: (a) => formatDateTime(a.updatedAt) },
];

export default function FreelanceApplicationsPage() {
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const resource = useApi<Page<ApplicationListItem>>(`/applications${qs({ status, page })}`);

  return (
    <>
      <PageHeader
        title="Mes candidatures"
        description="Suivi de vos candidatures : décision de l’entreprise, proposition commerciale et contrat."
        actions={<LinkButton href="/freelance/missions" variant="secondary">Rechercher des missions</LinkButton>}
      />
      <div className="mb-4 max-w-xs">
        <Field label="Filtrer par statut">
          {(p) => (
            <Select
              {...p}
              value={status}
              placeholder="Tous les statuts"
              options={optionsFrom(ApplicationStatus, labels.applicationStatus)}
              onChange={(e) => {
                setStatus(e.target.value);
                setPage(1);
              }}
            />
          )}
        </Field>
      </div>
      <ResourceView resource={resource}>
        {(data) => (
          <>
            <DataTable
              rows={data.items}
              columns={columns}
              rowKey={(a) => a.id}
              caption="Mes candidatures"
              empty={{
                title: 'Aucune candidature',
                description: 'Consultez les missions publiées et candidatez une fois votre profil validé par E-MPGT.',
                action: <LinkButton href="/freelance/missions" size="sm">Voir les missions</LinkButton>,
              }}
            />
            <Pagination page={data} onChange={setPage} />
          </>
        )}
      </ResourceView>
    </>
  );
}
