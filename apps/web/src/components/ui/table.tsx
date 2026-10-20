'use client';

import type { ReactNode } from 'react';
import type { Page } from '@empgt/contracts';
import { EmptyState } from './feedback';

export interface Column<T> {
  header: string;
  cell: (row: T) => ReactNode;
  className?: string;
}

/** Tableau de données réactif (cartes empilées sur mobile). */
export function DataTable<T>({
  rows,
  columns,
  rowKey,
  empty,
  onRowClick,
  caption,
}: {
  rows: T[];
  columns: Column<T>[];
  rowKey: (row: T) => string;
  empty?: { title: string; description?: string; action?: ReactNode };
  onRowClick?: (row: T) => void;
  caption?: string;
}) {
  if (rows.length === 0) return <EmptyState title={empty?.title ?? 'Aucun élément'} description={empty?.description} action={empty?.action} />;
  return (
    <div className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
      <table className="min-w-full divide-y divide-gray-200 text-sm">
        {caption && <caption className="sr-only">{caption}</caption>}
        <thead className="hidden bg-gray-50 md:table-header-group">
          <tr>
            {columns.map((c) => (
              <th key={c.header} scope="col" className={`px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-gray-600 ${c.className ?? ''}`}>
                {c.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {rows.map((row) => (
            <tr
              key={rowKey(row)}
              onClick={onRowClick ? () => onRowClick(row) : undefined}
              className={`block md:table-row ${onRowClick ? 'cursor-pointer hover:bg-brand-50' : ''}`}
            >
              {columns.map((c) => (
                <td key={c.header} className={`flex justify-between gap-4 px-4 py-2 md:table-cell md:py-3 ${c.className ?? ''}`}>
                  <span className="text-xs font-medium text-gray-500 md:hidden">{c.header}</span>
                  <span className="text-right md:text-left">{c.cell(row)}</span>
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function Pagination({ page, onChange }: { page: Pick<Page<unknown>, 'page' | 'pageSize' | 'total'>; onChange: (page: number) => void }) {
  const pages = Math.max(1, Math.ceil(page.total / page.pageSize));
  if (pages <= 1) return null;
  return (
    <nav aria-label="Pagination" className="mt-4 flex items-center justify-between text-sm">
      <span className="text-gray-600">
        Page {page.page} sur {pages} — {page.total} élément(s)
      </span>
      <div className="flex gap-2">
        <button type="button" disabled={page.page <= 1} onClick={() => onChange(page.page - 1)} className="rounded-md border border-gray-300 bg-white px-3 py-1.5 disabled:opacity-40">
          Précédent
        </button>
        <button type="button" disabled={page.page >= pages} onClick={() => onChange(page.page + 1)} className="rounded-md border border-gray-300 bg-white px-3 py-1.5 disabled:opacity-40">
          Suivant
        </button>
      </div>
    </nav>
  );
}
