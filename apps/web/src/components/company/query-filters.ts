'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useCallback } from 'react';

/**
 * Filtres d'une liste conservés dans l'URL (liens partageables depuis le tableau de bord,
 * retour arrière du navigateur). À utiliser dans un composant enveloppé par <Suspense>.
 */
export function useQueryFilters<K extends string>(keys: readonly K[]) {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const values = Object.fromEntries(keys.map((k) => [k, params.get(k) ?? ''])) as Record<K, string>;
  const page = Math.max(1, Number.parseInt(params.get('page') ?? '1', 10) || 1);
  const active = keys.some((k) => values[k] !== '');

  const update = useCallback(
    (changes: Partial<Record<K | 'page', string | number | null>>) => {
      const next = new URLSearchParams(params.toString());
      for (const [key, value] of Object.entries(changes) as Array<
        [string, string | number | null | undefined]
      >) {
        if (value === null || value === undefined || value === '') next.delete(key);
        else next.set(key, String(value));
      }
      // Tout changement de filtre ramène à la première page.
      if (!('page' in changes)) next.delete('page');
      const search = next.toString();
      router.replace(search ? `${pathname}?${search}` : pathname, { scroll: false });
    },
    [params, pathname, router],
  );

  const reset = useCallback(() => router.replace(pathname, { scroll: false }), [pathname, router]);

  return { values, page, active, update, reset };
}
