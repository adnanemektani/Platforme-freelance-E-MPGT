'use client';

import { useState } from 'react';
import { labels, type OwnProfileView } from '@empgt/contracts';
import { useApi } from '@/lib/hooks';
import { useSession } from '@/lib/session';
import { ActionButton } from '@/components/ui/actions';
import { StatusBadge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { ResourceView } from '@/components/ui/feedback';
import { PageHeader, Tabs } from '@/components/ui/page';
import { ProfileDocuments } from '@/components/freelancer/profile/documents';
import { EducationsSection } from '@/components/freelancer/profile/educations';
import { ExperiencesSection } from '@/components/freelancer/profile/experiences';
import { GeneralForm } from '@/components/freelancer/profile/general-form';
import { LanguagesEditor } from '@/components/freelancer/profile/languages';
import { PublicationSection } from '@/components/freelancer/profile/publication';
import { QualificationsSection } from '@/components/freelancer/profile/qualifications';
import { SkillsEditor } from '@/components/freelancer/profile/skills-editor';
import { ProfileStatusBanner } from '@/components/freelancer/profile/status-banner';

type TabId = 'general' | 'skills' | 'experiences' | 'educations' | 'languages' | 'qualifications' | 'documents' | 'publication';

function ProfileContent({ profile, onSaved }: { profile: OwnProfileView; onSaved: (p: OwnProfileView) => void }) {
  const [tab, setTab] = useState<TabId>('general');
  const tabs: Array<{ id: TabId; label: string; count?: number }> = [
    { id: 'general', label: 'Informations générales' },
    { id: 'skills', label: 'Compétences et logiciels', count: profile.skills.length },
    { id: 'experiences', label: 'Expériences', count: profile.experiences.length },
    { id: 'educations', label: 'Formations', count: profile.educations.length },
    { id: 'languages', label: 'Langues', count: profile.languages.length },
    { id: 'qualifications', label: 'Qualifications', count: profile.qualifications.length },
    { id: 'documents', label: 'Documents' },
    { id: 'publication', label: 'Visibilité' },
  ];
  const section = {
    general: { title: 'Informations générales', description: 'Titre, résumé, localisation, mobilité, modalités d’intervention et statut juridique.' },
    skills: { title: 'Compétences et logiciels', description: 'Métiers, techniques, logiciels (Revit, AutoCAD, MS Project…) et domaines d’expertise.' },
    experiences: { title: 'Expériences', description: 'Missions et postes significatifs, du plus récent au plus ancien.' },
    educations: { title: 'Formations', description: 'Diplômes et formations qualifiantes.' },
    languages: { title: 'Langues', description: 'Langues de travail et niveau.' },
    qualifications: { title: 'Qualifications et habilitations', description: 'Déclarées par vous, vérifiées par E-MPGT sur justificatif.' },
    documents: { title: 'Documents du profil', description: 'CV, attestation d’assurance, attestation fiscale / sociale, pièce d’identité.' },
    publication: { title: 'Visibilité dans le catalogue', description: 'Publication anonymisée, uniquement avec votre consentement explicite.' },
  }[tab];

  return (
    <div className="space-y-6">
      <ProfileStatusBanner profile={profile} />
      <div>
        <Tabs tabs={tabs} current={tab} onChange={(id) => setTab(id as TabId)} />
        <Card title={section.title} description={section.description}>
          {tab === 'general' && (
            <GeneralForm
              key={JSON.stringify([
                profile.headline,
                profile.summary,
                profile.yearsOfExperience,
                profile.city,
                profile.region,
                profile.country,
                profile.mobility,
                profile.mobilityNote,
                profile.workModes,
                profile.businessStatus,
              ])}
              profile={profile}
              onSaved={onSaved}
            />
          )}
          {tab === 'skills' && <SkillsEditor profile={profile} onSaved={onSaved} />}
          {tab === 'experiences' && <ExperiencesSection profile={profile} onSaved={onSaved} />}
          {tab === 'educations' && <EducationsSection profile={profile} onSaved={onSaved} />}
          {tab === 'languages' && <LanguagesEditor profile={profile} onSaved={onSaved} />}
          {tab === 'qualifications' && <QualificationsSection profile={profile} onSaved={onSaved} />}
          {tab === 'documents' && <ProfileDocuments profileId={profile.id} />}
          {tab === 'publication' && <PublicationSection profile={profile} onSaved={onSaved} />}
        </Card>
      </div>
    </div>
  );
}

export default function FreelanceProfilePage() {
  const profile = useApi<OwnProfileView>('/profile');
  const { refresh } = useSession();
  const onSaved = (view: OwnProfileView) => {
    profile.setData(view);
    void refresh();
  };

  return (
    <ResourceView resource={profile} loadingLabel="Chargement du profil…">
      {(p) => (
        <>
          <PageHeader
            title="Mon profil"
            description={p.headline ?? 'Profil à compléter'}
            badge={<StatusBadge status={p.validationStatus} label={labels.profileValidation[p.validationStatus]} />}
            actions={
              <ActionButton<OwnProfileView>
                actions={p.actions}
                action="submit"
                label="Soumettre à E-MPGT"
                endpoint="/profile/submit"
                confirm={{
                  title: 'Soumettre votre profil à E-MPGT',
                  message: 'E-MPGT va examiner votre profil. Vous serez notifié de sa décision ; la candidature aux missions est possible après validation.',
                  confirmLabel: 'Soumettre',
                }}
                success="Profil soumis à E-MPGT"
                onDone={onSaved}
              />
            }
          />
          <ProfileContent profile={p} onSaved={onSaved} />
        </>
      )}
    </ResourceView>
  );
}
