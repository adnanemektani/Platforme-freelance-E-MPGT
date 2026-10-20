import type { Contract, ContractAmendment, CommercialProposal } from '../../generated/prisma/client.js';
import { dec, decimalString } from '../../common/money.js';
import { pricingIssues, type Audience, type PricingTerms, commissionVisibleTo } from '../finance/calc.js';

/** Conditions requises pour envoyer puis valider une proposition (aucune valeur supposée). */
export function proposalMissingTerms(p: CommercialProposal): string[] {
  const missing = pricingIssues(p);
  if (!p.startDate) missing.unshift('Date de début');
  if (p.startDate && p.endDate && p.endDate < p.startDate) missing.push('Date de fin postérieure au début');
  if (p.commissionPayer === 'NONE' && !p.commissionNote) missing.push('Justification de l’absence de commission (exception)');
  if (!p.freelancerInvoiceAddressee) missing.push('Destinataire des factures du freelance');
  if (p.clientPaymentTermsDays === null) missing.push('Délai de règlement client (jours)');
  if (p.freelancerPaymentTermsDays === null) missing.push('Délai de règlement freelance (jours)');
  if (!p.timesheetValidationRule) missing.push('Règle de validation des CRA');
  if (!p.expensesPolicy) missing.push('Politique de frais');
  return missing;
}

export function pricingOf(source: CommercialProposal | Contract): PricingTerms {
  return {
    currency: source.currency,
    billingUnit: source.billingUnit,
    hoursPerDay: source.hoursPerDay,
    freelanceRate: source.freelanceRate,
    clientRate: source.clientRate,
    commissionPayer: source.commissionPayer,
    commissionMode: source.commissionMode,
    commissionBase: source.commissionBase,
    commissionValue: source.commissionValue,
  };
}

/**
 * Conditions applicables à une date : conditions figées du contrat, puis avenants signés
 * de type « modification des conditions » dont la date d'effet est antérieure ou égale.
 */
export function effectiveTermsAt(contract: Contract, amendments: ContractAmendment[], date: Date): PricingTerms & { key: string } {
  const terms: PricingTerms = pricingOf(contract);
  let key = 'contrat';
  for (const a of [...amendments].sort((x, y) => x.number - y.number)) {
    if (a.status !== 'SIGNED' || a.type !== 'TERMS_CHANGE' || a.effectiveDate > date) continue;
    if (a.newFreelanceRate) terms.freelanceRate = a.newFreelanceRate;
    if (a.newClientRate) terms.clientRate = a.newClientRate;
    if (a.newHoursPerDay) terms.hoursPerDay = a.newHoursPerDay;
    if (a.newCommissionValue) terms.commissionValue = a.newCommissionValue;
    key = `avenant-${a.number}`;
  }
  return { ...terms, key };
}

/** Date de fin effective : dernière prolongation signée, sinon fin initiale. */
export function effectiveEndDate(contract: Contract, amendments: ContractAmendment[]): Date | null {
  let end = contract.endDate;
  for (const a of [...amendments].sort((x, y) => x.number - y.number)) {
    if (a.status === 'SIGNED' && a.type === 'EXTENSION' && a.newEndDate) end = a.newEndDate;
  }
  return end;
}

/** Filtrage des conditions financières selon le destinataire. */
export function visibleTerms(source: CommercialProposal | Contract, audience: Audience) {
  const showCommission = commissionVisibleTo(audience, source.commissionPayer, source);
  return {
    freelanceRate: audience === 'company' ? null : decimalString(source.freelanceRate),
    clientRate: audience === 'freelancer' ? null : decimalString(source.clientRate),
    commissionPayer: showCommission ? source.commissionPayer : null,
    commissionMode: showCommission ? source.commissionMode : null,
    commissionBase: showCommission ? source.commissionBase : null,
    commissionValue: showCommission ? decimalString(source.commissionValue) : null,
    commissionNote: audience === 'admin' ? source.commissionNote : null,
  };
}

export function hasValue(value: unknown): boolean {
  return value !== null && value !== undefined && !(typeof value === 'string' && value === '');
}

export function positive(value: string | null | undefined): boolean {
  return Boolean(value) && dec(value!).gt(0);
}
