import type { ReactNode } from 'react';
import { labels, type AmountBreakdown } from '@empgt/contracts';
import { formatMoney } from '@/lib/format';
import { DefinitionList } from '@/components/ui/card';
import { hoursText, quantityText } from './display';

/**
 * Montants calculés par l'API (déjà filtrés selon le rôle) : on affiche uniquement
 * ce qui est renvoyé, sans aucun calcul côté navigateur.
 */
export function AmountsSummary({ amounts }: { amounts: AmountBreakdown }) {
  const money = (value: string | null) => formatMoney(value, amounts.currency);
  const items: Array<[string, ReactNode]> = [
    ['Quantité', quantityText(amounts.quantity, amounts.billingUnit)],
    ['Heures', hoursText(amounts.hours)],
  ];
  if (amounts.clientServiceAmount)
    items.push(['Prestation (hors commission)', money(amounts.clientServiceAmount)]);
  if (amounts.commissionAmount) {
    items.push([
      'Commission E-MPGT',
      `${money(amounts.commissionAmount)} — ${labels.commissionPayer[amounts.commissionPayer]}`,
    ]);
  }
  if (amounts.clientTotalExclTax)
    items.push([
      'Total HT facturé à votre entreprise',
      <strong key="total">{money(amounts.clientTotalExclTax)}</strong>,
    ]);
  return (
    <div className="space-y-3">
      <DefinitionList items={items} />
      <p className="text-xs text-gray-500">
        Montants hors taxes, en {amounts.currency}. La TVA éventuelle figure sur la facture. Règle
        d’arrondi : {amounts.roundingRule}
      </p>
    </div>
  );
}
