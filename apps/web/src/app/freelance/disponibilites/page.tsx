'use client';

import type { OwnProfileView } from '@empgt/contracts';
import { useApi } from '@/lib/hooks';
import { Card } from '@/components/ui/card';
import { ResourceView } from '@/components/ui/feedback';
import { PageHeader } from '@/components/ui/page';
import { AvailabilityPeriods, AvailabilityStatusForm, RatePreferencesForm } from '@/components/freelancer/availability';

export default function FreelanceAvailabilityPage() {
  const profile = useApi<OwnProfileView>('/profile');

  return (
    <>
      <PageHeader
        title="Disponibilités"
        description="Votre disponibilité aide E-MPGT et les entreprises à vous proposer des missions adaptées. Vos préférences tarifaires restent privées."
      />
      <ResourceView resource={profile} loadingLabel="Chargement de vos disponibilités…">
        {(p) => (
          <div className="grid gap-6 lg:grid-cols-2">
            <Card title="Statut de disponibilité" description="Affiché sur votre profil et dans le catalogue si vous l’avez autorisé.">
              <AvailabilityStatusForm key={`${p.availabilityStatus}-${p.availableFrom ?? ''}`} profile={p} onSaved={profile.setData} />
            </Card>
            <Card title="Préférences tarifaires" description="Fourchette indicative, privée.">
              <RatePreferencesForm key={[p.rateMin, p.rateMax, p.rateUnit, p.rateCurrency, p.rateNote].join('|')} profile={p} onSaved={profile.setData} />
            </Card>
            <Card title="Périodes de disponibilité" description="Disponibilités, disponibilités partielles et indisponibilités datées." className="lg:col-span-2">
              <AvailabilityPeriods profile={p} onSaved={profile.setData} />
            </Card>
          </div>
        )}
      </ResourceView>
    </>
  );
}
