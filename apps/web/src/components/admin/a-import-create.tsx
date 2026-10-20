'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import type { ImportBatchView } from '@empgt/contracts';
import { api } from '@/lib/api';
import { useAction } from '@/lib/hooks';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Field, FormError, formValue, Input } from '@/components/ui/form';
import { Tabs } from '@/components/ui/page';

export const DEFAULT_IMPORT_SOURCE = 'https://e-mpgt.com/profils-dispo';

/** Création d'un lot d'import : collecte par URL (hôte autorisé côté serveur) ou dépôt d'un instantané HTML. */
export function AImportCreate() {
  const router = useRouter();
  const [mode, setMode] = useState<'url' | 'upload'>('url');
  const [file, setFile] = useState<File | null>(null);
  const action = useAction();
  const open = (batch: ImportBatchView) => router.push(`/admin/imports/${batch.id}`);

  return (
    <Card
      title="Nouveau lot d’import"
      description="Le lot est d’abord créé en prévisualisation : aucun profil n’est créé tant que chaque élément n’a pas été examiné et validé."
    >
      <Tabs
        current={mode}
        onChange={(id) => {
          action.clearError();
          setMode(id as 'url' | 'upload');
        }}
        tabs={[
          { id: 'url', label: 'Collecter la page source' },
          { id: 'upload', label: 'Déposer un instantané HTML' },
        ]}
      />
      {mode === 'url' ? (
        <form
          className="space-y-4"
          onSubmit={async (e) => {
            e.preventDefault();
            const form = new FormData(e.currentTarget);
            const batch = await action.run(
              () =>
                api.post<ImportBatchView>('/admin/imports', {
                  sourceUrl: formValue(form, 'sourceUrl'),
                }),
              { success: 'Lot créé : examinez les éléments' },
            );
            if (batch) open(batch);
          }}
        >
          <Field
            label="Adresse de la page"
            required
            hint="Seules les pages https des hôtes autorisés par la configuration du serveur peuvent être collectées."
          >
            {(p) => (
              <Input {...p} name="sourceUrl" type="url" defaultValue={DEFAULT_IMPORT_SOURCE} />
            )}
          </Field>
          <FormError error={action.error} />
          <Button type="submit" loading={action.pending}>
            Collecter et prévisualiser
          </Button>
        </form>
      ) : (
        <form
          className="space-y-4"
          onSubmit={async (e) => {
            e.preventDefault();
            const form = new FormData(e.currentTarget);
            const local = formValue(form, 'collectedAt');
            const collectedAt = local ? new Date(local).toISOString() : null;
            const batch = await action.run(
              () =>
                api.upload<ImportBatchView>('/admin/imports/upload', file, {
                  sourceUrl: formValue(form, 'sourceUrl'),
                  collectedAt,
                }),
              {
                success: 'Lot créé : examinez les éléments',
              },
            );
            if (batch) open(batch);
          }}
        >
          <Field
            label="Instantané HTML de la page"
            required
            hint="Fichier .html enregistré depuis le navigateur (page complète). Il doit contenir les données de la page des profils."
          >
            {(p) => (
              <input
                {...p}
                type="file"
                accept=".html,.htm,text/html"
                className="block w-full text-sm text-gray-700 file:mr-3 file:rounded-md file:border-0 file:bg-brand-50 file:px-3 file:py-2 file:text-sm file:font-medium file:text-brand-800"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              />
            )}
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Adresse d’origine de l’instantané" required>
              {(p) => (
                <Input {...p} name="sourceUrl" type="url" defaultValue={DEFAULT_IMPORT_SOURCE} />
              )}
            </Field>
            <Field label="Date de collecte" hint="Facultatif : par défaut, la date du dépôt.">
              {(p) => <Input {...p} name="collectedAt" type="datetime-local" />}
            </Field>
          </div>
          <FormError error={action.error} />
          <Button type="submit" loading={action.pending} disabled={!file}>
            Déposer et prévisualiser
          </Button>
        </form>
      )}
    </Card>
  );
}
