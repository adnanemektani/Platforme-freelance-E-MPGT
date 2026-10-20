import {
  labels,
  type BillingUnit,
  type CommissionMode,
  type MembershipStatus,
  type RateUnit,
} from '@empgt/contracts';
import { formatDate, formatMoney, formatNumber } from '@/lib/format';

// Petites aides d'affichage propres à l'espace entreprise (aucune règle métier).

/** Assemble des éléments facultatifs (ville, région, pays…) ; « — » si tout est vide. */
export function joinParts(parts: Array<string | null | undefined>, separator = ', '): string {
  const list = parts.filter((p): p is string => Boolean(p && p.trim()));
  return list.length ? list.join(separator) : '—';
}

export function dateRange(
  start: string | null | undefined,
  end: string | null | undefined,
): string {
  if (start && end) return `Du ${formatDate(start)} au ${formatDate(end)}`;
  if (start) return `À partir du ${formatDate(start)}`;
  if (end) return `Jusqu’au ${formatDate(end)}`;
  return '—';
}

function perUnit(unit: RateUnit | BillingUnit | null | undefined): string {
  return unit ? ` / ${labels.rateUnit[unit]}` : '';
}

/** Tarif unitaire : « 450,00 € / jour ». */
export function rateText(
  value: string | null | undefined,
  currency: string | null | undefined,
  unit: RateUnit | BillingUnit | null | undefined,
): string {
  if (!value) return '—';
  return `${formatMoney(value, currency)}${perUnit(unit)}`;
}

export function budgetText(
  min: string | null,
  max: string | null,
  currency: string | null,
  unit: RateUnit | null,
): string {
  if (!min && !max) return 'Non précisé';
  const range =
    min && max
      ? `${formatMoney(min, currency)} – ${formatMoney(max, currency)}`
      : min
        ? `À partir de ${formatMoney(min, currency)}`
        : `Jusqu’à ${formatMoney(max, currency)}`;
  return `${range}${perUnit(unit)}`;
}

export function commissionValueText(
  mode: CommissionMode | null,
  value: string | null,
  currency: string | null,
): string {
  if (!value) return '—';
  if (mode === 'PERCENTAGE') return `${formatNumber(value, 4)} %`;
  return `${formatMoney(value, currency)} par unité facturée`;
}

export function quantityText(
  quantity: string | null | undefined,
  unit: BillingUnit | RateUnit,
): string {
  if (!quantity) return '—';
  return `${formatNumber(quantity)} ${labels.rateUnit[unit]}(s)`;
}

export function hoursText(hours: string | null | undefined): string {
  return hours ? `${formatNumber(hours)} h` : '—';
}

export function daysText(days: number | null | undefined): string {
  if (days === null || days === undefined) return '—';
  return `${days} jour${days > 1 ? 's' : ''}`;
}

export function yesNo(value: boolean | null | undefined): string {
  if (value === null || value === undefined) return '—';
  return value ? 'Oui' : 'Non';
}

/** Libellés absents de @empgt/contracts (états d'adhésion et d'invitation). */
export const MEMBERSHIP_STATUS: Record<MembershipStatus, string> = {
  ACTIVE: 'Actif',
  REVOKED: 'Retiré',
};

export const INVITATION_STATUS: Record<string, string> = {
  PENDING: 'En attente',
  ACCEPTED: 'Acceptée',
  REVOKED: 'Révoquée',
  EXPIRED: 'Expirée',
};

export const REVIEW_VISIBILITY: Record<string, string> = {
  INTERNAL: 'Interne (E-MPGT uniquement)',
};

export const breadcrumbRoot = { label: 'Tableau de bord', href: '/entreprise' };
