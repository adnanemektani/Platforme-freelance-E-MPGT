'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useState } from 'react';
import type { MeResponse, MessageResponse } from '@empgt/contracts';
import { api, type ApiError } from '@/lib/api';
import { useAction } from '@/lib/hooks';
import { SPACE_HOME, useSession } from '@/lib/session';
import { Button } from '@/components/ui/button';
import { Alert } from '@/components/ui/feedback';
import { Field, FormError, Input } from '@/components/ui/form';
import { AuthCard } from '@/components/shared/auth-card';

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const { setMe } = useSession();
  const { run, pending, error } = useAction();
  const [email, setEmail] = useState('');
  const [resent, setResent] = useState<string | null>(null);
  const unverified = (error as ApiError | undefined)?.status === 403 && /non confirmée/.test(error?.message ?? '');

  return (
    <AuthCard
      title="Connexion"
      description="Entreprises, freelances et administration E-MPGT."
      footer={
        <>
          Pas encore de compte ? <Link href="/inscription" className="font-medium text-brand-700 underline">Créer un compte</Link>
        </>
      }
    >
      <form
        className="space-y-4"
        onSubmit={async (e) => {
          e.preventDefault();
          const form = new FormData(e.currentTarget);
          const me = await run(() => api.post<MeResponse>('/auth/login', { email: form.get('email'), password: form.get('password') }), { silent: true });
          if (me) {
            setMe(me);
            const next = params.get('suite');
            router.replace(next && next.startsWith('/') && !next.startsWith('//') ? next : SPACE_HOME[me.user.space]);
          }
        }}
      >
        <Field label="Adresse e-mail" required>{(p) => <Input {...p} name="email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />}</Field>
        <Field label="Mot de passe" required>{(p) => <Input {...p} name="password" type="password" autoComplete="current-password" />}</Field>
        <FormError error={error} />
        {unverified && (
          <Alert tone="info">
            <button
              type="button"
              className="font-medium underline"
              onClick={async () => {
                const r = await api.post<MessageResponse>('/auth/resend-verification', { email });
                setResent(r.message);
              }}
            >
              Renvoyer l’e-mail de confirmation
            </button>
            {resent && <p className="mt-1">{resent}</p>}
          </Alert>
        )}
        <Button type="submit" loading={pending} className="w-full">Se connecter</Button>
        <p className="text-center text-sm">
          <Link href="/mot-de-passe-oublie" className="text-brand-700 underline">Mot de passe oublié ?</Link>
        </p>
      </form>
    </AuthCard>
  );
}

export default function Page() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
