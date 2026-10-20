'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useState } from 'react';
import { labels, type ApplicationListItem, type MissionView, type Page } from '@empgt/contracts';
import { formatDate, formatDateTime, formatMoney } from '@/lib/format';
import { useApi } from '@/lib/hooks';
import { ActionButton, findAction, PendingList } from '@/components/ui/actions';
import { Badge, StatusBadge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, DefinitionList } from '@/components/ui/card';
import { Alert, ResourceView } from '@/components/ui/feedback';
import { PageHeader } from '@/components/ui/page';
import { DataTable } from '@/components/ui/table';
import { adminPending, BText } from '@/components/admin/b-common';
import { BMissionAdminForm } from '@/components/admin/b-mission-form';

function budgetLabel(m: MissionView): string | null {
  if (!m.budgetMin && !m.budgetMax) return null;
  const range = [m.budgetMin && formatMoney(m.budgetMin, m.budgetCurrency), m.budgetMax && formatMoney(m.budgetMax, m.budgetCurrency)].filter(Boolean).join(' – ');
  return `${range}${m.budgetUnit ? ` / ${labels.rateUnit[m.budgetUnit]}` : ''}${m.budgetVisibleToFreelancers ? ' (visible des freelances)' : ' (masqué aux freelances)'}`;
}

export default function AdminMissionPage() {
  const { id } = useParams<{ id: string }>();
  const mission = useApi<MissionView>(`/missions/${id}`);
  const applications = useApi<Page<ApplicationListItem>>(`/applications?missionId=${id}&pageSize=100`);
  const [editing, setEditing] = useState(false);

  return (
    <ResourceView resource={mission}>
      {(m) => {
        const edit = findAction(m.actions, 'adminUpdate');
        const done = (view: MissionView) => {
          mission.setData(view);
          void applications.reload();
        };
        return (
          <>
            <PageHeader
              breadcrumbs={[{ label: 'Missions', href: '/admin/missions' }, { label: m.reference }]}
              title={m.title}
              badge={
                <span className="flex flex-wrap gap-1.5">
                  <StatusBadge status={m.publicationStatus} label={labels.missionPublication[m.publicationStatus]} />
                  <StatusBadge status={m.status} label={labels.missionStatus[m.status]} />
                  {m.isDemo && <Badge tone="purple">Démonstration</Badge>}
                </span>
              }
              description={
                <>
                  {m.reference} · {m.companyName ?? 'Entreprise'} · créée le {formatDate(m.createdAt)}
                </>
              }
              actions={
                <>
                  <ActionButton<MissionView>
                    actions={m.actions}
                    action="approve"
                    label="Valider et publier"
                    variant="success"
                    endpoint={`/missions/${id}/approve`}
                    reason="optional"
                    reasonLabel="Note pour l’entreprise"
                    confirm={{ title: 'Valider et publier la mission', message: 'La mission devient visible des freelances validés.' }}
                    success="Mission publiée"
                    onDone={done}
                  />
                  <ActionButton<MissionView>
                    actions={m.actions}
                    action="requestChanges"
                    label="Demander des corrections"
                    variant="secondary"
                    endpoint={`/missions/${id}/request-changes`}
                    reason="required"
                    reasonLabel="Corrections attendues"
                    success="Corrections demandées"
                    onDone={done}
                  />
                  <ActionButton<MissionView>
                    actions={m.actions}
                    action="reject"
                    label="Refuser"
                    variant="danger"
                    endpoint={`/missions/${id}/reject`}
                    reason="required"
                    reasonLabel="Motif du refus"
                    success="Mission refusée"
                    onDone={done}
                  />
                  <ActionButton<MissionView>
                    actions={m.actions}
                    action="unpublish"
                    label="Dépublier"
                    variant="secondary"
                    endpoint={`/missions/${id}/unpublish`}
                    reason="required"
                    reasonLabel="Motif de la dépublication"
                    success="Mission dépubliée"
                    onDone={done}
                  />
                  <ActionButton<MissionView>
                    actions={m.actions}
                    action="republish"
                    label="Republier"
                    variant="success"
                    endpoint={`/missions/${id}/republish`}
                    reason="required"
                    reasonLabel="Motif de la republication"
                    success="Mission republiée"
                    onDone={done}
                  />
                  <ActionButton<MissionView>
                    actions={m.actions}
                    action="cancel"
                    label="Annuler la mission"
                    variant="danger"
                    endpoint={`/missions/${id}/cancel`}
                    reason="required"
                    reasonLabel="Motif de l’annulation"
                    confirm={{ title: 'Annuler la mission', message: 'Les candidatures en cours seront clôturées. Cette décision est tracée et notifiée.' }}
                    success="Mission annulée"
                    onDone={done}
                  />
                </>
              }
            />

            <div className="space-y-6">
              <PendingList items={adminPending(m.pending)} />
              {m.reviewNote && (
                <Alert tone={m.publicationStatus === 'REJECTED' ? 'danger' : 'info'} title="Note de validation E-MPGT">
                  <p className="whitespace-pre-line">{m.reviewNote}</p>
                </Alert>
              )}
              {m.statusReason && (
                <Alert tone="warning" title="Motif du statut">
                  <p className="whitespace-pre-line">{m.statusReason}</p>
                </Alert>
              )}

              {edit && (
                <Card
                  title="Modification administrative"
                  description="Intervention E-MPGT : motif obligatoire, tracée dans l’audit et notifiée à l’entreprise."
                  actions={
                    !editing && (
                      <span className="inline-flex flex-col">
                        <Button variant="secondary" disabled={!edit.allowed} onClick={() => setEditing(true)}>
                          Modifier la mission
                        </Button>
                        {!edit.allowed && edit.reason && <span className="mt-1 max-w-xs text-xs text-gray-600">{edit.reason}</span>}
                      </span>
                    )
                  }
                >
                  {editing && edit.allowed ? (
                    <BMissionAdminForm
                      mission={m}
                      onCancel={() => setEditing(false)}
                      onSaved={(view) => {
                        mission.setData(view);
                        setEditing(false);
                      }}
                    />
                  ) : (
                    <p className="text-sm text-gray-600">Les modifications sont réservées aux corrections nécessaires ; privilégiez une demande de corrections à l’entreprise.</p>
                  )}
                </Card>
              )}

              <div className="grid gap-6 lg:grid-cols-3">
                <Card title="Contenu de la mission" className="lg:col-span-2">
                  <div className="space-y-4">
                    <BText value={m.description} />
                    {m.profileSought && (
                      <div>
                        <h3 className="text-sm font-semibold text-gray-900">Profil recherché</h3>
                        <BText value={m.profileSought} />
                      </div>
                    )}
                    {m.skills.length > 0 && (
                      <div>
                        <h3 className="mb-1.5 text-sm font-semibold text-gray-900">Compétences</h3>
                        <div className="flex flex-wrap gap-1.5">
                          {m.skills.map((s) => (
                            <Badge key={s.skillId} tone={s.required ? 'blue' : 'gray'}>
                              {s.name} · {labels.skillCategory[s.category]}
                              {s.required ? '' : ' (souhaitée)'}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </Card>
                <Card title="Informations">
                  <DefinitionList
                    columns={1}
                    items={[
                      [
                        'Entreprise',
                        <Link key="c" href={`/admin/entreprises/${m.companyId}`} className="text-brand-700 underline">
                          {m.companyName ?? 'Voir l’entreprise'}
                        </Link>,
                      ],
                      ['Secteur', m.sector],
                      ['Lieu', [m.city, m.region, m.country].filter(Boolean).join(', ')],
                      ['Modalité', m.workMode ? labels.workMode[m.workMode] : null],
                      ['Période', m.startDate || m.endDate ? `${formatDate(m.startDate)} → ${formatDate(m.endDate)}` : null],
                      ['Durée', m.durationLabel],
                      ['Budget indicatif', budgetLabel(m)],
                      ['Date limite de candidature', formatDate(m.applicationDeadline)],
                      ['Soumise le', formatDateTime(m.submittedAt)],
                      ['Publiée le', formatDateTime(m.publishedAt)],
                      ['Mise à jour', formatDateTime(m.updatedAt)],
                    ]}
                  />
                </Card>
              </div>

              <Card title="Candidatures" description={`${m.applicationsCount ?? 0} candidature(s)`}>
                <ResourceView resource={applications}>
                  {(list) => (
                    <DataTable
                      rows={list.items}
                      rowKey={(a) => a.id}
                      caption="Candidatures de la mission"
                      empty={{ title: 'Aucune candidature' }}
                      columns={[
                        {
                          header: 'Candidat',
                          cell: (a) => (
                            <span className="flex flex-col">
                              <Link href={`/admin/candidatures/${a.id}`} className="font-medium text-brand-700 hover:underline">
                                {a.candidateName}
                              </Link>
                              {a.candidateHeadline && <span className="text-xs text-gray-500">{a.candidateHeadline}</span>}
                            </span>
                          ),
                        },
                        { header: 'Statut', cell: (a) => <StatusBadge status={a.status} label={labels.applicationStatus[a.status]} /> },
                        { header: 'Reçue le', cell: (a) => formatDate(a.createdAt) },
                        { header: 'Mise à jour', cell: (a) => formatDate(a.updatedAt) },
                      ]}
                    />
                  )}
                </ResourceView>
              </Card>
            </div>
          </>
        );
      }}
    </ResourceView>
  );
}
