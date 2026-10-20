'use client';

import Link from 'next/link';
import { useId, useState } from 'react';
import type { ActionState, PendingItem } from '@empgt/contracts';
import { api } from '@/lib/api';
import { useAction } from '@/lib/hooks';
import { Button } from './button';
import { ConfirmDialog } from './dialog';

export function findAction(actions: ActionState[] | undefined, action: string): ActionState | undefined {
  return actions?.find((a) => a.action === action);
}

export function can(actions: ActionState[] | undefined, action: string): boolean {
  return Boolean(findAction(actions, action)?.allowed);
}

/**
 * Bouton relié à une action calculée par le serveur : il n'apparaît que si l'action existe
 * pour l'utilisateur, et il est désactivé (avec le motif affiché) si elle n'est pas possible.
 * Le résultat dépend uniquement de la réponse de l'API.
 */
export function ActionButton<T>({
  actions,
  action,
  label,
  endpoint,
  method = 'post',
  body,
  confirm,
  reason,
  reasonLabel = 'Motif',
  reasonField = 'reason',
  variant = 'primary',
  success,
  onDone,
  size = 'md',
}: {
  actions: ActionState[] | undefined;
  action: string;
  label: string;
  endpoint: string;
  method?: 'post' | 'patch' | 'put' | 'delete';
  body?: Record<string, unknown>;
  confirm?: { title: string; message?: React.ReactNode; confirmLabel?: string };
  reason?: 'required' | 'optional';
  reasonLabel?: string;
  /** Nom du champ envoyé à l'API pour le motif (« reason » par défaut, « comment » pour les propositions). */
  reasonField?: string;
  variant?: 'primary' | 'secondary' | 'danger' | 'success' | 'ghost';
  success?: string;
  onDone?: (result: T) => void;
  size?: 'sm' | 'md';
}) {
  const state = findAction(actions, action);
  const { run, pending } = useAction();
  const [open, setOpen] = useState(false);
  const reasonId = useId();
  if (!state) return null;

  const execute = async (motif: string | null) => {
    const payload = { ...(body ?? {}), ...(reason ? { [reasonField]: motif } : {}) };
    // Enveloppe : une réponse 204 (sans corps) reste un succès.
    const outcome = await run(async () => ({ value: await api[method]<T>(endpoint, payload) }), { success });
    if (outcome) {
      setOpen(false);
      onDone?.(outcome.value);
    }
  };

  const needsDialog = Boolean(confirm || reason);
  return (
    <div className="inline-flex flex-col">
      <Button
        variant={variant}
        size={size}
        disabled={!state.allowed}
        loading={pending && !needsDialog}
        aria-describedby={!state.allowed ? reasonId : undefined}
        onClick={() => (needsDialog ? setOpen(true) : void execute(null))}
      >
        {label}
      </Button>
      {!state.allowed && state.reason && (
        <span id={reasonId} className="mt-1 max-w-xs text-xs text-gray-600">
          {state.reason}
        </span>
      )}
      {needsDialog && (
        <ConfirmDialog
          open={open}
          onClose={() => setOpen(false)}
          onConfirm={execute}
          title={confirm?.title ?? label}
          message={confirm?.message}
          confirmLabel={confirm?.confirmLabel ?? label}
          tone={variant === 'danger' ? 'danger' : variant === 'success' ? 'success' : 'primary'}
          reasonLabel={reason ? reasonLabel : undefined}
          reasonRequired={reason === 'required'}
          pending={pending}
        />
      )}
    </div>
  );
}

const SEVERITY = {
  action: 'border-amber-200 bg-amber-50',
  info: 'border-brand-200 bg-brand-50',
  blocked: 'border-red-200 bg-red-50',
};

/** Ce qui est en attente, pourquoi, et quelle action est possible. */
export function PendingList({ items, title = 'À faire / en attente' }: { items: PendingItem[] | undefined; title?: string }) {
  if (!items || items.length === 0) return null;
  return (
    <section aria-label={title} className="space-y-2">
      {items.map((item) => (
        <div key={item.code + item.title} className={`rounded-md border p-3 text-sm ${SEVERITY[item.severity]}`}>
          <p className="font-semibold text-gray-900">{item.title}</p>
          {item.description && <p className="mt-0.5 text-gray-700">{item.description}</p>}
          {item.link && (
            <Link href={item.link} className="mt-1 inline-block font-medium text-brand-700 underline">
              {item.severity === 'action' ? 'Agir' : 'Voir'}
            </Link>
          )}
        </div>
      ))}
    </section>
  );
}
