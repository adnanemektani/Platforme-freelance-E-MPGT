'use client';

import Link from 'next/link';
import { useState } from 'react';
import {
  IntegrationScope,
  labels,
  type CreatedIntegrationClient,
  type IntegrationClientView,
  type PlatformSettings,
} from '@empgt/contracts';
import { api } from '@/lib/api';
import { formatDate, formatDateTime } from '@/lib/format';
import { useAction, useApi } from '@/lib/hooks';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ConfirmDialog, Dialog } from '@/components/ui/dialog';
import { Alert, ResourceView } from '@/components/ui/feedback';
import { Checkbox, Field, FormError, formValue, Input, Textarea } from '@/components/ui/form';
import { PageHeader } from '@/components/ui/page';
import { DataTable } from '@/components/ui/table';
import { useToast } from '@/components/ui/toast';

export default function IntegrationPage() {
  const clients = useApi<IntegrationClientView[]>('/admin/integration-clients');
  const settings = useApi<PlatformSettings>('/admin/settings');
  const [created, setCreated] = useState<CreatedIntegrationClient | null>(null);
  const [revoking, setRevoking] = useState<IntegrationClientView | null>(null);
  const [formKey, setFormKey] = useState(0);
  const createAction = useAction();
  const revokeAction = useAction();

  return (
    <>
      <PageHeader
        title="Intégration Knowledge Graph"
        description="Clients machine autorisés à lire l’API d’intégration (données filtrées, sans coordonnées, données bancaires ni contenu de documents)."
      />
      <div className="space-y-6">
        <Alert tone="warning" title="Aucune synchronisation réelle en V1">
          L’API d’intégration est prête mais aucune synchronisation n’est active : la décision D-16
          (périmètre du partage avec le Knowledge Graph) est attendue. Un domaine n’est servi que
          s’il est activé dans les paramètres <strong>et</strong> accordé au client.
        </Alert>

        <Card
          title="État du partage"
          description="Domaines activés dans les paramètres de la plateforme (aucun par défaut)."
          actions={
            <Link href="/admin/parametres" className="text-sm font-medium text-brand-700 underline">
              Modifier dans les paramètres
            </Link>
          }
        >
          <ResourceView resource={settings} loadingLabel="Chargement des paramètres…">
            {(s) => (
              <ul className="flex flex-wrap gap-2">
                {IntegrationScope.map((scope) => {
                  const enabled = s.integrationEnabledScopes.includes(scope);
                  return (
                    <li key={scope}>
                      <Badge tone={enabled ? 'green' : 'gray'}>
                        {labels.integrationScope[scope]} : {enabled ? 'activé' : 'désactivé'}
                      </Badge>
                    </li>
                  );
                })}
              </ul>
            )}
          </ResourceView>
        </Card>

        <Card
          title="Nouveau client d’intégration"
          description="Le jeton d’accès n’est affiché qu’une seule fois, à la création : seul son condensat est conservé."
        >
          <form
            key={formKey}
            className="space-y-4"
            onSubmit={async (e) => {
              e.preventDefault();
              const form = new FormData(e.currentTarget);
              const days = formValue(form, 'expiresInDays');
              const result = await createAction.run(
                () =>
                  api.post<CreatedIntegrationClient>('/admin/integration-clients', {
                    name: formValue(form, 'name'),
                    description: formValue(form, 'description'),
                    scopes: form.getAll('scopes').map(String),
                    expiresInDays: days,
                  }),
                { success: 'Client d’intégration créé' },
              );
              if (result) {
                setCreated(result);
                setFormKey((k) => k + 1);
                void clients.reload();
              }
            }}
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Nom" required>
                {(p) => (
                  <Input
                    {...p}
                    name="name"
                    maxLength={100}
                    placeholder="Ex. Knowledge Graph — préproduction"
                  />
                )}
              </Field>
              <Field
                label="Expiration (jours)"
                hint="Facultatif : de 1 à 730 jours. Sans valeur, le jeton n’expire pas."
              >
                {(p) => <Input {...p} name="expiresInDays" type="number" min={1} max={730} />}
              </Field>
            </div>
            <Field label="Description">
              {(p) => <Textarea {...p} name="description" rows={2} maxLength={500} />}
            </Field>
            <fieldset className="space-y-2">
              <legend className="text-sm font-medium text-gray-800">
                Domaines accordés{' '}
                <span className="text-red-700" aria-hidden="true">
                  *
                </span>
              </legend>
              <div className="grid gap-2 sm:grid-cols-3">
                {IntegrationScope.map((scope) => (
                  <Checkbox
                    key={scope}
                    name="scopes"
                    value={scope}
                    label={labels.integrationScope[scope]}
                  />
                ))}
              </div>
            </fieldset>
            <FormError error={createAction.error} />
            <Button type="submit" loading={createAction.pending}>
              Créer le client
            </Button>
          </form>
        </Card>

        <section aria-labelledby="clients-title" className="space-y-3">
          <h2 id="clients-title" className="text-lg font-semibold text-gray-900">
            Clients d’intégration
          </h2>
          <ResourceView resource={clients} loadingLabel="Chargement des clients…">
            {(list) => (
              <DataTable
                rows={list}
                rowKey={(c) => c.id}
                caption="Clients d’intégration"
                empty={{
                  title: 'Aucun client d’intégration',
                  description: 'Créez un client pour préparer la connexion du Knowledge Graph.',
                }}
                columns={[
                  {
                    header: 'Client',
                    cell: (c) => (
                      <span className="block">
                        <span className="font-medium text-gray-900">{c.name}</span>
                        {c.description && (
                          <span className="block text-xs text-gray-600">{c.description}</span>
                        )}
                        <span className="block font-mono text-xs text-gray-500">
                          empgt_int_{c.tokenPrefix}_…
                        </span>
                      </span>
                    ),
                  },
                  {
                    header: 'Domaines',
                    cell: (c) => (
                      <span className="flex flex-wrap gap-1">
                        {c.scopes.map((s) => (
                          <Badge key={s} tone="blue">
                            {labels.integrationScope[s]}
                          </Badge>
                        ))}
                      </span>
                    ),
                  },
                  { header: 'Créé le', cell: (c) => formatDate(c.createdAt) },
                  { header: 'Dernière utilisation', cell: (c) => formatDateTime(c.lastUsedAt) },
                  {
                    header: 'Expiration',
                    cell: (c) => (c.expiresAt ? formatDate(c.expiresAt) : 'Aucune'),
                  },
                  {
                    header: 'État',
                    cell: (c) =>
                      c.revokedAt ? (
                        <span className="block">
                          <Badge tone="red">Révoqué le {formatDate(c.revokedAt)}</Badge>
                          {c.revokeReason && (
                            <span className="mt-1 block max-w-xs text-xs text-gray-600">
                              {c.revokeReason}
                            </span>
                          )}
                        </span>
                      ) : (
                        <Button size="sm" variant="danger" onClick={() => setRevoking(c)}>
                          Révoquer
                        </Button>
                      ),
                  },
                ]}
              />
            )}
          </ResourceView>
        </section>
      </div>

      {created && <TokenDialog client={created} onClose={() => setCreated(null)} />}

      <ConfirmDialog
        open={revoking !== null}
        onClose={() => setRevoking(null)}
        title={revoking ? `Révoquer « ${revoking.name} »` : 'Révoquer'}
        message="Le jeton cessera immédiatement de fonctionner. Cette opération est définitive : il faudra créer un nouveau client."
        confirmLabel="Révoquer"
        tone="danger"
        reasonLabel="Motif"
        reasonRequired
        pending={revokeAction.pending}
        onConfirm={async (reason) => {
          if (!revoking) return;
          const result = await revokeAction.run(
            () =>
              api.post<IntegrationClientView>(`/admin/integration-clients/${revoking.id}/revoke`, {
                reason,
              }),
            { success: 'Client révoqué' },
          );
          if (result) {
            setRevoking(null);
            void clients.reload();
          }
        }}
      />
    </>
  );
}

function TokenDialog({
  client,
  onClose,
}: {
  client: CreatedIntegrationClient;
  onClose: () => void;
}) {
  const toast = useToast();
  return (
    <Dialog
      open
      onClose={onClose}
      title={`Jeton du client « ${client.name} »`}
      footer={<Button onClick={onClose}>J’ai copié le jeton</Button>}
    >
      <Alert tone="warning" title="Affiché une seule fois">
        Copiez ce jeton maintenant et transmettez-le par un canal sûr. Il ne pourra plus être
        affiché : seul son condensat est conservé. En cas de perte, révoquez ce client et créez-en
        un nouveau.
      </Alert>
      <pre className="overflow-x-auto whitespace-pre-wrap break-all rounded-md border border-gray-200 bg-gray-50 p-3 font-mono text-xs text-gray-900">
        {client.token}
      </pre>
      <Button
        variant="secondary"
        size="sm"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(client.token);
            toast.success('Jeton copié dans le presse-papiers');
          } catch {
            toast.error('Copie impossible : sélectionnez le jeton et copiez-le manuellement.');
          }
        }}
      >
        Copier le jeton
      </Button>
    </Dialog>
  );
}
