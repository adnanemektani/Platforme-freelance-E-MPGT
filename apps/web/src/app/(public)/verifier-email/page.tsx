'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useRef, useState } from 'react';
import type { MessageResponse } from '@empgt/contracts';
import { api, ApiError } from '@/lib/api';
import { Alert, Spinner } from '@/components/ui/feedback';
import { AuthCard } from '@/components/shared/auth-card';

function Verify() {
  const token = useSearchParams().get('token') ?? '';
  const [state, setState] = useState<{ ok: boolean; message: string } | null>(null);
  const started = useRef(false);
  useEffect(() => {
    if (!token || started.current) return;
    started.current = true;
    api
      .post<MessageResponse>('/auth/verify-email', { token })
      .then((r) => setState({ ok: true, message: r.message }))
      .catch((e: unknown) => setState({ ok: false, message: e instanceof ApiError ? e.message : 'Vérification impossible.' }));
  }, [token]);
  return (
    <AuthCard title="Confirmation de l’adresse e-mail">
      {!token && <Alert tone="danger">Lien incomplet.</Alert>}
      {token && !state && <Spinner label="Vérification en cours…" />}
      {state && <Alert tone={state.ok ? 'success' : 'danger'}>{state.message}</Alert>}
      <Link href="/connexion" className="mt-4 inline-block font-medium text-brand-700 underline">Aller à la connexion</Link>
    </AuthCard>
  );
}

export default function Page() {
  return (
    <Suspense>
      <Verify />
    </Suspense>
  );
}
