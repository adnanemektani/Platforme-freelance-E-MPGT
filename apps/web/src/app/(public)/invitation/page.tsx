'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';
import type { InvitationPreview, MeResponse } from '@empgt/contracts';
import { api, ApiError } from '@/lib/api';
import { formatDate } from '@/lib/format';
import { useAction } from '@/lib/hooks';
import { SPACE_HOME, useSession } from '@/lib/session';
import { Button, LinkButton } from '@/components/ui/button';
import { Alert, Spinner } from '@/components/ui/feedback';
import { Checkbox, Field, FormError, formValue, Input } from '@/components/ui/form';
import { AuthCard } from '@/components/shared/auth-card';

function Invitation() {
  const token = useSearchParams().get('token') ?? '';
  const router = useRouter();
  const { user, setMe } = useSession();
  const [preview, setPreview] = useState<InvitationPreview | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const { run, pending, error } = useAction();

  useEffect(() => {
    if (!token) return;
    api
      .post<InvitationPreview>('/auth/invitations/preview', { token })
      .then(setPreview)
      .catch((e: unknown) => setLoadError(e instanceof ApiError ? e.message : 'Invitation illisible.'));
  }, [token]);

  if (!token || loadError) return <AuthCard title="Invitation"><Alert tone="danger">{loadError ?? 'Lien incomplet.'}</Alert></AuthCard>;
  if (!preview) return <AuthCard title="Invitation"><Spinner /></AuthCard>;

  const target = preview.type === 'COMPANY_MEMBER' ? `rejoindre l’entreprise « ${preview.companyName} »` : `rattacher le profil « ${preview.profileHeadline ?? 'historique'} » à votre compte`;
  const accept = async (body: Record<string, unknown>) => {
    const me = await run(() => api.post<MeResponse>('/auth/invitations/accept', { token, ...body }), { silent: true });
    if (me) {
      setMe(me);
      router.replace(preview.type === 'PROFILE_CLAIM' ? '/freelance/profil' : SPACE_HOME[me.user.space]);
    }
  };

  return (
    <AuthCard title="Invitation" description={<>Invitation adressée à <strong>{preview.email}</strong> pour {target}. Valable jusqu’au {formatDate(preview.expiresAt)}.</>}>
      {preview.type === 'PROFILE_CLAIM' && (
        <Alert tone="info">Après acceptation, vous vérifierez et compléterez vos informations, puis déciderez de leur publication. Rien n’est publié sans votre accord.</Alert>
      )}
      {preview.accountExists ? (
        user && user.email === preview.email ? (
          <div className="mt-4 space-y-3">
            <FormError error={error} />
            <Button loading={pending} onClick={() => void accept({})} className="w-full">Accepter l’invitation</Button>
          </div>
        ) : (
          <div className="mt-4 space-y-3 text-sm text-gray-700">
            <p>Un compte existe déjà pour cette adresse. Connectez-vous avec ce compte puis rouvrez ce lien.</p>
            <LinkButton href={`/connexion?suite=${encodeURIComponent(`/invitation?token=${token}`)}`}>Se connecter</LinkButton>
          </div>
        )
      ) : (
        <form
          className="mt-4 space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            const form = new FormData(e.currentTarget);
            void accept({ firstName: formValue(form, 'firstName'), lastName: formValue(form, 'lastName'), password: form.get('password'), acceptTerms: form.get('acceptTerms') === 'on' });
          }}
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Prénom" required>{(p) => <Input {...p} name="firstName" autoComplete="given-name" />}</Field>
            <Field label="Nom" required>{(p) => <Input {...p} name="lastName" autoComplete="family-name" />}</Field>
          </div>
          <Field label="Mot de passe" required hint="12 caractères minimum.">{(p) => <Input {...p} name="password" type="password" minLength={12} autoComplete="new-password" />}</Field>
          <Checkbox name="acceptTerms" required label={<>J’accepte les <Link href="/cgu" className="underline" target="_blank">conditions d’utilisation</Link>.</>} />
          <FormError error={error} />
          <Button type="submit" loading={pending} className="w-full">Créer mon compte et accepter</Button>
        </form>
      )}
    </AuthCard>
  );
}

export default function Page() {
  return (
    <Suspense>
      <Invitation />
    </Suspense>
  );
}
