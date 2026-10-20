'use client';

import { useState } from 'react';
import type { ContractView, ReviewView } from '@empgt/contracts';
import { api, qs } from '@/lib/api';
import { formatDateTime } from '@/lib/format';
import { useAction, useApi } from '@/lib/hooks';
import { findAction } from '@/components/ui/actions';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Field, FormError, formValue, Select, Textarea } from '@/components/ui/form';
import { REVIEW_VISIBILITY } from './display';
import { ActionUnavailable } from './widgets';

const RATINGS = [
  { value: '5', label: '5 — Excellent' },
  { value: '4', label: '4 — Très bien' },
  { value: '3', label: '3 — Satisfaisant' },
  { value: '2', label: '2 — Insuffisant' },
  { value: '1', label: '1 — Très insuffisant' },
];

function Stars({ rating }: { rating: number }) {
  return (
    <span aria-label={`Note : ${rating} sur 5`} className="text-amber-500">
      <span aria-hidden="true">{'★'.repeat(rating)}</span>
      <span aria-hidden="true" className="text-gray-300">
        {'★'.repeat(Math.max(0, 5 - rating))}
      </span>
    </span>
  );
}

/** Évaluation de la mission par l'entreprise (visibilité interne E-MPGT). */
export function ContractReviews({ contract }: { contract: ContractView }) {
  const reviews = useApi<ReviewView[]>(`/contracts/reviews${qs({ contractId: contract.id })}`);
  const state = findAction(contract.actions, 'review');
  const action = useAction();
  const [formKey, setFormKey] = useState(0);
  const own = reviews.data ?? [];
  if (!state && own.length === 0) return null;

  return (
    <Card
      title="Évaluation de la mission"
      description="Visibilité interne : votre évaluation est réservée à E-MPGT et n’est pas publiée."
    >
      <div className="space-y-4">
        {own.length > 0 && (
          <ul className="divide-y divide-gray-100">
            {own.map((r) => (
              <li key={r.id} className="space-y-1 py-2 text-sm">
                <div className="flex flex-wrap items-center gap-2">
                  <Stars rating={r.rating} />
                  <span className="text-xs text-gray-500">
                    {formatDateTime(r.createdAt)} ·{' '}
                    {REVIEW_VISIBILITY[r.visibility] ?? r.visibility}
                  </span>
                </div>
                {r.comment && <p className="whitespace-pre-line text-gray-800">{r.comment}</p>}
              </li>
            ))}
          </ul>
        )}
        <ActionUnavailable state={state} />
        {state?.allowed && (
          <form
            key={formKey}
            className="space-y-4"
            onSubmit={async (e) => {
              e.preventDefault();
              const form = new FormData(e.currentTarget);
              const created = await action.run(
                () =>
                  api.post<ReviewView>(`/contracts/${contract.id}/reviews`, {
                    rating: Number(form.get('rating')),
                    comment: formValue(form, 'comment'),
                  }),
                { success: 'Évaluation enregistrée' },
              );
              if (created) {
                setFormKey((k) => k + 1);
                await reviews.reload();
              }
            }}
          >
            <div className="grid gap-4 sm:grid-cols-[14rem_1fr]">
              <Field label="Note" required>
                {(p) => (
                  <Select
                    {...p}
                    name="rating"
                    defaultValue=""
                    placeholder="Choisir une note"
                    options={RATINGS}
                  />
                )}
              </Field>
              <Field
                label="Commentaire"
                hint="Facultatif : qualité du travail, respect des délais, communication…"
              >
                {(p) => <Textarea {...p} name="comment" rows={3} maxLength={4000} />}
              </Field>
            </div>
            <FormError error={action.error} />
            <Button type="submit" loading={action.pending}>
              Enregistrer l’évaluation
            </Button>
          </form>
        )}
      </div>
    </Card>
  );
}
