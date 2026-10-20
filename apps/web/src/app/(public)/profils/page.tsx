'use client';

import Link from 'next/link';
import { useState } from 'react';
import { AvailabilityStatus, labels, type Page, type PublicProfileListItem } from '@empgt/contracts';
import { qs } from '@/lib/api';
import { useApi } from '@/lib/hooks';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { EmptyState, ResourceView } from '@/components/ui/feedback';
import { Input, optionsFrom, Select } from '@/components/ui/form';
import { Pagination } from '@/components/ui/table';

export default function ProfilsPage() {
  const [filters, setFilters] = useState({ q: '', skill: '', country: '', availability: '' });
  const [applied, setApplied] = useState(filters);
  const [page, setPage] = useState(1);
  const resource = useApi<Page<PublicProfileListItem>>(`/public/profiles${qs({ ...applied, page, pageSize: 12 })}`);

  return (
    <div className="mx-auto max-w-6xl px-4 py-12">
      <h1 className="text-3xl font-bold text-gray-900">Profils disponibles</h1>
      <p className="mt-2 max-w-3xl text-gray-700">
        Profils validés par E-MPGT et publiés avec l’accord explicite de chaque freelance. Les fiches sont anonymisées : ni nom, ni coordonnées.
      </p>
      <form
        className="mt-6 grid gap-3 rounded-lg border border-gray-200 bg-white p-4 sm:grid-cols-2 lg:grid-cols-5"
        onSubmit={(e) => {
          e.preventDefault();
          setPage(1);
          setApplied(filters);
        }}
      >
        <label className="sr-only" htmlFor="q">Recherche</label>
        <Input id="q" placeholder="Métier, mot-clé…" value={filters.q} onChange={(e) => setFilters({ ...filters, q: e.target.value })} className="lg:col-span-2" />
        <label className="sr-only" htmlFor="skill">Compétence</label>
        <Input id="skill" placeholder="Compétence (ex. Revit)" value={filters.skill} onChange={(e) => setFilters({ ...filters, skill: e.target.value })} />
        <label className="sr-only" htmlFor="availability">Disponibilité</label>
        <Select id="availability" value={filters.availability} placeholder="Toute disponibilité" options={optionsFrom(AvailabilityStatus, labels.availabilityStatus)} onChange={(e) => setFilters({ ...filters, availability: e.target.value })} />
        <Button type="submit">Rechercher</Button>
      </form>
      <div className="mt-6">
        <ResourceView resource={resource}>
          {(data) =>
            data.items.length === 0 ? (
              <EmptyState title="Aucun profil publié ne correspond" description="Les profils n’apparaissent ici qu’après validation par E-MPGT et accord de publication du freelance." />
            ) : (
              <>
                <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {data.items.map((p) => (
                    <li key={p.id} className="flex flex-col rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
                      <p className="font-semibold text-gray-900">{p.headline}</p>
                      <p className="mt-1 text-xs text-gray-600">
                        {[p.city, p.country].filter(Boolean).join(', ') || 'Localisation non précisée'}
                        {p.yearsOfExperience !== null && ` · ${p.yearsOfExperience} ans d’expérience`}
                      </p>
                      {p.summaryExcerpt && <p className="mt-2 flex-1 text-sm text-gray-700">{p.summaryExcerpt}</p>}
                      <div className="mt-3 flex flex-wrap gap-1">
                        {p.skills.slice(0, 5).map((s) => (
                          <Badge key={s}>{s}</Badge>
                        ))}
                      </div>
                      <div className="mt-3 flex items-center justify-between">
                        <Badge tone={p.availabilityStatus === 'AVAILABLE_NOW' ? 'green' : 'gray'}>{labels.availabilityStatus[p.availabilityStatus]}</Badge>
                        <Link href={`/profils/${p.id}`} className="text-sm font-medium text-brand-700 underline">Voir la fiche</Link>
                      </div>
                    </li>
                  ))}
                </ul>
                <Pagination page={data} onChange={setPage} />
              </>
            )
          }
        </ResourceView>
      </div>
    </div>
  );
}
