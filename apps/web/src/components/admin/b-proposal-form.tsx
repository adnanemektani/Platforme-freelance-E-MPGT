'use client';

import { useState, type ReactNode } from 'react';
import {
  BillingUnit,
  CommissionBase,
  CommissionMode,
  CommissionPayer,
  CurrencyCode,
  InvoiceAddressee,
  labels,
  type ProposalView,
} from '@empgt/contracts';
import type { ApiError } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Checkbox, Field, FormError, formValue, Input, optionsFrom, Select, Textarea } from '@/components/ui/form';
import { formChecked } from './b-common';

/** Conditions envoyées à l'API (proposalTermsSchema) : chaîne vide → null, aucune valeur supposée. */
export type BProposalTermsBody = Record<string, string | boolean | null>;

type Initial = Partial<Pick<ProposalView,
  | 'startDate' | 'endDate' | 'currency' | 'billingUnit' | 'hoursPerDay' | 'freelanceRate' | 'clientRate' | 'estimatedQuantity'
  | 'commissionPayer' | 'commissionMode' | 'commissionBase' | 'commissionValue' | 'commissionNote'
  | 'commissionVisibleToCompany' | 'commissionVisibleToFreelancer' | 'expensesPolicy' | 'taxNote' | 'timesheetValidationRule'
  | 'clientPaymentTermsDays' | 'freelancerPaymentTermsDays' | 'paymentTermsNote' | 'freelancerInvoiceAddressee' | 'internalNotes'>>;

const currencyOptions = CurrencyCode.map((c) => ({ value: c, label: c }));

function termsFromForm(form: FormData): BProposalTermsBody {
  const v = (name: string) => formValue(form, name);
  return {
    startDate: v('startDate'),
    endDate: v('endDate'),
    currency: v('currency'),
    billingUnit: v('billingUnit'),
    hoursPerDay: v('hoursPerDay'),
    freelanceRate: v('freelanceRate'),
    clientRate: v('clientRate'),
    estimatedQuantity: v('estimatedQuantity'),
    commissionPayer: v('commissionPayer'),
    commissionMode: v('commissionMode'),
    commissionBase: v('commissionBase'),
    commissionValue: v('commissionValue'),
    commissionNote: v('commissionNote'),
    commissionVisibleToCompany: formChecked(form, 'commissionVisibleToCompany'),
    commissionVisibleToFreelancer: formChecked(form, 'commissionVisibleToFreelancer'),
    expensesPolicy: v('expensesPolicy'),
    taxNote: v('taxNote'),
    timesheetValidationRule: v('timesheetValidationRule'),
    clientPaymentTermsDays: v('clientPaymentTermsDays'),
    freelancerPaymentTermsDays: v('freelancerPaymentTermsDays'),
    paymentTermsNote: v('paymentTermsNote'),
    freelancerInvoiceAddressee: v('freelancerInvoiceAddressee'),
    internalNotes: v('internalNotes'),
  };
}

function Section({ title, description, children }: { title: string; description?: string; children: ReactNode }) {
  return (
    <fieldset className="space-y-4 rounded-md border border-gray-200 p-4">
      <legend className="px-1 text-sm font-semibold text-gray-900">{title}</legend>
      {description && <p className="-mt-2 text-xs text-gray-600">{description}</p>}
      {children}
    </fieldset>
  );
}

/**
 * Formulaire complet des conditions d'une proposition commerciale. Aucun champ commercial
 * n'est pré-rempli (politique de commission non décidée, D-05) ; la complétude est contrôlée
 * par l'API (`missingTerms`) à l'envoi et à la validation.
 */
export function BProposalTermsForm({
  initial = {},
  submitLabel,
  pending,
  error,
  onSubmit,
  onCancel,
}: {
  initial?: Initial;
  submitLabel: string;
  pending: boolean;
  error?: ApiError;
  onSubmit: (body: BProposalTermsBody) => void | Promise<void>;
  onCancel?: () => void;
}) {
  const [billingUnit, setBillingUnit] = useState<string>(initial.billingUnit ?? '');
  const [payer, setPayer] = useState<string>(initial.commissionPayer ?? '');
  const [mode, setMode] = useState<string>(initial.commissionMode ?? '');
  const noCommission = payer === 'NONE';
  const perDay = billingUnit === 'DAY';

  return (
    <form
      className="space-y-5"
      onSubmit={async (e) => {
        e.preventDefault();
        await onSubmit(termsFromForm(new FormData(e.currentTarget)));
      }}
    >
      <Section title="Période et unité">
        <div className="grid gap-4 md:grid-cols-3">
          <Field label="Date de début" hint="Obligatoire pour l’envoi">{(p) => <Input {...p} type="date" name="startDate" defaultValue={initial.startDate ?? ''} />}</Field>
          <Field label="Date de fin">{(p) => <Input {...p} type="date" name="endDate" defaultValue={initial.endDate ?? ''} />}</Field>
          <Field label="Devise">{(p) => <Select {...p} name="currency" defaultValue={initial.currency ?? ''} placeholder="— Choisir —" options={currencyOptions} />}</Field>
          <Field label="Unité de facturation">
            {(p) => (
              <Select {...p} name="billingUnit" value={billingUnit} onChange={(e) => setBillingUnit(e.target.value)} placeholder="— Choisir —" options={optionsFrom(BillingUnit, labels.billingUnit)} />
            )}
          </Field>
          <Field
            label="Heures de référence par journée"
            required={perDay}
            hint={perDay ? 'Obligatoire en facturation journalière : aucune valeur n’est supposée (conversion des heures du CRA en jours).' : 'Uniquement pour une facturation à la journée.'}
          >
            {(p) => <Input {...p} name="hoursPerDay" inputMode="decimal" disabled={!perDay} defaultValue={initial.hoursPerDay ?? ''} placeholder="À fixer au contrat" />}
          </Field>
          <Field label="Quantité estimée" hint="En heures ou en jours selon l’unité ; sert à l’aperçu des montants.">
            {(p) => <Input {...p} name="estimatedQuantity" inputMode="decimal" defaultValue={initial.estimatedQuantity ?? ''} />}
          </Field>
        </div>
      </Section>

      <Section title="Tarifs" description="Le tarif freelance est masqué à l’entreprise ; le tarif client est masqué au freelance.">
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Tarif freelance (par unité)">{(p) => <Input {...p} name="freelanceRate" inputMode="decimal" defaultValue={initial.freelanceRate ?? ''} />}</Field>
          <Field label="Tarif client (par unité)">{(p) => <Input {...p} name="clientRate" inputMode="decimal" defaultValue={initial.clientRate ?? ''} />}</Field>
        </div>
      </Section>

      <Section title="Commission E-MPGT" description="Par défaut, la commission n’est visible que de son payeur ; cochez pour la montrer à l’autre partie.">
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Payeur">
            {(p) => <Select {...p} name="commissionPayer" value={payer} onChange={(e) => setPayer(e.target.value)} placeholder="— Choisir —" options={optionsFrom(CommissionPayer, labels.commissionPayer)} />}
          </Field>
          <Field label="Mode" hint={noCommission ? 'Sans objet : aucune commission.' : undefined}>
            {(p) => (
              <Select {...p} name="commissionMode" value={noCommission ? '' : mode} disabled={noCommission} onChange={(e) => setMode(e.target.value)} placeholder="— Choisir —" options={optionsFrom(CommissionMode, labels.commissionMode)} />
            )}
          </Field>
          <Field label="Assiette" hint="Pour une commission en pourcentage.">
            {(p) => (
              <Select {...p} name="commissionBase" defaultValue={initial.commissionBase ?? ''} disabled={noCommission || mode === 'FIXED_PER_UNIT'} placeholder="— Choisir —" options={optionsFrom(CommissionBase, labels.commissionBase)} />
            )}
          </Field>
          <Field label="Valeur" hint={mode === 'PERCENTAGE' ? 'Pourcentage (ex. 10 pour 10 %).' : mode === 'FIXED_PER_UNIT' ? 'Montant par unité facturée, dans la devise.' : 'Pourcentage ou montant par unité selon le mode.'}>
            {(p) => <Input {...p} name="commissionValue" inputMode="decimal" disabled={noCommission} defaultValue={initial.commissionValue ?? ''} />}
          </Field>
          <div className="md:col-span-2">
            <Field
              label={noCommission ? 'Justification de l’absence de commission' : 'Note sur la commission'}
              required={noCommission}
              hint={noCommission ? 'Obligatoire : une absence de commission est une exception motivée.' : 'Interne à E-MPGT.'}
            >
              {(p) => <Textarea {...p} name="commissionNote" rows={2} maxLength={2000} defaultValue={initial.commissionNote ?? ''} />}
            </Field>
          </div>
        </div>
        <div className="space-y-2">
          <Checkbox name="commissionVisibleToCompany" defaultChecked={Boolean(initial.commissionVisibleToCompany)} label="Commission visible de l’entreprise" />
          <Checkbox name="commissionVisibleToFreelancer" defaultChecked={Boolean(initial.commissionVisibleToFreelancer)} label="Commission visible du freelance" />
        </div>
      </Section>

      <Section title="Frais, taxes et CRA">
        <Field label="Politique de frais" hint="Obligatoire pour l’envoi (ex. frais inclus, refacturés sur justificatifs…).">
          {(p) => <Textarea {...p} name="expensesPolicy" rows={2} maxLength={2000} defaultValue={initial.expensesPolicy ?? ''} />}
        </Field>
        <Field label="Note sur les taxes" hint="La plateforme ne calcule aucune taxe : elles figurent sur les factures déposées.">
          {(p) => <Textarea {...p} name="taxNote" rows={2} maxLength={2000} defaultValue={initial.taxNote ?? ''} />}
        </Field>
        <Field label="Règle de validation des CRA" hint="Obligatoire pour l’envoi (qui valide, dans quel délai…).">
          {(p) => <Textarea {...p} name="timesheetValidationRule" rows={2} maxLength={2000} defaultValue={initial.timesheetValidationRule ?? ''} />}
        </Field>
      </Section>

      <Section title="Règlements et facturation">
        <div className="grid gap-4 md:grid-cols-3">
          <Field label="Délai de règlement client (jours)">
            {(p) => <Input {...p} type="number" min={0} max={365} step={1} name="clientPaymentTermsDays" defaultValue={initial.clientPaymentTermsDays ?? ''} />}
          </Field>
          <Field label="Délai de règlement freelance (jours)">
            {(p) => <Input {...p} type="number" min={0} max={365} step={1} name="freelancerPaymentTermsDays" defaultValue={initial.freelancerPaymentTermsDays ?? ''} />}
          </Field>
          <Field label="Factures du freelance adressées à">
            {(p) => <Select {...p} name="freelancerInvoiceAddressee" defaultValue={initial.freelancerInvoiceAddressee ?? ''} placeholder="— Choisir —" options={optionsFrom(InvoiceAddressee, labels.invoiceAddressee)} />}
          </Field>
        </div>
        <Field label="Note sur les règlements">{(p) => <Textarea {...p} name="paymentTermsNote" rows={2} maxLength={2000} defaultValue={initial.paymentTermsNote ?? ''} />}</Field>
      </Section>

      <Field label="Notes internes E-MPGT" hint="Jamais visibles des parties.">
        {(p) => <Textarea {...p} name="internalNotes" rows={3} maxLength={5000} defaultValue={initial.internalNotes ?? ''} />}
      </Field>

      <FormError error={error} />
      <div className="flex flex-wrap gap-2">
        <Button type="submit" loading={pending}>
          {submitLabel}
        </Button>
        {onCancel && (
          <Button variant="secondary" onClick={onCancel} disabled={pending}>
            Annuler
          </Button>
        )}
      </div>
    </form>
  );
}
