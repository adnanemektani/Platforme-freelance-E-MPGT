'use client';

import Link from 'next/link';
import { useState } from 'react';
import type { MessageResponse } from '@empgt/contracts';
import { api } from '@/lib/api';
import { useAction } from '@/lib/hooks';
import { Button } from '@/components/ui/button';
import { Alert } from '@/components/ui/feedback';
import { Field, FormError, Input } from '@/components/ui/form';
import { AuthCard } from '@/components/shared/auth-card';

export default function Page() {
  const { run, pending, error } = useAction();
  const [message, setMessage] = useState<string | null>(null);
  return (
    <AuthCard title="Mot de passe oublié" description="Indiquez votre adresse : si un compte existe, vous recevrez un lien valable 1 heure." footer={<Link href="/connexion" className="underline">Retour à la connexion</Link>}>
      {message ? (
        <Alert tone="success">{message}</Alert>
      ) : (
        <form
          className="space-y-4"
          onSubmit={async (e) => {
            e.preventDefault();
            const form = new FormData(e.currentTarget);
            const result = await run(() => api.post<MessageResponse>('/auth/forgot-password', { email: form.get('email') }), { silent: true });
            if (result) setMessage(result.message);
          }}
        >
          <Field label="Adresse e-mail" required>{(p) => <Input {...p} name="email" type="email" autoComplete="email" />}</Field>
          <FormError error={error} />
          <Button type="submit" loading={pending} className="w-full">Envoyer le lien</Button>
        </form>
      )}
    </AuthCard>
  );
}
