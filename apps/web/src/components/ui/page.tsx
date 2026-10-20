import Link from 'next/link';
import type { ReactNode } from 'react';

export function PageHeader({
  title,
  description,
  actions,
  breadcrumbs,
  badge,
}: {
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  breadcrumbs?: Array<{ label: string; href?: string }>;
  badge?: ReactNode;
}) {
  return (
    <header className="mb-6 space-y-2">
      {breadcrumbs && breadcrumbs.length > 0 && (
        <nav aria-label="Fil d’Ariane" className="text-sm text-gray-600">
          <ol className="flex flex-wrap items-center gap-1">
            {breadcrumbs.map((b, i) => (
              <li key={b.label} className="flex items-center gap-1">
                {i > 0 && <span aria-hidden="true">/</span>}
                {b.href ? (
                  <Link href={b.href} className="hover:underline">
                    {b.label}
                  </Link>
                ) : (
                  <span aria-current="page">{b.label}</span>
                )}
              </li>
            ))}
          </ol>
        </nav>
      )}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight text-gray-900">{title}</h1>
            {badge}
          </div>
          {description && <p className="mt-1 max-w-3xl text-sm text-gray-600">{description}</p>}
        </div>
        {actions && <div className="flex flex-wrap items-start gap-2">{actions}</div>}
      </div>
    </header>
  );
}

export function Tabs({ tabs, current, onChange }: { tabs: Array<{ id: string; label: string; count?: number }>; current: string; onChange: (id: string) => void }) {
  return (
    <div role="tablist" className="mb-4 flex flex-wrap gap-1 border-b border-gray-200">
      {tabs.map((t) => (
        <button
          key={t.id}
          role="tab"
          type="button"
          aria-selected={current === t.id}
          onClick={() => onChange(t.id)}
          className={`-mb-px border-b-2 px-3 py-2 text-sm font-medium ${current === t.id ? 'border-brand-700 text-brand-800' : 'border-transparent text-gray-600 hover:text-gray-900'}`}
        >
          {t.label}
          {t.count !== undefined && <span className="ml-1.5 rounded-full bg-gray-100 px-1.5 text-xs text-gray-700">{t.count}</span>}
        </button>
      ))}
    </div>
  );
}
