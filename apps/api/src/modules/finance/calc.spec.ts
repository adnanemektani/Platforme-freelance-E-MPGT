import { describe, expect, it } from 'vitest';
import { commissionVisibleTo, computeFromHours, computeFromQuantity, pricingIssues, quantityFromHours, toBreakdown, type PricingTerms } from './calc.js';
import { dec } from '../../common/money.js';

const base: PricingTerms = {
  currency: 'EUR',
  billingUnit: 'DAY',
  hoursPerDay: '7.5',
  freelanceRate: '600',
  clientRate: '600',
  commissionPayer: 'CLIENT',
  commissionMode: 'PERCENTAGE',
  commissionBase: 'FREELANCE_AMOUNT',
  commissionValue: '12',
};

describe('calcul des montants (règles V1)', () => {
  it("n'accepte pas d'heures de référence implicites pour une facturation journalière", () => {
    expect(pricingIssues({ ...base, hoursPerDay: null })).toContain('Heures de référence par journée (aucune valeur n’est supposée)');
  });

  it('signale toutes les conditions manquantes sans en inventer', () => {
    const issues = pricingIssues({
      currency: null,
      billingUnit: null,
      hoursPerDay: null,
      freelanceRate: null,
      clientRate: null,
      commissionPayer: null,
      commissionMode: null,
      commissionBase: null,
      commissionValue: null,
    });
    expect(issues).toEqual(['Devise', 'Unité de facturation (heure ou jour)', 'Tarif freelance', 'Tarif client', 'Payeur de la commission']);
  });

  it('convertit les heures en jours avec la valeur figée au contrat, sans arrondi intermédiaire', () => {
    const q = quantityFromHours('22.5', { billingUnit: 'DAY', hoursPerDay: dec('7.5') });
    expect(q.toFixed()).toBe('3');
    const q2 = quantityFromHours('10', { billingUnit: 'DAY', hoursPerDay: dec('7') });
    expect(q2.toFixed(10)).toBe('1.4285714286');
  });

  it('calcule la commission payée par le client en sus de la prestation', () => {
    const a = computeFromHours('150', base); // 150 h / 7,5 = 20 jours
    expect(a.quantity.toFixed()).toBe('20');
    expect(a.freelanceGrossAmount.toFixed(2)).toBe('12000.00');
    expect(a.clientServiceAmount.toFixed(2)).toBe('12000.00');
    expect(a.commissionAmount.toFixed(2)).toBe('1440.00');
    expect(a.clientTotalExclTax.toFixed(2)).toBe('13440.00');
    expect(a.freelanceNetExclTax.toFixed(2)).toBe('12000.00');
    expect(a.platformMarginExclTax.toFixed(2)).toBe('1440.00');
    expect(a.unexplainedSpread.toFixed(2)).toBe('0.00');
  });

  it('déduit la commission de la rémunération freelance lorsque le freelance la paie', () => {
    const a = computeFromHours('150', { ...base, commissionPayer: 'FREELANCER', commissionBase: 'CLIENT_AMOUNT', commissionValue: '10' });
    expect(a.clientTotalExclTax.toFixed(2)).toBe('12000.00');
    expect(a.commissionAmount.toFixed(2)).toBe('1200.00');
    expect(a.freelanceNetExclTax.toFixed(2)).toBe('10800.00');
    expect(a.platformMarginExclTax.toFixed(2)).toBe('1200.00');
  });

  it('applique une commission fixe par unité', () => {
    const a = computeFromQuantity('3', { ...base, commissionMode: 'FIXED_PER_UNIT', commissionValue: '45.5', commissionBase: null });
    expect(a.commissionAmount.toFixed(2)).toBe('136.50');
  });

  it('accepte une absence de commission (exception) et signale un écart de tarifs non expliqué', () => {
    const a = computeFromHours('7.5', { ...base, commissionPayer: 'NONE', clientRate: '650' });
    expect(a.commissionAmount.toFixed(2)).toBe('0.00');
    expect(a.platformMarginExclTax.toFixed(2)).toBe('50.00');
    expect(a.unexplainedSpread.toFixed(2)).toBe('50.00');
  });

  it('arrondit au demi supérieur, une fois par ligne, à la précision de la devise', () => {
    // 10 h / 7 h = 1,428571… jour × 333,33 = 476,1857… → 476,19
    const a = computeFromHours('10', { ...base, hoursPerDay: '7', freelanceRate: '333.33', clientRate: '333.33', commissionValue: '7.5' });
    expect(a.freelanceGrossAmount.toFixed(2)).toBe('476.19');
    // 7,5 % de 476,19 = 35,71425 → 35,71
    expect(a.commissionAmount.toFixed(2)).toBe('35.71');
    // demi exact : 0,125 → 0,13
    const b = computeFromQuantity('1', { ...base, billingUnit: 'HOUR', hoursPerDay: null, freelanceRate: '0.125', clientRate: '0.125', commissionPayer: 'NONE' });
    expect(b.freelanceGrossAmount.toFixed(2)).toBe('0.13');
  });

  it('respecte les devises sans décimales (franc CFA)', () => {
    const a = computeFromHours('8', { ...base, currency: 'XOF', billingUnit: 'HOUR', hoursPerDay: null, freelanceRate: '12500.5', clientRate: '12500.5', commissionValue: '10' });
    expect(a.freelanceGrossAmount.toFixed()).toBe('100004');
    expect(a.commissionAmount.toFixed()).toBe('10000');
  });

  it("n'utilise jamais de flottant binaire : 0,1 + 0,2 reste exact", () => {
    const a = computeFromQuantity('3', { ...base, billingUnit: 'HOUR', hoursPerDay: null, freelanceRate: '0.1', clientRate: '0.1', commissionPayer: 'NONE' });
    expect(a.freelanceGrossAmount.toFixed(2)).toBe('0.30');
  });

  it('refuse une commission supérieure à la rémunération', () => {
    expect(() =>
      computeFromQuantity('1', { ...base, commissionPayer: 'FREELANCER', commissionMode: 'FIXED_PER_UNIT', commissionValue: '700', commissionBase: null }),
    ).toThrow(/dépasse/);
  });

  it('filtre les montants selon le destinataire', () => {
    const a = computeFromHours('150', base);
    const visibility = { commissionVisibleToCompany: false, commissionVisibleToFreelancer: false };
    const company = toBreakdown(a, 'company', visibility);
    expect(company.freelanceGrossAmount).toBeNull();
    expect(company.freelanceNetExclTax).toBeNull();
    expect(company.commissionAmount).toBe('1440.00'); // payée par le client : visible du client
    expect(company.platformMarginExclTax).toBeNull();
    const freelancer = toBreakdown(a, 'freelancer', visibility);
    expect(freelancer.clientTotalExclTax).toBeNull();
    expect(freelancer.clientServiceAmount).toBeNull();
    expect(freelancer.commissionAmount).toBeNull();
    expect(freelancer.freelanceNetExclTax).toBe('12000.00');
    expect(toBreakdown(a, 'admin', visibility).platformMarginExclTax).toBe('1440.00');
    expect(commissionVisibleTo('freelancer', 'CLIENT', { commissionVisibleToCompany: false, commissionVisibleToFreelancer: true })).toBe(true);
  });
});
