'use client';

import { useState } from 'react';
import { labels, type DocumentView, type OwnProfileView, type Page, type QualificationView } from '@empgt/contracts';
import { api } from '@/lib/api';
import { formatDate } from '@/lib/format';
import { useAction, useApi } from '@/lib/hooks';
import { ActionButton } from '@/components/ui/actions';
import { StatusBadge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Alert, EmptyState, ResourceView } from '@/components/ui/feedback';
import { Field, formValue, Input } from '@/components/ui/form';
import { DocumentList } from '../document-list';
import { DocumentUpload } from '../document-upload';
import { ItemDialog } from './item-dialog';
import { editState, EditLock, type ProfileSectionProps } from './shared';

type Editing = { mode: 'create' } | { mode: 'edit'; item: QualificationView } | null;

/** Qualifications et habilitations (CACES, habilitations électriques, SST…) avec justificatifs. */
export function QualificationsSection({ profile, onSaved }: ProfileSectionProps) {
  const { editable, reason } = editState(profile.actions);
  const [editing, setEditing] = useState<Editing>(null);
  const [uploadFor, setUploadFor] = useState<string | null>(null);
  const action = useAction();
  const documents = useApi<Page<DocumentView>>(`/documents?profileId=${profile.id}&kind=QUALIFICATION_CERTIFICATE&pageSize=100`);
  const item = editing?.mode === 'edit' ? editing.item : null;

  const refreshProfile = async () => {
    try {
      onSaved(await api.get<OwnProfileView>('/profile'));
    } catch {
      // La vue sera rechargée au prochain affichage ; l'erreur de dépôt éventuelle a déjà été signalée.
    }
  };

  const submit = async (form: FormData) => {
    const body = {
      name: formValue(form, 'name'),
      issuer: formValue(form, 'issuer'),
      reference: formValue(form, 'reference'),
      obtainedAt: formValue(form, 'obtainedAt'),
      expiresAt: formValue(form, 'expiresAt'),
    };
    const result = await action.run(
      () => (item ? api.patch<OwnProfileView>(`/profile/qualifications/${item.id}`, body) : api.post<OwnProfileView>('/profile/qualifications', body)),
      { success: item ? 'Qualification modifiée' : 'Qualification ajoutée' },
    );
    if (result) {
      setEditing(null);
      onSaved(result);
    }
  };

  return (
    <div className="space-y-4">
      <Alert tone="info">
        Une qualification reste « déclarée » tant qu’E-MPGT n’a pas vérifié son justificatif. Toute modification la repasse à l’état « déclarée ». Les justificatifs
        sont privés : visibles uniquement par vous et E-MPGT.
      </Alert>
      <EditLock reason={reason} />
      {editable && (
        <Button
          variant="secondary"
          onClick={() => {
            action.clearError();
            setEditing({ mode: 'create' });
          }}
        >
          Ajouter une qualification
        </Button>
      )}
      {profile.qualifications.length === 0 ? (
        <EmptyState title="Aucune qualification déclarée" description="Habilitations électriques, CACES, SST, AIPR, certifications…" />
      ) : (
        <ul className="space-y-3">
          {profile.qualifications.map((q) => {
            const docs = (documents.data?.items ?? []).filter((d) => d.qualificationId === q.id);
            return (
              <li key={q.id} className="space-y-3 rounded-lg border border-gray-200 bg-white p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-semibold text-gray-900">{q.name}</p>
                      <StatusBadge status={q.status} label={labels.qualificationStatus[q.status]} />
                    </div>
                    <p className="text-sm text-gray-700">
                      {[q.issuer, q.reference ? `Réf. ${q.reference}` : null].filter(Boolean).join(' · ') || 'Organisme non précisé'}
                    </p>
                    <p className="text-xs text-gray-500">
                      Obtenue le {formatDate(q.obtainedAt)} · Expire le {formatDate(q.expiresAt)}
                    </p>
                    {q.verificationNote && <p className="text-xs text-gray-700">Note E-MPGT : {q.verificationNote}</p>}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button size="sm" variant="secondary" onClick={() => setUploadFor(uploadFor === q.id ? null : q.id)} aria-expanded={uploadFor === q.id}>
                      Déposer un justificatif<span className="sr-only"> pour {q.name}</span>
                    </Button>
                    {editable && (
                      <>
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => {
                            action.clearError();
                            setEditing({ mode: 'edit', item: q });
                          }}
                        >
                          Modifier<span className="sr-only"> {q.name}</span>
                        </Button>
                        <ActionButton<OwnProfileView>
                          actions={profile.actions}
                          action="update"
                          label="Supprimer"
                          size="sm"
                          variant="danger"
                          method="delete"
                          endpoint={`/profile/qualifications/${q.id}`}
                          confirm={{
                            title: 'Supprimer la qualification',
                            message: `La qualification « ${q.name} » sera retirée. Supprimez d’abord ses justificatifs éventuels.`,
                            confirmLabel: 'Supprimer',
                          }}
                          success="Qualification supprimée"
                          onDone={onSaved}
                        />
                      </>
                    )}
                  </div>
                </div>
                {uploadFor === q.id && (
                  <div className="rounded-md border border-gray-200 bg-gray-50 p-3">
                    <DocumentUpload
                      target="qualification"
                      targetId={q.id}
                      kinds={['QUALIFICATION_CERTIFICATE']}
                      withExpiry
                      submitLabel="Déposer le justificatif"
                      notice="Le dépôt d’un justificatif déclenche sa vérification par E-MPGT."
                      onUploaded={async () => {
                        setUploadFor(null);
                        await Promise.all([documents.reload(), refreshProfile()]);
                      }}
                    />
                  </div>
                )}
                <ResourceView resource={documents} loadingLabel="Chargement des justificatifs…">
                  {() =>
                    docs.length > 0 ? (
                      <DocumentList documents={docs} onChanged={() => void Promise.all([documents.reload(), refreshProfile()])} />
                    ) : (
                      <p className="text-xs text-gray-600">Aucun justificatif déposé.</p>
                    )
                  }
                </ResourceView>
              </li>
            );
          })}
        </ul>
      )}

      <ItemDialog
        open={editing !== null}
        title={item ? 'Modifier la qualification' : 'Ajouter une qualification'}
        submitLabel="Enregistrer"
        pending={action.pending}
        error={action.error}
        onClose={() => setEditing(null)}
        onSubmit={submit}
      >
        <Field label="Qualification ou habilitation" required hint="Ex. « Habilitation électrique B1V », « CACES R482 cat. A »">
          {(p) => <Input {...p} name="name" defaultValue={item?.name ?? ''} maxLength={200} />}
        </Field>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Organisme délivrant">{(p) => <Input {...p} name="issuer" defaultValue={item?.issuer ?? ''} maxLength={200} />}</Field>
          <Field label="Référence / numéro">{(p) => <Input {...p} name="reference" defaultValue={item?.reference ?? ''} maxLength={200} />}</Field>
          <Field label="Date d’obtention">{(p) => <Input {...p} name="obtainedAt" type="date" defaultValue={item?.obtainedAt ?? ''} />}</Field>
          <Field label="Date d’expiration">{(p) => <Input {...p} name="expiresAt" type="date" defaultValue={item?.expiresAt ?? ''} />}</Field>
        </div>
      </ItemDialog>
    </div>
  );
}
