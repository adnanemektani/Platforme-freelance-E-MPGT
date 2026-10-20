'use client';

import { useState } from 'react';
import type { MessageResponse } from '@empgt/contracts';
import { api } from '@/lib/api';
import { useAction } from '@/lib/hooks';
import { Button } from '@/components/ui/button';
import { Alert } from '@/components/ui/feedback';
import { Field, FormError, formValue, Input, Select, Textarea } from '@/components/ui/form';

export default function ContactPage() {
  const { run, pending, error } = useAction();
  const [done, setDone] = useState<string | null>(null);
  return (
    <div className="mx-auto max-w-2xl px-4 py-12">
      <h1 className="text-3xl font-bold text-gray-900">Contact</h1>
      <p className="mt-2 text-gray-700">Une question sur la plateforme, une mission, un profil ? Écrivez à E-MPGT.</p>
      <div className="mt-6 rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        {done ? (
          <Alert tone="success">{done}</Alert>
        ) : (
          <form
            className="space-y-4"
            onSubmit={async (e) => {
              e.preventDefault();
              const form = new FormData(e.currentTarget);
              const result = await run(
                () =>
                  api.post<MessageResponse>('/public/contact', {
                    name: formValue(form, 'name'),
                    email: formValue(form, 'email'),
                    organization: formValue(form, 'organization'),
                    audience: form.get('audience'),
                    subject: formValue(form, 'subject'),
                    message: formValue(form, 'message'),
                    website: form.get('website') ?? '',
                  }),
                { silent: true },
              );
              if (result) setDone(result.message);
            }}
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Nom" required>{(p) => <Input {...p} name="name" autoComplete="name" />}</Field>
              <Field label="Adresse e-mail" required>{(p) => <Input {...p} name="email" type="email" autoComplete="email" />}</Field>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Organisation">{(p) => <Input {...p} name="organization" autoComplete="organization" />}</Field>
              <Field label="Vous êtes" required>
                {(p) => <Select {...p} name="audience" defaultValue="COMPANY" options={[{ value: 'COMPANY', label: 'Une entreprise' }, { value: 'FREELANCER', label: 'Freelance' }, { value: 'OTHER', label: 'Autre' }]} />}
              </Field>
            </div>
            <Field label="Objet" required>{(p) => <Input {...p} name="subject" />}</Field>
            <Field label="Message" required>{(p) => <Textarea {...p} name="message" rows={6} />}</Field>
            {/* Champ piège pour les robots, invisible pour les humains et les lecteurs d’écran. */}
            <input type="text" name="website" tabIndex={-1} autoComplete="off" aria-hidden="true" className="hidden" />
            <p className="text-xs text-gray-600">Vos informations servent uniquement à répondre à votre demande.</p>
            <FormError error={error} />
            <Button type="submit" loading={pending}>Envoyer</Button>
          </form>
        )}
      </div>
    </div>
  );
}
