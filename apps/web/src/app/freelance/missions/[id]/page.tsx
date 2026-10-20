'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { labels, type MissionView } from '@empgt/contracts';
import { formatDate, formatMoney } from '@/lib/format';
import { useApi } from '@/lib/hooks';
import { findAction, PendingList } from '@/components/ui/actions';
import { Badge, StatusBadge } from '@/components/ui/badge';
import { Card, DefinitionList } from '@/components/ui/card';
import { Alert, ResourceView } from '@/components/ui/feedback';
import { PageHeader } from '@/components/ui/page';
import { ApplyForm } from '@/components/freelancer/apply-form';
import { place } from '@/components/freelancer/helpers';
import { MASKED_COMPANY } from '@/components/freelancer/mission-card';

function budget(m: MissionView): string | null {
  if (!m.budgetMin && !m.budgetMax) return null;
  const range = m.budgetMin && m.budgetMax ? `${formatMoney(m.budgetMin, m.budgetCurrency)} – ${formatMoney(m.budgetMax, m.budgetCurrency)}` : formatMoney(m.budgetMin ?? m.budgetMax, m.budgetCurrency);
  return `${range}${m.budgetUnit ? ` par ${labels.rateUnit[m.budgetUnit]}` : ''}`;
}

function MissionDetail({ mission: m }: { mission: MissionView }) {
  const apply = findAction(m.actions, 'apply');
  const required = m.skills.filter((s) => s.required);
  const optional = m.skills.filter((s) => !s.required);

  return (
    <>
      <PageHeader
        title={m.title}
        description={`${m.reference} · ${m.companyName ?? MASKED_COMPANY}`}
        breadcrumbs={[{ label: 'Missions', href: '/freelance/missions' }, { label: m.reference }]}
        badge={<StatusBadge status={m.status} label={labels.missionStatus[m.status]} />}
      />
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <PendingList items={m.pending} />
          <Card title="Description de la mission">
            <p className="whitespace-pre-line text-sm text-gray-800">{m.description}</p>
            {m.profileSought && (
              <>
                <h3 className="mt-4 text-sm font-semibold text-gray-900">Profil recherché</h3>
                <p className="mt-1 whitespace-pre-line text-sm text-gray-800">{m.profileSought}</p>
              </>
            )}
          </Card>
          {m.skills.length > 0 && (
            <Card title="Compétences attendues">
              {required.length > 0 && (
                <div>
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500">Requises</h3>
                  <div className="mt-1 flex flex-wrap gap-1.5">
                    {required.map((s) => (
                      <Badge key={s.skillId} tone="blue">
                        {s.name}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
              {optional.length > 0 && (
                <div className="mt-3">
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500">Souhaitées</h3>
                  <div className="mt-1 flex flex-wrap gap-1.5">
                    {optional.map((s) => (
                      <Badge key={s.skillId}>{s.name}</Badge>
                    ))}
                  </div>
                </div>
              )}
            </Card>
          )}

          <Card title="Candidater" description={apply?.allowed ? 'Votre candidature est transmise à l’entreprise et à E-MPGT.' : undefined}>
            {m.myApplication ? (
              <Alert tone="info" title={`Candidature ${labels.applicationStatus[m.myApplication.status].toLowerCase()}`}>
                Vous avez candidaté le {formatDate(m.myApplication.createdAt)}.{' '}
                <Link href={`/freelance/candidatures/${m.myApplication.id}`} className="font-medium underline">
                  Suivre ma candidature
                </Link>
              </Alert>
            ) : apply?.allowed ? (
              <ApplyForm missionId={m.id} />
            ) : apply ? (
              <Alert tone="warning" title="Candidature impossible">
                {apply.reason}
                {/profil/i.test(apply.reason ?? '') && (
                  <>
                    {' '}
                    <Link href="/freelance/profil" className="font-medium underline">
                      Voir mon profil
                    </Link>
                  </>
                )}
              </Alert>
            ) : (
              <p className="text-sm text-gray-600">La candidature n’est pas disponible pour cette mission.</p>
            )}
          </Card>
        </div>

        <Card title="En bref">
          <DefinitionList
            columns={1}
            items={[
              ['Entreprise', m.companyName ?? <span className="italic text-gray-600">{MASKED_COMPANY}</span>],
              ['Lieu', place(m.city, m.region, m.country) || null],
              ['Modalité', m.workMode ? labels.workMode[m.workMode] : null],
              ['Secteur', m.sector],
              ['Début', formatDate(m.startDate)],
              ['Fin', formatDate(m.endDate)],
              ['Durée', m.durationLabel],
              ['Budget indicatif', budget(m)],
              ['Date limite de candidature', m.applicationDeadline ? formatDate(m.applicationDeadline) : null],
              ['Publiée le', formatDate(m.publishedAt)],
            ]}
          />
        </Card>
      </div>
    </>
  );
}

export default function FreelanceMissionPage() {
  const { id } = useParams<{ id: string }>();
  const mission = useApi<MissionView>(`/missions/${id}`);
  return <ResourceView resource={mission}>{(m) => <MissionDetail mission={m} />}</ResourceView>;
}
