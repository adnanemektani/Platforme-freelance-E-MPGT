'use client';

import Link from 'next/link';
import { useState } from 'react';
import {
  CompanyStatus,
  CompanyVerificationStatus,
  labels,
  type AdminCompanyListItem,
  type Page,
} from '@empgt/contracts';
import { qs } from '@/lib/api';
import { formatDate, formatDateTime } from '@/lib/format';
import { useApi } from '@/lib/hooks';
import { Badge, StatusBadge } from '@/components/ui/badge';
import { ResourceView } from '@/components/ui/feedback';
import { Field, Input, optionsFrom, Select } from '@/components/ui/form';
import { PageHeader } from '@/components/ui/page';
import { DataTable, Pagination } from '@/components/ui/table';
import { AFilterForm } from '@/components/admin/a-shared';

const EMPTY = { q: '', verificationStatus: '', status: '' };

export default function EntreprisesPage() {
  const [filters, setFilters] = useState(EMPTY);
  const [applied, setApplied] = useState(EMPTY);
  const [page, setPage] = useState(1);
  const list = useApi<Page<AdminCompanyListItem>>(`/admin/companies${qs({ ...applied, page })}`);

  return (
    <>
      <PageHeader
        title="Entreprises"
        description="Organisations clientes : état de vérification, état du compte et missions."
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
              placeholder="Raison sociale, immatriculation, ville…"
              value={filters.q}
              onChange={(e) => setFilters({ ...filters, q: e.target.value })}
            />
          )}
        </Field>
        <Field label="Vérification">
          {(p) => (
            <Select
              {...p}
              value={filters.verificationStatus}
              placeholder="Tous les états de vérification"
              options={optionsFrom(CompanyVerificationStatus, labels.companyVerification)}
              onChange={(e) => setFilters({ ...filters, verificationStatus: e.target.value })}
            />
          )}
        </Field>
        <Field label="État">
          {(p) => (
            <Select
              {...p}
              value={filters.status}
              placeholder="Tous les états"
              options={optionsFrom(CompanyStatus, labels.companyStatus)}
              onChange={(e) => setFilters({ ...filters, status: e.target.value })}
            />
          )}
        </Field>
      </AFilterForm>

      <ResourceView resource={list} loadingLabel="Chargement des entreprises…">
        {(data) => (
          <>
            <DataTable
              rows={data.items}
              rowKey={(c) => c.id}
              caption="Entreprises"
              empty={{
                title: 'Aucune entreprise ne correspond',
                description: 'Modifiez les filtres pour élargir la recherche.',
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
                {
                  header: 'Vérification',
                  cell: (c) => (
                    <StatusBadge
                      status={c.verificationStatus}
                      label={labels.companyVerification[c.verificationStatus]}
                    />
                  ),
                },
                {
                  header: 'État',
                  cell: (c) => (
                    <StatusBadge status={c.status} label={labels.companyStatus[c.status]} />
                  ),
                },
                { header: 'Missions', cell: (c) => c.missions },
                {
                  header: 'Demande de vérification',
                  cell: (c) => formatDateTime(c.verificationSubmittedAt),
                },
                { header: 'Créée le', cell: (c) => formatDate(c.createdAt) },
              ]}
            />
            <Pagination page={data} onChange={setPage} />
          </>
        )}
      </ResourceView>
    </>
  );
}
