'use client';

import { useState } from 'react';
import { DocumentKind, labels, type DocumentView, type Page } from '@empgt/contracts';
import { qs } from '@/lib/api';
import { useApi } from '@/lib/hooks';
import { useSession } from '@/lib/session';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Alert, ResourceView } from '@/components/ui/feedback';
import { Field, Input, Select } from '@/components/ui/form';
import { PageHeader } from '@/components/ui/page';
import { Pagination } from '@/components/ui/table';
import { DocumentList } from '@/components/freelancer/document-list';
import { DocumentUpload } from '@/components/freelancer/document-upload';
import { PROFILE_DOCUMENT_KINDS } from '@/components/freelancer/profile/documents';

const VISIBLE_KINDS = DocumentKind.filter((k) => k !== 'IMPORT_SNAPSHOT');

export default function FreelanceDocumentsPage() {
  const { user } = useSession();
  const profileId = user?.freelancerProfile?.id ?? null;
  const [kind, setKind] = useState('');
  const [q, setQ] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const documents = useApi<Page<DocumentView>>(`/documents${qs({ kind, q: search, page, pageSize: 20 })}`);

  return (
    <>
      <PageHeader
        title="Documents"
        description="Tous les documents auxquels vous avez accès : documents de profil, justificatifs, contrats et avenants signés, pièces jointes de CRA, factures."
      />
      <div className="space-y-6">
        <Alert tone="info" title="Qui voit vos documents ?">
          Les documents de profil (CV, attestations, pièce d’identité, justificatifs de qualification) sont privés : visibles uniquement par vous et E-MPGT. Les
          documents rattachés à un contrat ou à un CRA sont visibles des parties au contrat et d’E-MPGT. Chaque téléchargement est tracé.
        </Alert>

        {profileId && (
          <Card title="Déposer un document de profil" description="Pour un justificatif de qualification, passez par la rubrique « Qualifications » de votre profil.">
            <DocumentUpload
              target="profile"
              targetId={profileId}
              kinds={PROFILE_DOCUMENT_KINDS}
              withExpiry
              onUploaded={() => {
                setPage(1);
                void documents.reload();
              }}
            />
          </Card>
        )}

        <section aria-labelledby="liste-documents" className="space-y-3">
          <h2 id="liste-documents" className="text-base font-semibold text-gray-900">
            Mes documents
          </h2>
          <form
            role="search"
            className="grid gap-3 sm:grid-cols-[2fr_2fr_auto] sm:items-end"
            onSubmit={(e) => {
              e.preventDefault();
              setPage(1);
              setSearch(q.trim());
            }}
          >
            <Field label="Type de document">
              {(p) => (
                <Select
                  {...p}
                  value={kind}
                  placeholder="Tous les types"
                  options={VISIBLE_KINDS.map((k) => ({ value: k, label: labels.documentKind[k] }))}
                  onChange={(e) => {
                    setKind(e.target.value);
                    setPage(1);
                  }}
                />
              )}
            </Field>
            <Field label="Intitulé ou nom de fichier">{(p) => <Input {...p} value={q} onChange={(e) => setQ(e.target.value)} />}</Field>
            <Button type="submit">Rechercher</Button>
          </form>
          <ResourceView resource={documents}>
            {(data) => (
              <>
                <DocumentList
                  documents={data.items}
                  onChanged={() => void documents.reload()}
                  showAttachment
                  emptyTitle="Aucun document"
                  emptyDescription="Déposez votre CV et vos attestations pour compléter votre dossier."
                />
                <Pagination page={data} onChange={setPage} />
              </>
            )}
          </ResourceView>
        </section>
      </div>
    </>
  );
}
