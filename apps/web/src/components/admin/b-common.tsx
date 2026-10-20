'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useId, useState, type ReactNode } from 'react';
import {
  labels,
  type ActionState,
  type AmountBreakdown,
  type BillingUnit,
  type CommissionBase,
  type CommissionMode,
  type CommissionPayer,
  type DocumentView,
  type InvoiceAddressee,
  type PendingItem,
  type PlatformSettings,
} from '@empgt/contracts';
import { documentUrl } from '@/lib/api';
import { formatDate, formatMoney, formatNumber } from '@/lib/format';
import { useAction, useApi } from '@/lib/hooks';
import { findAction } from '@/components/ui/actions';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { DefinitionList } from '@/components/ui/card';
import { Dialog } from '@/components/ui/dialog';
import { Alert } from '@/components/ui/feedback';
import { Field, FormError, Input, Select } from '@/components/ui/form';

// Briques de la partie B de l'administration E-MPGT (missions → finance).
// Aucune règle métier ici : affichage des données de l'API et déclenchement de ses actions.

// ── Filtres de liste conservés dans l'URL (retour arrière, liens partageables) ──

/** À utiliser dans un composant enveloppé par <Suspense> (useSearchParams). */
export function useUrlFilters<K extends string>(keys: readonly K[]) {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const values = Object.fromEntries(keys.map((key) => [key, params.get(key) ?? ''])) as Record<K, string>;
  const requested = Number(params.get('page') ?? '1');
  const page = Number.isInteger(requested) && requested > 0 ? requested : 1;

  const update = (next: Partial<Record<K | 'page', string | number | null>>) => {
    const search = new URLSearchParams(params.toString());
    for (const [key, value] of Object.entries(next)) {
      if (value === null || value === undefined || value === '') search.delete(key);
      else search.set(key, String(value));
    }
    if (!('page' in next)) search.delete('page');
    const query = search.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  };

  return { values, page, update };
}

export function BFilterBar({ children }: { children: ReactNode }) {
  return <div className="mb-4 grid items-end gap-3 rounded-lg border border-gray-200 bg-white p-4 sm:grid-cols-2 lg:grid-cols-4">{children}</div>;
}

export function BFilterSelect({
  label,
  value,
  onChange,
  options,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: Array<{ value: string; label: string }>;
  placeholder?: string;
}) {
  return <Field label={label}>{(p) => <Select {...p} value={value} options={options} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />}</Field>;
}

/** Recherche plein texte : à monter avec `key={valeurCourante}` pour suivre l'URL. */
export function BSearch({ value, onSearch, label = 'Recherche', placeholder }: { value: string; onSearch: (value: string) => void; label?: string; placeholder?: string }) {
  const [text, setText] = useState(value);
  return (
    <form
      role="search"
      className="flex items-end gap-2 sm:col-span-2"
      onSubmit={(e) => {
        e.preventDefault();
        onSearch(text.trim());
      }}
    >
      <div className="min-w-0 flex-1">
        <Field label={label}>{(p) => <Input {...p} type="search" value={text} placeholder={placeholder} onChange={(e) => setText(e.target.value)} />}</Field>
      </div>
      <Button type="submit" variant="secondary">
        Rechercher
      </Button>
    </form>
  );
}

// ── Documents ───────────────────────────────────────────────────────────────

export function BDocumentLinks({ id, previewable = true }: { id: string | null | undefined; previewable?: boolean }) {
  if (!id) return <span className="text-gray-500">—</span>;
  return (
    <span className="inline-flex flex-wrap gap-3">
      <a href={documentUrl(id)} className="font-medium text-brand-700 underline">
        Télécharger
      </a>
      {previewable && (
        <a href={documentUrl(id, true)} target="_blank" rel="noopener noreferrer" className="font-medium text-brand-700 underline">
          Aperçu
        </a>
      )}
    </span>
  );
}

export function BExpiryBadge({ doc }: { doc: Pick<DocumentView, 'expiryState' | 'expiresAt'> }) {
  switch (doc.expiryState) {
    case 'expired':
      return <Badge tone="red">Expiré le {formatDate(doc.expiresAt)}</Badge>;
    case 'expiring':
      return <Badge tone="amber">Échéance proche : {formatDate(doc.expiresAt)}</Badge>;
    case 'valid':
      return <Badge tone="green">Valide jusqu’au {formatDate(doc.expiresAt)}</Badge>;
    default:
      return <span className="text-xs text-gray-500">Sans échéance</span>;
  }
}

// ── Montants ────────────────────────────────────────────────────────────────

/** Une chaîne décimale non nulle (lecture du texte, sans calcul). */
export function isNonZeroAmount(value: string | null | undefined): boolean {
  return Boolean(value) && /[1-9]/.test(value as string);
}

export function quantityLabel(unit: BillingUnit): string {
  return unit === 'DAY' ? 'jour(s)' : 'heure(s)';
}

/** Détail d'un calcul de montants renvoyé par l'API (aperçu de proposition ou CRA). */
export function BAmountBreakdown({ amounts, empty }: { amounts: AmountBreakdown | null; empty?: string }) {
  if (!amounts) return <p className="text-sm text-gray-600">{empty ?? 'Montants non calculables : conditions incomplètes.'}</p>;
  const c = amounts.currency;
  const spread = isNonZeroAmount(amounts.unexplainedSpread);
  return (
    <div className="space-y-3">
      <DefinitionList
        columns={3}
        items={[
          ['Quantité de référence', `${formatNumber(amounts.quantity, 4)} ${quantityLabel(amounts.billingUnit)} — ${formatNumber(amounts.hours)} h`],
          ['Prestation client (hors commission)', formatMoney(amounts.clientServiceAmount, c)],
          ['Rémunération brute freelance', formatMoney(amounts.freelanceGrossAmount, c)],
          ['Commission', `${formatMoney(amounts.commissionAmount, c)} — ${labels.commissionPayer[amounts.commissionPayer]}`],
          ['Total HT facturé au client', <strong key="ct">{formatMoney(amounts.clientTotalExclTax, c)}</strong>],
          ['Net HT dû au freelance', <strong key="fn">{formatMoney(amounts.freelanceNetExclTax, c)}</strong>],
          ['Marge E-MPGT (interne)', formatMoney(amounts.platformMarginExclTax, c)],
          [
            'Écart non expliqué (interne)',
            <span key="sp" className={spread ? 'font-semibold text-amber-800' : ''}>
              {formatMoney(amounts.unexplainedSpread, c)}
              {spread && ' — différence de tarifs hors commission'}
            </span>,
          ],
          ['Règle d’arrondi', amounts.roundingRule],
        ]}
      />
      <p className="text-xs text-gray-500">Montants hors taxes calculés par la plateforme ; les taxes figurent uniquement sur les factures déposées.</p>
    </div>
  );
}

// ── Conditions commerciales (proposition ou contrat) ────────────────────────

export interface BTermsLike {
  startDate: string | null;
  endDate: string | null;
  currency: string | null;
  billingUnit: BillingUnit | null;
  hoursPerDay: string | null;
  freelanceRate: string | null;
  clientRate: string | null;
  commissionPayer: CommissionPayer | null;
  commissionMode: CommissionMode | null;
  commissionBase: CommissionBase | null;
  commissionValue: string | null;
  commissionNote: string | null;
  expensesPolicy: string | null;
  taxNote: string | null;
  timesheetValidationRule: string | null;
  clientPaymentTermsDays: number | null;
  freelancerPaymentTermsDays: number | null;
  paymentTermsNote: string | null;
  freelancerInvoiceAddressee: InvoiceAddressee | null;
}

export function rateLabel(rate: string | null, currency: string | null, unit: BillingUnit | null): string {
  if (!rate) return '—';
  return `${formatMoney(rate, currency)}${unit ? ` / ${labels.rateUnit[unit]}` : ''}`;
}

export function commissionValueLabel(value: string | null, mode: CommissionMode | null, currency: string | null, unit: BillingUnit | null): string {
  if (!value) return '—';
  if (mode === 'PERCENTAGE') return `${formatNumber(value, 4)} %`;
  return `${formatMoney(value, currency)}${unit ? ` / ${labels.rateUnit[unit]}` : ' par unité'}`;
}

function days(value: number | null): string {
  return value === null ? '—' : `${value} jour(s)`;
}

export function BTermsList({ terms, extra = [] }: { terms: BTermsLike; extra?: Array<[string, ReactNode]> }) {
  const t = terms;
  return (
    <DefinitionList
      columns={3}
      items={[
        ['Début', formatDate(t.startDate)],
        ['Fin', formatDate(t.endDate)],
        ['Devise', t.currency],
        ['Unité de facturation', t.billingUnit ? labels.billingUnit[t.billingUnit] : null],
        ['Heures de référence par journée', t.billingUnit === 'DAY' ? (t.hoursPerDay ? `${formatNumber(t.hoursPerDay)} h` : 'Non renseignées') : 'Sans objet (facturation horaire)'],
        ['Tarif freelance', rateLabel(t.freelanceRate, t.currency, t.billingUnit)],
        ['Tarif client', rateLabel(t.clientRate, t.currency, t.billingUnit)],
        ...extra,
        ['Payeur de la commission', t.commissionPayer ? labels.commissionPayer[t.commissionPayer] : null],
        ['Mode de commission', t.commissionMode ? labels.commissionMode[t.commissionMode] : null],
        ['Assiette', t.commissionBase ? labels.commissionBase[t.commissionBase] : null],
        ['Valeur de la commission', commissionValueLabel(t.commissionValue, t.commissionMode, t.currency, t.billingUnit)],
        ['Note / justification commission', t.commissionNote],
        ['Frais', t.expensesPolicy],
        ['Taxes', t.taxNote],
        ['Règle de validation des CRA', t.timesheetValidationRule],
        ['Délai de règlement client', days(t.clientPaymentTermsDays)],
        ['Délai de règlement freelance', days(t.freelancerPaymentTermsDays)],
        ['Note sur les règlements', t.paymentTermsNote],
        ['Factures du freelance adressées à', t.freelancerInvoiceAddressee ? labels.invoiceAddressee[t.freelancerInvoiceAddressee] : null],
      ]}
    />
  );
}

/** Rappel de la politique de commission (décision D-05) : aucune valeur n'est proposée par défaut. */
export function BCommissionPolicyNotice() {
  const settings = useApi<PlatformSettings>('/admin/settings');
  const policy = settings.data?.commissionPolicy;
  if (policy) {
    return (
      <Alert tone="info" title="Politique de commission de référence">
        <p className="whitespace-pre-line">{policy}</p>
        <p className="mt-1 text-xs">Aucune valeur n’est pré-remplie : saisissez explicitement chaque condition.</p>
      </Alert>
    );
  }
  return (
    <Alert tone="warning" title="Politique de commission non décidée (D-05)">
      Aucune condition commerciale n’est pré-remplie ni supposée : tarifs, commission (payeur, mode, assiette, valeur), heures de référence, délais et frais
      doivent être saisis explicitement pour chaque proposition.
    </Alert>
  );
}

// ── Action serveur déclenchée par un formulaire en boîte de dialogue ────────

type Variant = 'primary' | 'secondary' | 'danger' | 'success' | 'ghost';

/**
 * Bouton relié à une action calculée par le serveur (`actions`), qui ouvre un formulaire.
 * Absent si l'action n'existe pas ; désactivé avec le motif si elle n'est pas possible.
 */
export function BActionDialog<T>({
  actions,
  action,
  label,
  title,
  description,
  variant = 'primary',
  size = 'md',
  submitLabel,
  success,
  onSubmit,
  onDone,
  children,
}: {
  actions: ActionState[] | undefined;
  action: string;
  label: string;
  title?: string;
  description?: ReactNode;
  variant?: Variant;
  size?: 'sm' | 'md';
  submitLabel?: string;
  success?: string;
  onSubmit: (form: FormData) => Promise<T>;
  onDone?: (result: T) => void;
  children?: ReactNode;
}) {
  const state = findAction(actions, action);
  const [open, setOpen] = useState(false);
  const [formKey, setFormKey] = useState(0);
  const { run, pending, error, clearError } = useAction();
  const formId = useId();
  const reasonId = useId();
  if (!state) return null;

  const close = () => {
    setOpen(false);
    clearError();
  };
  const submitVariant: Variant = variant === 'ghost' || variant === 'secondary' ? 'primary' : variant;

  return (
    <div className="inline-flex flex-col">
      <Button
        variant={variant}
        size={size}
        disabled={!state.allowed}
        aria-describedby={!state.allowed ? reasonId : undefined}
        onClick={() => setOpen(true)}
      >
        {label}
      </Button>
      {!state.allowed && state.reason && (
        <span id={reasonId} className="mt-1 max-w-xs text-xs text-gray-600">
          {state.reason}
        </span>
      )}
      <Dialog
        open={open}
        onClose={close}
        title={title ?? label}
        footer={
          <>
            <Button variant="secondary" onClick={close} disabled={pending}>
              Annuler
            </Button>
            <Button type="submit" form={formId} variant={submitVariant} loading={pending}>
              {submitLabel ?? label}
            </Button>
          </>
        }
      >
        {description && <div className="text-sm text-gray-700">{description}</div>}
        <form
          key={formKey}
          id={formId}
          className="space-y-4"
          onSubmit={async (e) => {
            e.preventDefault();
            const data = new FormData(e.currentTarget);
            const result = await run(() => onSubmit(data), { success });
            if (result !== undefined) {
              setOpen(false);
              setFormKey((k) => k + 1);
              onDone?.(result);
            }
          }}
        >
          {children}
          <FormError error={error} />
        </form>
      </Dialog>
    </div>
  );
}

/**
 * Éléments « en attente » pour l'espace E-MPGT : certains liens calculés par l'API pointent vers
 * l'espace d'une partie (inaccessible ici) ; ils sont retirés, le contenu reste affiché.
 */
export function adminPending(items: PendingItem[] | undefined): PendingItem[] {
  return (items ?? []).map((item) => (item.link && !item.link.startsWith('/admin') ? { ...item, link: undefined } : item));
}

/** Lecture d'une case à cocher d'un formulaire natif. */
export function formChecked(form: FormData, name: string): boolean {
  return form.get(name) === 'on';
}

export function BText({ value, empty = '—' }: { value: string | null | undefined; empty?: string }) {
  if (!value) return <span className="text-gray-500">{empty}</span>;
  return <p className="whitespace-pre-line text-sm text-gray-800">{value}</p>;
}
