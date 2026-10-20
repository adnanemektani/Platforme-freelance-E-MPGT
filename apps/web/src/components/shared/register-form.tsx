'use client';

import Link from 'next/link';
import { useState } from 'react';
import type { MessageResponse } from '@empgt/contracts';
import { api } from '@/lib/api';
import { useAction } from '@/lib/hooks';
import { Button } from '@/components/ui/button';
import { Alert } from '@/components/ui/feedback';
import { Checkbox, Field, FormError, formValue, Input } from '@/components/ui/form';
import { AuthCard } from './auth-card';

export function RegisterForm({ kind }: { kind: 'company' | 'freelancer' }) {
  const { run, pending, error } = useAction();
  const [done, setDone] = useState<string | null>(null);
  const company = kind === 'company';

  if (done) {
    return (
      <AuthCard title="Vérifiez votre boîte e-mail">
        <Alert tone="success">{done}</Alert>
        <p className="mt-4 text-sm text-gray-700">
          Cliquez sur le lien reçu pour confirmer votre adresse, puis connectez-vous.{' '}
          {company ? 'Vous pourrez alors renseigner votre entreprise et préparer vos missions.' : 'Vous pourrez alors compléter votre profil et le soumettre à E-MPGT.'}
        </p>
        <Link href="/connexion" className="mt-4 inline-block font-medium text-brand-700 underline">Aller à la connexion</Link>
      </AuthCard>
    );
  }

  return (
    <AuthCard
      title={company ? 'Créer un compte entreprise' : 'Créer un compte freelance'}
      description={company ? 'Vous serez responsable de votre organisation sur la plateforme.' : 'Votre profil sera examiné par E-MPGT avant de pouvoir candidater.'}
      footer={
        <>
          Déjà inscrit ? <Link href="/connexion" className="font-medium text-brand-700 underline">Se connecter</Link>
        </>
      }
    >
      <form
        className="space-y-4"
        onSubmit={async (e) => {
          e.preventDefault();
          const form = new FormData(e.currentTarget);
          const body = {
            email: formValue(form, 'email'),
            password: form.get('password'),
            firstName: formValue(form, 'firstName'),
            lastName: formValue(form, 'lastName'),
            phone: formValue(form, 'phone'),
            acceptTerms: form.get('acceptTerms') === 'on',
            ...(company ? { companyName: formValue(form, 'companyName'), country: formValue(form, 'country') } : {}),
          };
          const result = await run(() => api.post<MessageResponse>(company ? '/auth/register/company' : '/auth/register/freelancer', body), { silent: true });
          if (result) setDone(result.message);
        }}
      >
        {company && (
          <>
            <Field label="Raison sociale de l’entreprise" required>{(p) => <Input {...p} name="companyName" autoComplete="organization" />}</Field>
            <Field label="Pays (code ISO)" hint="Ex. FR, MA, CI, SN">{(p) => <Input {...p} name="country" maxLength={2} className="uppercase" />}</Field>
          </>
        )}
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Prénom" required>{(p) => <Input {...p} name="firstName" autoComplete="given-name" />}</Field>
          <Field label="Nom" required>{(p) => <Input {...p} name="lastName" autoComplete="family-name" />}</Field>
        </div>
        <Field label="Adresse e-mail professionnelle" required>{(p) => <Input {...p} name="email" type="email" autoComplete="email" />}</Field>
        <Field label="Téléphone">{(p) => <Input {...p} name="phone" type="tel" autoComplete="tel" />}</Field>
        <Field label="Mot de passe" required hint="12 caractères minimum ; une phrase de passe est recommandée.">
          {(p) => <Input {...p} name="password" type="password" minLength={12} autoComplete="new-password" />}
        </Field>
        <Checkbox
          name="acceptTerms"
          required
          label={
            <>
              J’accepte les <Link href="/cgu" className="underline" target="_blank">conditions d’utilisation</Link> et la{' '}
              <Link href="/confidentialite" className="underline" target="_blank">politique de confidentialité</Link>.
            </>
          }
        />
        <FormError error={error} />
        <Button type="submit" loading={pending} className="w-full">Créer mon compte</Button>
      </form>
    </AuthCard>
  );
}
