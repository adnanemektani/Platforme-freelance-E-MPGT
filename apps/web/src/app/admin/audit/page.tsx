'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Suspense, useId, useState } from 'react';
import { labels, type AuditEventView, type Page, type RoleCode } from '@empgt/contracts';
import { qs } from '@/lib/api';
import { formatDateTime } from '@/lib/format';
import { useApi } from '@/lib/hooks';
import { Badge } from '@/components/ui/badge';
import { LoadingBlock, ResourceView } from '@/components/ui/feedback';
import { Field, Input } from '@/components/ui/form';
import { PageHeader } from '@/components/ui/page';
import { DataTable, Pagination } from '@/components/ui/table';
import {
  AUDIT_ENTITY_TYPES,
  auditActorTypeLabels,
  auditEntityHref,
} from '@/components/admin/a-labels';
import { ADetails, AFilterForm, AJson } from '@/components/admin/a-shared';

interface Filters {
  entityType: string;
  entityId: string;
  action: string;
  from: string;
  to: string;
  q: string;
}

const EMPTY: Filters = { entityType: '', entityId: '', action: '', from: '', to: '', q: '' };

/** Bornes de période : dates locales (AAAA-MM-JJ) converties en instants ISO 8601. */
function toRange(from: string, to: string): { from?: string; to?: string } {
  return {
    from: from ? new Date(`${from}T00:00:00`).toISOString() : undefined,
    to: to ? new Date(`${to}T23:59:59.999`).toISOString() : undefined,
  };
}

export default function AuditPage() {
  return (
    <>
      <PageHeader
        title="Journal d’audit"
        description="Historique en ajout seul des opérations sensibles : qui, quand, sur quel objet, quelle action et pour quel motif."
      />
      <Suspense fallback={<LoadingBlock />}>
        <AuditContent />
      </Suspense>
    </>
  );
}

function AuditContent() {
  const params = useSearchParams();
  const initial: Filters = {
    ...EMPTY,
    entityType: params.get('entityType') ?? '',
    entityId: params.get('entityId') ?? '',
  };
  const [filters, setFilters] = useState<Filters>(initial);
  const [applied, setApplied] = useState<Filters>(initial);
  const [page, setPage] = useState(1);
  const listId = useId();
  const range = toRange(applied.from, applied.to);
  const events = useApi<Page<AuditEventView>>(
    `/admin/audit${qs({ entityType: applied.entityType, entityId: applied.entityId, action: applied.action, q: applied.q, from: range.from, to: range.to, page, pageSize: 50 })}`,
  );
  const set = (key: keyof Filters) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setFilters({ ...filters, [key]: e.target.value });

  return (
    <>
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
        <Field label="Recherche" hint="Action, motif ou identifiant exact.">
          {(p) => <Input {...p} value={filters.q} onChange={set('q')} />}
        </Field>
        <Field label="Type d’objet">
          {(p) => (
            <>
              <Input
                {...p}
                list={listId}
                value={filters.entityType}
                onChange={set('entityType')}
                placeholder="Ex. Company"
              />
              <datalist id={listId}>
                {AUDIT_ENTITY_TYPES.map((t) => (
                  <option key={t} value={t} />
                ))}
              </datalist>
            </>
          )}
        </Field>
        <Field label="Identifiant de l’objet">
          {(p) => (
            <Input
              {...p}
              value={filters.entityId}
              onChange={set('entityId')}
              className="font-mono"
            />
          )}
        </Field>
        <Field label="Action" hint="Contient, ex. « admin.company ».">
          {(p) => <Input {...p} value={filters.action} onChange={set('action')} />}
        </Field>
        <Field label="Du">
          {(p) => <Input {...p} type="date" value={filters.from} onChange={set('from')} />}
        </Field>
        <Field label="Au">
          {(p) => <Input {...p} type="date" value={filters.to} onChange={set('to')} />}
        </Field>
      </AFilterForm>

      <ResourceView resource={events} loadingLabel="Chargement du journal…">
        {(data) => (
          <>
            <DataTable
              rows={data.items}
              rowKey={(e) => e.id}
              caption="Événements d’audit"
              empty={{
                title: 'Aucun événement ne correspond',
                description: 'Modifiez les filtres pour élargir la recherche.',
              }}
              columns={[
                {
                  header: 'Date',
                  cell: (e) => (
                    <span className="whitespace-nowrap">{formatDateTime(e.occurredAt)}</span>
                  ),
                },
                {
                  header: 'Acteur',
                  cell: (e) => (
                    <span className="block max-w-xs">
                      <span className="block break-words">
                        {e.actorName ?? auditActorTypeLabels[e.actorType] ?? e.actorType}
                      </span>
                      {e.actorName && e.actorType !== 'USER' && (
                        <span className="block text-xs text-gray-500">
                          {auditActorTypeLabels[e.actorType] ?? e.actorType}
                        </span>
                      )}
                      {e.actorRoles.length > 0 && (
                        <span className="mt-1 flex flex-wrap gap-1">
                          {e.actorRoles.map((r) => (
                            <Badge key={r}>
                              {r in labels.role ? labels.role[r as RoleCode] : r}
                            </Badge>
                          ))}
                        </span>
                      )}
                    </span>
                  ),
                },
                {
                  header: 'Action',
                  cell: (e) => <span className="font-mono text-xs">{e.action}</span>,
                },
                {
                  header: 'Objet',
                  cell: (e) => {
                    const href = auditEntityHref(e.entityType, e.entityId);
                    return (
                      <span className="block">
                        <span className="block">{e.entityType}</span>
                        {e.entityId &&
                          (href ? (
                            <Link
                              href={href}
                              className="break-all font-mono text-xs text-brand-700 underline"
                            >
                              {e.entityId}
                            </Link>
                          ) : (
                            <span className="break-all font-mono text-xs text-gray-600">
                              {e.entityId}
                            </span>
                          ))}
                      </span>
                    );
                  },
                },
                {
                  header: 'Motif',
                  cell: (e) =>
                    e.reason ? (
                      <span className="block max-w-xs whitespace-pre-wrap">{e.reason}</span>
                    ) : (
                      '—'
                    ),
                },
                {
                  header: 'Détails',
                  cell: (e) => (
                    <span className="block min-w-48 space-y-1">
                      {e.metadata !== null && e.metadata !== undefined ? (
                        <ADetails summary="Métadonnées">
                          <AJson value={e.metadata} />
                        </ADetails>
                      ) : (
                        <span className="block text-xs text-gray-500">Sans métadonnées</span>
                      )}
                      {e.requestId && (
                        <span className="block break-all font-mono text-xs text-gray-500">
                          Requête {e.requestId}
                        </span>
                      )}
                    </span>
                  ),
                },
              ]}
            />
            <Pagination page={data} onChange={setPage} />
          </>
        )}
      </ResourceView>
    </>
  );
}
