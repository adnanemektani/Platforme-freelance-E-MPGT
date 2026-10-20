'use client';

import { useState, type ReactNode } from 'react';
import { labels, type DocumentKind, type DocumentTarget, type DocumentView } from '@empgt/contracts';
import { api } from '@/lib/api';
import { useAction } from '@/lib/hooks';
import { Button } from '@/components/ui/button';
import { FileInput } from '@/components/ui/file-upload';
import { Field, FormError, formValue, Input, Select } from '@/components/ui/form';

/**
 * Dépôt d'un document rattaché à une cible (profil, qualification, CRA, contrat).
 * Le type de document, le format, la taille et le droit de dépôt sont contrôlés par le serveur.
 */
export function DocumentUpload({
  target,
  targetId,
  kinds,
  withExpiry = false,
  submitLabel = 'Déposer le document',
  notice,
  onUploaded,
}: {
  target: DocumentTarget;
  targetId: string;
  kinds: DocumentKind[];
  withExpiry?: boolean;
  submitLabel?: string;
  notice?: ReactNode;
  onUploaded: (doc: DocumentView) => void;
}) {
  const [kind, setKind] = useState<DocumentKind>(kinds[0]!);
  const [file, setFile] = useState<File | null>(null);
  const [formKey, setFormKey] = useState(0);
  const action = useAction();

  return (
    <form
      key={formKey}
      className="space-y-3"
      onSubmit={async (e) => {
        e.preventDefault();
        const form = new FormData(e.currentTarget);
        const doc = await action.run(
          () =>
            api.upload<DocumentView>('/documents', file, {
              kind,
              target,
              targetId,
              title: formValue(form, 'title'),
              expiresAt: withExpiry ? formValue(form, 'expiresAt') : null,
            }),
          { success: 'Document déposé' },
        );
        if (doc) {
          setFile(null);
          setFormKey((k) => k + 1);
          onUploaded(doc);
        }
      }}
    >
      {notice && <div className="text-xs text-gray-600">{notice}</div>}
      <div className="grid gap-3 sm:grid-cols-2">
        {kinds.length > 1 ? (
          <Field label="Type de document" required>
            {(p) => (
              <Select
                {...p}
                value={kind}
                onChange={(e) => setKind(e.target.value as DocumentKind)}
                options={kinds.map((k) => ({ value: k, label: labels.documentKind[k] }))}
              />
            )}
          </Field>
        ) : (
          <p className="text-sm text-gray-700 sm:col-span-2">
            Type : <span className="font-medium">{labels.documentKind[kind]}</span>
          </p>
        )}
        <Field label="Intitulé" hint="Facultatif (ex. « Attestation RC Pro 2026 »)">
          {(p) => <Input {...p} name="title" maxLength={200} />}
        </Field>
        {withExpiry && (
          <Field label="Date d’expiration" hint="Facultatif : E-MPGT vous signalera l’échéance.">
            {(p) => <Input {...p} name="expiresAt" type="date" />}
          </Field>
        )}
      </div>
      <FileInput label="Fichier" kind={kind} required onChange={setFile} />
      <FormError error={action.error} />
      <Button type="submit" size="sm" loading={action.pending} disabled={!file}>
        {submitLabel}
      </Button>
    </form>
  );
}
