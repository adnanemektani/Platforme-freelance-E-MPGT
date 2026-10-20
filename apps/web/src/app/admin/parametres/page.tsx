'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import { SettingsPage } from '@/components/shared/settings-page';
import { LoadingBlock } from '@/components/ui/feedback';
import { PageHeader, Tabs } from '@/components/ui/page';
import { ASettingsForm } from '@/components/admin/a-settings-form';

export default function ParametresPage() {
  return (
    <Suspense fallback={<LoadingBlock />}>
      <ParametresContent />
    </Suspense>
  );
}

function ParametresContent() {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const tab = params.get('onglet') === 'compte' ? 'compte' : 'plateforme';

  return (
    <>
      <Tabs
        current={tab}
        onChange={(id) => router.replace(id === 'compte' ? `${pathname}?onglet=compte` : pathname)}
        tabs={[
          { id: 'plateforme', label: 'Paramètres de la plateforme' },
          { id: 'compte', label: 'Mon compte' },
        ]}
      />
      {tab === 'compte' ? (
        <SettingsPage />
      ) : (
        <>
          <PageHeader
            title="Paramètres de la plateforme"
            description="Politique de validation, affichage, commission, informations légales et partage avec le Knowledge Graph. Chaque modification exige un motif et est tracée."
          />
          <ASettingsForm />
        </>
      )}
    </>
  );
}
