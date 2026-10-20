'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useState } from 'react';
import {
  labels,
  type ApplicationListItem,
  type DocumentView,
  type MissionView,
  type Page,
} from '@empgt/contracts';
import { api, qs } from '@/lib/api';
import { formatDate, formatDateTime } from '@/lib/format';
import { useAction, useApi, type Resource } from '@/lib/hooks';
import { ActionButton, PendingList } from '@/components/ui/actions';
import { Badge, StatusBadge } from '@/components/ui/badge';
import { Card, DefinitionList } from '@/components/ui/card';
import { Alert, ResourceView } from '@/components/ui/feedback';
import { PageHeader } from '@/components/ui/page';
import { DataTable, type Column } from '@/components/ui/table';
import {
  breadcrumbRoot,
  budgetText,
  dateRange,
  joinParts,
  yesNo,
} from '@/components/company/display';
import { DocumentTable, DocumentUploadForm } from '@/components/company/documents';
import { MissionForm } from '@/components/company/mission-form';
import { Anchor, GatedButton } from '@/components/company/widgets';

const applicationColumns: Column<ApplicationListItem>[] = [
  {
    header: 'Candidat',
    cell: (a) => (
      <span className="inline-flex flex-col items-end md:items-start">
        <Link
          href={`/entreprise/candidatures/${a.id}`}
          className="font-medium text-brand-700 hover:underline"
        >
          {a.candidateName}
        </Link>
        {a.candidateHeadline && (
          <span className="text-xs text-gray-500">{a.candidateHeadline}</span>
        )}
      </span>
    ),
  },
  {
    header: 'Statut',
    cell: (a) => <StatusBadge status={a.status} label={labels.applicationStatus[a.status]} />,
  },
  { header: 'Reçue le', cell: (a) => formatDate(a.createdAt) },
  { header: 'Mise à jour', cell: (a) => formatDate(a.updatedAt) },
];

function MissionApplications({
  missionId,
  applications,
}: {
  missionId: string;
  applications: Resource<Page<ApplicationListItem>>;
}) {
  return (
    <Card
      title="Candidatures"
      description="Examinez chaque candidature : présélection, retenue d’un candidat ou refus motivé."
      actions={
        <Link
          href={`/entreprise/candidatures?missionId=${missionId}`}
          className="text-sm font-medium text-brand-700 underline"
        >
          Filtrer dans la liste des candidatures
        </Link>
      }
    >
      <ResourceView resource={applications}>
        {(page) => (
          <DataTable
            rows={page.items}
            columns={applicationColumns}
            rowKey={(a) => a.id}
            caption="Candidatures reçues pour cette mission"
            empty={{
              title: 'Aucune candidature',
              description: 'Les candidatures apparaissent ici une fois la mission publiée.',
            }}
          />
        )}
      </ResourceView>
    </Card>
  );
}

function MissionAttachments({ mission }: { mission: MissionView }) {
  // L'API ne filtre pas les documents par mission : on liste les pièces « Autre document »
  // de l'entreprise et l'on garde celles rattachées à cette mission.
  const documents = useApi<Page<DocumentView>>(
    `/documents${qs({ companyId: mission.companyId, kind: 'OTHER', pageSize: 100 })}`,
  );
  return (
    <Card
      title="Pièces jointes"
      description="Documents internes à la mission (plans, CCTP, planning…), visibles des membres de votre entreprise et d’E-MPGT."
    >
      <div className="space-y-6">
        <ResourceView resource={documents}>
          {(page) => (
            <DocumentTable
              documents={page.items.filter((d) => d.missionId === mission.id)}
              showTarget={false}
              onChanged={() => void documents.reload()}
              empty={{ title: 'Aucune pièce jointe' }}
            />
          )}
        </ResourceView>
        <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
          <h3 className="mb-3 text-sm font-semibold text-gray-900">Ajouter une pièce jointe</h3>
          <DocumentUploadForm
            target="mission"
            targetId={mission.id}
            kinds={['OTHER']}
            withExpiry={false}
            submitLabel="Ajouter la pièce jointe"
            onUploaded={() => void documents.reload()}
          />
        </div>
      </div>
    </Card>
  );
}

function MissionDetails({ m }: { m: MissionView }) {
  return (
    <div className="space-y-6">
      <Card title="Description">
        <p className="whitespace-pre-line text-sm text-gray-800">{m.description}</p>
        {m.profileSought && (
          <div className="mt-4">
            <h3 className="text-sm font-semibold text-gray-900">Profil recherché</h3>
            <p className="mt-1 whitespace-pre-line text-sm text-gray-800">{m.profileSought}</p>
          </div>
        )}
      </Card>
      <Card title="Informations">
        <DefinitionList
          items={[
            ['Référence', m.reference],
            ['Secteur', m.sector],
            ['Lieu', joinParts([m.city, m.region, m.country])],
            ['Modalité d’intervention', m.workMode ? labels.workMode[m.workMode] : 'Non précisée'],
            ['Période', dateRange(m.startDate, m.endDate)],
            ['Durée indicative', m.durationLabel],
            [
              'Date limite de candidature',
              m.applicationDeadline ? formatDate(m.applicationDeadline) : null,
            ],
            [
              'Budget indicatif',
              budgetText(m.budgetMin, m.budgetMax, m.budgetCurrency, m.budgetUnit),
            ],
            ['Budget visible des freelances', yesNo(m.budgetVisibleToFreelancers)],
            ['Candidatures reçues', m.applicationsCount],
            ['Créée le', formatDateTime(m.createdAt)],
            ['Soumise le', m.submittedAt ? formatDateTime(m.submittedAt) : null],
            ['Publiée le', m.publishedAt ? formatDateTime(m.publishedAt) : null],
            ['Dernière modification', formatDateTime(m.updatedAt)],
          ]}
        />
      </Card>
      <Card title="Compétences">
        {m.skills.length === 0 ? (
          <p className="text-sm text-gray-600">
            Aucune compétence : au moins une est requise pour soumettre la mission.
          </p>
        ) : (
          <ul className="flex flex-wrap gap-1.5">
            {m.skills.map((s) => (
              <li key={s.skillId}>
                <Badge tone={s.required ? 'blue' : 'gray'}>
                  {s.name} · {labels.skillCategory[s.category]} ·{' '}
                  {s.required ? 'obligatoire' : 'souhaitée'}
                </Badge>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}

export default function MissionPage() {
  const { id } = useParams<{ id: string }>();
  const mission = useApi<MissionView>(`/missions/${id}`);
  const [editing, setEditing] = useState(false);
  const applications = useApi<Page<ApplicationListItem>>(
    `/applications${qs({ missionId: id, pageSize: 50 })}`,
  );
  const save = useAction();

  return (
    <ResourceView resource={mission} loadingLabel="Chargement de la mission…">
      {(m) => (
        <>
          <PageHeader
            title={m.title}
            description={`${m.reference} · ${joinParts([m.city, m.country])}`}
            breadcrumbs={[
              breadcrumbRoot,
              { label: 'Mes missions', href: '/entreprise/missions' },
              { label: m.reference },
            ]}
            badge={
              <span className="flex flex-wrap gap-2">
                <StatusBadge
                  status={m.publicationStatus}
                  label={labels.missionPublication[m.publicationStatus]}
                />
                <StatusBadge status={m.status} label={labels.missionStatus[m.status]} />
                {m.isDemo && <Badge tone="amber">Démonstration</Badge>}
              </span>
            }
            actions={
              editing ? undefined : (
                <>
                  <GatedButton actions={m.actions} action="update" onClick={() => setEditing(true)}>
                    Modifier
                  </GatedButton>
                  <ActionButton<MissionView>
                    actions={m.actions}
                    action="submit"
                    label="Soumettre à E-MPGT"
                    endpoint={`/missions/${id}/submit`}
                    confirm={{
                      title: 'Soumettre la mission à E-MPGT',
                      message:
                        'E-MPGT vérifie la mission avant sa publication auprès des freelances. Rappel : une mission correspond à un seul poste.',
                      confirmLabel: 'Soumettre',
                    }}
                    success="Mission soumise à E-MPGT"
                    onDone={mission.setData}
                  />
                  <ActionButton<MissionView>
                    actions={m.actions}
                    action="withdraw"
                    label="Retirer de la validation"
                    endpoint={`/missions/${id}/withdraw`}
                    variant="secondary"
                    confirm={{
                      title: 'Retirer la mission de la validation',
                      message:
                        'La mission repasse en brouillon : vous pourrez la modifier puis la soumettre à nouveau.',
                      confirmLabel: 'Retirer',
                    }}
                    success="Mission repassée en brouillon"
                    onDone={mission.setData}
                  />
                  <ActionButton<MissionView>
                    actions={m.actions}
                    action="cancel"
                    label="Annuler la mission"
                    endpoint={`/missions/${id}/cancel`}
                    variant="danger"
                    reason="required"
                    reasonLabel="Motif de l’annulation"
                    confirm={{
                      title: 'Annuler la mission',
                      message:
                        'L’annulation est définitive : la mission ne sera plus visible et les candidatures en cours seront clôturées.',
                      confirmLabel: 'Annuler la mission',
                    }}
                    success="Mission annulée"
                    onDone={(result) => {
                      mission.setData(result);
                      void applications.reload();
                    }}
                  />
                </>
              )
            }
          />
          <div className="space-y-6">
            <PendingList items={m.pending} />
            {m.reviewNote && (
              <Alert
                tone={m.publicationStatus === 'REJECTED' ? 'danger' : 'warning'}
                title="Note de revue E-MPGT"
              >
                <p className="whitespace-pre-line">{m.reviewNote}</p>
              </Alert>
            )}
            {m.statusReason && (
              <Alert tone="warning" title="Motif">
                <p className="whitespace-pre-line">{m.statusReason}</p>
              </Alert>
            )}

            {editing ? (
              <>
                <Alert tone="info" title="Modification de la mission">
                  Une mission = un poste. Les modifications sont enregistrées sur le brouillon ;
                  soumettez ensuite la mission à E-MPGT.
                </Alert>
                <MissionForm
                  initial={m}
                  submitLabel="Enregistrer les modifications"
                  pending={save.pending}
                  error={save.error}
                  onCancel={() => {
                    save.clearError();
                    setEditing(false);
                  }}
                  onSubmit={async (input) => {
                    const updated = await save.run(
                      () => api.patch<MissionView>(`/missions/${id}`, input),
                      { success: 'Mission enregistrée' },
                    );
                    if (updated) {
                      mission.setData(updated);
                      setEditing(false);
                    }
                  }}
                />
              </>
            ) : (
              <MissionDetails m={m} />
            )}

            <Anchor id="candidatures">
              <MissionApplications missionId={m.id} applications={applications} />
            </Anchor>
            <MissionAttachments mission={m} />
          </div>
        </>
      )}
    </ResourceView>
  );
}
