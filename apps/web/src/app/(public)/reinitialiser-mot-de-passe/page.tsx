'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Suspense, useState } from 'react';
import type { MessageResponse } from '@empgt/contracts';
import { api } from '@/lib/api';
import { useAction } from '@/lib/hooks';
import { Button } from '@/components/ui/button';
import { Alert } from '@/components/ui/feedback';
import { Field, FormError, Input } from '@/components/ui/form';
import { AuthCard } from '@/components/shared/auth-card';

function ResetForm() {
  const token = useSearchParams().get('token') ?? '';
  const { run, pending, error } = useAction();
  const [message, setMessage] = useState<string | null>(null);
  if (!token) return <AuthCard title="Lien invalide"><Alert tone="danger">Ce lien est incomplet. Demandez un nouveau lien depuis « Mot de passe oublié ».</Alert></AuthCard>;
  return (
    <AuthCard title="Choisir un mot de passe" description="12 caractères minimum. Ce lien ne peut servir qu’une fois.">
      {message ? (
        <>
          <Alert tone="success">{message}</Alert>
          <Link href="/connexion" className="mt-4 inline-block font-medium text-brand-700 underline">Se connecter</Link>
        </>
      ) : (
        <form
          className="space-y-4"
          onSubmit={async (e) => {
            e.preventDefault();
            const form = new FormData(e.currentTarget);
            if (form.get('password') !== form.get('confirm')) return;
            const result = await run(() => api.post<MessageResponse>('/auth/reset-password', { token, password: form.get('password') }), { silent: true });
            if (result) setMessage(result.message);
          }}
        >
          <Field label="Nouveau mot de passe" required>{(p) => <Input {...p} name="password" type="password" minLength={12} autoComplete="new-password" />}</Field>
          <Field label="Confirmation" required>{(p) => <Input {...p} name="confirm" type="password" minLength={12} autoComplete="new-password" />}</Field>
          <FormError error={error} />
          <Button type="submit" loading={pending} className="w-full">Enregistrer</Button>
        </form>
      )}
    </AuthCard>
  );
}

export default function Page() {
  return (
    <Suspense>
      <ResetForm />
    </Suspense>
  );
}
