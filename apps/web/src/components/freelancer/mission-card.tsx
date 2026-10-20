import Link from 'next/link';
import { labels, type MissionListItem } from '@empgt/contracts';
import { formatDate } from '@/lib/format';
import { Badge, StatusBadge } from '@/components/ui/badge';
import { place } from './helpers';

export const MASKED_COMPANY = 'Entreprise vérifiée — nom communiqué après sélection';

/** Carte d'une mission publiée, avec l'état de ma candidature éventuelle. */
export function MissionCard({ mission }: { mission: MissionListItem }) {
  const location = place(mission.city, mission.country);
  return (
    <li className="flex flex-col rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <p className="text-xs text-gray-500">{mission.reference}</p>
        {mission.myApplicationStatus && (
          <StatusBadge status={mission.myApplicationStatus} label={`Ma candidature : ${labels.applicationStatus[mission.myApplicationStatus].toLowerCase()}`} />
        )}
      </div>
      <h2 className="mt-1 text-base font-semibold text-gray-900">
        <Link href={`/freelance/missions/${mission.id}`} className="hover:underline">
          {mission.title}
        </Link>
      </h2>
      <p className={`mt-0.5 text-sm ${mission.companyName ? 'text-gray-800' : 'italic text-gray-600'}`}>{mission.companyName ?? MASKED_COMPANY}</p>
      <dl className="mt-3 space-y-1 text-sm text-gray-700">
        <div className="flex gap-1">
          <dt className="sr-only">Lieu</dt>
          <dd>{location || 'Lieu non précisé'}</dd>
          {mission.workMode && (
            <>
              <dt className="sr-only">Modalité</dt>
              <dd>· {labels.workMode[mission.workMode]}</dd>
            </>
          )}
        </div>
        <div>
          <dt className="sr-only">Période</dt>
          <dd>
            {mission.startDate ? `Début ${formatDate(mission.startDate)}` : 'Début à définir'}
            {mission.endDate ? ` · fin ${formatDate(mission.endDate)}` : ''}
            {mission.durationLabel ? ` · ${mission.durationLabel}` : ''}
          </dd>
        </div>
      </dl>
      {mission.skills.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1">
          {mission.skills.slice(0, 6).map((s) => (
            <Badge key={s}>{s}</Badge>
          ))}
          {mission.skills.length > 6 && <Badge>+{mission.skills.length - 6}</Badge>}
        </div>
      )}
      <div className="mt-auto flex items-center justify-between pt-4">
        <span className="text-xs text-gray-500">{mission.publishedAt ? `Publiée le ${formatDate(mission.publishedAt)}` : ''}</span>
        <Link href={`/freelance/missions/${mission.id}`} className="text-sm font-medium text-brand-700 underline">
          Voir la mission<span className="sr-only"> {mission.title}</span>
        </Link>
      </div>
    </li>
  );
}
