'use client';

import { useState } from 'react';
import type { DisputeView, DocumentView } from '@empgt/contracts';
import { api } from '@/lib/api';
import { Checkbox, Field, formValue, Input, Select, Textarea } from '@/components/ui/form';
import { BActionDialog, formChecked } from './b-common';

/** Vérification d'un document (action « verify ») : motif obligatoire en cas de refus. */
export function BVerifyDocumentDialog({ doc, onDone }: { doc: DocumentView; onDone: (view: DocumentView) => void }) {
  const [status, setStatus] = useState('VERIFIED');
  const rejecting = status === 'REJECTED';
  return (
    <BActionDialog<DocumentView>
      actions={doc.actions}
      action="verify"
      label="Vérifier"
      size="sm"
      variant="secondary"
      title={`Vérifier « ${doc.title ?? doc.originalFilename} »`}
      submitLabel="Enregistrer la décision"
      success="Décision enregistrée"
      onSubmit={(form) =>
        api.post<DocumentView>(`/documents/${doc.id}/verify`, {
          status: formValue(form, 'status'),
          note: formValue(form, 'note'),
          expiresAt: formValue(form, 'expiresAt'),
        })
      }
      onDone={onDone}
    >
      <Field label="Décision" required>
        {(p) => (
          <Select
            {...p}
            name="status"
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            options={[
              { value: 'VERIFIED', label: 'Document vérifié' },
              { value: 'REJECTED', label: 'Document refusé' },
            ]}
          />
        )}
      </Field>
      <Field label={rejecting ? 'Motif du refus' : 'Note'} required={rejecting} hint={rejecting ? 'Obligatoire : communiqué au déposant.' : 'Facultative.'}>
        {(p) => <Textarea {...p} name="note" rows={3} minLength={rejecting ? 3 : undefined} maxLength={2000} />}
      </Field>
      <Field label="Date d’échéance" hint="Date de fin de validité du document, le cas échéant (ex. attestation d’assurance).">
        {(p) => <Input {...p} type="date" name="expiresAt" defaultValue={doc.expiresAt ?? ''} />}
      </Field>
    </BActionDialog>
  );
}

/** Suppression d'un document (action « delete ») avec motif, conservé dans le journal d'audit. */
export function BDeleteDocumentDialog({ doc, onDone }: { doc: DocumentView; onDone: () => void }) {
  return (
    <BActionDialog<true>
      actions={doc.actions}
      action="delete"
      label="Supprimer"
      size="sm"
      variant="danger"
      title={`Supprimer « ${doc.title ?? doc.originalFilename} »`}
      submitLabel="Supprimer"
      success="Document supprimé"
      description="Le document n’est plus accessible aux utilisateurs ; la suppression est tracée."
      onSubmit={async (form) => {
        await api.delete(`/documents/${doc.id}`, { reason: formValue(form, 'reason') });
        return true as const;
      }}
      onDone={onDone}
    >
      <Field label="Motif" required hint="Obligatoire pour le document d’un tiers.">
        {(p) => <Textarea {...p} name="reason" rows={3} minLength={3} maxLength={2000} />}
      </Field>
    </BActionDialog>
  );
}

/** Traitement d'un litige (action « resolve ») : résolution motivée, clôture facultative. */
export function BResolveDisputeDialog({ dispute, onDone }: { dispute: DisputeView; onDone: (view: DisputeView) => void }) {
  return (
    <BActionDialog<DisputeView>
      actions={dispute.actions}
      action="resolve"
      label="Traiter le litige"
      size="sm"
      submitLabel="Enregistrer la résolution"
      success="Litige traité"
      description={<p className="whitespace-pre-line">Motif du litige : {dispute.reason}</p>}
      onSubmit={(form) => api.post<DisputeView>(`/disputes/${dispute.id}/resolve`, { resolution: formValue(form, 'resolution'), close: formChecked(form, 'close') })}
      onDone={onDone}
    >
      <Field label="Résolution" required hint="Communiquée aux deux parties.">
        {(p) => <Textarea {...p} name="resolution" rows={4} minLength={3} maxLength={2000} />}
      </Field>
      <Checkbox name="close" label="Clore le litige" hint="Sinon, il est marqué « résolu »." />
    </BActionDialog>
  );
}
