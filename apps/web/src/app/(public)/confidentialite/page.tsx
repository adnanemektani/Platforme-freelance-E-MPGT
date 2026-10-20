'use client';

import { Legal, LegalPage } from '@/components/shared/legal-page';

export default function Page() {
  return (
    <LegalPage title="Politique de confidentialité">
      {(l) => (
        <>
          <p>
            Responsable du traitement : <Legal value={l.operatorName} missing="société exploitante (décision D-01)" />. Contact pour vos données :{' '}
            <Legal value={l.dataProtectionContact} missing="contact données personnelles / DPO" />.
          </p>
          <h2 className="text-lg font-semibold">Données traitées et finalités</h2>
          <ul className="list-disc pl-6">
            <li>Compte : identité, adresse e-mail, téléphone facultatif — gestion de l’accès et des notifications.</li>
            <li>Profil freelance : parcours, compétences, disponibilités — examen par E-MPGT et mise en relation.</li>
            <li>Entreprise : informations légales et contacts — vérification et contractualisation.</li>
            <li>Missions, candidatures, contrats, CRA, factures et règlements — exécution des missions.</li>
            <li>Journal d’audit et sessions (adresse IP tronquée) — sécurité et traçabilité des décisions.</li>
          </ul>
          <h2 className="text-lg font-semibold">Ce que la plateforme ne fait pas</h2>
          <ul className="list-disc pl-6">
            <li>Aucune coordonnée bancaire n’est collectée sur la plateforme en V1.</li>
            <li>Les documents sont privés par défaut : une entreprise ne voit pas automatiquement les documents d’un freelance.</li>
            <li>Un profil n’apparaît dans le catalogue public qu’avec votre consentement explicite, sous forme anonymisée, et vous pouvez le retirer à tout moment.</li>
          </ul>
          <h2 className="text-lg font-semibold">Conservation</h2>
          <p>
            <Legal value={null} missing="durées de conservation par catégorie de données (décision D-17)" />
          </p>
          <h2 className="text-lg font-semibold">Vos droits</h2>
          <p>
            Vous pouvez demander l’accès, la rectification ou l’effacement de vos données, dans les limites des obligations légales de conservation, auprès de :{' '}
            <Legal value={l.dataProtectionContact ?? l.contactEmail} missing="adresse de contact" />.
          </p>
        </>
      )}
    </LegalPage>
  );
}
