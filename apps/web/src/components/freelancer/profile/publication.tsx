'use client';

import Link from 'next/link';
import { useState } from 'react';
import { labels, type CatalogVisibility, type OwnProfileView } from '@empgt/contracts';
import { api } from '@/lib/api';
import { formatDateTime } from '@/lib/format';
import { useAction } from '@/lib/hooks';
import { findAction } from '@/components/ui/actions';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Alert } from '@/components/ui/feedback';
import { Checkbox, FormError } from '@/components/ui/form';
import type { ProfileSectionProps } from './shared';

/** Visibilité dans le catalogue public anonymisé, avec consentement explicite (PUT /profile/publication). */
export function PublicationSection({ profile, onSaved }: ProfileSectionProps) {
  const publish = findAction(profile.actions, 'publish');
  const [visibility, setVisibility] = useState<CatalogVisibility>(profile.catalogVisibility);
  const [consent, setConsent] = useState(false);
  const action = useAction();
  const publicDisabled = !publish?.allowed && profile.catalogVisibility !== 'PUBLIC_ANONYMOUS';
  const changed = visibility !== profile.catalogVisibility || (visibility === 'PUBLIC_ANONYMOUS' && consent);

  return (
    <form
      className="space-y-4"
      onSubmit={async (e) => {
        e.preventDefault();
        const result = await action.run(() => api.put<OwnProfileView>('/profile/publication', { catalogVisibility: visibility, consent: visibility === 'PUBLIC_ANONYMOUS' && consent }), {
          success: visibility === 'PUBLIC_ANONYMOUS' ? 'Publication dans le catalogue enregistrée' : 'Profil retiré du catalogue public',
        });
        if (result) {
          setConsent(false);
          setVisibility(result.catalogVisibility);
          onSaved(result);
        }
      }}
    >
      <div className="flex flex-wrap items-center gap-2 text-sm text-gray-800">
        Visibilité actuelle : <Badge tone={profile.catalogVisibility === 'PUBLIC_ANONYMOUS' ? 'green' : 'gray'}>{labels.catalogVisibility[profile.catalogVisibility]}</Badge>
        {profile.publicationConsentAt && <span className="text-xs text-gray-600">Consentement donné le {formatDateTime(profile.publicationConsentAt)}</span>}
      </div>
      {profile.catalogVisibility === 'PUBLIC_ANONYMOUS' && (
        <p className="text-sm">
          <Link href={`/profils/${profile.id}`} className="font-medium text-brand-700 underline">
            Voir ma fiche publique anonymisée
          </Link>{' '}
          <span className="text-xs text-gray-600">(visible tant que votre profil est validé par E-MPGT)</span>
        </p>
      )}

      <fieldset className="space-y-2">
        <legend className="text-sm font-medium text-gray-800">Choisir la visibilité</legend>
        <label className="flex items-start gap-2 text-sm text-gray-800">
          <input type="radio" name="visibility" value="PRIVATE" checked={visibility === 'PRIVATE'} onChange={() => setVisibility('PRIVATE')} className="mt-0.5 h-4 w-4" />
          <span>
            <span className="font-medium">{labels.catalogVisibility.PRIVATE}</span>
            <span className="block text-xs text-gray-600">Votre profil n’est consulté que par E-MPGT et, lorsque vous candidatez, par l’entreprise concernée.</span>
          </span>
        </label>
        <label className="flex items-start gap-2 text-sm text-gray-800">
          <input
            type="radio"
            name="visibility"
            value="PUBLIC_ANONYMOUS"
            checked={visibility === 'PUBLIC_ANONYMOUS'}
            disabled={publicDisabled}
            onChange={() => setVisibility('PUBLIC_ANONYMOUS')}
            className="mt-0.5 h-4 w-4"
          />
          <span>
            <span className="font-medium">{labels.catalogVisibility.PUBLIC_ANONYMOUS}</span>
            <span className="block text-xs text-gray-600">
              Fiche publique sans nom ni coordonnées : titre, résumé, compétences, expériences, formations, langues et disponibilité.
            </span>
          </span>
        </label>
      </fieldset>
      {publish && !publish.allowed && <Alert tone="warning">{publish.reason}</Alert>}
      {visibility === 'PUBLIC_ANONYMOUS' && (
        <Checkbox
          checked={consent}
          onChange={(e) => setConsent(e.target.checked)}
          label="J’accepte que mon profil soit publié de façon anonymisée dans le catalogue public d’E-MPGT."
          hint="Consentement explicite, horodaté et révocable à tout moment en repassant votre profil en « Privé »."
        />
      )}
      <FormError error={action.error} />
      <Button type="submit" loading={action.pending} disabled={!changed || (visibility === 'PUBLIC_ANONYMOUS' && !consent)}>
        Enregistrer la visibilité
      </Button>
    </form>
  );
}
