'use client';

import { labels, type AdminProfileView } from '@empgt/contracts';
import { formatDate, formatDateTime, formatMoney } from '@/lib/format';
import { Badge } from '@/components/ui/badge';
import { DefinitionList } from '@/components/ui/card';
import { AText, periodOf } from './a-shared';

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-2">
      <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-600">{title}</h3>
      {children}
    </section>
  );
}

function Empty({ children = 'Non renseigné' }: { children?: React.ReactNode }) {
  return <p className="text-sm text-gray-500">{children}</p>;
}

/** Contenu complet d'un profil (lecture seule) tel que renvoyé par l'API d'administration. */
export function AProfileContent({ profile: p }: { profile: AdminProfileView }) {
  const rate =
    p.rateMin || p.rateMax
      ? `${[p.rateMin ? formatMoney(p.rateMin, p.rateCurrency) : null, p.rateMax ? formatMoney(p.rateMax, p.rateCurrency) : null].filter(Boolean).join(' – ')}${p.rateUnit ? ` / ${labels.rateUnit[p.rateUnit]}` : ''}`
      : null;
  return (
    <div className="space-y-6">
      <DefinitionList
        columns={3}
        items={[
          ['Titre', p.headline],
          ['Années d’expérience', p.yearsOfExperience],
          ['Localisation', [p.city, p.region, p.country].filter(Boolean).join(', ')],
          [
            'Mobilité',
            p.mobility
              ? `${labels.mobility[p.mobility]}${p.mobilityNote ? ` — ${p.mobilityNote}` : ''}`
              : p.mobilityNote,
          ],
          ['Modes de travail', p.workModes.map((w) => labels.workMode[w]).join(', ')],
          ['Statut d’exercice', p.businessStatus ? labels.businessStatus[p.businessStatus] : null],
          ['Tarif indicatif', rate ? `${rate}${p.rateNote ? ` (${p.rateNote})` : ''}` : p.rateNote],
          [
            'Disponibilité',
            `${labels.availabilityStatus[p.availabilityStatus]}${p.availableFrom ? ` ${formatDate(p.availableFrom)}` : ''}`,
          ],
          [
            'Catalogue public',
            `${labels.catalogVisibility[p.catalogVisibility]}${p.publicationConsentAt ? ` — consentement du ${formatDateTime(p.publicationConsentAt)}` : ''}`,
          ],
          ['Soumis le', formatDateTime(p.submittedAt)],
          ['Dernière décision', formatDateTime(p.reviewedAt)],
          ['Mis à jour le', formatDateTime(p.updatedAt)],
        ]}
      />

      <Section title="Résumé">
        <p className="text-sm text-gray-900">
          <AText value={p.summary} empty="Non renseigné" />
        </p>
      </Section>

      <Section title={`Compétences (${p.skills.length})`}>
        {p.skills.length === 0 ? (
          <Empty />
        ) : (
          <ul className="flex flex-wrap gap-1.5">
            {p.skills.map((s) => (
              <li key={s.skillId}>
                <Badge tone="blue">
                  {s.name}
                  <span className="ml-1 opacity-75">
                    · {labels.skillCategory[s.category]}
                    {s.level ? ` · ${s.level}` : ''}
                    {s.yearsOfExperience !== null ? ` · ${s.yearsOfExperience} an(s)` : ''}
                  </span>
                </Badge>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section title={`Expériences (${p.experiences.length})`}>
        {p.experiences.length === 0 ? (
          <Empty />
        ) : (
          <ol className="space-y-3">
            {p.experiences.map((e) => (
              <li key={e.id} className="rounded-md border border-gray-100 p-3 text-sm">
                <p className="font-medium text-gray-900">{e.title}</p>
                <p className="text-gray-600">
                  {[e.organization, e.location, periodOf(e)].filter(Boolean).join(' · ') || '—'}
                </p>
                {e.description && (
                  <p className="mt-1 text-gray-800">
                    <AText value={e.description} />
                  </p>
                )}
              </li>
            ))}
          </ol>
        )}
      </Section>

      <Section title={`Formations (${p.educations.length})`}>
        {p.educations.length === 0 ? (
          <Empty />
        ) : (
          <ul className="space-y-2">
            {p.educations.map((e) => (
              <li key={e.id} className="text-sm">
                <p className="font-medium text-gray-900">{e.title}</p>
                <p className="text-gray-600">
                  {[e.institution, e.periodLabel ?? (e.year ? String(e.year) : null)]
                    .filter(Boolean)
                    .join(' · ') || '—'}
                </p>
                {e.description && (
                  <p className="text-gray-800">
                    <AText value={e.description} />
                  </p>
                )}
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section title={`Langues (${p.languages.length})`}>
        {p.languages.length === 0 ? (
          <Empty />
        ) : (
          <ul className="flex flex-wrap gap-1.5">
            {p.languages.map((l) => (
              <li key={l.id}>
                <Badge>
                  {l.name}
                  {l.level ? ` — ${l.level}` : ''}
                </Badge>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section title={`Périodes de disponibilité (${p.availabilities.length})`}>
        {p.availabilities.length === 0 ? (
          <Empty>Aucune période déclarée</Empty>
        ) : (
          <ul className="space-y-1 text-sm">
            {p.availabilities.map((a) => (
              <li key={a.id}>
                <span className="font-medium">{labels.availabilityKind[a.kind]}</span> du{' '}
                {formatDate(a.startDate)}
                {a.endDate ? ` au ${formatDate(a.endDate)}` : ''}
                {a.daysPerWeek ? ` · ${a.daysPerWeek} j/sem.` : ''}
                {a.note ? ` · ${a.note}` : ''}
              </li>
            ))}
          </ul>
        )}
      </Section>
    </div>
  );
}
