import type { ReactNode } from 'react';

export function Card({ title, description, actions, children, className = '' }: { title?: ReactNode; description?: ReactNode; actions?: ReactNode; children?: ReactNode; className?: string }) {
  return (
    <section className={`rounded-lg border border-gray-200 bg-white shadow-sm ${className}`}>
      {(title || actions) && (
        <header className="flex flex-wrap items-start justify-between gap-3 border-b border-gray-100 px-5 py-4">
          <div>
            {title && <h2 className="text-base font-semibold text-gray-900">{title}</h2>}
            {description && <p className="mt-0.5 text-sm text-gray-600">{description}</p>}
          </div>
          {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
        </header>
      )}
      <div className="px-5 py-4">{children}</div>
    </section>
  );
}

/** Liste « libellé : valeur » pour les fiches de détail. */
export function DefinitionList({ items, columns = 2 }: { items: Array<[string, ReactNode]>; columns?: 1 | 2 | 3 }) {
  const grid = { 1: 'sm:grid-cols-1', 2: 'sm:grid-cols-2', 3: 'sm:grid-cols-3' }[columns];
  return (
    <dl className={`grid grid-cols-1 gap-x-6 gap-y-3 ${grid}`}>
      {items.map(([label, value]) => (
        <div key={label}>
          <dt className="text-xs font-medium uppercase tracking-wide text-gray-500">{label}</dt>
          <dd className="mt-0.5 text-sm text-gray-900">{value === null || value === undefined || value === '' ? '—' : value}</dd>
        </div>
      ))}
    </dl>
  );
}

export function StatTile({ label, value, hint, href }: { label: string; value: ReactNode; hint?: string; href?: string }) {
  const content = (
    <>
      <p className="text-sm text-gray-600">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-gray-900">{value}</p>
      {hint && <p className="mt-1 text-xs text-gray-500">{hint}</p>}
    </>
  );
  return href ? (
    <a href={href} className="block rounded-lg border border-gray-200 bg-white p-4 shadow-sm hover:border-brand-200 hover:bg-brand-50">
      {content}
    </a>
  ) : (
    <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">{content}</div>
  );
}
