// Dates calendaires : stockées en @db.Date (minuit UTC), échangées au format AAAA-MM-JJ.
// Aucun calcul ne dépend du fuseau du serveur.

export function parseIsoDate(value: string): Date {
  const [y, m, d] = value.split('-').map(Number) as [number, number, number];
  return new Date(Date.UTC(y, m - 1, d));
}

export function parseOptionalIsoDate(value: string | null | undefined): Date | null {
  return value ? parseIsoDate(value) : null;
}

export function toIsoDate(date: Date): string;
export function toIsoDate(date: Date | null | undefined): string | null;
export function toIsoDate(date: Date | null | undefined): string | null {
  if (!date) return null;
  return date.toISOString().slice(0, 10);
}

export function toIso(date: Date): string;
export function toIso(date: Date | null | undefined): string | null;
export function toIso(date: Date | null | undefined): string | null {
  return date ? date.toISOString() : null;
}

/** Date du jour (UTC) à minuit. */
export function today(now = new Date()): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

export function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * 86_400_000);
}

export function addHours(date: Date, hours: number): Date {
  return new Date(date.getTime() + hours * 3_600_000);
}

/** Dernier jour du mois de la date donnée. */
export function endOfMonth(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0));
}

export function maxDate(a: Date, b: Date): Date {
  return a.getTime() >= b.getTime() ? a : b;
}

export function minDate(a: Date, b: Date): Date {
  return a.getTime() <= b.getTime() ? a : b;
}

/** Libellé de mois en français, ex. « octobre 2026 ». */
export function monthLabel(date: Date): string {
  return new Intl.DateTimeFormat('fr-FR', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(date);
}

export function formatDateFr(date: Date): string {
  return new Intl.DateTimeFormat('fr-FR', { dateStyle: 'long', timeZone: 'UTC' }).format(date);
}
