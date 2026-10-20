'use client';

import Link from 'next/link';
import { useId, useState, type ReactNode } from 'react';
import {
  labels,
  type DocumentKind,
  type DocumentTarget,
  type DocumentView,
} from '@empgt/contracts';
import { api, documentUrl } from '@/lib/api';
import { formatBytes, formatDate } from '@/lib/format';
import { useAction } from '@/lib/hooks';
import { can, findAction } from '@/components/ui/actions';
import { Badge, StatusBadge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/dialog';
import { FileInput } from '@/components/ui/file-upload';
import { Field, FormError, formValue, Input, Select } from '@/components/ui/form';
import { DataTable, type Column } from '@/components/ui/table';

/** Types de documents que l'entreprise peut rattacher à son organisation. */
export const COMPANY_DOCUMENT_KINDS: DocumentKind[] = [
  'COMPANY_REGISTRATION',
  'INSURANCE',
  'TAX_SOCIAL_CERTIFICATE',
  'OTHER',
];

const linkClass = 'font-medium text-brand-700 underline';

function ExpiryCell({ doc }: { doc: DocumentView }) {
  if (!doc.expiresAt) return <span className="text-gray-500">Sans échéance</span>;
  const tone =
    doc.expiryState === 'expired' ? 'red' : doc.expiryState === 'expiring' ? 'amber' : 'green';
  const text =
    doc.expiryState === 'expired'
      ? 'Expiré'
      : doc.expiryState === 'expiring'
        ? 'Expire bientôt'
        : 'Valide';
  return (
    <span className="inline-flex flex-col items-end gap-0.5 md:items-start">
      <span>{formatDate(doc.expiresAt)}</span>
      <Badge tone={tone}>{text}</Badge>
    </span>
  );
}

function TargetCell({ doc }: { doc: DocumentView }) {
  let target: ReactNode = 'Entreprise';
  if (doc.invoiceId)
    target = (
      <Link href={`/entreprise/factures/${doc.invoiceId}`} className={linkClass}>
        Facture
      </Link>
    );
  else if (doc.timesheetId)
    target = (
      <Link href={`/entreprise/cra/${doc.timesheetId}`} className={linkClass}>
        CRA
      </Link>
    );
  else if (doc.contractId)
    target = (
      <Link href={`/entreprise/contrats/${doc.contractId}`} className={linkClass}>
        Contrat
      </Link>
    );
  else if (doc.missionId)
    target = (
      <Link href={`/entreprise/missions/${doc.missionId}`} className={linkClass}>
        Mission
      </Link>
    );
  return (
    <span className="inline-flex flex-col items-end md:items-start">
      <span>{target}</span>
      <span className="text-xs text-gray-500">{labels.documentVisibility[doc.visibility]}</span>
    </span>
  );
}

/** Suppression d'un document (réponse 204 : on attend la confirmation de l'API). */
export function DeleteDocumentButton({
  doc,
  onDeleted,
}: {
  doc: DocumentView;
  onDeleted?: () => void;
}) {
  const state = findAction(doc.actions, 'delete');
  const { run, pending } = useAction();
  const [open, setOpen] = useState(false);
  const reasonId = useId();
  if (!state) return null;
  return (
    <div className="inline-flex flex-col">
      <Button
        size="sm"
        variant="ghost"
        disabled={!state.allowed}
        aria-describedby={!state.allowed ? reasonId : undefined}
        onClick={() => setOpen(true)}
      >
        Supprimer
      </Button>
      {!state.allowed && state.reason && (
        <span id={reasonId} className="mt-1 max-w-[14rem] text-xs text-gray-600">
          {state.reason}
        </span>
      )}
      <ConfirmDialog
        open={open}
        onClose={() => setOpen(false)}
        title="Supprimer le document"
        message={`« ${doc.title ?? doc.originalFilename} » ne sera plus accessible. Cette suppression est tracée.`}
        confirmLabel="Supprimer"
        tone="danger"
        pending={pending}
        onConfirm={async () => {
          const done = await run(
            async () => {
              await api.delete(`/documents/${doc.id}`, {});
              return true;
            },
            { success: 'Document supprimé' },
          );
          if (done) {
            setOpen(false);
            onDeleted?.();
          }
        }}
      />
    </div>
  );
}

/** Liens de téléchargement (contrôle d'accès effectué par l'API). */
export function DownloadLinks({
  documentId,
  mimeType,
  label = 'Télécharger',
}: {
  documentId: string;
  mimeType?: string;
  label?: string;
}) {
  const previewable = !mimeType || mimeType === 'application/pdf' || mimeType.startsWith('image/');
  return (
    <span className="inline-flex flex-wrap gap-3 text-sm">
      <a href={documentUrl(documentId)} className={linkClass}>
        {label}
      </a>
      {previewable && (
        <a
          href={documentUrl(documentId, true)}
          target="_blank"
          rel="noopener noreferrer"
          className={linkClass}
        >
          Aperçu<span className="sr-only"> (nouvel onglet)</span>
        </a>
      )}
    </span>
  );
}

export function DocumentTable({
  documents,
  onChanged,
  showTarget = true,
  empty,
}: {
  documents: DocumentView[];
  onChanged?: () => void;
  showTarget?: boolean;
  empty?: { title: string; description?: string };
}) {
  const columns: Column<DocumentView>[] = [
    {
      header: 'Document',
      cell: (d) => (
        <span className="inline-flex flex-col items-end md:items-start">
          <span className="font-medium text-gray-900">{d.title ?? d.originalFilename}</span>
          <span className="text-xs text-gray-500">
            {labels.documentKind[d.kind]} · {formatBytes(d.sizeBytes)}
          </span>
        </span>
      ),
    },
    ...(showTarget
      ? [{ header: 'Rattachement', cell: (d: DocumentView) => <TargetCell doc={d} /> }]
      : []),
    {
      header: 'Vérification',
      cell: (d) => (
        <span className="inline-flex flex-col items-end gap-0.5 md:items-start">
          <StatusBadge
            status={d.verificationStatus}
            label={labels.documentVerification[d.verificationStatus]}
          />
          {d.verificationNote && (
            <span className="max-w-[16rem] text-xs text-gray-600">{d.verificationNote}</span>
          )}
        </span>
      ),
    },
    { header: 'Échéance', cell: (d) => <ExpiryCell doc={d} /> },
    {
      header: 'Déposé',
      cell: (d) => (
        <span className="inline-flex flex-col items-end md:items-start">
          <span>{formatDate(d.createdAt)}</span>
          {d.uploadedByName && (
            <span className="text-xs text-gray-500">par {d.uploadedByName}</span>
          )}
        </span>
      ),
    },
    {
      header: 'Actions',
      cell: (d) => (
        <span className="inline-flex flex-wrap items-center justify-end gap-2 md:justify-start">
          {can(d.actions, 'download') && <DownloadLinks documentId={d.id} mimeType={d.mimeType} />}
          <DeleteDocumentButton doc={d} onDeleted={onChanged} />
        </span>
      ),
    },
  ];
  return (
    <DataTable
      rows={documents}
      columns={columns}
      rowKey={(d) => d.id}
      caption="Documents"
      empty={empty ?? { title: 'Aucun document' }}
    />
  );
}

/** Dépôt d'un document rattaché à l'entreprise, à une mission… (multipart, contrôles côté serveur). */
export function DocumentUploadForm({
  target,
  targetId,
  kinds,
  withExpiry = true,
  submitLabel = 'Déposer le document',
  onUploaded,
}: {
  target: DocumentTarget;
  targetId: string;
  kinds: DocumentKind[];
  withExpiry?: boolean;
  submitLabel?: string;
  onUploaded?: (doc: DocumentView) => void;
}) {
  const [kind, setKind] = useState<DocumentKind>(kinds[0] ?? 'OTHER');
  const [file, setFile] = useState<File | null>(null);
  const [version, setVersion] = useState(0);
  const action = useAction();
  return (
    <form
      key={version}
      className="grid gap-4 sm:grid-cols-2"
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
          setVersion((v) => v + 1);
          onUploaded?.(doc);
        }
      }}
    >
      {kinds.length > 1 && (
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
      )}
      <Field label="Titre" hint="Facultatif : par défaut, le nom du fichier est affiché.">
        {(p) => <Input {...p} name="title" maxLength={200} />}
      </Field>
      {withExpiry && (
        <Field
          label="Date d’expiration"
          hint="Facultative : pour les attestations à durée limitée (assurance, attestations fiscales et sociales…)."
        >
          {(p) => <Input {...p} type="date" name="expiresAt" />}
        </Field>
      )}
      <div className="sm:col-span-2">
        <FileInput label="Fichier" kind={kind} required onChange={setFile} />
      </div>
      <div className="space-y-3 sm:col-span-2">
        <FormError error={action.error} />
        <Button type="submit" loading={action.pending} disabled={!file}>
          {submitLabel}
        </Button>
      </div>
    </form>
  );
}
