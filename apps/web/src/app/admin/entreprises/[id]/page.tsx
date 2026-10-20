'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useState } from 'react';
import { labels, type AdminCompanyView } from '@empgt/contracts';
import { formatDate, formatDateTime } from '@/lib/format';
import { useApi } from '@/lib/hooks';
import { findAction, PendingList } from '@/components/ui/actions';
import { Badge, StatusBadge } from '@/components/ui/badge';
import { Card, DefinitionList, StatTile } from '@/components/ui/card';
import { Alert, ResourceView } from '@/components/ui/feedback';
import { PageHeader } from '@/components/ui/page';
import { ACompanyForm } from '@/components/admin/a-company-form';
import { invitationStatusLabels } from '@/components/admin/a-labels';
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
    action: 'verify',
    label: 'Vérifier l’entreprise',
    path: 'verify',
    reason: 'optional',
    variant: 'success',
    success: 'Entreprise vérifiée',
    message: 'L’entreprise sera informée ; ses missions validées pourront être publiées.',
  },
  {
    action: 'requestChanges',
    label: 'Demander des compléments',
    path: 'request-changes',
    reason: 'required',
    success: 'Compléments demandés',
    message:
      'Le motif est transmis à l’entreprise, qui pourra corriger puis redemander la vérification.',
  },
  {
    action: 'reject',
    label: 'Refuser la vérification',
    path: 'reject',
    reason: 'required',
    variant: 'danger',
    success: 'Vérification refusée',
    message: 'Le motif est transmis à l’entreprise.',
  },
  {
    action: 'suspend',
    label: 'Suspendre l’entreprise',
    path: 'suspend',
    reason: 'required',
    variant: 'danger',
    success: 'Entreprise suspendue',
    message:
      'L’organisation ne pourra plus agir sur la plateforme jusqu’à sa réactivation. Le motif lui est communiqué.',
  },
  {
    action: 'reactivate',
    label: 'Réactiver l’entreprise',
    path: 'reactivate',
    reason: 'required',
    variant: 'success',
    success: 'Entreprise réactivée',
  },
];

export default function EntrepriseFichePage() {
  const { id } = useParams<{ id: string }>();
  const company = useApi<AdminCompanyView>(`/admin/companies/${id}`);
  const [editing, setEditing] = useState(false);

  return (
    <ResourceView resource={company} loadingLabel="Chargement de l’entreprise…">
      {(c) => (
        <>
          <PageHeader
            breadcrumbs={[
              { label: 'Entreprises', href: '/admin/entreprises' },
              { label: c.legalName },
            ]}
            title={c.legalName}
            badge={
              <span className="flex flex-wrap gap-1.5">
                <StatusBadge
                  status={c.verificationStatus}
                  label={labels.companyVerification[c.verificationStatus]}
                />
                <StatusBadge status={c.status} label={labels.companyStatus[c.status]} />
                {c.isDemo && <Badge tone="purple">Démonstration</Badge>}
              </span>
            }
            description={`Créée le ${formatDate(c.createdAt)}${c.verificationSubmittedAt ? ` · vérification demandée le ${formatDateTime(c.verificationSubmittedAt)}` : ''}${c.verifiedAt ? ` · vérifiée le ${formatDateTime(c.verifiedAt)}` : ''}`}
          />

          <div className="space-y-6">
            <Card
              title="Décisions"
              description="Seules les décisions possibles dans l’état actuel sont proposées ; chaque décision est tracée et notifiée à l’entreprise."
            >
              <ADecisionBar<AdminCompanyView>
                actions={c.actions}
                base={`/admin/companies/${c.id}`}
                decisions={DECISIONS}
                onDone={company.setData}
              />
              <div className="mt-4 space-y-3">
                {c.verificationNote && (
                  <Alert
                    tone={c.verificationStatus === 'REJECTED' ? 'danger' : 'info'}
                    title="Note de vérification"
                  >
                    <AText value={c.verificationNote} />
                  </Alert>
                )}
                {c.statusReason && (
                  <Alert tone="warning" title="Motif de suspension">
                    <AText value={c.statusReason} />
                  </Alert>
                )}
                {c.missingForVerification.length > 0 && (
                  <Alert tone="warning" title="Informations manquantes pour la vérification">
                    {c.missingForVerification.join(', ')}
                  </Alert>
                )}
              </div>
            </Card>

            <PendingList items={c.pending} />

            <div className="grid gap-4 sm:grid-cols-3">
              <StatTile label="Missions" value={c.stats.missions} />
              <StatTile label="Missions publiées" value={c.stats.publishedMissions} />
              <StatTile label="Contrats actifs" value={c.stats.activeContracts} />
            </div>

            <Card
              title="Informations"
              actions={
                !editing ? (
                  <AStateButton
                    state={findAction(c.actions, 'adminUpdate')}
                    label="Modifier (motif obligatoire)"
                    onClick={() => setEditing(true)}
                  />
                ) : undefined
              }
            >
              {editing ? (
                <ACompanyForm
                  company={c}
                  onCancel={() => setEditing(false)}
                  onSaved={(updated) => {
                    company.setData(updated);
                    setEditing(false);
                  }}
                />
              ) : (
                <div className="space-y-4">
                  <DefinitionList
                    items={[
                      ['Raison sociale', c.legalName],
                      ['Nom commercial', c.tradeName],
                      ['Forme juridique', c.legalForm],
                      [
                        'Immatriculation',
                        [c.registrationType, c.registrationNumber].filter(Boolean).join(' '),
                      ],
                      ['Numéro de TVA', c.vatNumber],
                      [
                        'Adresse',
                        [
                          c.addressLine1,
                          c.addressLine2,
                          [c.postalCode, c.city].filter(Boolean).join(' '),
                          c.country,
                        ]
                          .filter(Boolean)
                          .join(', '),
                      ],
                      ['Secteur', c.sector],
                      ['Effectif', c.sizeRange],
                      [
                        'Site web',
                        c.website ? (
                          <a
                            href={c.website}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-brand-700 underline"
                          >
                            {c.website}
                          </a>
                        ) : null,
                      ],
                    ]}
                  />
                  <div>
                    <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
                      Description
                    </p>
                    <p className="mt-0.5 text-sm text-gray-900">
                      <AText value={c.description} />
                    </p>
                  </div>
                  <div>
                    <p className="mb-1 text-xs font-medium uppercase tracking-wide text-gray-500">
                      Champs verrouillés après vérification
                    </p>
                    <AFieldBadges
                      fields={c.lockedFields}
                      tone="purple"
                      empty="Aucun champ verrouillé"
                    />
                  </div>
                </div>
              )}
            </Card>

            <Card
              title="Notes internes"
              description="Visibles uniquement par E-MPGT. Modifiables via « Modifier »."
            >
              <p className="text-sm text-gray-900">
                <AText value={c.internalNotes} empty="Aucune note interne." />
              </p>
            </Card>

            <div className="grid gap-6 lg:grid-cols-2">
              <Card title="Contacts">
                {c.contacts.length === 0 ? (
                  <p className="text-sm text-gray-600">Aucun contact déclaré.</p>
                ) : (
                  <ul className="divide-y divide-gray-100">
                    {c.contacts.map((ct) => (
                      <li key={ct.id} className="py-2 text-sm">
                        <p className="font-medium text-gray-900">
                          {ct.fullName} <Badge>{labels.contactKind[ct.kind]}</Badge>
                        </p>
                        <p className="text-gray-600">
                          {[ct.jobTitle, ct.email, ct.phone].filter(Boolean).join(' · ') || '—'}
                        </p>
                      </li>
                    ))}
                  </ul>
                )}
              </Card>

              <Card title="Membres">
                {c.members.length === 0 ? (
                  <p className="text-sm text-gray-600">Aucun membre.</p>
                ) : (
                  <ul className="divide-y divide-gray-100">
                    {c.members.map((m) => (
                      <li
                        key={m.membershipId}
                        className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm"
                      >
                        <span>
                          <span className="font-medium text-gray-900">
                            {m.firstName} {m.lastName}
                          </span>
                          <span className="block text-gray-600">
                            {m.email} · depuis le {formatDate(m.since)}
                          </span>
                        </span>
                        <span className="flex gap-1">
                          <Badge tone="blue">{labels.companyRole[m.role]}</Badge>
                          {m.status !== 'ACTIVE' && <Badge tone="gray">Retiré</Badge>}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
                {c.invitations.length > 0 && (
                  <div className="mt-4">
                    <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
                      Invitations
                    </p>
                    <ul className="mt-1 space-y-1 text-sm text-gray-700">
                      {c.invitations.map((inv) => (
                        <li key={inv.id}>
                          {inv.email} — {inv.role ? labels.companyRole[inv.role] : '—'} ·{' '}
                          {invitationStatusLabels[inv.status] ?? inv.status} · expire le{' '}
                          {formatDate(inv.expiresAt)}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </Card>
            </div>

            <ADocumentsCard filter={{ companyId: c.id }} title="Documents de l’entreprise" />

            <p className="text-sm">
              <Link
                href={`/admin/audit?entityType=Company&entityId=${c.id}`}
                className="font-medium text-brand-700 underline"
              >
                Voir l’historique de cette entreprise dans le journal d’audit
              </Link>
            </p>
          </div>
        </>
      )}
    </ResourceView>
  );
}
