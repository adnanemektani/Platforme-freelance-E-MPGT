import { labels, type CandidateProfileView, type ExperienceView } from '@empgt/contracts';
import { formatDate } from '@/lib/format';
import { Badge, StatusBadge } from '@/components/ui/badge';
import { Card, DefinitionList } from '@/components/ui/card';
import { joinParts } from './display';

function experiencePeriod(e: ExperienceView): string | null {
  if (e.periodLabel) return e.periodLabel;
  const point = (year: number | null, month: number | null) =>
    year ? (month ? `${String(month).padStart(2, '0')}/${year}` : String(year)) : null;
  const start = point(e.startYear, e.startMonth);
  const end = e.isCurrent ? 'aujourd’hui' : point(e.endYear, e.endMonth);
  const text = [start, end].filter(Boolean).join(' – ');
  return text || null;
}

/**
 * Profil professionnel d'un candidat tel que transmis par l'API : identité réduite,
 * aucune coordonnée (E-MPGT assure la mise en relation).
 */
export function CandidateProfile({ candidate }: { candidate: CandidateProfileView }) {
  const availability =
    labels.availabilityStatus[candidate.availabilityStatus] +
    (candidate.availabilityStatus === 'AVAILABLE_FROM' && candidate.availableFrom
      ? ` ${formatDate(candidate.availableFrom)}`
      : '');
  return (
    <div className="space-y-4">
      <Card
        title={candidate.displayName}
        description={candidate.headline ?? 'Intitulé de poste non renseigné'}
      >
        <DefinitionList
          items={[
            [
              'Expérience',
              candidate.yearsOfExperience !== null ? `${candidate.yearsOfExperience} an(s)` : null,
            ],
            ['Localisation', joinParts([candidate.city, candidate.region, candidate.country])],
            [
              'Mobilité',
              candidate.mobility
                ? `${labels.mobility[candidate.mobility]}${candidate.mobilityNote ? ` — ${candidate.mobilityNote}` : ''}`
                : null,
            ],
            [
              'Modalités acceptées',
              candidate.workModes.length
                ? candidate.workModes.map((m) => labels.workMode[m]).join(', ')
                : null,
            ],
            ['Disponibilité', availability],
          ]}
        />
        {candidate.summary && (
          <p className="mt-4 whitespace-pre-line text-sm text-gray-800">{candidate.summary}</p>
        )}
        <p className="mt-4 text-xs text-gray-500">
          Les coordonnées du candidat ne sont pas communiquées : E-MPGT assure la mise en relation
          et la contractualisation.
        </p>
      </Card>

      <Card title="Compétences et logiciels">
        {candidate.skills.length === 0 ? (
          <p className="text-sm text-gray-600">Aucune compétence renseignée.</p>
        ) : (
          <ul className="flex flex-wrap gap-1.5">
            {candidate.skills.map((s) => (
              <li key={s.skillId}>
                <Badge tone={s.category === 'SOFTWARE' ? 'purple' : 'gray'}>
                  {s.name}
                  {s.level ? ` · ${s.level}` : ''}
                  {s.yearsOfExperience !== null ? ` · ${s.yearsOfExperience} an(s)` : ''}
                </Badge>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card title="Expériences">
        {candidate.experiences.length === 0 ? (
          <p className="text-sm text-gray-600">Aucune expérience renseignée.</p>
        ) : (
          <ol className="space-y-4">
            {candidate.experiences.map((e) => (
              <li key={e.id} className="border-l-2 border-brand-200 pl-3">
                <p className="font-medium text-gray-900">
                  {e.title}
                  {e.organization ? ` — ${e.organization}` : ''}
                </p>
                <p className="text-xs text-gray-500">
                  {joinParts([experiencePeriod(e), e.location], ' · ')}
                </p>
                {e.description && (
                  <p className="mt-1 whitespace-pre-line text-sm text-gray-700">{e.description}</p>
                )}
              </li>
            ))}
          </ol>
        )}
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="Formations">
          {candidate.educations.length === 0 ? (
            <p className="text-sm text-gray-600">Aucune formation renseignée.</p>
          ) : (
            <ul className="space-y-3">
              {candidate.educations.map((e) => (
                <li key={e.id}>
                  <p className="font-medium text-gray-900">{e.title}</p>
                  <p className="text-xs text-gray-500">
                    {joinParts(
                      [e.institution, e.periodLabel ?? (e.year ? String(e.year) : null)],
                      ' · ',
                    )}
                  </p>
                  {e.description && <p className="mt-1 text-sm text-gray-700">{e.description}</p>}
                </li>
              ))}
            </ul>
          )}
        </Card>
        <Card title="Langues">
          {candidate.languages.length === 0 ? (
            <p className="text-sm text-gray-600">Aucune langue renseignée.</p>
          ) : (
            <ul className="space-y-1 text-sm text-gray-800">
              {candidate.languages.map((l) => (
                <li key={l.id}>
                  <span className="font-medium">{l.name}</span>
                  {l.level ? ` — ${l.level}` : ''}
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <Card
        title="Qualifications et habilitations"
        description="Le statut indique si E-MPGT a vérifié le justificatif."
      >
        {candidate.qualifications.length === 0 ? (
          <p className="text-sm text-gray-600">Aucune qualification déclarée.</p>
        ) : (
          <ul className="divide-y divide-gray-100">
            {candidate.qualifications.map((q) => (
              <li
                key={q.id}
                className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm"
              >
                <span>
                  <span className="font-medium text-gray-900">{q.name}</span>
                  {q.issuer && <span className="text-gray-600"> — {q.issuer}</span>}
                  {q.expiresAt && (
                    <span className="block text-xs text-gray-500">
                      Valable jusqu’au {formatDate(q.expiresAt)}
                    </span>
                  )}
                </span>
                <StatusBadge status={q.status} label={labels.qualificationStatus[q.status]} />
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
