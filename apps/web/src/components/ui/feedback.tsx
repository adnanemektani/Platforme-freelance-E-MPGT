import type { ReactNode } from 'react';
import type { ApiError } from '@/lib/api';

type Tone = 'info' | 'success' | 'warning' | 'danger';

const TONES: Record<Tone, string> = {
  info: 'border-brand-200 bg-brand-50 text-brand-900',
  success: 'border-accent-100 bg-accent-50 text-accent-800',
  warning: 'border-amber-200 bg-amber-50 text-amber-900',
  danger: 'border-red-200 bg-red-50 text-red-800',
};

export function Alert({ tone = 'info', title, children }: { tone?: Tone; title?: string; children?: ReactNode }) {
  return (
    <div role={tone === 'danger' ? 'alert' : 'status'} className={`rounded-md border p-4 text-sm ${TONES[tone]}`}>
      {title && <p className="font-semibold">{title}</p>}
      {children && <div className={title ? 'mt-1' : ''}>{children}</div>}
    </div>
  );
}

export function Spinner({ label = 'Chargement…' }: { label?: string }) {
  return (
    <span className="inline-flex items-center gap-2 text-sm text-gray-600" role="status">
      <span className="h-4 w-4 animate-spin rounded-full border-2 border-brand-500 border-t-transparent" aria-hidden="true" />
      {label}
    </span>
  );
}

export function LoadingBlock({ label }: { label?: string }) {
  return (
    <div className="flex items-center justify-center rounded-lg border border-dashed border-gray-200 bg-white p-10">
      <Spinner label={label} />
    </div>
  );
}

export function EmptyState({ title, description, action }: { title: string; description?: string; action?: ReactNode }) {
  return (
    <div className="rounded-lg border border-dashed border-gray-300 bg-white p-8 text-center">
      <p className="font-medium text-gray-900">{title}</p>
      {description && <p className="mt-1 text-sm text-gray-600">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function ErrorBlock({ error, onRetry }: { error: ApiError; onRetry?: () => void }) {
  const title =
    error.status === 404 ? 'Élément introuvable' : error.status === 403 ? 'Accès refusé' : error.status === 0 ? 'Serveur injoignable' : 'Une erreur est survenue';
  return (
    <Alert tone="danger" title={title}>
      <p>{error.message}</p>
      {error.requestId && <p className="mt-1 text-xs opacity-75">Référence : {error.requestId}</p>}
      {onRetry && error.status !== 404 && error.status !== 403 && (
        <button type="button" onClick={onRetry} className="mt-2 font-medium underline">
          Réessayer
        </button>
      )}
    </Alert>
  );
}

/** Rendu standard d'une ressource : chargement, erreur, puis contenu. */
export function ResourceView<T>({
  resource,
  children,
  loadingLabel,
}: {
  resource: { data: T | undefined; error: ApiError | undefined; loading: boolean; reload: () => Promise<void> };
  children: (data: T) => ReactNode;
  loadingLabel?: string;
}) {
  if (resource.error && !resource.data) return <ErrorBlock error={resource.error} onRetry={() => void resource.reload()} />;
  if (!resource.data) return <LoadingBlock label={loadingLabel} />;
  return <>{children(resource.data)}</>;
}
