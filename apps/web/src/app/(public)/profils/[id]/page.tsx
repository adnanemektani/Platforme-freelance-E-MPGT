'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { Suspense } from 'react';
import { labels, type PublicProfileView } from '@empgt/contracts';
import { formatDate } from '@/lib/format';
import { useApi } from '@/lib/hooks';
import { Badge } from '@/components/ui/badge';
import { buttonClass } from '@/components/ui/button';
import { LoadingBlock, ResourceView } from '@/components/ui/feedback';

function ProfilPublic() {
  const { id } = useParams<{ id: string }>();
  const resource = useApi<PublicProfileView>(`/public/profiles/${id}`);
  return (
    <div className="mx-auto max-w-4xl px-4 py-12">
      <Link href="/profils" className="text-sm text-brand-700 underline">← Tous les profils</Link>
      <div className="mt-4">
        <ResourceView resource={resource}>
          {(p) => (
            <article className="space-y-6 rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
              <header>
                <h1 className="text-2xl font-bold text-gray-900">{p.headline}</h1>
                <p className="mt-1 text-sm text-gray-600">
                  {[p.city, p.country].filter(Boolean).join(', ') || 'Localisation non précisée'}
                  {p.yearsOfExperience !== null && ` · ${p.yearsOfExperience} ans d’expérience`}
                  {p.mobility && ` · Mobilité ${labels.mobility[p.mobility].toLowerCase()}`}
                </p>
                <div className="mt-2 flex flex-wrap gap-2">
                  <Badge tone={p.availabilityStatus === 'AVAILABLE_NOW' ? 'green' : 'gray'}>
                    {labels.availabilityStatus[p.availabilityStatus]}
                    {p.availabilityStatus === 'AVAILABLE_FROM' && p.availableFrom ? ` ${formatDate(p.availableFrom)}` : ''}
                  </Badge>
                  {p.workModes.map((m) => (
                    <Badge key={m} tone="blue">{labels.workMode[m]}</Badge>
                  ))}
                </div>
              </header>
              {p.summary && <p className="whitespace-pre-line text-gray-800">{p.summary}</p>}
              {p.skills.length > 0 && (
                <section>
                  <h2 className="text-lg font-semibold text-gray-900">Compétences et logiciels</h2>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {p.skills.map((s) => (
                      <Badge key={s.name} tone={s.category === 'SOFTWARE' ? 'purple' : 'gray'}>{s.name}</Badge>
                    ))}
                  </div>
                </section>
              )}
              {p.experiences.length > 0 && (
                <section>
                  <h2 className="text-lg font-semibold text-gray-900">Expériences</h2>
                  <ol className="mt-2 space-y-3">
                    {p.experiences.map((e, i) => (
                      <li key={i} className="border-l-2 border-brand-200 pl-3">
                        <p className="font-medium text-gray-900">{e.title}{e.organization ? ` — ${e.organization}` : ''}</p>
                        {e.periodLabel && <p className="text-xs text-gray-500">{e.periodLabel}</p>}
                        {e.description && <p className="mt-1 whitespace-pre-line text-sm text-gray-700">{e.description}</p>}
                      </li>
                    ))}
                  </ol>
                </section>
              )}
              {p.educations.length > 0 && (
                <section>
                  <h2 className="text-lg font-semibold text-gray-900">Formation</h2>
                  <ul className="mt-2 space-y-1 text-sm text-gray-800">
                    {p.educations.map((e, i) => (
                      <li key={i}>{[e.periodLabel, e.title, e.institution].filter(Boolean).join(' — ')}</li>
                    ))}
                  </ul>
                </section>
              )}
              {p.languages.length > 0 && (
                <section>
                  <h2 className="text-lg font-semibold text-gray-900">Langues</h2>
                  <p className="mt-1 text-sm text-gray-800">{p.languages.map((l) => (l.level ? `${l.name} (${l.level})` : l.name)).join(', ')}</p>
                </section>
              )}
              <footer className="rounded-md bg-brand-50 p-4 text-sm text-brand-900">
                Ce profil vous intéresse ? Créez un compte entreprise et publiez votre mission : E-MPGT organise la mise en relation.
                <div className="mt-2 flex flex-wrap gap-2">
                  <Link href="/inscription/entreprise" className={buttonClass('primary', 'sm')}>Créer un compte entreprise</Link>
                  <Link href="/contact" className={buttonClass('secondary', 'sm')}>Contacter E-MPGT</Link>
                </div>
              </footer>
            </article>
          )}
        </ResourceView>
      </div>
    </div>
  );
}

export default function ProfilPublicPage() {
  return (
    <Suspense fallback={<LoadingBlock />}>
      <ProfilPublic />
    </Suspense>
  );
}
