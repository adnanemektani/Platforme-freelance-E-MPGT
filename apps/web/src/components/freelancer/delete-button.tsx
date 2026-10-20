'use client';

import { useId, useState, type ReactNode } from 'react';
import type { ActionState } from '@empgt/contracts';
import { api } from '@/lib/api';
import { useAction } from '@/lib/hooks';
import { findAction } from '@/components/ui/actions';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/dialog';

/**
 * Suppression reliée à une action calculée par le serveur, pour les routes DELETE qui ne
 * renvoient pas de contenu (204) : n'apparaît que si l'action existe, désactivée avec son motif
 * sinon, confirmation obligatoire, et l'écran n'est mis à jour qu'après la réponse de l'API.
 */
export function DeleteButton({
  actions,
  action = 'delete',
  label = 'Supprimer',
  endpoint,
  confirmTitle,
  confirmMessage,
  success,
  onDone,
  size = 'sm',
  variant = 'danger',
}: {
  actions: ActionState[] | undefined;
  action?: string;
  label?: string;
  endpoint: string;
  confirmTitle: string;
  confirmMessage?: ReactNode;
  success: string;
  onDone: () => void;
  size?: 'sm' | 'md';
  variant?: 'danger' | 'secondary' | 'ghost';
}) {
  const state = findAction(actions, action);
  const { run, pending } = useAction();
  const [open, setOpen] = useState(false);
  const reasonId = useId();
  if (!state) return null;

  return (
    <div className="inline-flex flex-col">
      <Button variant={variant} size={size} disabled={!state.allowed} aria-describedby={!state.allowed ? reasonId : undefined} onClick={() => setOpen(true)}>
        {label}
      </Button>
      {!state.allowed && state.reason && (
        <span id={reasonId} className="mt-1 max-w-xs text-xs text-gray-600">
          {state.reason}
        </span>
      )}
      <ConfirmDialog
        open={open}
        onClose={() => setOpen(false)}
        title={confirmTitle}
        message={confirmMessage}
        confirmLabel={label}
        tone="danger"
        pending={pending}
        onConfirm={async () => {
          const ok = await run(
            async () => {
              await api.delete(endpoint, {});
              return true;
            },
            { success },
          );
          if (ok) {
            setOpen(false);
            onDone();
          }
        }}
      />
    </div>
  );
}
