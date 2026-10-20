'use client';

import { useState } from 'react';
import { IntegrationScope, labels, type LegalInfo, type PlatformSettings } from '@empgt/contracts';
import { api } from '@/lib/api';
import { useAction, useApi } from '@/lib/hooks';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Alert, ResourceView } from '@/components/ui/feedback';
import { Checkbox, Field, FormError, formValue, Input, Textarea } from '@/components/ui/form';

const LEGAL_FIELDS: Array<{
  name: keyof LegalInfo;
  label: string;
  multiline?: boolean;
  hint?: string;
}> = [
  { name: 'operatorName', label: 'Société exploitante' },
  { name: 'operatorLegalForm', label: 'Forme juridique' },
  { name: 'operatorAddress', label: 'Adresse du siège', multiline: true },
  {
    name: 'operatorRegistration',
    label: 'Immatriculation',
    hint: 'Ex. RCS, numéro SIREN, capital social…',
  },
  { name: 'operatorCountry', label: 'Pays' },
  { name: 'publicationDirector', label: 'Directeur de la publication' },
  {
    name: 'hostingProvider',
    label: 'Hébergeur',
    multiline: true,
    hint: 'Nom, adresse et contact de l’hébergeur.',
  },
  { name: 'contactEmail', label: 'Contact (e-mail)' },
  {
    name: 'dataProtectionContact',
    label: 'Contact données personnelles',
    hint: 'Délégué à la protection des données ou contact dédié.',
  },
];

const POLICY: Array<{
  name:
    | 'freelancerProfileApprovalRequired'
    | 'companyVerificationRequiredForPublication'
    | 'missionApprovalRequired';
  label: string;
  hint: string;
}> = [
  {
    name: 'freelancerProfileApprovalRequired',
    label: 'Validation des profils freelances par E-MPGT',
    hint: 'Un profil doit être validé avant de pouvoir candidater aux missions et d’apparaître (avec consentement) dans le catalogue public anonymisé.',
  },
  {
    name: 'companyVerificationRequiredForPublication',
    label: 'Vérification de l’entreprise avant la publication de sa première mission',
    hint: 'L’entreprise peut préparer et soumettre ses missions ; elles ne sont publiées qu’une fois l’entreprise vérifiée.',
  },
  {
    name: 'missionApprovalRequired',
    label: 'Validation de chaque mission par E-MPGT',
    hint: 'Une mission soumise n’est visible des freelances qu’après validation par E-MPGT.',
  },
];

/** Paramètres métier de la plateforme (GET / PATCH /admin/settings), motif obligatoire. */
export function ASettingsForm() {
  const settings = useApi<PlatformSettings>('/admin/settings');
  const action = useAction();
  const [formKey, setFormKey] = useState(0);

  return (
    <ResourceView resource={settings} loadingLabel="Chargement des paramètres…">
      {(s) => (
        <form
          key={formKey}
          className="space-y-6"
          onSubmit={async (e) => {
            e.preventDefault();
            const form = new FormData(e.currentTarget);
            const legal = Object.fromEntries(
              LEGAL_FIELDS.map((f) => [f.name, formValue(form, `legal.${f.name}`)]),
            );
            const result = await action.run(
              () =>
                api.patch<PlatformSettings>('/admin/settings', {
                  freelancerProfileApprovalRequired:
                    form.get('freelancerProfileApprovalRequired') === 'on',
                  companyVerificationRequiredForPublication:
                    form.get('companyVerificationRequiredForPublication') === 'on',
                  missionApprovalRequired: form.get('missionApprovalRequired') === 'on',
                  freelancerSeesCompanyName: form.get('freelancerSeesCompanyName') === 'on',
                  commissionPolicy: formValue(form, 'commissionPolicy'),
                  legal,
                  integrationEnabledScopes: form.getAll('integrationEnabledScopes').map(String),
                  reason: formValue(form, 'reason'),
                }),
              { success: 'Paramètres enregistrés' },
            );
            if (result) {
              settings.setData(result);
              setFormKey((k) => k + 1);
            }
          }}
        >
          <Card
            title="Politique de validation V1"
            description="Contrôles appliqués par le serveur. Toute modification est tracée avec son motif."
          >
            <div className="space-y-4">
              <Alert tone="info">
                La vérification de l’adresse e-mail est obligatoire pour tous les comptes et n’est
                pas désactivable.
              </Alert>
              {POLICY.map((p) => (
                <Checkbox
                  key={p.name}
                  name={p.name}
                  label={p.label}
                  hint={p.hint}
                  defaultChecked={s[p.name]}
                />
              ))}
            </div>
          </Card>

          <Card title="Affichage des missions">
            <Checkbox
              name="freelancerSeesCompanyName"
              label="Les freelances voient le nom de l’entreprise sur les missions"
              hint="Décision D-15. Décoché : les missions sont présentées sans le nom de l’entreprise cliente."
              defaultChecked={s.freelancerSeesCompanyName}
            />
          </Card>

          <Card
            title="Politique de commission"
            description="Texte de référence de la politique de commission validée."
          >
            <div className="space-y-3">
              {!s.commissionPolicy && (
                <Alert tone="warning" title="Décision D-05 ouverte">
                  Aucune politique de commission n’est encore validée. Laissez le champ vide tant
                  que la décision n’est pas prise.
                </Alert>
              )}
              <Field
                label="Politique de commission"
                hint="Laisser vide = décision D-05 ouverte. 4000 caractères maximum."
              >
                {(p) => (
                  <Textarea
                    {...p}
                    name="commissionPolicy"
                    rows={5}
                    maxLength={4000}
                    defaultValue={s.commissionPolicy ?? ''}
                  />
                )}
              </Field>
            </div>
          </Card>

          <Card
            title="Informations légales"
            description="Affichées dans les mentions légales publiques. Un champ vide reste affiché comme « à compléter »."
          >
            <div className="grid gap-4 sm:grid-cols-2">
              {LEGAL_FIELDS.map((f) => (
                <Field key={f.name} label={f.label} hint={f.hint}>
                  {(p) =>
                    f.multiline ? (
                      <Textarea
                        {...p}
                        name={`legal.${f.name}`}
                        rows={2}
                        defaultValue={s.legal[f.name] ?? ''}
                      />
                    ) : (
                      <Input {...p} name={`legal.${f.name}`} defaultValue={s.legal[f.name] ?? ''} />
                    )
                  }
                </Field>
              ))}
            </div>
          </Card>

          <Card
            title="Partage avec le Knowledge Graph"
            description="Domaines servis par l’API d’intégration (décision D-16). Aucun domaine n’est activé par défaut."
          >
            <div className="space-y-3">
              <Alert tone="warning">
                Aucune synchronisation réelle en V1 ; décision D-16 attendue. Un domaine doit aussi
                être accordé au client d’intégration.
              </Alert>
              <div className="grid gap-2 sm:grid-cols-3">
                {IntegrationScope.map((scope) => (
                  <Checkbox
                    key={scope}
                    name="integrationEnabledScopes"
                    value={scope}
                    label={labels.integrationScope[scope]}
                    defaultChecked={s.integrationEnabledScopes.includes(scope)}
                  />
                ))}
              </div>
            </div>
          </Card>

          <Card>
            <div className="space-y-4">
              <Field
                label="Motif de la modification"
                required
                hint="Obligatoire : conservé dans le journal d’audit (3 caractères minimum)."
              >
                {(p) => <Textarea {...p} name="reason" rows={2} minLength={3} />}
              </Field>
              <FormError error={action.error} />
              <Button type="submit" loading={action.pending}>
                Enregistrer les paramètres
              </Button>
            </div>
          </Card>
        </form>
      )}
    </ResourceView>
  );
}
