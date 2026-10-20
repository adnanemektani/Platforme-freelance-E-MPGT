'use client';

import { useState } from 'react';
import type { ActionState, ReviewView } from '@empgt/contracts';
import { api } from '@/lib/api';
import { formatDateTime } from '@/lib/format';
import { useAction, useApi } from '@/lib/hooks';
import { findAction } from '@/components/ui/actions';
import { Button } from '@/components/ui/button';
import { Alert, ResourceView } from '@/components/ui/feedback';
import { Field, FormError, formValue, Textarea } from '@/components/ui/form';

function Stars({ rating }: { rating: number }) {
  return (
    <span aria-label={`${rating} sur 5`} className="text-amber-600">
      {'★'.repeat(rating)}
      <span className="text-gray-300">{'★'.repeat(5 - rating)}</span>
    </span>
  );
}

/** Évaluation de la mission (interne à E-MPGT par défaut) : affichée seulement si l'action « review » existe. */
export function ContractReview({ contractId, actions }: { contractId: string; actions: ActionState[] }) {
  const state = findAction(actions, 'review');
  const reviews = useApi<ReviewView[]>(state ? `/contracts/reviews?contractId=${contractId}` : null);
  const action = useAction();
  const [formKey, setFormKey] = useState(0);
  if (!state) return null;

  return (
    <div className="space-y-4">
      <ResourceView resource={reviews}>
        {(list) =>
          list.length > 0 ? (
            <ul className="space-y-2">
              {list.map((r) => (
                <li key={r.id} className="rounded-md border border-gray-100 bg-gray-50 p-3 text-sm">
                  <Stars rating={r.rating} /> <span className="text-xs text-gray-500">— {formatDateTime(r.createdAt)}</span>
                  {r.comment && <p className="mt-1 whitespace-pre-line text-gray-800">{r.comment}</p>}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-gray-600">Vous n’avez pas encore évalué cette mission.</p>
          )
        }
      </ResourceView>
      {!state.allowed ? (
        <Alert tone="info">{state.reason ?? 'Évaluation impossible pour le moment.'}</Alert>
      ) : (
        <form
          key={formKey}
          className="space-y-3"
          onSubmit={async (e) => {
            e.preventDefault();
            const form = new FormData(e.currentTarget);
            const created = await action.run(
              () => api.post<ReviewView>(`/contracts/${contractId}/reviews`, { rating: form.get('rating'), comment: formValue(form, 'comment') }),
              { success: 'Évaluation enregistrée' },
            );
            if (created) {
              setFormKey((k) => k + 1);
              await reviews.reload();
            }
          }}
        >
          <fieldset>
            <legend className="text-sm font-medium text-gray-800">
              Note de la collaboration avec l’entreprise <span className="text-red-700" aria-hidden="true">*</span>
            </legend>
            <div className="mt-1 flex flex-wrap gap-3">
              {[1, 2, 3, 4, 5].map((n) => (
                <label key={n} className="inline-flex items-center gap-1 text-sm text-gray-800">
                  <input type="radio" name="rating" value={n} required className="h-4 w-4 text-brand-700" />
                  {n} / 5
                </label>
              ))}
            </div>
          </fieldset>
          <Field label="Commentaire" hint="Facultatif. Évaluation interne transmise à E-MPGT.">
            {(p) => <Textarea {...p} name="comment" maxLength={4000} rows={3} />}
          </Field>
          <FormError error={action.error} />
          <Button type="submit" size="sm" loading={action.pending}>
            Enregistrer l’évaluation
          </Button>
        </form>
      )}
    </div>
  );
}
