'use client';

import { Legal, LegalPage } from '@/components/shared/legal-page';

export default function Page() {
  return (
    <LegalPage title="Mentions légales">
      {(l) => (
        <>
          <h2 className="text-lg font-semibold">Éditeur du site</h2>
          <p>
            Société exploitante : <Legal value={l.operatorName} missing="raison sociale de la société exploitante (décision D-01)" />
            <br />
            Forme juridique : <Legal value={l.operatorLegalForm} missing="forme juridique" />
            <br />
            Immatriculation : <Legal value={l.operatorRegistration} missing="numéro d’immatriculation" />
            <br />
            Siège : <Legal value={l.operatorAddress} missing="adresse du siège" /> — <Legal value={l.operatorCountry} missing="pays" />
          </p>
          <p>
            Directeur de la publication : <Legal value={l.publicationDirector} missing="directeur de la publication" />
            <br />
            Contact : <Legal value={l.contactEmail} missing="adresse de contact" />
          </p>
          <h2 className="text-lg font-semibold">Hébergement</h2>
          <p>
            <Legal value={l.hostingProvider} missing="nom, adresse et contact de l’hébergeur" />
          </p>
          <h2 className="text-lg font-semibold">Propriété intellectuelle</h2>
          <p>Le logo E-MPGT est la propriété de son titulaire. Les profils publiés le sont avec l’accord explicite des freelances concernés.</p>
        </>
      )}
    </LegalPage>
  );
}
