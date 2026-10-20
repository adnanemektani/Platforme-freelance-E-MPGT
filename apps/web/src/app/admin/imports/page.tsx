'use client';

import Link from 'next/link';
import { useState } from 'react';
import type { ImportBatchView, Page } from '@empgt/contracts';
import { formatDateTime } from '@/lib/format';
import { useApi } from '@/lib/hooks';
import { Badge } from '@/components/ui/badge';
import { Alert, ResourceView } from '@/components/ui/feedback';
import { PageHeader } from '@/components/ui/page';
import { DataTable, Pagination } from '@/components/ui/table';
import { AImportCreate } from '@/components/admin/a-import-create';
import { importBatchStatusLabels, importBatchStatusTones } from '@/components/admin/a-labels';

export default function ImportsPage() {
  const [page, setPage] = useState(1);
  const list = useApi<Page<ImportBatchView>>(`/admin/imports?page=${page}`);

  return (
    <>
      <PageHeader
        title="Imports des profils historiques"
        description="Collecte de la page publique des profils disponibles, analyse, puis examen manuel de chaque profil avant toute création."
      />
      <div className="space-y-6">
        <Alert tone="info" title="Ce que fait la validation d’un élément">
          Valider un élément crée (ou met à jour) un profil historique <strong>privé</strong> « à
          vérifier », <strong>sans compte ni invitation</strong>. Aucune identité, disponibilité,
          tarif, statut ni consentement n’est déduit de la source ; les mentions de diplômes ou
          certifications restent non vérifiées. Les corrections humaines ne sont jamais écrasées par
          un nouvel import.
        </Alert>

        <AImportCreate />

        <section aria-labelledby="batches-title" className="space-y-3">
          <h2 id="batches-title" className="text-lg font-semibold text-gray-900">
            Lots d’import
          </h2>
          <ResourceView resource={list} loadingLabel="Chargement des lots…">
            {(data) => (
              <>
                <DataTable
                  rows={data.items}
                  rowKey={(b) => b.id}
                  caption="Lots d’import"
                  empty={{
                    title: 'Aucun lot d’import',
                    description: 'Créez un premier lot ci-dessus.',
                  }}
                  columns={[
                    {
                      header: 'Collecte',
                      cell: (b) => (
                        <Link
                          href={`/admin/imports/${b.id}`}
                          className="font-medium text-brand-700 underline"
                        >
                          {formatDateTime(b.collectedAt)}
                        </Link>
                      ),
                    },
                    {
                      header: 'Source',
                      cell: (b) => <span className="break-all text-xs">{b.sourceUrl}</span>,
                    },
                    {
                      header: 'Statut',
                      cell: (b) => (
                        <Badge tone={importBatchStatusTones[b.status]}>
                          {importBatchStatusLabels[b.status]}
                        </Badge>
                      ),
                    },
                    { header: 'Profils', cell: (b) => b.stats?.profiles ?? '—' },
                    {
                      header: 'Nouveaux / modifiés / inchangés',
                      cell: (b) =>
                        b.stats
                          ? `${b.stats.new} / ${b.stats.changed} / ${b.stats.unchanged}`
                          : '—',
                    },
                    {
                      header: 'À examiner',
                      cell: (b) =>
                        b.pendingItems > 0 ? <Badge tone="amber">{b.pendingItems}</Badge> : '0',
                    },
                    {
                      header: 'Analyseur',
                      cell: (b) => <span className="font-mono text-xs">{b.parserVersion}</span>,
                    },
                  ]}
                />
                <Pagination page={data} onChange={setPage} />
              </>
            )}
          </ResourceView>
        </section>
      </div>
    </>
  );
}
