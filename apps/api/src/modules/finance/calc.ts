import type { AmountBreakdown, BillingUnit, CommissionBase, CommissionMode, CommissionPayer } from '@empgt/contracts';
import { Decimal, dec, moneyString, roundMoney, ROUNDING_RULE, type DecimalLike } from '../../common/money.js';

// Moteur de calcul V1. Il n'invente aucune règle commerciale : il applique
// exactement les conditions saisies et figées dans la proposition / le contrat.
//
// Définitions (documentées dans docs/finance.md) :
//   quantité Q        = heures (unité HOUR) ou heures ÷ heures de référence par jour (unité DAY, valeur figée au contrat)
//   prestation client = arrondi(Q × tarif client)
//   brut freelance    = arrondi(Q × tarif freelance)
//   commission        = arrondi(assiette × taux ÷ 100)   si PERCENTAGE (assiette = ligne arrondie choisie)
//                     = arrondi(Q × montant unitaire)   si FIXED_PER_UNIT
//                     = 0                               si aucune commission (exception motivée)
//   total client HT   = prestation client + commission si payée par le client
//   net freelance HT  = brut freelance − commission si payée par le freelance
//   marge E-MPGT      = total client HT − net freelance HT (interne)
//   écart non expliqué = marge − commission (interne : différence de tarifs hors commission)
// Les taxes ne sont jamais calculées : elles figurent sur les factures déposées.

export interface PricingTerms {
  currency: string | null;
  billingUnit: BillingUnit | null;
  hoursPerDay: DecimalLike | null;
  freelanceRate: DecimalLike | null;
  clientRate: DecimalLike | null;
  commissionPayer: CommissionPayer | null;
  commissionMode: CommissionMode | null;
  commissionBase: CommissionBase | null;
  commissionValue: DecimalLike | null;
}

export interface CompleteTerms {
  currency: string;
  billingUnit: BillingUnit;
  hoursPerDay: Decimal | null;
  freelanceRate: Decimal;
  clientRate: Decimal;
  commissionPayer: CommissionPayer;
  commissionMode: CommissionMode | null;
  commissionBase: CommissionBase | null;
  commissionValue: Decimal | null;
}

export class PricingError extends Error {}

/** Éléments de tarification manquants ou incohérents (liste vide = conditions exploitables). */
export function pricingIssues(terms: PricingTerms): string[] {
  const issues: string[] = [];
  if (!terms.currency) issues.push('Devise');
  if (!terms.billingUnit) issues.push('Unité de facturation (heure ou jour)');
  if (terms.billingUnit === 'DAY') {
    if (!terms.hoursPerDay) issues.push('Heures de référence par journée (aucune valeur n’est supposée)');
    else if (dec(terms.hoursPerDay).lte(0) || dec(terms.hoursPerDay).gt(24)) issues.push('Heures par journée entre 0 et 24');
  }
  if (!terms.freelanceRate) issues.push('Tarif freelance');
  else if (dec(terms.freelanceRate).lte(0)) issues.push('Tarif freelance strictement positif');
  if (!terms.clientRate) issues.push('Tarif client');
  else if (dec(terms.clientRate).lte(0)) issues.push('Tarif client strictement positif');
  if (!terms.commissionPayer) issues.push('Payeur de la commission');
  if (terms.commissionPayer && terms.commissionPayer !== 'NONE') {
    if (!terms.commissionMode) issues.push('Mode de commission (pourcentage ou montant par unité)');
    if (terms.commissionValue === null || terms.commissionValue === undefined) issues.push('Valeur de la commission');
    if (terms.commissionMode === 'PERCENTAGE') {
      if (!terms.commissionBase) issues.push('Assiette de la commission');
      if (terms.commissionValue !== null && dec(terms.commissionValue).gt(100)) issues.push('Pourcentage de commission ≤ 100');
    }
  }
  return issues;
}

export function completeTerms(terms: PricingTerms): CompleteTerms {
  const issues = pricingIssues(terms);
  if (issues.length) throw new PricingError(`Conditions incomplètes : ${issues.join(', ')}`);
  return {
    currency: terms.currency!,
    billingUnit: terms.billingUnit!,
    hoursPerDay: terms.hoursPerDay ? dec(terms.hoursPerDay) : null,
    freelanceRate: dec(terms.freelanceRate!),
    clientRate: dec(terms.clientRate!),
    commissionPayer: terms.commissionPayer!,
    commissionMode: terms.commissionPayer === 'NONE' ? null : terms.commissionMode,
    commissionBase: terms.commissionPayer === 'NONE' ? null : terms.commissionBase,
    commissionValue: terms.commissionPayer === 'NONE' ? null : dec(terms.commissionValue!),
  };
}

/** Quantité exacte (non arrondie) correspondant à un nombre d'heures. */
export function quantityFromHours(hours: DecimalLike, terms: Pick<CompleteTerms, 'billingUnit' | 'hoursPerDay'>): Decimal {
  const h = dec(hours);
  if (terms.billingUnit === 'HOUR') return h;
  if (!terms.hoursPerDay || terms.hoursPerDay.lte(0)) throw new PricingError('Heures de référence par journée non définies');
  return h.div(terms.hoursPerDay);
}

export interface Amounts {
  currency: string;
  billingUnit: BillingUnit;
  hours: Decimal;
  quantity: Decimal;
  clientServiceAmount: Decimal;
  freelanceGrossAmount: Decimal;
  commissionAmount: Decimal;
  commissionPayer: CommissionPayer;
  clientTotalExclTax: Decimal;
  freelanceNetExclTax: Decimal;
  platformMarginExclTax: Decimal;
  unexplainedSpread: Decimal;
}

export function computeFromQuantity(quantity: DecimalLike, termsInput: PricingTerms | CompleteTerms, hours?: DecimalLike): Amounts {
  const terms = 'freelanceRate' in termsInput && termsInput.freelanceRate instanceof Decimal ? (termsInput as CompleteTerms) : completeTerms(termsInput as PricingTerms);
  const q = dec(quantity);
  if (q.lt(0)) throw new PricingError('Quantité négative');
  const clientService = roundMoney(q.mul(terms.clientRate), terms.currency);
  const freelanceGross = roundMoney(q.mul(terms.freelanceRate), terms.currency);
  let commission = new Decimal(0);
  if (terms.commissionPayer !== 'NONE' && terms.commissionValue) {
    if (terms.commissionMode === 'PERCENTAGE') {
      const base = terms.commissionBase === 'CLIENT_AMOUNT' ? clientService : freelanceGross;
      commission = roundMoney(base.mul(terms.commissionValue).div(100), terms.currency);
    } else {
      commission = roundMoney(q.mul(terms.commissionValue), terms.currency);
    }
  }
  const clientTotal = terms.commissionPayer === 'CLIENT' ? clientService.plus(commission) : clientService;
  const freelanceNet = terms.commissionPayer === 'FREELANCER' ? freelanceGross.minus(commission) : freelanceGross;
  if (freelanceNet.lt(0)) throw new PricingError('La commission dépasse la rémunération du freelance');
  const margin = clientTotal.minus(freelanceNet);
  return {
    currency: terms.currency,
    billingUnit: terms.billingUnit,
    hours: hours !== undefined ? dec(hours) : terms.billingUnit === 'HOUR' ? q : q.mul(terms.hoursPerDay ?? 0),
    quantity: q,
    clientServiceAmount: clientService,
    freelanceGrossAmount: freelanceGross,
    commissionAmount: commission,
    commissionPayer: terms.commissionPayer,
    clientTotalExclTax: clientTotal,
    freelanceNetExclTax: freelanceNet,
    platformMarginExclTax: margin,
    unexplainedSpread: margin.minus(commission),
  };
}

export function computeFromHours(hours: DecimalLike, termsInput: PricingTerms): Amounts {
  const terms = completeTerms(termsInput);
  return computeFromQuantity(quantityFromHours(hours, terms), terms, hours);
}

export type Audience = 'admin' | 'company' | 'freelancer';

export interface CommissionVisibility {
  commissionVisibleToCompany: boolean;
  commissionVisibleToFreelancer: boolean;
}

/** La commission est visible du payeur, et de l'autre partie seulement si E-MPGT l'a décidé. */
export function commissionVisibleTo(audience: Audience, payer: CommissionPayer | null, visibility: CommissionVisibility): boolean {
  if (audience === 'admin') return true;
  if (audience === 'company') return payer === 'CLIENT' || visibility.commissionVisibleToCompany;
  return payer === 'FREELANCER' || visibility.commissionVisibleToFreelancer;
}

/** Sérialise un calcul en ne gardant que les montants visibles par le destinataire. */
export function toBreakdown(amounts: Amounts, audience: Audience, visibility: CommissionVisibility): AmountBreakdown {
  const m = (value: Decimal) => moneyString(value, amounts.currency);
  const showCommission = commissionVisibleTo(audience, amounts.commissionPayer, visibility);
  const company = audience === 'admin' || audience === 'company';
  const freelancer = audience === 'admin' || audience === 'freelancer';
  return {
    currency: amounts.currency,
    billingUnit: amounts.billingUnit,
    hours: amounts.hours.toFixed(2),
    quantity: amounts.quantity.toDecimalPlaces(4, Decimal.ROUND_HALF_UP).toFixed(),
    clientServiceAmount: company ? m(amounts.clientServiceAmount) : null,
    freelanceGrossAmount: freelancer ? m(amounts.freelanceGrossAmount) : null,
    commissionAmount: showCommission ? m(amounts.commissionAmount) : null,
    commissionPayer: amounts.commissionPayer,
    clientTotalExclTax: company ? m(amounts.clientTotalExclTax) : null,
    freelanceNetExclTax: freelancer ? m(amounts.freelanceNetExclTax) : null,
    platformMarginExclTax: audience === 'admin' ? m(amounts.platformMarginExclTax) : null,
    unexplainedSpread: audience === 'admin' ? m(amounts.unexplainedSpread) : null,
    roundingRule: ROUNDING_RULE,
  };
}

/** Instantané figé à l'approbation d'un CRA (stocké en JSON, montants en chaînes). */
export function amountsSnapshot(amounts: Amounts) {
  const m = (value: Decimal) => moneyString(value, amounts.currency);
  return {
    currency: amounts.currency,
    billingUnit: amounts.billingUnit,
    hours: amounts.hours.toFixed(2),
    quantity: amounts.quantity.toFixed(),
    clientServiceAmount: m(amounts.clientServiceAmount),
    freelanceGrossAmount: m(amounts.freelanceGrossAmount),
    commissionAmount: m(amounts.commissionAmount),
    commissionPayer: amounts.commissionPayer,
    clientTotalExclTax: m(amounts.clientTotalExclTax),
    freelanceNetExclTax: m(amounts.freelanceNetExclTax),
    platformMarginExclTax: m(amounts.platformMarginExclTax),
    unexplainedSpread: m(amounts.unexplainedSpread),
    roundingRule: ROUNDING_RULE,
  };
}

export type AmountsSnapshot = ReturnType<typeof amountsSnapshot>;

export function snapshotToAmounts(s: AmountsSnapshot): Amounts {
  return {
    currency: s.currency,
    billingUnit: s.billingUnit,
    hours: dec(s.hours),
    quantity: dec(s.quantity),
    clientServiceAmount: dec(s.clientServiceAmount),
    freelanceGrossAmount: dec(s.freelanceGrossAmount),
    commissionAmount: dec(s.commissionAmount),
    commissionPayer: s.commissionPayer,
    clientTotalExclTax: dec(s.clientTotalExclTax),
    freelanceNetExclTax: dec(s.freelanceNetExclTax),
    platformMarginExclTax: dec(s.platformMarginExclTax),
    unexplainedSpread: dec(s.unexplainedSpread),
  };
}
