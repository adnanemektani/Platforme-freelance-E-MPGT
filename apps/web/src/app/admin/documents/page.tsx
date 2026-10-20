'use client';

import Link from 'next/link';
import { Suspense } from 'react';
import { DocumentKind, DocumentVerificationStatus, labels, type DocumentView, type Page } from '@empgt/contracts';
import { qs } from '@/lib/api';
import { formatBytes, formatDateTime } from '@/lib/format';
import { useApi } from '@/lib/hooks';
import { StatusBadge } from '@/components/ui/badge';
import { Checkbox, optionsFrom } from '@/components/ui/form';
import { LoadingBlock, ResourceView } from '@/components/ui/feedback';
import { PageHeader } from '@/components/ui/page';
import { DataTable, Pagination } from '@/components/ui/table';
import { BDocumentLinks, BExpiryBadge, BFilterBar, BFilterSelect, BSearch, useUrlFilters } from '@/components/admin/b-common';
import { BDeleteDocumentDialog, BVerifyDocumentDialog } from '@/components/admin/b-documents';

const FILTERS = ['q', 'kind', 'verificationStatus', 'echeance'] as const;
const EXPIRING_DAYS = 30;

function attachment(d: DocumentView): { label: string; href: string } | null {
  if (d.invoiceId) return { label: 'Facture', href: `/admin/finance/factures/${d.invoiceId}` };
  if (d.timesheetId) return { label: 'CRA', href: `/admin/cra/${d.timesheetId}` };
  if (d.contractId) return { label: 'Contrat', href: `/admin/contrats/${d.contractId}` };
  if (d.missionId) return { label: 'Mission', href: `/admin/missions/${d.missionId}` };
  if (d.profileId) return { label: 'Profil freelance', href: `/admin/freelances/${d.profileId}` };
  if (d.companyId) return { label: 'Entreprise', href: `/admin/entreprises/${d.companyId}` };
  return null;
}

function previewable(mime: string): boolean {
  return mime === 'application/pdf' || mime.startsWith('image/');
}

export default function AdminDocumentsPage() {
  return (
    <>
      <PageHeader
        title="Documents"
        description="Tous les documents déposés : vérification des justificatifs (assurance, immatriculation, qualifications…), suivi des échéances, pièces contractuelles et financières."
      />
      <Suspense fallback={<LoadingBlock />}>
        <DocumentsList />
      </Suspense>
    </>
  );
}

function DocumentsList() {
  const { values, page, update } = useUrlFilters(FILTERS);
  const expiring = values.echeance === '1';
  const documents = useApi<Page<DocumentView>>(
    `/documents${qs({ q: values.q, kind: values.kind, verificationStatus: values.verificationStatus, expiringWithinDays: expiring ? EXPIRING_DAYS : undefined, page, pageSize: 20 })}`,
  );

  return (
    <>
      <BFilterBar>
        <BSearch key={values.q} value={values.q} onSearch={(q) => update({ q })} placeholder="Titre ou nom du fichier…" />
        <BFilterSelect label="Type" value={values.kind} onChange={(kind) => update({ kind })} placeholder="Tous" options={optionsFrom(DocumentKind, labels.documentKind)} />
        <BFilterSelect
          label="Vérification"
          value={values.verificationStatus}
          onChange={(verificationStatus) => update({ verificationStatus })}
          placeholder="Tous"
          options={optionsFrom(DocumentVerificationStatus, labels.documentVerification)}
        />
        <div className="pb-2">
          <Checkbox
            checked={expiring}
            onChange={(e) => update({ echeance: e.target.checked ? '1' : null })}
            label={`Échéance dans ${EXPIRING_DAYS} jours ou dépassée`}
          />
        </div>
      </BFilterBar>
      <ResourceView resource={documents}>
        {(data) => (
          <>
            <DataTable
              rows={data.items}
              rowKey={(d) => d.id}
              caption="Documents"
              empty={{ title: 'Aucun document ne correspond', description: 'Modifiez les filtres pour élargir la recherche.' }}
              columns={[
                {
                  header: 'Document',
                  cell: (d) => (
                    <span className="flex max-w-xs flex-col">
                      <span className="font-medium text-gray-900">{d.title ?? d.originalFilename}</span>
                      <span className="text-xs text-gray-500">
                        {labels.documentKind[d.kind]} · {d.originalFilename} · {formatBytes(d.sizeBytes)}
                      </span>
                      <span className="text-xs text-gray-500">
                        Déposé {d.uploadedByName ? `par ${d.uploadedByName} ` : ''}le {formatDateTime(d.createdAt)}
                      </span>
                    </span>
                  ),
                },
                {
                  header: 'Rattachement',
                  cell: (d) => {
                    const target = attachment(d);
                    return (
                      <span className="flex flex-col">
                        {target ? (
                          <Link href={target.href} className="text-brand-700 underline">
                            {target.label}
                          </Link>
                        ) : (
                          '—'
                        )}
                        <span className="text-xs text-gray-500">{labels.documentVisibility[d.visibility]}</span>
                      </span>
                    );
                  },
                },
                {
                  header: 'Vérification',
                  cell: (d) => (
                    <span className="flex flex-col gap-0.5">
                      <StatusBadge status={d.verificationStatus} label={labels.documentVerification[d.verificationStatus]} />
                      {d.verifiedAt && <span className="text-xs text-gray-500">le {formatDateTime(d.verifiedAt)}</span>}
                      {d.verificationNote && <span className="max-w-xs text-xs text-gray-600">{d.verificationNote}</span>}
                    </span>
                  ),
                },
                { header: 'Échéance', cell: (d) => <BExpiryBadge doc={d} /> },
                { header: 'Fichier', cell: (d) => <BDocumentLinks id={d.id} previewable={previewable(d.mimeType)} /> },
                {
                  header: 'Actions',
                  cell: (d) => (
                    <span className="flex flex-wrap gap-2">
                      <BVerifyDocumentDialog doc={d} onDone={() => void documents.reload()} />
                      <BDeleteDocumentDialog doc={d} onDone={() => void documents.reload()} />
                    </span>
                  ),
                },
              ]}
            />
            <Pagination page={data} onChange={(p) => update({ page: p })} />
          </>
        )}
      </ResourceView>
    </>
  );
}
