'use client';

import Link from 'next/link';
import { useState } from 'react';
import {
  labels,
  ProfileOrigin,
  ProfileValidationStatus,
  type AdminProfileListItem,
  type Page,
} from '@empgt/contracts';
import { qs } from '@/lib/api';
import { formatDateTime } from '@/lib/format';
import { useApi } from '@/lib/hooks';
import { Badge, StatusBadge } from '@/components/ui/badge';
import { ResourceView } from '@/components/ui/feedback';
import { Field, Input, optionsFrom, Select } from '@/components/ui/form';
import { PageHeader } from '@/components/ui/page';
import { DataTable, Pagination } from '@/components/ui/table';
import { AFilterForm } from '@/components/admin/a-shared';

const EMPTY = { q: '', validationStatus: '', origin: '' };

export default function FreelancesPage() {
  const [filters, setFilters] = useState(EMPTY);
  const [applied, setApplied] = useState(EMPTY);
  const [page, setPage] = useState(1);
  const list = useApi<Page<AdminProfileListItem>>(`/admin/freelancers${qs({ ...applied, page })}`);

  return (
    <>
      <PageHeader
        title="Freelances"
        description="Profils inscrits, profils historiques importés (sans compte tant qu’ils ne sont pas rattachés) et profils de démonstration."
      />
      <AFilterForm
        onSubmit={() => {
          setPage(1);
          setApplied(filters);
        }}
        onReset={() => {
          setFilters(EMPTY);
          setApplied(EMPTY);
          setPage(1);
        }}
      >
        <Field label="Recherche">
          {(p) => (
            <Input
              {...p}
              placeholder="Titre, ville, compétence, e-mail…"
              value={filters.q}
              onChange={(e) => setFilters({ ...filters, q: e.target.value })}
            />
          )}
        </Field>
        <Field label="Validation">
          {(p) => (
            <Select
              {...p}
              value={filters.validationStatus}
              placeholder="Tous les états"
              options={optionsFrom(ProfileValidationStatus, labels.profileValidation)}
              onChange={(e) => setFilters({ ...filters, validationStatus: e.target.value })}
            />
          )}
        </Field>
        <Field label="Origine">
          {(p) => (
            <Select
              {...p}
              value={filters.origin}
              placeholder="Toutes les origines"
              options={optionsFrom(ProfileOrigin, labels.profileOrigin)}
              onChange={(e) => setFilters({ ...filters, origin: e.target.value })}
            />
          )}
        </Field>
      </AFilterForm>

      <ResourceView resource={list} loadingLabel="Chargement des profils…">
        {(data) => (
          <>
            <DataTable
              rows={data.items}
              rowKey={(p) => p.id}
              caption="Profils freelances"
              empty={{
                title: 'Aucun profil ne correspond',
                description: 'Modifiez les filtres pour élargir la recherche.',
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
                    p.userEmail ? (
                      <span className="block">
                        {p.userName}
                        <span className="block text-xs text-gray-600">{p.userEmail}</span>
                      </span>
                    ) : (
                      <span className="text-gray-600">Profil historique sans compte</span>
                    ),
                },
                { header: 'Origine', cell: (p) => labels.profileOrigin[p.origin] },
                {
                  header: 'Validation',
                  cell: (p) => (
                    <StatusBadge
                      status={p.validationStatus}
                      label={labels.profileValidation[p.validationStatus]}
                    />
                  ),
                },
                { header: 'Catalogue', cell: (p) => labels.catalogVisibility[p.catalogVisibility] },
                {
                  header: 'Localisation',
                  cell: (p) => [p.city, p.country].filter(Boolean).join(', ') || '—',
                },
                { header: 'Mis à jour', cell: (p) => formatDateTime(p.updatedAt) },
              ]}
            />
            <Pagination page={data} onChange={setPage} />
          </>
        )}
      </ResourceView>
    </>
  );
}
