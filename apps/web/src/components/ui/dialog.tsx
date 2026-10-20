'use client';

import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { Button } from './button';
import { Field, Textarea } from './form';

/** Boîte de dialogue modale native (<dialog>) : piège du focus et touche Échap gérés par le navigateur. */
export function Dialog({ open, onClose, title, children, footer }: { open: boolean; onClose: () => void; title: string; children: ReactNode; footer?: ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);
  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      onClose={onClose}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      className="w-full max-w-lg rounded-lg p-0 shadow-xl backdrop:bg-gray-900/40"
    >
      <div className="border-b border-gray-100 px-5 py-4">
        <h2 id={titleId} className="text-base font-semibold text-gray-900">
          {title}
        </h2>
      </div>
      <div className="space-y-4 px-5 py-4">{children}</div>
      {footer && <div className="flex justify-end gap-2 border-t border-gray-100 px-5 py-3">{footer}</div>}
    </dialog>
  );
}

/**
 * Confirmation d'une action sensible. Avec `reasonLabel`, un motif est demandé
 * (et transmis au serveur, qui l'enregistre dans le journal d'audit).
 */
export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  message,
  confirmLabel = 'Confirmer',
  tone = 'primary',
  reasonLabel,
  reasonRequired = false,
  pending = false,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: (reason: string | null) => void | Promise<void>;
  title: string;
  message?: ReactNode;
  confirmLabel?: string;
  tone?: 'primary' | 'danger' | 'success';
  reasonLabel?: string;
  reasonRequired?: boolean;
  pending?: boolean;
}) {
  const [reason, setReason] = useState('');
  const invalid = reasonRequired && reason.trim().length < 3;
  return (
    <Dialog
      open={open}
      onClose={() => {
        setReason('');
        onClose();
      }}
      title={title}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={pending}>
            Annuler
          </Button>
          <Button
            variant={tone}
            loading={pending}
            disabled={invalid}
            onClick={async () => {
              await onConfirm(reason.trim() || null);
              setReason('');
            }}
          >
            {confirmLabel}
          </Button>
        </>
      }
    >
      {message && <div className="text-sm text-gray-700">{message}</div>}
      {reasonLabel && (
        <Field label={reasonLabel} required={reasonRequired} hint={reasonRequired ? 'Obligatoire : le motif est conservé dans l’historique.' : 'Facultatif'}>
          {(props) => <Textarea {...props} value={reason} onChange={(e) => setReason(e.target.value)} />}
        </Field>
      )}
    </Dialog>
  );
}
