'use client';

import { useState } from 'react';
import type { MessageResponse, SessionInfo, SessionUser } from '@empgt/contracts';
import { labels } from '@empgt/contracts';
import { api } from '@/lib/api';
import { formatDateTime } from '@/lib/format';
import { useAction, useApi } from '@/lib/hooks';
import { useSession } from '@/lib/session';
import { Button } from '@/components/ui/button';
import { Card, DefinitionList } from '@/components/ui/card';
import { ResourceView } from '@/components/ui/feedback';
import { Field, FormError, formValue, Input } from '@/components/ui/form';
import { PageHeader } from '@/components/ui/page';

/** Paramètres du compte : identité, mot de passe, sessions ouvertes. */
export function SettingsPage() {
  const { user, refresh } = useSession();
  const sessions = useApi<SessionInfo[]>('/auth/sessions');
  const profileAction = useAction();
  const passwordAction = useAction();
  const [passwordFormKey, setPasswordFormKey] = useState(0);
  if (!user) return null;

  return (
    <>
      <PageHeader title="Paramètres du compte" description="Vos informations personnelles, votre mot de passe et vos sessions ouvertes." />
      <div className="grid gap-6 lg:grid-cols-2">
        <Card title="Mon identité">
          <form
            className="space-y-4"
            onSubmit={async (e) => {
              e.preventDefault();
              const form = new FormData(e.currentTarget);
              const result = await profileAction.run(
                () => api.patch<SessionUser>('/auth/me', { firstName: formValue(form, 'firstName'), lastName: formValue(form, 'lastName'), phone: formValue(form, 'phone') }),
                { success: 'Informations enregistrées' },
              );
              if (result) await refresh();
            }}
          >
            <Field label="Prénom" required>{(p) => <Input {...p} name="firstName" defaultValue={user.firstName} autoComplete="given-name" />}</Field>
            <Field label="Nom" required>{(p) => <Input {...p} name="lastName" defaultValue={user.lastName} autoComplete="family-name" />}</Field>
            <Field label="Téléphone">{(p) => <Input {...p} name="phone" type="tel" defaultValue={user.phone ?? ''} autoComplete="tel" />}</Field>
            <DefinitionList items={[['Adresse e-mail', user.email], ['État du compte', labels.userStatus[user.status]], ['Rôle', user.roles.map((r) => labels.role[r]).join(', ')]]} />
            <FormError error={profileAction.error} />
            <Button type="submit" loading={profileAction.pending}>Enregistrer</Button>
          </form>
        </Card>

        <Card title="Mot de passe" description="12 caractères minimum. Vos autres sessions seront fermées.">
          <form
            key={passwordFormKey}
            className="space-y-4"
            onSubmit={async (e) => {
              e.preventDefault();
              const form = new FormData(e.currentTarget);
              const result = await passwordAction.run(
                () => api.post<MessageResponse>('/auth/change-password', { currentPassword: form.get('currentPassword'), newPassword: form.get('newPassword') }),
                { success: 'Mot de passe modifié' },
              );
              if (result) {
                setPasswordFormKey((k) => k + 1);
                await sessions.reload();
              }
            }}
          >
            <Field label="Mot de passe actuel" required>{(p) => <Input {...p} name="currentPassword" type="password" autoComplete="current-password" />}</Field>
            <Field label="Nouveau mot de passe" required hint="12 caractères minimum ; une phrase de passe est recommandée.">
              {(p) => <Input {...p} name="newPassword" type="password" minLength={12} autoComplete="new-password" />}
            </Field>
            <FormError error={passwordAction.error} />
            <Button type="submit" loading={passwordAction.pending}>Modifier le mot de passe</Button>
          </form>
        </Card>

        <Card title="Sessions ouvertes" className="lg:col-span-2">
          <ResourceView resource={sessions}>
            {(list) => (
              <ul className="divide-y divide-gray-100">
                {list.map((s) => (
                  <li key={s.id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
                    <span>
                      <span className="font-medium">{s.current ? 'Cette session' : 'Autre session'}</span> — {s.userAgent ?? 'Navigateur inconnu'}
                      <span className="block text-xs text-gray-500">
                        Dernière activité {formatDateTime(s.lastSeenAt)} · expire {formatDateTime(s.expiresAt)} {s.ipPrefix ? `· réseau ${s.ipPrefix}` : ''}
                      </span>
                    </span>
                    {!s.current && (
                      <Button size="sm" variant="secondary" onClick={async () => { await api.delete(`/auth/sessions/${s.id}`); await sessions.reload(); }}>
                        Fermer
                      </Button>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </ResourceView>
        </Card>
      </div>
    </>
  );
}
