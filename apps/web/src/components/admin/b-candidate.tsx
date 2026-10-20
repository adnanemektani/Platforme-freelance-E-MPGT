import { labels, type CandidateProfileView } from '@empgt/contracts';
import { formatDate } from '@/lib/format';
import { Badge, StatusBadge } from '@/components/ui/badge';
import { DefinitionList } from '@/components/ui/card';

/** Profil professionnel d'un candidat (vue fournie par l'API, sans coordonnées). */
export function BCandidateProfile({ candidate }: { candidate: CandidateProfileView }) {
  const c = candidate;
  return (
    <div className="space-y-5">
      <div>
        <p className="text-lg font-semibold text-gray-900">{c.displayName}</p>
        {c.headline && <p className="text-sm text-gray-700">{c.headline}</p>}
      </div>
      <DefinitionList
        columns={3}
        items={[
          ['Expérience', c.yearsOfExperience !== null ? `${c.yearsOfExperience} an(s)` : null],
          ['Localisation', [c.city, c.region, c.country].filter(Boolean).join(', ')],
          ['Mobilité', c.mobility ? `${labels.mobility[c.mobility]}${c.mobilityNote ? ` — ${c.mobilityNote}` : ''}` : null],
          ['Modalités', c.workModes.map((m) => labels.workMode[m]).join(', ')],
          ['Disponibilité', `${labels.availabilityStatus[c.availabilityStatus]}${c.availableFrom ? ` ${formatDate(c.availableFrom)}` : ''}`],
        ]}
      />
      {c.summary && <p className="whitespace-pre-line text-sm text-gray-800">{c.summary}</p>}

      {c.skills.length > 0 && (
        <section>
          <h3 className="mb-2 text-sm font-semibold text-gray-900">Compétences</h3>
          <div className="flex flex-wrap gap-1.5">
            {c.skills.map((s) => (
              <Badge key={s.skillId} tone="blue">
                {s.name}
                {s.level ? ` · ${s.level}` : ''}
                {s.yearsOfExperience ? ` · ${s.yearsOfExperience} an(s)` : ''}
              </Badge>
            ))}
          </div>
        </section>
      )}

      {c.experiences.length > 0 && (
        <section>
          <h3 className="mb-2 text-sm font-semibold text-gray-900">Expériences</h3>
          <ul className="space-y-3">
            {c.experiences.map((e) => (
              <li key={e.id} className="border-l-2 border-brand-200 pl-3">
                <p className="text-sm font-medium text-gray-900">
                  {e.title}
                  {e.organization && <span className="font-normal text-gray-700"> — {e.organization}</span>}
                </p>
                <p className="text-xs text-gray-500">{[e.periodLabel, e.location, e.isCurrent ? 'En cours' : null].filter(Boolean).join(' · ')}</p>
                {e.description && <p className="mt-1 whitespace-pre-line text-sm text-gray-700">{e.description}</p>}
              </li>
            ))}
          </ul>
        </section>
      )}

      {c.educations.length > 0 && (
        <section>
          <h3 className="mb-2 text-sm font-semibold text-gray-900">Formations</h3>
          <ul className="space-y-1 text-sm text-gray-800">
            {c.educations.map((e) => (
              <li key={e.id}>
                {e.title}
                {e.institution && ` — ${e.institution}`}
                {(e.periodLabel ?? e.year) && <span className="text-gray-500"> ({e.periodLabel ?? e.year})</span>}
              </li>
            ))}
          </ul>
        </section>
      )}

      {c.languages.length > 0 && (
        <section>
          <h3 className="mb-2 text-sm font-semibold text-gray-900">Langues</h3>
          <p className="text-sm text-gray-800">{c.languages.map((l) => (l.level ? `${l.name} (${l.level})` : l.name)).join(', ')}</p>
        </section>
      )}

      {c.qualifications.length > 0 && (
        <section>
          <h3 className="mb-2 text-sm font-semibold text-gray-900">Qualifications</h3>
          <ul className="space-y-1.5">
            {c.qualifications.map((q) => (
              <li key={q.id} className="flex flex-wrap items-center gap-2 text-sm text-gray-800">
                <span>
                  {q.name}
                  {q.issuer && <span className="text-gray-600"> — {q.issuer}</span>}
                  {q.expiresAt && <span className="text-gray-500"> (échéance {formatDate(q.expiresAt)})</span>}
                </span>
                <StatusBadge status={q.status} label={labels.qualificationStatus[q.status]} />
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
