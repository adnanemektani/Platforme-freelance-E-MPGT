import { Decimal } from 'decimal.js';
import { CURRENCIES } from '@empgt/contracts';

// Arithmétique décimale exacte (decimal.js) : aucun montant ne transite par un flottant binaire.
// Règle d'arrondi V1 (documentée dans docs/finance.md) : arrondi commercial « demi vers le haut »
// (ROUND_HALF_UP), appliqué une seule fois par ligne calculée, à la précision de la devise
// (2 décimales pour EUR/MAD/USD, 0 pour XOF/XAF).

export const ROUNDING_RULE =
  'Arrondi commercial au demi supérieur (ROUND_HALF_UP), une fois par ligne, à la précision de la devise';

export type DecimalLike = Decimal | string | number | { toString(): string };

export function dec(value: DecimalLike): Decimal {
  return value instanceof Decimal ? value : new Decimal(value.toString());
}

export function currencyScale(currency: string): number {
  return (CURRENCIES as Record<string, number>)[currency] ?? 2;
}

export function roundMoney(value: DecimalLike, currency: string): Decimal {
  return dec(value).toDecimalPlaces(currencyScale(currency), Decimal.ROUND_HALF_UP);
}

/** Montant formaté à la précision de la devise (« 1250.50 », « 150000 »). */
export function moneyString(value: DecimalLike, currency: string): string {
  return roundMoney(value, currency).toFixed(currencyScale(currency));
}

export function optionalMoneyString(value: DecimalLike | null | undefined, currency: string): string | null {
  return value === null || value === undefined ? null : moneyString(value, currency);
}

/** Décimal non monétaire (tarif, heures) : au moins 2 décimales, sans zéros superflus au-delà. */
export function decimalString(value: DecimalLike): string;
export function decimalString(value: DecimalLike | null | undefined): string | null;
export function decimalString(value: DecimalLike | null | undefined): string | null {
  if (value === null || value === undefined) return null;
  const d = dec(value);
  return d.decimalPlaces() <= 2 ? d.toFixed(2) : d.toFixed();
}

export function sumDecimals(values: DecimalLike[]): Decimal {
  return values.reduce<Decimal>((total, value) => total.plus(dec(value)), new Decimal(0));
}

export { Decimal };
