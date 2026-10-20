'use client';

import { useRouter } from 'next/navigation';
import type { MissionView } from '@empgt/contracts';
import { api } from '@/lib/api';
import { useAction } from '@/lib/hooks';
import { Alert } from '@/components/ui/feedback';
import { PageHeader } from '@/components/ui/page';
import { breadcrumbRoot } from '@/components/company/display';
import { MissionForm } from '@/components/company/mission-form';

export default function NouvelleMissionPage() {
  const router = useRouter();
  const action = useAction();

  return (
    <>
      <PageHeader
        title="Nouvelle mission"
        description="La mission est enregistrée en brouillon : vous pourrez la compléter, puis la soumettre à la validation d’E-MPGT avant sa publication."
        breadcrumbs={[
          breadcrumbRoot,
          { label: 'Mes missions', href: '/entreprise/missions' },
          { label: 'Nouvelle mission' },
        ]}
      />
      <div className="space-y-6">
        <Alert tone="info" title="Une mission = un poste">
          Chaque mission aboutit au recrutement d’un seul freelance. Pour plusieurs postes (même
          identiques), créez une mission par poste.
        </Alert>
        <MissionForm
          submitLabel="Créer la mission (brouillon)"
          pending={action.pending}
          error={action.error}
          onCancel={() => router.push('/entreprise/missions')}
          onSubmit={async (input) => {
            const mission = await action.run(() => api.post<MissionView>('/missions', input), {
              success: 'Mission créée en brouillon',
            });
            if (mission) router.push(`/entreprise/missions/${mission.id}`);
          }}
        />
      </div>
    </>
  );
}
