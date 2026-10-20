'use client';

import { useId, type ReactNode } from 'react';
import type { ApiError } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { FormError } from '@/components/ui/form';

/** Boîte de dialogue contenant un formulaire d'ajout / de modification d'un élément du profil. */
export function ItemDialog({
  open,
  title,
  submitLabel,
  pending,
  error,
  onClose,
  onSubmit,
  children,
}: {
  open: boolean;
  title: string;
  submitLabel: string;
  pending: boolean;
  error?: ApiError | null;
  onClose: () => void;
  onSubmit: (form: FormData) => void | Promise<void>;
  children: ReactNode;
}) {
  const formId = useId();
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={title}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={pending}>
            Annuler
          </Button>
          <Button type="submit" form={formId} loading={pending}>
            {submitLabel}
          </Button>
        </>
      }
    >
      {open && (
        <form
          id={formId}
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            void onSubmit(new FormData(e.currentTarget));
          }}
        >
          {children}
          <FormError error={error} />
        </form>
      )}
    </Dialog>
  );
}
