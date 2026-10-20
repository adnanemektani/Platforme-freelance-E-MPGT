'use client';

import type { ReactNode } from 'react';
import type { LegalInfo, PublicSettings } from '@empgt/contracts';
import { useApi } from '@/lib/hooks';
import { Alert } from '@/components/ui/feedback';

/** Valeur légale ou mention explicite de l'information manquante (jamais inventée). */
export function Legal({ value, missing }: { value: string | null | undefined; missing: string }) {
  if (value) return <>{value}</>;
  return <mark className="rounded bg-amber-100 px-1 text-amber-900">[À compléter par E-MPGT : {missing}]</mark>;
}

export function LegalPage({ title, children }: { title: string; children: (legal: LegalInfo) => ReactNode }) {
  const settings = useApi<PublicSettings>('/public/settings');
  const legal = settings.data?.legal;
  const missing = legal ? Object.values(legal).filter((v) => !v).length : 0;
  return (
    <div className="mx-auto max-w-3xl px-4 py-12">
      <h1 className="text-3xl font-bold text-gray-900">{title}</h1>
      {missing > 0 && (
        <div className="mt-4">
          <Alert tone="warning" title="Informations légales incomplètes">
            Certaines informations doivent être fournies par E-MPGT (société exploitante, hébergeur, contact…). Elles sont signalées ci-dessous.
          </Alert>
        </div>
      )}
      <div className="prose mt-6 max-w-none space-y-4 text-sm leading-6 text-gray-800">{legal ? children(legal) : <p>Chargement…</p>}</div>
    </div>
  );
}
