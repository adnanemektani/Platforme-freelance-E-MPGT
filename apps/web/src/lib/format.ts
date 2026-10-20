import { CURRENCIES } from '@empgt/contracts';

// Formatage français. Les montants arrivent de l'API sous forme de chaînes décimales :
// Intl.NumberFormat accepte les chaînes et les formate sans passer par un flottant intermédiaire.

const dateFormat = new Intl.DateTimeFormat('fr-FR', { dateStyle: 'medium', timeZone: 'UTC' });
const dateTimeFormat = new Intl.DateTimeFormat('fr-FR', { dateStyle: 'medium', timeStyle: 'short' });
const monthFormat = new Intl.DateTimeFormat('fr-FR', { month: 'long', year: 'numeric', timeZone: 'UTC' });

export function formatDate(value: string | null | undefined): string {
  if (!value) return '—';
  const date = value.length === 10 ? new Date(`${value}T00:00:00Z`) : new Date(value);
  return Number.isNaN(date.getTime()) ? value : dateFormat.format(date);
}

export function formatDateTime(value: string | null | undefined): string {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : dateTimeFormat.format(date);
}

export function formatMonth(value: string | null | undefined): string {
  if (!value) return '—';
  return monthFormat.format(new Date(`${value.slice(0, 10)}T00:00:00Z`));
}

export function formatMoney(value: string | null | undefined, currency: string | null | undefined): string {
  if (value === null || value === undefined || value === '') return '—';
  const digits = currency ? ((CURRENCIES as Record<string, number>)[currency] ?? 2) : 2;
  try {
    return new Intl.NumberFormat('fr-FR', {
      style: currency ? 'currency' : 'decimal',
      currency: currency ?? undefined,
      minimumFractionDigits: digits,
      maximumFractionDigits: Math.max(digits, 4),
    }).format(value as unknown as number);
  } catch {
    return `${value} ${currency ?? ''}`.trim();
  }
}

export function formatNumber(value: string | null | undefined, maxDigits = 2): string {
  if (value === null || value === undefined || value === '') return '—';
  return new Intl.NumberFormat('fr-FR', { maximumFractionDigits: maxDigits }).format(value as unknown as number);
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} o`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} Ko`;
  return `${(bytes / 1024 / 1024).toFixed(1)} Mo`;
}

export function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

export function firstOfMonthIso(offset = 0): string {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + offset, 1)).toISOString().slice(0, 10);
}
