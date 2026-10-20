import { labels, type BillingUnit, type ExperienceView } from '@empgt/contracts';
import { firstOfMonthIso, formatMonth } from '@/lib/format';

// Aides d'affichage propres à l'espace freelance (aucune règle métier : mise en forme uniquement).

/** Libellés des rubriques signalées « à confirmer » sur un profil historique importé. */
export const FIELD_TO_CONFIRM_LABELS: Record<string, string> = {
  identity: 'Identité (nom, prénom)',
  email: 'Adresse e-mail',
  headline: 'Titre du profil',
  summary: 'Résumé (repris d’une accroche courte)',
  yearsOfExperience: 'Années d’expérience',
  businessStatus: 'Statut juridique',
  availabilityStatus: 'Disponibilité',
  rates: 'Préférences tarifaires',
  city: 'Ville',
  country: 'Pays de résidence',
  mobility: 'Mobilité',
  workModes: 'Modalités d’intervention',
  skills: 'Compétences et logiciels',
  experiences: 'Expériences',
  educations: 'Formations',
  languages: 'Langues',
  qualifications: 'Qualifications et habilitations',
  publicationConsent: 'Consentement à la publication dans le catalogue',
};

export function fieldToConfirmLabel(field: string): string {
  return FIELD_TO_CONFIRM_LABELS[field] ?? field;
}

/** « Ville, région, pays » en ignorant les valeurs absentes. */
export function place(...parts: Array<string | null | undefined>): string {
  return parts.filter((p) => p && p.trim()).join(', ');
}

const monthName = new Intl.DateTimeFormat('fr-FR', { month: 'long', timeZone: 'UTC' });
export const MONTH_OPTIONS = Array.from({ length: 12 }, (_, i) => ({
  value: String(i + 1),
  label: monthName.format(new Date(Date.UTC(2000, i, 1))),
}));

function monthYear(month: number | null, year: number | null): string | null {
  if (!year) return null;
  return month ? `${String(month).padStart(2, '0')}/${year}` : String(year);
}

/** Période lisible d'une expérience : libellé saisi, sinon dates de début et de fin. */
export function experiencePeriod(e: Pick<ExperienceView, 'periodLabel' | 'startMonth' | 'startYear' | 'endMonth' | 'endYear' | 'isCurrent'>): string {
  const start = monthYear(e.startMonth, e.startYear);
  const end = e.isCurrent ? 'en cours' : monthYear(e.endMonth, e.endYear);
  const dates = start || end ? `${start ?? '?'} – ${end ?? '?'}` : null;
  if (e.periodLabel && dates) return `${e.periodLabel} (${dates})`;
  return e.periodLabel ?? dates ?? (e.isCurrent ? 'En cours' : 'Période non précisée');
}

/** « par jour » / « par heure ». */
export function perUnit(unit: BillingUnit | null | undefined): string {
  return unit ? `par ${labels.rateUnit[unit]}` : '';
}

/** Les 12 derniers mois (1er du mois, ISO), du plus récent au plus ancien. */
export function recentMonths(count = 12): Array<{ value: string; label: string }> {
  return Array.from({ length: count }, (_, i) => {
    const value = firstOfMonthIso(-i);
    return { value, label: formatMonth(value) };
  });
}

/** Jours calendaires (ISO) de `from` à `to` inclus. */
export function daysBetween(from: string, to: string): string[] {
  const days: string[] = [];
  const end = new Date(`${to}T00:00:00Z`).getTime();
  for (let d = new Date(`${from}T00:00:00Z`); d.getTime() <= end && days.length < 62; d = new Date(d.getTime() + 86_400_000)) {
    days.push(d.toISOString().slice(0, 10));
  }
  return days;
}

const dayFormat = new Intl.DateTimeFormat('fr-FR', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' });
const dayLongFormat = new Intl.DateTimeFormat('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });

export function formatDay(iso: string): string {
  return dayFormat.format(new Date(`${iso}T00:00:00Z`));
}

export function formatDayLong(iso: string): string {
  return dayLongFormat.format(new Date(`${iso}T00:00:00Z`));
}

export function isWeekend(iso: string): boolean {
  const day = new Date(`${iso}T00:00:00Z`).getUTCDay();
  return day === 0 || day === 6;
}

const HOURS_PATTERN = /^(\d{1,2})(?:[.,](\d{1,2}))?$/;

/** Saisie d'heures syntaxiquement valide (le contrôle définitif est fait par le serveur). */
export function isHoursSyntax(value: string): boolean {
  return HOURS_PATTERN.test(value.trim());
}

/**
 * Somme exacte d'heures décimales saisies (en centièmes, sans flottant) — affichage indicatif
 * avant enregistrement ; le total officiel est celui calculé par le serveur.
 */
export function sumHours(values: string[]): string | null {
  let hundredths = 0;
  for (const raw of values) {
    const value = raw.trim();
    if (!value) continue;
    const match = HOURS_PATTERN.exec(value);
    if (!match) return null;
    hundredths += Number(match[1]) * 100 + Number((match[2] ?? '').padEnd(2, '0'));
  }
  return `${Math.floor(hundredths / 100)}.${String(hundredths % 100).padStart(2, '0')}`;
}
