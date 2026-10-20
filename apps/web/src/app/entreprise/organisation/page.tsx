'use client';

import Link from 'next/link';
import { labels, type CompanyView, type DocumentView, type Page } from '@empgt/contracts';
import { qs } from '@/lib/api';
import { formatDateTime } from '@/lib/format';
import { useApi } from '@/lib/hooks';
import { useSession } from '@/lib/session';
import { ActionButton, PendingList } from '@/components/ui/actions';
import { Badge, StatusBadge } from '@/components/ui/badge';
import { Card, DefinitionList } from '@/components/ui/card';
import { Alert, ResourceView } from '@/components/ui/feedback';
import { PageHeader } from '@/components/ui/page';
import { CompanyContacts } from '@/components/company/company-contacts';
import { CompanyInfoForm } from '@/components/company/company-info-form';
import { CompanyMembers } from '@/components/company/company-members';
import { breadcrumbRoot } from '@/components/company/display';
import {
  COMPANY_DOCUMENT_KINDS,
  DocumentTable,
  DocumentUploadForm,
} from '@/components/company/documents';
import { Anchor } from '@/components/company/widgets';

function VerificationCard({
  company,
  onChange,
}: {
  company: CompanyView;
  onChange: (c: CompanyView) => void;
}) {
  const noteTone =
    company.verificationStatus === 'REJECTED'
      ? 'danger'
      : company.verificationStatus === 'CHANGES_REQUESTED'
        ? 'warning'
        : 'info';
  return (
    <Card
      title="Vérification par E-MPGT"
      description="E-MPGT contrôle l’identité légale de votre entreprise avant la publication de vos missions."
    >
      <div className="space-y-4">
        <DefinitionList
          columns={3}
          items={[
            [
              'État',
              <StatusBadge
                key="etat"
                status={company.verificationStatus}
                label={labels.companyVerification[company.verificationStatus]}
              />,
            ],
            [
              'Demandée le',
              company.verificationSubmittedAt
                ? formatDateTime(company.verificationSubmittedAt)
                : null,
            ],
            ['Vérifiée le', company.verifiedAt ? formatDateTime(company.verifiedAt) : null],
          ]}
        />
        {company.verificationNote && (
          <Alert tone={noteTone} title="Message d’E-MPGT">
            <p className="whitespace-pre-line">{company.verificationNote}</p>
          </Alert>
        )}
        {company.missingForVerification.length > 0 && (
          <Alert tone="warning" title="À compléter avant de demander la vérification">
            <ul className="list-disc pl-5">
              {company.missingForVerification.map((m) => (
                <li key={m}>{m}</li>
              ))}
            </ul>
          </Alert>
        )}
        <ActionButton<CompanyView>
          actions={company.actions}
          action="submitVerification"
          label="Demander la vérification"
          endpoint="/company/submit-verification"
          confirm={{
            title: 'Demander la vérification',
            message:
              'E-MPGT va contrôler les informations de votre entreprise et les justificatifs déposés (immatriculation, assurance, attestations). Vous serez notifié du résultat.',
            confirmLabel: 'Envoyer la demande',
          }}
          success="Demande de vérification envoyée à E-MPGT"
          onDone={onChange}
        />
      </div>
    </Card>
  );
}

function CompanyDocuments({ companyId }: { companyId: string }) {
  const documents = useApi<Page<DocumentView>>(`/documents${qs({ companyId, pageSize: 100 })}`);
  return (
    <Card
      title="Documents de l’entreprise"
      description="Justificatif d’immatriculation, attestation d’assurance, attestations fiscales et sociales… Ils sont vérifiés par E-MPGT."
      actions={
        <Link href="/entreprise/documents" className="text-sm font-medium text-brand-700 underline">
          Tous les documents
        </Link>
      }
    >
      <div className="space-y-6">
        <ResourceView resource={documents}>
          {(page) => (
            <DocumentTable
              documents={page.items.filter((d) => !d.missionId && !d.contractId)}
              showTarget={false}
              onChanged={() => void documents.reload()}
              empty={{
                title: 'Aucun document déposé',
                description:
                  'Déposez votre justificatif d’immatriculation pour faciliter la vérification.',
              }}
            />
          )}
        </ResourceView>
        <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
          <h3 className="mb-3 text-sm font-semibold text-gray-900">Déposer un document</h3>
          <DocumentUploadForm
            target="company"
            targetId={companyId}
            kinds={COMPANY_DOCUMENT_KINDS}
            onUploaded={() => void documents.reload()}
          />
        </div>
      </div>
    </Card>
  );
}

export default function OrganisationPage() {
  const { refresh } = useSession();
  const company = useApi<CompanyView>('/company');
  const apply = (next: CompanyView) => {
    company.setData(next);
    // La raison sociale et l'état de vérification sont aussi affichés dans l'en-tête de l'espace.
    void refresh();
  };

  return (
    <ResourceView resource={company} loadingLabel="Chargement de votre organisation…">
      {(c) => (
        <>
          <PageHeader
            title={c.tradeName || c.legalName}
            description="Informations de l’entreprise, vérification, contacts, membres et documents."
            breadcrumbs={[breadcrumbRoot, { label: 'Entreprise et membres' }]}
            badge={
              <span className="flex flex-wrap gap-2">
                <StatusBadge
                  status={c.verificationStatus}
                  label={labels.companyVerification[c.verificationStatus]}
                />
                {c.status !== 'ACTIVE' && (
                  <StatusBadge status={c.status} label={labels.companyStatus[c.status]} />
                )}
                {c.isDemo && <Badge tone="amber">Démonstration</Badge>}
              </span>
            }
          />
          <div className="space-y-6">
            <PendingList items={c.pending} />
            <VerificationCard company={c} onChange={apply} />
            <Card title="Informations de l’entreprise">
              <CompanyInfoForm company={c} onSaved={apply} />
            </Card>
            <CompanyContacts company={c} onChange={company.setData} />
            <Anchor id="membres">
              <CompanyMembers company={c} onChange={company.setData} />
            </Anchor>
            <Anchor id="documents">
              <CompanyDocuments companyId={c.id} />
            </Anchor>
          </div>
        </>
      )}
    </ResourceView>
  );
}
