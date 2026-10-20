'use client';

import { useId, type ReactNode } from 'react';
import type { ActionState } from '@empgt/contracts';
import { findAction } from '@/components/ui/actions';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/feedback';

/**
 * Bouton gouverné par une action calculée par l'API, mais qui ouvre une interface locale
 * (mode édition, formulaire) au lieu d'appeler directement l'API.
 * Absent si l'action n'existe pas ; désactivé avec le motif si elle n'est pas possible.
 */
export function GatedButton({
  actions,
  action,
  children,
  onClick,
  variant = 'secondary',
  size = 'md',
}: {
  actions: ActionState[] | undefined;
  action: string;
  children: ReactNode;
  onClick: () => void;
  variant?: 'primary' | 'secondary' | 'danger' | 'success' | 'ghost';
  size?: 'sm' | 'md';
}) {
  const state = findAction(actions, action);
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
        {children}
      </Button>
      {!state.allowed && state.reason && (
        <span id={reasonId} className="mt-1 max-w-xs text-xs text-gray-600">
          {state.reason}
        </span>
      )}
    </div>
  );
}

/** Motif affiché lorsqu'une action existe mais n'est pas possible (formulaires). */
export function ActionUnavailable({ state }: { state: ActionState | undefined }) {
  if (!state || state.allowed || !state.reason) return null;
  return (
    <p className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
      {state.reason}
    </p>
  );
}

/** Barre de filtres d'une liste (le texte libre est appliqué à l'envoi du formulaire). */
export function FilterBar({
  children,
  onSubmit,
  onReset,
  active,
}: {
  children: ReactNode;
  onSubmit: () => void;
  onReset?: () => void;
  active?: boolean;
}) {
  return (
    <form
      role="search"
      aria-label="Filtres de la liste"
      className="mb-4 grid gap-3 rounded-lg border border-gray-200 bg-white p-4 sm:grid-cols-2 lg:grid-cols-4 lg:items-end"
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit();
      }}
    >
      {children}
      <div className="flex flex-wrap gap-2">
        <Button type="submit">Rechercher</Button>
        {active && onReset && (
          <Button variant="ghost" onClick={onReset}>
            Réinitialiser
          </Button>
        )}
      </div>
    </form>
  );
}

/** Indique qu'une liste déjà affichée est en cours de rechargement (changement de filtre). */
export function Refreshing({ loading }: { loading: boolean }) {
  if (!loading) return null;
  return (
    <div className="mb-2">
      <Spinner label="Mise à jour…" />
    </div>
  );
}

/** Section ancrable (liens « #candidatures », « #membres »…) tenant compte de l'en-tête fixe. */
export function Anchor({ id, children }: { id: string; children: ReactNode }) {
  return (
    <div id={id} className="scroll-mt-20">
      {children}
    </div>
  );
}

/** Texte libre sur plusieurs lignes (« — » si vide). */
export function MultiLine({ text }: { text: string | null | undefined }) {
  if (!text) return <>—</>;
  return <span className="whitespace-pre-line">{text}</span>;
}
