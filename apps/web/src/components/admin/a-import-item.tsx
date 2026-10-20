'use client';

import Link from 'next/link';
import { useId, useState } from 'react';
import { labels, type ImportItemView } from '@empgt/contracts';
import { api } from '@/lib/api';
import { formatDateTime } from '@/lib/format';
import { useAction } from '@/lib/hooks';
import { findAction } from '@/components/ui/actions';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { Alert } from '@/components/ui/feedback';
import { Field, FormError, formValue, Input, Textarea } from '@/components/ui/form';
import { ADetails, AFieldBadges, AStateButton, AText, periodOf } from './a-shared';

const CHANGE_TONES: Record<ImportItemView['change'], 'blue' | 'gray' | 'amber'> = {
  NEW: 'blue',
  UNCHANGED: 'gray',
  CHANGED: 'amber',
};
const STATUS_TONES: Record<ImportItemView['status'], 'amber' | 'green' | 'gray' | 'purple'> = {
  PENDING_REVIEW: 'amber',
  APPROVED: 'green',
  IGNORED: 'gray',
  DUPLICATE: 'purple',
};

type Decision = 'APPROVE' | 'IGNORE' | 'DUPLICATE';

const DECISIONS: Array<{
  decision: Decision;
  action: string;
  label: string;
  variant: 'success' | 'secondary' | 'danger';
}> = [
  { decision: 'APPROVE', action: 'approve', label: 'Valider', variant: 'success' },
  {
    decision: 'DUPLICATE',
    action: 'markDuplicate',
    label: 'Marquer comme doublon',
    variant: 'secondary',
  },
  { decision: 'IGNORE', action: 'ignore', label: 'Ignorer', variant: 'secondary' },
];

function Block({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <p className="text-xs font-medium uppercase tracking-wide text-gray-500">{title}</p>
      <div className="text-sm text-gray-900">{children}</div>
    </div>
  );
}

/** Élément d'un lot d'import : prévisualisation de l'analyse et décision manuelle. */
export function AImportItemCard({
  item,
  onReviewed,
}: {
  item: ImportItemView;
  onReviewed: (item: ImportItemView) => void;
}) {
  const [decision, setDecision] = useState<Decision | null>(null);
  const p = item.parsed;

  return (
    <article className="rounded-lg border border-gray-200 bg-white shadow-sm">
      <header className="flex flex-wrap items-start justify-between gap-3 border-b border-gray-100 px-5 py-4">
        <div className="min-w-0">
          <h3 className="text-base font-semibold text-gray-900">
            {p.headline ?? 'Profil sans titre'}
          </h3>
          <p className="mt-0.5 font-mono text-xs text-gray-500">
            {item.externalKey} · empreinte {item.fingerprint.slice(0, 12)}…
          </p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            <Badge tone={STATUS_TONES[item.status]}>{labels.importItemStatus[item.status]}</Badge>
            <Badge tone={CHANGE_TONES[item.change]}>{labels.importItemChange[item.change]}</Badge>
            {item.duplicateOf && (
              <Badge tone="red">
                Doublon probable ({Math.round(item.duplicateOf.score * 100)} %)
              </Badge>
            )}
          </div>
        </div>
        <div className="flex flex-wrap items-start gap-2">
          {DECISIONS.map((d) => (
            <AStateButton
              key={d.action}
              state={findAction(item.actions, d.action)}
              label={d.label}
              variant={d.variant}
              onClick={() => setDecision(d.decision)}
            />
          ))}
        </div>
      </header>

      <div className="space-y-4 px-5 py-4">
        {item.warnings.length > 0 && (
          <Alert tone="warning" title="Points d’attention de l’analyse">
            <ul className="list-disc pl-5">
              {item.warnings.map((w, i) => (
                <li key={`${i}-${w}`}>{w}</li>
              ))}
            </ul>
          </Alert>
        )}
        {item.duplicateOf && (
          <p className="text-sm text-gray-800">
            Ressemble au profil existant{' '}
            <Link
              href={`/admin/freelances/${item.duplicateOf.profileId}`}
              className="font-medium text-brand-700 underline"
            >
              {item.duplicateOf.headline ?? 'Profil sans titre'}
            </Link>{' '}
            (similarité {Math.round(item.duplicateOf.score * 100)} %).
          </p>
        )}
        {item.profileId && (
          <p className="text-sm text-gray-800">
            Profil correspondant :{' '}
            <Link
              href={`/admin/freelances/${item.profileId}`}
              className="font-medium text-brand-700 underline"
            >
              ouvrir la fiche
            </Link>
          </p>
        )}
        {item.lockedFields.length > 0 && (
          <Block title="Champs verrouillés (corrections humaines, non écrasés par l’import)">
            <AFieldBadges fields={item.lockedFields} tone="purple" />
          </Block>
        )}
        {(item.reviewNote || item.reviewedAt) && (
          <Block title="Décision">
            {item.reviewedAt && (
              <span className="text-gray-600">Le {formatDateTime(item.reviewedAt)}. </span>
            )}
            <AText value={item.reviewNote} empty="" />
          </Block>
        )}

        <div className="grid gap-4 md:grid-cols-2">
          <Block title="Accroche">
            <AText value={p.tagline} />
          </Block>
          <Block title="Résumé">
            <AText value={p.summary} />
          </Block>
        </div>

        <Block title={`Expériences (${p.experiences.length})`}>
          {p.experiences.length === 0 ? (
            <span className="text-gray-500">Aucune</span>
          ) : (
            <ol className="space-y-2">
              {p.experiences.map((e, i) => (
                <li key={`${e.title}-${i}`}>
                  <span className="font-medium">{e.title}</span>
                  <span className="text-gray-600">
                    {' '}
                    {[e.organization, periodOf(e)].filter(Boolean).join(' · ')}
                  </span>
                  {e.description && (
                    <span className="block text-gray-700">
                      <AText value={e.description} />
                    </span>
                  )}
                </li>
              ))}
            </ol>
          )}
        </Block>

        <Block title={`Compétences (${p.skills.length})`}>
          {p.skills.length === 0 ? (
            <span className="text-gray-500">Aucune</span>
          ) : (
            <ul className="flex flex-wrap gap-1.5">
              {p.skills.map((s, i) => (
                <li key={`${i}-${s.name}`}>
                  <Badge tone="blue">
                    {s.name}{' '}
                    <span className="opacity-75">· {labels.skillCategory[s.category]}</span>
                  </Badge>
                </li>
              ))}
            </ul>
          )}
        </Block>

        <div className="grid gap-4 md:grid-cols-2">
          <Block title={`Formations (${p.educations.length})`}>
            {p.educations.length === 0 ? (
              <span className="text-gray-500">Aucune</span>
            ) : (
              <ul className="space-y-1">
                {p.educations.map((e, i) => (
                  <li key={`${e.title}-${i}`}>
                    <span className="font-medium">{e.title}</span>
                    <span className="text-gray-600">
                      {' '}
                      {[e.institution, e.periodLabel ?? (e.year ? String(e.year) : null)]
                        .filter(Boolean)
                        .join(' · ')}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Block>
          <Block title={`Langues (${p.languages.length})`}>
            {p.languages.length === 0 ? (
              <span className="text-gray-500">Aucune</span>
            ) : (
              <ul className="flex flex-wrap gap-1.5">
                {p.languages.map((l, i) => (
                  <li key={`${i}-${l.name}`}>
                    <Badge>
                      {l.name}
                      {l.level ? ` — ${l.level}` : ''}
                    </Badge>
                  </li>
                ))}
              </ul>
            )}
          </Block>
        </div>

        <Block title="Mentions de qualifications (non vérifiées)">
          {p.qualificationMentions.length === 0 ? (
            <span className="text-gray-500">Aucune</span>
          ) : (
            <ul className="space-y-1">
              {p.qualificationMentions.map((q, i) => (
                <li key={`${i}-${q}`} className="flex flex-wrap items-center gap-2">
                  <span>{q}</span>
                  <Badge tone="amber">Non vérifiée</Badge>
                </li>
              ))}
            </ul>
          )}
        </Block>

        <ADetails summary="Texte brut collecté (usage interne)">
          <pre className="max-h-96 overflow-auto whitespace-pre-wrap text-xs text-gray-800">
            {item.rawText}
          </pre>
          {p.sourceBlockIds.length > 0 && (
            <p className="mt-2 font-mono text-xs text-gray-500">
              Blocs source : {p.sourceBlockIds.join(', ')}
            </p>
          )}
        </ADetails>
      </div>

      {decision && (
        <AReviewDialog
          item={item}
          decision={decision}
          onClose={() => setDecision(null)}
          onDone={(updated) => {
            setDecision(null);
            onReviewed(updated);
          }}
        />
      )}
    </article>
  );
}

const DIALOG_TEXT: Record<Decision, { title: string; confirm: string; success: string }> = {
  APPROVE: {
    title: 'Valider cet élément',
    confirm: 'Valider et créer / mettre à jour le profil privé',
    success: 'Élément validé : profil historique privé enregistré',
  },
  DUPLICATE: {
    title: 'Marquer comme doublon',
    confirm: 'Marquer comme doublon',
    success: 'Élément marqué comme doublon',
  },
  IGNORE: { title: 'Ignorer cet élément', confirm: 'Ignorer', success: 'Élément ignoré' },
};

function AReviewDialog({
  item,
  decision,
  onClose,
  onDone,
}: {
  item: ImportItemView;
  decision: Decision;
  onClose: () => void;
  onDone: (item: ImportItemView) => void;
}) {
  const action = useAction();
  const formId = useId();
  const text = DIALOG_TEXT[decision];

  return (
    <Dialog
      open
      onClose={onClose}
      title={text.title}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={action.pending}>
            Annuler
          </Button>
          <Button
            type="submit"
            form={formId}
            variant={decision === 'APPROVE' ? 'success' : 'primary'}
            loading={action.pending}
          >
            {text.confirm}
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
              api.post<ImportItemView>(`/admin/import-items/${item.id}/review`, {
                decision,
                profileId: formValue(form, 'profileId'),
                note: formValue(form, 'note'),
              }),
            { success: text.success },
          );
          if (result) onDone(result);
        }}
      >
        {decision === 'APPROVE' && (
          <Alert tone="info">
            La validation crée ou met à jour un profil historique <strong>privé</strong> « à
            vérifier », sans compte ni invitation. Aucune identité, disponibilité, tarif, statut ni
            consentement n’est déduit de la source.
          </Alert>
        )}
        {decision !== 'IGNORE' && (
          <Field
            label={
              decision === 'DUPLICATE'
                ? 'Identifiant du profil existant'
                : 'Profil existant à mettre à jour (facultatif)'
            }
            required={decision === 'DUPLICATE' && !item.duplicateOf}
            hint={
              decision === 'DUPLICATE'
                ? item.duplicateOf
                  ? 'Par défaut : le doublon probable détecté par l’analyse.'
                  : 'Identifiant (UUID) du profil correspondant, visible dans l’adresse de sa fiche.'
                : 'Laisser vide pour créer un nouveau profil (ou mettre à jour celui déjà issu de cette source).'
            }
          >
            {(p) => (
              <Input
                {...p}
                name="profileId"
                defaultValue={decision === 'DUPLICATE' ? (item.duplicateOf?.profileId ?? '') : ''}
                className="font-mono"
              />
            )}
          </Field>
        )}
        <Field
          label="Note"
          hint="Facultatif : conservée avec la décision et dans le journal d’audit."
        >
          {(p) => <Textarea {...p} name="note" rows={3} />}
        </Field>
        <FormError error={action.error} />
      </form>
    </Dialog>
  );
}
