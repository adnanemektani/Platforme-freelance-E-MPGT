'use client';

import { Suspense, useState } from 'react';
import {
  DocumentKind,
  DocumentVerificationStatus,
  labels,
  type DocumentView,
  type Page,
} from '@empgt/contracts';
import { qs } from '@/lib/api';
import { useApi } from '@/lib/hooks';
import { useSession } from '@/lib/session';
import { Card } from '@/components/ui/card';
import { LoadingBlock, ResourceView } from '@/components/ui/feedback';
import { Field, Input, optionsFrom, Select } from '@/components/ui/form';
import { PageHeader } from '@/components/ui/page';
import { Pagination } from '@/components/ui/table';
import { breadcrumbRoot } from '@/components/company/display';
import {
  COMPANY_DOCUMENT_KINDS,
  DocumentTable,
  DocumentUploadForm,
} from '@/components/company/documents';
import { useQueryFilters } from '@/components/company/query-filters';
import { FilterBar, Refreshing } from '@/components/company/widgets';

const FILTER_KEYS = ['q', 'kind', 'verificationStatus'] as const;

function DocumentsList() {
  const { user } = useSession();
  const { values, page, active, update, reset } = useQueryFilters(FILTER_KEYS);
  const [text, setText] = useState(values.q);
  const documents = useApi<Page<DocumentView>>(
    `/documents${qs({ ...values, page, pageSize: 20 })}`,
  );
  const companyId = user?.company?.id;

  return (
    <div className="space-y-6">
      <div>
        <FilterBar
          onSubmit={() => update({ q: text })}
          onReset={() => {
            setText('');
            reset();
          }}
          active={active}
        >
          <Field label="Recherche">
            {(p) => (
              <Input
                {...p}
                type="search"
                value={text}
                placeholder="Titre ou nom de fichier"
                onChange={(e) => setText(e.target.value)}
              />
            )}
          </Field>
          <Field label="Type">
            {(p) => (
              <Select
                {...p}
                value={values.kind}
                placeholder="Tous les types"
                options={optionsFrom(DocumentKind, labels.documentKind)}
                onChange={(e) => update({ kind: e.target.value })}
              />
            )}
          </Field>
          <Field label="Vérification">
            {(p) => (
              <Select
                {...p}
                value={values.verificationStatus}
                placeholder="Tous les états"
                options={optionsFrom(DocumentVerificationStatus, labels.documentVerification)}
                onChange={(e) => update({ verificationStatus: e.target.value })}
              />
            )}
          </Field>
        </FilterBar>
        <Refreshing loading={documents.loading && Boolean(documents.data)} />
        <ResourceView resource={documents} loadingLabel="Chargement des documents…">
          {(data) => (
            <>
              <DocumentTable
                documents={data.items}
                onChanged={() => void documents.reload()}
                empty={
                  active
                    ? { title: 'Aucun document ne correspond aux filtres' }
                    : {
                        title: 'Aucun document',
                        description: 'Déposez les justificatifs de votre entreprise ci-dessous.',
                      }
                }
              />
              <Pagination page={data} onChange={(p) => update({ page: p })} />
            </>
          )}
        </ResourceView>
      </div>

      {companyId && (
        <Card
          title="Déposer un document de l’entreprise"
          description="Visible des membres de votre entreprise et d’E-MPGT. Les justificatifs officiels sont vérifiés par E-MPGT."
        >
          <DocumentUploadForm
            target="company"
            targetId={companyId}
            kinds={COMPANY_DOCUMENT_KINDS}
            onUploaded={() => void documents.reload()}
          />
        </Card>
      )}
    </div>
  );
}

export default function DocumentsPage() {
  return (
    <>
      <PageHeader
        title="Documents"
        description="Tous les documents auxquels vous avez accès : justificatifs de l’entreprise, pièces jointes de missions, contrats signés, factures…"
        breadcrumbs={[breadcrumbRoot, { label: 'Documents' }]}
      />
      <Suspense fallback={<LoadingBlock />}>
        <DocumentsList />
      </Suspense>
    </>
  );
}
