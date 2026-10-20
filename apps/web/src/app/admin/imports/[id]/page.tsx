'use client';

import { useParams } from 'next/navigation';
import { useState } from 'react';
import {
  labels,
  type ImportBatchView,
  type ImportItemStatus,
  type ImportItemView,
  type Page,
} from '@empgt/contracts';
import { qs } from '@/lib/api';
import { formatDateTime } from '@/lib/format';
import { useApi } from '@/lib/hooks';
import { Badge } from '@/components/ui/badge';
import { Card, DefinitionList, StatTile } from '@/components/ui/card';
import { Alert, EmptyState, ResourceView } from '@/components/ui/feedback';
import { PageHeader, Tabs } from '@/components/ui/page';
import { Pagination } from '@/components/ui/table';
import { AImportItemCard } from '@/components/admin/a-import-item';
import { importBatchStatusLabels, importBatchStatusTones } from '@/components/admin/a-labels';

type Filter = ImportItemStatus | 'ALL';

const FILTERS: Array<{ id: Filter; label: string }> = [
  { id: 'PENDING_REVIEW', label: labels.importItemStatus.PENDING_REVIEW },
  { id: 'APPROVED', label: labels.importItemStatus.APPROVED },
  { id: 'DUPLICATE', label: labels.importItemStatus.DUPLICATE },
  { id: 'IGNORED', label: labels.importItemStatus.IGNORED },
  { id: 'ALL', label: 'Tous' },
];

export default function ImportBatchPage() {
  const { id } = useParams<{ id: string }>();
  const batch = useApi<ImportBatchView>(`/admin/imports/${id}`);
  const [filter, setFilter] = useState<Filter>('PENDING_REVIEW');
  const [page, setPage] = useState(1);
  const items = useApi<Page<ImportItemView>>(
    `/admin/imports/${id}/items${qs({ status: filter === 'ALL' ? null : filter, page, pageSize: 10 })}`,
  );

  return (
    <ResourceView resource={batch} loadingLabel="Chargement du lot…">
      {(b) => (
        <>
          <PageHeader
            breadcrumbs={[
              { label: 'Imports', href: '/admin/imports' },
              { label: `Lot du ${formatDateTime(b.collectedAt)}` },
            ]}
            title={`Lot du ${formatDateTime(b.collectedAt)}`}
            badge={
              <Badge tone={importBatchStatusTones[b.status]}>
                {importBatchStatusLabels[b.status]}
              </Badge>
            }
            description="Examinez chaque profil analysé : validez-le (profil privé « à vérifier »), marquez-le comme doublon ou ignorez-le."
          />
          <div className="space-y-6">
            {b.error && (
              <Alert tone="danger" title="Erreur lors de l’analyse">
                {b.error}
              </Alert>
            )}

            <Card title="Provenance">
              <DefinitionList
                items={[
                  [
                    'Source',
                    <a
                      key="src"
                      href={b.sourceUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="break-all text-brand-700 underline"
                    >
                      {b.sourceUrl}
                    </a>,
                  ],
                  ['Date de collecte', formatDateTime(b.collectedAt)],
                  ['Lot créé le', formatDateTime(b.createdAt)],
                  [
                    'Version de l’analyseur',
                    <span key="pv" className="font-mono text-xs">
                      {b.parserVersion}
                    </span>,
                  ],
                  [
                    'Empreinte SHA-256 de l’instantané',
                    <span key="sha" className="break-all font-mono text-xs">
                      {b.snapshotSha256}
                    </span>,
                  ],
                  ['Éléments à examiner', b.pendingItems],
                ]}
              />
            </Card>

            {b.stats && (
              <div className="grid gap-4 sm:grid-cols-3 lg:grid-cols-7">
                <StatTile label="Blocs lus" value={b.stats.blocks} />
                <StatTile label="Profils détectés" value={b.stats.profiles} />
                <StatTile label="Nouveaux" value={b.stats.new} />
                <StatTile label="Modifiés à la source" value={b.stats.changed} />
                <StatTile label="Inchangés" value={b.stats.unchanged} />
                <StatTile label="Doublons probables" value={b.stats.duplicates} />
                <StatTile label="Écartés" value={b.stats.skipped} />
              </div>
            )}

            <Alert tone="info">
              Valider un élément crée ou met à jour un profil historique <strong>privé</strong> « à
              vérifier », sans compte ni invitation. Aucune identité, disponibilité, tarif, statut
              ni consentement n’est déduit de la source. Les mentions de qualifications restent non
              vérifiées.
            </Alert>

            <section aria-labelledby="items-title">
              <h2 id="items-title" className="mb-3 text-lg font-semibold text-gray-900">
                Éléments du lot
              </h2>
              <Tabs
                current={filter}
                onChange={(next) => {
                  setFilter(next as Filter);
                  setPage(1);
                }}
                tabs={FILTERS.map((f) =>
                  f.id === 'PENDING_REVIEW' ? { ...f, count: b.pendingItems } : f,
                )}
              />
              <ResourceView resource={items} loadingLabel="Chargement des éléments…">
                {(data) =>
                  data.items.length === 0 ? (
                    <EmptyState title="Aucun élément dans cette catégorie" />
                  ) : (
                    <div className="space-y-4">
                      {data.items.map((item) => (
                        <AImportItemCard
                          key={item.id}
                          item={item}
                          onReviewed={() => {
                            void items.reload();
                            void batch.reload();
                          }}
                        />
                      ))}
                      <Pagination page={data} onChange={setPage} />
                    </div>
                  )
                }
              </ResourceView>
            </section>
          </div>
        </>
      )}
    </ResourceView>
  );
}
