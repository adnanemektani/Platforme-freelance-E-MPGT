/** Forme normalisée d'un libellé : minuscules, sans accents ni ponctuation superflue. */
export function slugify(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9+#.]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 120);
}

/** Normalisation pour comparaison de textes (détection de doublons). */
export function normalizeForCompare(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

export function tokens(value: string): Set<string> {
  return new Set(
    normalizeForCompare(value)
      .split(' ')
      .filter((token) => token.length > 2),
  );
}

/** Similarité de Jaccard entre deux ensembles de mots (0 à 1). */
export function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 && b.size === 0) return 1;
  let intersection = 0;
  for (const token of a) if (b.has(token)) intersection++;
  return intersection / (a.size + b.size - intersection);
}

/** Nom affiché à une entreprise pour un candidat : prénom + initiale (hypothèse D-15). */
export function displayName(firstName: string | null | undefined, lastName: string | null | undefined): string {
  const first = (firstName ?? '').trim();
  const initial = (lastName ?? '').trim().charAt(0);
  if (!first && !initial) return 'Candidat';
  return initial ? `${first} ${initial.toUpperCase()}.` : first;
}

export function fullName(firstName: string | null | undefined, lastName: string | null | undefined): string {
  return `${(firstName ?? '').trim()} ${(lastName ?? '').trim()}`.trim();
}

export function excerpt(value: string | null | undefined, max = 220): string | null {
  if (!value) return null;
  const clean = value.replace(/\s+/g, ' ').trim();
  return clean.length <= max ? clean : `${clean.slice(0, max - 1).trimEnd()}…`;
}
