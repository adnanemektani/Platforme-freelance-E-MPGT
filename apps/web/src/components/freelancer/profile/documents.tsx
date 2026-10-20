'use client';

import type { DocumentKind, DocumentView, Page } from '@empgt/contracts';
import { useApi } from '@/lib/hooks';
import { Card } from '@/components/ui/card';
import { Alert, ResourceView } from '@/components/ui/feedback';
import { DocumentList } from '../document-list';
import { DocumentUpload } from '../document-upload';

/** Types de documents déposables sur le profil (la liste acceptée est contrôlée par le serveur). */
export const PROFILE_DOCUMENT_KINDS: DocumentKind[] = ['CV', 'INSURANCE', 'TAX_SOCIAL_CERTIFICATE', 'IDENTITY', 'OTHER'];

/** Documents du profil : CV, attestations, pièce d'identité (privés : vous et E-MPGT). */
export function ProfileDocuments({ profileId }: { profileId: string }) {
  const documents = useApi<Page<DocumentView>>(`/documents?profileId=${profileId}&pageSize=100`);

  return (
    <div className="space-y-4">
      <Alert tone="info" title="Documents privés">
        Vos documents de profil sont visibles uniquement par vous et E-MPGT. Ils ne sont jamais transmis automatiquement aux entreprises. Les attestations
        (assurance, fiscale / sociale) et la pièce d’identité sont vérifiées par E-MPGT.
      </Alert>
      <Card title="Déposer un document">
        <DocumentUpload target="profile" targetId={profileId} kinds={PROFILE_DOCUMENT_KINDS} withExpiry onUploaded={() => void documents.reload()} />
      </Card>
      <ResourceView resource={documents}>
        {(page) => (
          <DocumentList
            documents={page.items.filter((d) => d.kind !== 'INVOICE' && d.kind !== 'QUALIFICATION_CERTIFICATE' && !d.contractId)}
            onChanged={() => void documents.reload()}
            emptyTitle="Aucun document de profil"
            emptyDescription="Déposez votre CV, votre attestation d’assurance (RC Pro), votre attestation fiscale / sociale et votre pièce d’identité."
          />
        )}
      </ResourceView>
    </div>
  );
}
