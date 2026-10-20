'use client';

import Link from 'next/link';
import { labels, type DocumentView } from '@empgt/contracts';
import { documentUrl } from '@/lib/api';
import { formatBytes, formatDate, formatDateTime } from '@/lib/format';
import { Badge, StatusBadge } from '@/components/ui/badge';
import { EmptyState } from '@/components/ui/feedback';
import { DeleteButton } from './delete-button';

const EXPIRY: Record<DocumentView['expiryState'], { label: string; tone: 'gray' | 'green' | 'amber' | 'red' } | null> = {
  none: null,
  valid: { label: 'Valide', tone: 'green' },
  expiring: { label: 'Expire bientôt', tone: 'amber' },
  expired: { label: 'Expiré', tone: 'red' },
};

/** Rattachement lisible d'un document (affichage seulement). */
function attachment(doc: DocumentView): { label: string; href?: string } {
  if (doc.invoiceId) return { label: 'Facture', href: `/freelance/paiements/factures/${doc.invoiceId}` };
  if (doc.timesheetId) return { label: 'CRA', href: `/freelance/cra/${doc.timesheetId}` };
  if (doc.qualificationId) return { label: 'Qualification', href: '/freelance/profil' };
  if (doc.contractId) return { label: 'Contrat', href: `/freelance/contrats/${doc.contractId}` };
  if (doc.profileId) return { label: 'Profil', href: '/freelance/profil' };
  return { label: '—' };
}

function canPreview(doc: DocumentView): boolean {
  return doc.mimeType === 'application/pdf' || doc.mimeType.startsWith('image/');
}

/** Liste de documents : type, état de vérification, échéance, téléchargement et suppression. */
export function DocumentList({
  documents,
  onChanged,
  emptyTitle = 'Aucun document',
  emptyDescription,
  showAttachment = false,
}: {
  documents: DocumentView[];
  onChanged: () => void;
  emptyTitle?: string;
  emptyDescription?: string;
  showAttachment?: boolean;
}) {
  if (documents.length === 0) return <EmptyState title={emptyTitle} description={emptyDescription} />;
  return (
    <ul className="divide-y divide-gray-100 rounded-lg border border-gray-200 bg-white">
      {documents.map((doc) => {
        const expiry = EXPIRY[doc.expiryState];
        const target = attachment(doc);
        return (
          <li key={doc.id} className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0 space-y-1">
              <p className="text-sm font-semibold text-gray-900">
                {labels.documentKind[doc.kind]}
                {doc.title && <span className="font-normal text-gray-700"> — {doc.title}</span>}
              </p>
              <p className="truncate text-xs text-gray-600">
                {doc.originalFilename} · {formatBytes(doc.sizeBytes)} · déposé le {formatDateTime(doc.createdAt)}
                {doc.uploadedByName ? ` par ${doc.uploadedByName}` : ''}
              </p>
              <div className="flex flex-wrap items-center gap-1.5">
                <Badge tone={doc.visibility === 'OWNER_AND_ADMIN' ? 'gray' : 'blue'}>{labels.documentVisibility[doc.visibility]}</Badge>
                {doc.verificationStatus !== 'NOT_REQUIRED' && (
                  <StatusBadge status={doc.verificationStatus} label={labels.documentVerification[doc.verificationStatus]} />
                )}
                {doc.expiresAt && (
                  <span className="text-xs text-gray-600">
                    Échéance {formatDate(doc.expiresAt)} {expiry && <Badge tone={expiry.tone}>{expiry.label}</Badge>}
                  </span>
                )}
                {showAttachment &&
                  (target.href ? (
                    <Link href={target.href} className="text-xs font-medium text-brand-700 underline">
                      Rattaché : {target.label}
                    </Link>
                  ) : (
                    <span className="text-xs text-gray-600">Rattaché : {target.label}</span>
                  ))}
              </div>
              {doc.verificationNote && (
                <p className={`text-xs ${doc.verificationStatus === 'REJECTED' ? 'text-red-700' : 'text-gray-700'}`}>Note de vérification : {doc.verificationNote}</p>
              )}
            </div>
            <div className="flex shrink-0 flex-wrap items-start gap-2">
              <a href={documentUrl(doc.id)} className="rounded-md border border-brand-200 bg-white px-3 py-1.5 text-sm font-medium text-brand-800 hover:bg-brand-50">
                Télécharger<span className="sr-only"> {doc.originalFilename}</span>
              </a>
              {canPreview(doc) && (
                <a
                  href={documentUrl(doc.id, true)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded-md px-3 py-1.5 text-sm font-medium text-brand-700 hover:bg-brand-50"
                >
                  Aperçu<span className="sr-only"> de {doc.originalFilename} (nouvel onglet)</span>
                </a>
              )}
              <DeleteButton
                actions={doc.actions}
                endpoint={`/documents/${doc.id}`}
                confirmTitle="Supprimer le document"
                confirmMessage={
                  <p>
                    Le document « {doc.title ?? doc.originalFilename} » ne sera plus accessible. La suppression est tracée dans l’historique.
                  </p>
                }
                success="Document supprimé"
                onDone={onChanged}
              />
            </div>
          </li>
        );
      })}
    </ul>
  );
}
