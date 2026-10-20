'use client';

import { useId, useState, type ReactNode } from 'react';
import { labels, type ActionState, type DocumentView, type Page } from '@empgt/contracts';
import { api, documentUrl, qs } from '@/lib/api';
import { formatDate, formatDateTime } from '@/lib/format';
import { useAction, useApi } from '@/lib/hooks';
import { ActionButton, findAction } from '@/components/ui/actions';
import { Badge, StatusBadge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Dialog } from '@/components/ui/dialog';
import { ResourceView } from '@/components/ui/feedback';
import { Field, FormError, formValue, Input, Select, Textarea } from '@/components/ui/form';
import { DataTable, Pagination } from '@/components/ui/table';
import { fieldLabel } from './a-labels';

// ── Barre de décisions (boutons issus du tableau `actions` de l'API) ────────

export interface ADecision {
  /** Nom de l'action dans le tableau `actions`. */
  action: string;
  label: string;
  /** Segment ajouté à l'URL de base (ex. « request-changes »). */
  path: string;
  reason?: 'required' | 'optional';
  reasonLabel?: string;
  variant?: 'primary' | 'secondary' | 'danger' | 'success' | 'ghost';
  success: string;
  message?: ReactNode;
}

/** Affiche uniquement les décisions présentes dans `actions` (désactivées avec motif si impossibles). */
export function ADecisionBar<T>({
  actions,
  base,
  decisions,
  onDone,
}: {
  actions: ActionState[];
  base: string;
  decisions: ADecision[];
  onDone: (result: T) => void;
}) {
  return (
    <div className="flex flex-wrap items-start gap-2">
      {decisions.map((d) => (
        <ActionButton<T>
          key={d.action}
          actions={actions}
          action={d.action}
          label={d.label}
          endpoint={`${base}/${d.path}`}
          reason={d.reason}
          reasonLabel={d.reasonLabel ?? (d.reason === 'optional' ? 'Commentaire' : 'Motif')}
          variant={d.variant ?? 'secondary'}
          success={d.success}
          confirm={{ title: d.label, message: d.message }}
          onDone={onDone}
        />
      ))}
    </div>
  );
}

/**
 * Bouton local (ouverture d'un formulaire, d'une boîte de dialogue) relié à une action de l'API :
 * absent si l'action n'existe pas, désactivé avec le motif si elle n'est pas possible.
 */
export function AStateButton({
  state,
  label,
  onClick,
  variant = 'secondary',
  size = 'sm',
}: {
  state: ActionState | undefined;
  label: string;
  onClick: () => void;
  variant?: 'primary' | 'secondary' | 'danger' | 'success' | 'ghost';
  size?: 'sm' | 'md';
}) {
  const reasonId = useId();
  if (!state) return null;
  return (
    <div className="inline-flex flex-col">
      <Button
        variant={variant}
        size={size}
        disabled={!state.allowed}
        aria-describedby={!state.allowed ? reasonId : undefined}
        onClick={onClick}
      >
        {label}
      </Button>
      {!state.allowed && state.reason && (
        <span id={reasonId} className="mt-1 max-w-xs text-xs text-gray-600">
          {state.reason}
        </span>
      )}
    </div>
  );
}

// ── Vérification d'un justificatif (documents, qualifications) ─────────────

/**
 * Bouton + boîte de dialogue « Vérifier / refuser » : statut, note, échéance.
 * `state` : action « verify » renvoyée par l'API (si absente, rien n'est affiché).
 * `ungated` : objet pour lequel l'API ne renvoie pas de tableau `actions` (qualifications) :
 * le bouton est toujours proposé et le serveur reste seul juge de la décision.
 */
export function AVerifyButton<T>({
  state: gate,
  ungated = false,
  endpoint,
  title,
  defaultExpiresAt,
  onDone,
}: {
  state?: ActionState;
  ungated?: boolean;
  endpoint: string;
  title: string;
  defaultExpiresAt?: string | null;
  onDone: (result: T) => void;
}) {
  const [open, setOpen] = useState(false);
  const action = useAction();
  const reasonId = useId();
  const formId = useId();
  const state: ActionState | undefined = ungated ? { action: 'verify', allowed: true } : gate;
  if (!state) return null;
  return (
    <div className="inline-flex flex-col">
      <Button
        size="sm"
        variant="secondary"
        disabled={!state.allowed}
        aria-describedby={!state.allowed ? reasonId : undefined}
        onClick={() => setOpen(true)}
      >
        Vérifier / refuser
      </Button>
      {!state.allowed && state.reason && (
        <span id={reasonId} className="mt-1 max-w-xs text-xs text-gray-600">
          {state.reason}
        </span>
      )}
      <Dialog
        open={open}
        onClose={() => {
          action.clearError();
          setOpen(false);
        }}
        title={title}
        footer={
          <>
            <Button variant="secondary" onClick={() => setOpen(false)} disabled={action.pending}>
              Annuler
            </Button>
            <Button type="submit" form={formId} loading={action.pending}>
              Enregistrer la décision
            </Button>
          </>
        }
      >
        <form
          id={formId}
          className="space-y-4"
          onSubmit={async (e) => {
            e.preventDefault();
            const form = new FormData(e.currentTarget);
            const result = await action.run(
              () =>
                api.post<T>(endpoint, {
                  status: formValue(form, 'status'),
                  note: formValue(form, 'note'),
                  expiresAt: formValue(form, 'expiresAt'),
                }),
              { success: 'Décision enregistrée' },
            );
            if (result !== undefined) {
              setOpen(false);
              onDone(result);
            }
          }}
        >
          <Field label="Décision" required>
            {(p) => (
              <Select
                {...p}
                name="status"
                defaultValue="VERIFIED"
                options={[
                  { value: 'VERIFIED', label: 'Vérifié : justificatif conforme' },
                  { value: 'REJECTED', label: 'Refusé : justificatif non conforme' },
                ]}
              />
            )}
          </Field>
          <Field
            label="Note"
            hint="Obligatoire en cas de refus : elle est communiquée au déposant et conservée dans l’historique."
          >
            {(p) => <Textarea {...p} name="note" rows={3} />}
          </Field>
          <Field
            label="Date d’échéance"
            hint="Facultatif : date de fin de validité du justificatif."
          >
            {(p) => (
              <Input {...p} name="expiresAt" type="date" defaultValue={defaultExpiresAt ?? ''} />
            )}
          </Field>
          <FormError error={action.error} />
        </form>
      </Dialog>
    </div>
  );
}

// ── Documents rattachés à un profil ou une entreprise ───────────────────────

const EXPIRY: Record<
  DocumentView['expiryState'],
  { label: string; tone: 'gray' | 'green' | 'amber' | 'red' } | null
> = {
  none: null,
  valid: { label: 'Valide', tone: 'green' },
  expiring: { label: 'Échéance proche', tone: 'amber' },
  expired: { label: 'Échu', tone: 'red' },
};

export function ADocumentsCard({
  filter,
  title = 'Documents',
  description,
}: {
  filter: { profileId?: string; companyId?: string };
  title?: string;
  description?: string;
}) {
  const [page, setPage] = useState(1);
  const docs = useApi<Page<DocumentView>>(`/documents${qs({ ...filter, page, pageSize: 20 })}`);
  return (
    <Card
      title={title}
      description={
        description ??
        'Justificatifs déposés. Le téléchargement est contrôlé et tracé par le serveur.'
      }
    >
      <ResourceView resource={docs} loadingLabel="Chargement des documents…">
        {(data) => (
          <>
            <DataTable
              rows={data.items}
              rowKey={(d) => d.id}
              caption={title}
              empty={{ title: 'Aucun document', description: 'Aucun justificatif n’a été déposé.' }}
              columns={[
                {
                  header: 'Document',
                  cell: (d) => (
                    <span className="block">
                      <span className="font-medium text-gray-900">
                        {d.title ?? d.originalFilename}
                      </span>
                      <span className="block text-xs text-gray-600">
                        {labels.documentKind[d.kind]} · déposé le {formatDate(d.createdAt)}
                        {d.uploadedByName ? ` par ${d.uploadedByName}` : ''}
                      </span>
                    </span>
                  ),
                },
                {
                  header: 'Vérification',
                  cell: (d) => (
                    <span className="block">
                      <StatusBadge
                        status={d.verificationStatus}
                        label={labels.documentVerification[d.verificationStatus]}
                      />
                      {d.verificationNote && (
                        <span className="mt-1 block max-w-xs text-xs text-gray-600">
                          {d.verificationNote}
                        </span>
                      )}
                      {d.verifiedAt && (
                        <span className="block text-xs text-gray-500">
                          le {formatDateTime(d.verifiedAt)}
                        </span>
                      )}
                    </span>
                  ),
                },
                {
                  header: 'Échéance',
                  cell: (d) => {
                    const expiry = EXPIRY[d.expiryState];
                    return (
                      <span className="flex flex-wrap items-center gap-1">
                        {formatDate(d.expiresAt)}
                        {expiry && <Badge tone={expiry.tone}>{expiry.label}</Badge>}
                      </span>
                    );
                  },
                },
                {
                  header: 'Actions',
                  cell: (d) => (
                    <span className="flex flex-wrap items-start gap-2">
                      {findAction(d.actions, 'download') && (
                        <a
                          href={documentUrl(d.id)}
                          className="text-sm font-medium text-brand-700 underline"
                        >
                          Télécharger
                        </a>
                      )}
                      {findAction(d.actions, 'download') &&
                        (d.mimeType === 'application/pdf' || d.mimeType.startsWith('image/')) && (
                          <a
                            href={documentUrl(d.id, true)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-sm font-medium text-brand-700 underline"
                          >
                            Aperçu
                          </a>
                        )}
                      <AVerifyButton<DocumentView>
                        state={findAction(d.actions, 'verify')}
                        endpoint={`/documents/${d.id}/verify`}
                        title={`Vérifier « ${d.title ?? d.originalFilename} »`}
                        defaultExpiresAt={d.expiresAt}
                        onDone={() => void docs.reload()}
                      />
                    </span>
                  ),
                },
              ]}
            />
            <Pagination page={data} onChange={setPage} />
          </>
        )}
      </ResourceView>
    </Card>
  );
}

// ── Petits éléments d'affichage ─────────────────────────────────────────────

/** Liste de champs (clés renvoyées par l'API) affichés avec un libellé lisible. */
export function AFieldBadges({
  fields,
  tone = 'gray',
  empty = 'Aucun',
}: {
  fields: string[];
  tone?: 'gray' | 'amber' | 'purple' | 'blue' | 'red';
  empty?: string;
}) {
  if (fields.length === 0) return <p className="text-sm text-gray-600">{empty}</p>;
  return (
    <ul className="flex flex-wrap gap-1.5">
      {fields.map((f) => (
        <li key={f}>
          <Badge tone={tone}>{fieldLabel(f)}</Badge>
        </li>
      ))}
    </ul>
  );
}

/** Données techniques repliables (métadonnées, texte brut…). */
export function ADetails({
  summary,
  children,
  className = '',
}: {
  summary: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <details className={`rounded-md border border-gray-200 bg-gray-50 text-sm ${className}`}>
      <summary className="cursor-pointer select-none px-3 py-2 font-medium text-gray-800">
        {summary}
      </summary>
      <div className="border-t border-gray-200 px-3 py-2">{children}</div>
    </details>
  );
}

export function AJson({ value }: { value: unknown }) {
  return (
    <pre className="max-h-80 overflow-auto whitespace-pre-wrap break-all text-xs text-gray-800">
      {JSON.stringify(value, null, 2)}
    </pre>
  );
}

/** Texte long avec retours à la ligne conservés. */
export function AText({
  value,
  empty = '—',
}: {
  value: string | null | undefined;
  empty?: string;
}) {
  if (!value) return <span className="text-gray-500">{empty}</span>;
  return <span className="whitespace-pre-wrap">{value}</span>;
}

/** Formulaire de filtres standard (soumis explicitement). */
export function AFilterForm({
  onSubmit,
  onReset,
  children,
}: {
  onSubmit: () => void;
  onReset?: () => void;
  children: ReactNode;
}) {
  return (
    <form
      className="mb-4 grid gap-3 rounded-lg border border-gray-200 bg-white p-4 sm:grid-cols-2 lg:grid-cols-4"
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit();
      }}
    >
      {children}
      <div className="flex items-end gap-2">
        <Button type="submit">Filtrer</Button>
        {onReset && (
          <Button variant="ghost" onClick={onReset}>
            Réinitialiser
          </Button>
        )}
      </div>
    </form>
  );
}

/** Période d'une expérience : libellé source, sinon mois/année de début et de fin. */
export function periodOf(e: {
  periodLabel: string | null;
  startYear: number | null;
  startMonth: number | null;
  endYear: number | null;
  endMonth: number | null;
  isCurrent: boolean;
}): string {
  if (e.periodLabel) return e.periodLabel;
  const part = (year: number | null, month: number | null) =>
    year ? `${month ? `${String(month).padStart(2, '0')}/` : ''}${year}` : null;
  const start = part(e.startYear, e.startMonth);
  const end = e.isCurrent ? 'aujourd’hui' : part(e.endYear, e.endMonth);
  if (!start && !end) return '';
  return `${start ?? '?'} – ${end ?? '?'}`;
}
