import {
  labels,
  type AmountBreakdown,
  type BillingUnit,
  type CommissionBase,
  type CommissionMode,
  type CommissionPayer,
  type InvoiceAddressee,
} from '@empgt/contracts';
import { formatMoney, formatNumber } from '@/lib/format';
import { DefinitionList } from '@/components/ui/card';
import { perUnit } from './helpers';

/** Conditions commerciales telles que renvoyées au freelance (proposition ou contrat). */
export interface FreelancerTerms {
  currency: string | null;
  billingUnit: BillingUnit | null;
  hoursPerDay: string | null;
  freelanceRate: string | null;
  estimatedQuantity?: string | null;
  commissionPayer: CommissionPayer | null;
  commissionMode: CommissionMode | null;
  commissionBase: CommissionBase | null;
  commissionValue: string | null;
  expensesPolicy: string | null;
  taxNote: string | null;
  timesheetValidationRule: string | null;
  freelancerPaymentTermsDays: number | null;
  paymentTermsNote: string | null;
  freelancerInvoiceAddressee: InvoiceAddressee | null;
}

function commissionValue(t: FreelancerTerms): string | null {
  if (!t.commissionValue) return null;
  if (t.commissionMode === 'PERCENTAGE') return `${formatNumber(t.commissionValue, 4)} %`;
  return `${formatMoney(t.commissionValue, t.currency)} ${perUnit(t.billingUnit)}`.trim();
}

function text(value: string | null) {
  return value ? <span className="whitespace-pre-line">{value}</span> : null;
}

/** Conditions visibles par le freelance : tarif, unité, journée de référence, commission (si visible), frais, délais. */
export function TermsList({ terms }: { terms: FreelancerTerms }) {
  const items: Array<[string, React.ReactNode]> = [
    ['Tarif freelance', terms.freelanceRate ? `${formatMoney(terms.freelanceRate, terms.currency)} ${perUnit(terms.billingUnit)}` : 'Non communiqué'],
    ['Unité de facturation', terms.billingUnit ? labels.billingUnit[terms.billingUnit] : null],
    ['Devise', terms.currency],
    ['Heures par jour de référence', terms.hoursPerDay ? `${formatNumber(terms.hoursPerDay)} h` : null],
  ];
  if (terms.estimatedQuantity !== undefined) {
    items.push([
      'Quantité estimée',
      terms.estimatedQuantity ? `${formatNumber(terms.estimatedQuantity)} ${terms.billingUnit === 'HOUR' ? 'heure(s)' : 'jour(s)'}` : null,
    ]);
  }
  if (terms.commissionPayer) {
    items.push(['Commission E-MPGT', labels.commissionPayer[terms.commissionPayer]]);
    if (terms.commissionMode) items.push(['Mode de commission', labels.commissionMode[terms.commissionMode]]);
    if (terms.commissionBase) items.push(['Base de calcul', labels.commissionBase[terms.commissionBase]]);
    if (terms.commissionValue) items.push(['Valeur de la commission', commissionValue(terms)]);
  }
  items.push(
    ['Délai de règlement freelance', terms.freelancerPaymentTermsDays !== null ? `${terms.freelancerPaymentTermsDays} jour(s)` : null],
    ['Destinataire de vos factures', terms.freelancerInvoiceAddressee ? labels.invoiceAddressee[terms.freelancerInvoiceAddressee] : null],
    ['Précisions sur les règlements', text(terms.paymentTermsNote)],
    ['Politique de frais', text(terms.expensesPolicy)],
    ['Note fiscale', text(terms.taxNote)],
    ['Validation des CRA', text(terms.timesheetValidationRule)],
  );
  return <DefinitionList items={items} />;
}

/** Montants calculés par le serveur, filtrés pour le freelance (aucun calcul côté navigateur). */
export function AmountsView({ amounts, note }: { amounts: AmountBreakdown; note?: string }) {
  const unit = amounts.billingUnit === 'HOUR' ? 'heure(s)' : 'jour(s)';
  const items: Array<[string, React.ReactNode]> = [
    ['Heures', `${formatNumber(amounts.hours)} h`],
    ['Quantité facturable', `${formatNumber(amounts.quantity, 4)} ${unit}`],
  ];
  if (amounts.freelanceGrossAmount !== null) items.push(['Rémunération brute freelance (HT)', formatMoney(amounts.freelanceGrossAmount, amounts.currency)]);
  if (amounts.commissionAmount !== null) {
    items.push([`Commission (${labels.commissionPayer[amounts.commissionPayer].toLowerCase()})`, formatMoney(amounts.commissionAmount, amounts.currency)]);
  }
  if (amounts.freelanceNetExclTax !== null) {
    items.push(['Montant net freelance (HT)', <strong key="net">{formatMoney(amounts.freelanceNetExclTax, amounts.currency)}</strong>]);
  }
  return (
    <div className="space-y-3">
      <DefinitionList items={items} />
      <p className="text-xs text-gray-600">
        {note ? `${note} ` : ''}Règle d’arrondi : {amounts.roundingRule}. Montants hors taxes : la plateforme ne calcule pas les taxes.
      </p>
    </div>
  );
}
