'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useState } from 'react';
import { labels, type AdminProfileView } from '@empgt/contracts';
import { formatDateTime } from '@/lib/format';
import { useApi } from '@/lib/hooks';
import { findAction, PendingList } from '@/components/ui/actions';
import { Badge, StatusBadge } from '@/components/ui/badge';
import { Card, DefinitionList } from '@/components/ui/card';
import { Alert, ResourceView } from '@/components/ui/feedback';
import { PageHeader } from '@/components/ui/page';
import {
  AClaimInvite,
  APaymentConfigCard,
  AQualificationsCard,
} from '@/components/admin/a-profile-admin';
import { AProfileContent } from '@/components/admin/a-profile-content';
import { AProfileForm } from '@/components/admin/a-profile-form';
import { AProfileSections } from '@/components/admin/a-profile-sections';
import {
  ADecisionBar,
  ADocumentsCard,
  AFieldBadges,
  AStateButton,
  AText,
  type ADecision,
} from '@/components/admin/a-shared';

const DECISIONS: ADecision[] = [
  {
    action: 'approve',
    label: 'Valider le profil',
    path: 'approve',
    reason: 'optional',
    variant: 'success',
    success: 'Profil validé',
    message:
      'Le freelance sera informé ; il pourra candidater aux missions publiées et, s’il y consent, apparaître dans le catalogue public anonymisé.',
  },
  {
    action: 'requestChanges',
    label: 'Demander des corrections',
    path: 'request-changes',
    reason: 'required',
    success: 'Corrections demandées',
    message:
      'Le motif est transmis au freelance, qui pourra corriger puis soumettre à nouveau son profil.',
  },
  {
    action: 'reject',
    label: 'Refuser le profil',
    path: 'reject',
    reason: 'required',
    variant: 'danger',
    success: 'Profil refusé',
    message: 'Le motif est transmis au freelance.',
  },
  {
    action: 'suspend',
    label: 'Suspendre le profil',
    path: 'suspend',
    reason: 'required',
    variant: 'danger',
    success: 'Profil suspendu',
    message:
      'Le profil ne pourra plus candidater ni apparaître dans le catalogue jusqu’à sa réactivation.',
  },
  {
    action: 'reactivate',
    label: 'Réactiver le profil',
    path: 'reactivate',
    reason: 'required',
    variant: 'success',
    success: 'Profil réactivé',
  },
];

export default function FreelanceFichePage() {
  const { id } = useParams<{ id: string }>();
  const profile = useApi<AdminProfileView>(`/admin/freelancers/${id}`);
  const [editing, setEditing] = useState(false);

  return (
    <ResourceView resource={profile} loadingLabel="Chargement du profil…">
      {(p) => {
        const sections = findAction(p.actions, 'editSections');
        const title = p.headline ?? 'Profil sans titre';
        return (
          <>
            <PageHeader
              breadcrumbs={[{ label: 'Freelances', href: '/admin/freelances' }, { label: title }]}
              title={title}
              badge={
                <span className="flex flex-wrap gap-1.5">
                  <StatusBadge
                    status={p.validationStatus}
                    label={labels.profileValidation[p.validationStatus]}
                  />
                  <Badge tone={p.origin === 'IMPORTED' ? 'amber' : 'gray'}>
                    {labels.profileOrigin[p.origin]}
                  </Badge>
                  <Badge>{labels.catalogVisibility[p.catalogVisibility]}</Badge>
                  {p.isDemo && <Badge tone="purple">Démonstration</Badge>}
                  {p.changedSinceReview && <Badge tone="amber">Modifié depuis la validation</Badge>}
                </span>
              }
            />

            <div className="space-y-6">
              <Card
                title="Décisions"
                description="Seules les décisions possibles dans l’état actuel sont proposées ; chaque décision est tracée et, si le profil a un compte, notifiée au freelance."
              >
                <ADecisionBar<AdminProfileView>
                  actions={p.actions}
                  base={`/admin/freelancers/${p.id}`}
                  decisions={DECISIONS}
                  onDone={profile.setData}
                />
                <div className="mt-4 space-y-3">
                  {p.changedSinceReview && (
                    <Alert tone="warning" title="Modifié depuis la validation">
                      Le profil a été modifié après la dernière décision d’E-MPGT (
                      {formatDateTime(p.reviewedAt)}). Dernière mise à jour :{' '}
                      {formatDateTime(p.updatedAt)}.
                    </Alert>
                  )}
                  {p.validationNote && (
                    <Alert
                      tone={
                        p.validationStatus === 'REJECTED' || p.validationStatus === 'SUSPENDED'
                          ? 'danger'
                          : 'info'
                      }
                      title="Note de la dernière décision"
                    >
                      <AText value={p.validationNote} />
                    </Alert>
                  )}
                </div>
              </Card>

              <PendingList items={p.pending} />

              <div className="grid gap-6 lg:grid-cols-2">
                <Card title="Compte">
                  {p.user ? (
                    <DefinitionList
                      items={[
                        ['Nom', `${p.user.firstName} ${p.user.lastName}`.trim()],
                        ['Adresse e-mail', p.user.email],
                        [
                          'État du compte',
                          p.user.status in labels.userStatus
                            ? labels.userStatus[p.user.status as keyof typeof labels.userStatus]
                            : p.user.status,
                        ],
                      ]}
                    />
                  ) : (
                    <div className="space-y-3">
                      <Alert tone="warning" title="Profil historique sans compte">
                        Aucune identité ni coordonnée n’est associée à ce profil. Il reste privé
                        tant que la personne concernée ne l’a pas rattaché à un compte, complété et
                        soumis elle-même.
                      </Alert>
                      <AClaimInvite profile={p} onDone={profile.setData} />
                    </div>
                  )}
                </Card>

                <Card title="Provenance">
                  <DefinitionList
                    columns={1}
                    items={[
                      ['Origine', labels.profileOrigin[p.origin]],
                      [
                        'Source',
                        p.sourceUrl ? (
                          <a
                            href={p.sourceUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="break-all text-brand-700 underline"
                          >
                            {p.sourceUrl}
                          </a>
                        ) : null,
                      ],
                      ['Collectée le', formatDateTime(p.sourceCollectedAt)],
                      [
                        'Clé externe',
                        p.sourceExternalKey ? (
                          <span className="font-mono text-xs">{p.sourceExternalKey}</span>
                        ) : null,
                      ],
                    ]}
                  />
                </Card>
              </div>

              <Card title="Points de contrôle">
                <div className="grid gap-4 md:grid-cols-3">
                  <div>
                    <p className="mb-1 text-xs font-medium uppercase tracking-wide text-gray-500">
                      Champs à confirmer
                    </p>
                    <AFieldBadges fields={p.fieldsToConfirm} tone="amber" empty="Aucun" />
                  </div>
                  <div>
                    <p className="mb-1 text-xs font-medium uppercase tracking-wide text-gray-500">
                      Champs verrouillés (corrections humaines)
                    </p>
                    <AFieldBadges fields={p.importLockedFields} tone="purple" empty="Aucun" />
                  </div>
                  <div>
                    <p className="mb-1 text-xs font-medium uppercase tracking-wide text-gray-500">
                      Manquants pour la soumission
                    </p>
                    <AFieldBadges
                      fields={p.missingForSubmission}
                      tone="red"
                      empty="Rien ne manque"
                    />
                  </div>
                </div>
              </Card>

              <Card
                title="Contenu du profil"
                actions={
                  !editing ? (
                    <AStateButton
                      state={findAction(p.actions, 'adminUpdate')}
                      label="Modifier (motif obligatoire)"
                      onClick={() => setEditing(true)}
                    />
                  ) : undefined
                }
              >
                {editing ? (
                  <AProfileForm
                    profile={p}
                    onCancel={() => setEditing(false)}
                    onSaved={(updated) => {
                      profile.setData(updated);
                      setEditing(false);
                    }}
                  />
                ) : (
                  <AProfileContent profile={p} />
                )}
              </Card>

              <Card
                title="Notes internes"
                description="Visibles uniquement par E-MPGT. Modifiables via « Modifier »."
              >
                <p className="text-sm text-gray-900">
                  <AText value={p.internalNotes} empty="Aucune note interne." />
                </p>
              </Card>

              {sections && (
                <Card
                  title="Rubriques du profil historique"
                  description="Compétences, langues, expériences et formations d’un profil importé non rattaché. Chaque correction est verrouillée vis-à-vis des imports suivants."
                >
                  {sections.allowed ? (
                    <AProfileSections profile={p} onChange={profile.setData} />
                  ) : (
                    <p className="text-sm text-gray-600">{sections.reason}</p>
                  )}
                </Card>
              )}

              <AQualificationsCard profile={p} onChange={profile.setData} />

              <APaymentConfigCard profileId={p.id} />

              <ADocumentsCard filter={{ profileId: p.id }} title="Documents du profil" />

              <p className="text-sm">
                <Link
                  href={`/admin/audit?entityType=FreelancerProfile&entityId=${p.id}`}
                  className="font-medium text-brand-700 underline"
                >
                  Voir l’historique de ce profil dans le journal d’audit
                </Link>
              </p>
            </div>
          </>
        );
      }}
    </ResourceView>
  );
}
