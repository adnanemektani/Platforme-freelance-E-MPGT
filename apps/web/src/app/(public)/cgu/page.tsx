'use client';

import { Legal, LegalPage } from '@/components/shared/legal-page';

export default function Page() {
  return (
    <LegalPage title="Conditions d’utilisation">
      {(l) => (
        <>
          <p>
            La plateforme est exploitée par <Legal value={l.operatorName} missing="société exploitante (décision D-01)" />. Les présentes conditions sont une base de
            travail : leur rédaction définitive, notamment les conditions commerciales, doit être validée par E-MPGT.
          </p>
          <h2 className="text-lg font-semibold">Comptes</h2>
          <ul className="list-disc pl-6">
            <li>Chaque utilisateur confirme son adresse e-mail et protège son mot de passe.</li>
            <li>Les profils freelances sont validés par E-MPGT avant toute candidature ; les entreprises sont vérifiées avant la publication de leur première mission ; les missions sont validées avant publication.</li>
            <li>Aucun utilisateur ne peut s’attribuer de droits d’administration.</li>
          </ul>
          <h2 className="text-lg font-semibold">Missions et contrats</h2>
          <ul className="list-disc pl-6">
            <li>Une mission correspond à un poste à pourvoir.</li>
            <li>La retenue d’un candidat n’engage pas la mission : un contrat signé, déposé sur la plateforme, est nécessaire.</li>
            <li>Les conditions d’un contrat sont figées ; toute évolution passe par un avenant.</li>
          </ul>
          <h2 className="text-lg font-semibold">Commission, facturation et règlements</h2>
          <p>
            <Legal value={null} missing="politique de commission, émetteur des factures, délais et modalités de règlement (décisions D-04 à D-10)" />
          </p>
          <p>La plateforme ne réalise aucun mouvement d’argent : les règlements sont enregistrés par E-MPGT avec leur justificatif.</p>
        </>
      )}
    </LegalPage>
  );
}
