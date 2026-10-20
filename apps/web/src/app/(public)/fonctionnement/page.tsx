import type { Metadata } from 'next';
import Link from 'next/link';
import { buttonClass } from '@/components/ui/button';

export const metadata: Metadata = { title: 'Fonctionnement' };

const RULES = [
  'Vérification de l’adresse e-mail pour tous les comptes.',
  'Validation du profil freelance par E-MPGT avant toute candidature et toute publication dans le catalogue.',
  'Vérification de l’entreprise par E-MPGT avant la publication de sa première mission.',
  'Validation de chaque mission par E-MPGT avant qu’elle soit visible des freelances.',
];

export default function FonctionnementPage() {
  return (
    <div className="mx-auto max-w-4xl space-y-10 px-4 py-12">
      <header>
        <h1 className="text-3xl font-bold text-gray-900">Fonctionnement de la plateforme</h1>
        <p className="mt-2 text-gray-700">Chaque étape est validée explicitement : rien n’est publié, contractualisé ou réglé sans action tracée.</p>
      </header>

      <section>
        <h2 className="text-xl font-semibold text-gray-900">Règles de validation (politique initiale V1)</h2>
        <ul className="mt-3 list-disc space-y-1 pl-6 text-gray-700">
          {RULES.map((r) => (
            <li key={r}>{r}</li>
          ))}
        </ul>
        <p className="mt-2 text-sm text-gray-600">Pendant les validations, chacun peut préparer ses informations et ses brouillons. Cette politique est susceptible d’évoluer.</p>
      </section>

      <section className="grid gap-6 md:grid-cols-2">
        <div className="rounded-lg border border-gray-200 bg-white p-5">
          <h2 className="text-lg font-semibold text-brand-800">Côté entreprise</h2>
          <ol className="mt-3 list-decimal space-y-1 pl-5 text-sm text-gray-700">
            <li>Créer le compte et confirmer l’adresse e-mail.</li>
            <li>Renseigner l’entreprise et demander sa vérification.</li>
            <li>Préparer les missions (une mission = un poste) et les soumettre.</li>
            <li>Examiner les candidatures, présélectionner, retenir un candidat.</li>
            <li>Accepter la proposition commerciale préparée par E-MPGT.</li>
            <li>Après dépôt du contrat signé : valider les CRA, consulter factures et règlements.</li>
          </ol>
        </div>
        <div className="rounded-lg border border-gray-200 bg-white p-5">
          <h2 className="text-lg font-semibold text-accent-800">Côté freelance</h2>
          <ol className="mt-3 list-decimal space-y-1 pl-5 text-sm text-gray-700">
            <li>Créer le compte et confirmer l’adresse e-mail.</li>
            <li>Compléter le profil (expériences, compétences, logiciels, formations, langues, disponibilités).</li>
            <li>Soumettre le profil à la validation d’E-MPGT.</li>
            <li>Rechercher les missions publiées et candidater.</li>
            <li>Accepter la proposition commerciale ; la mission démarre après dépôt du contrat signé.</li>
            <li>Déclarer ses heures (CRA), déposer ses factures, suivre ses règlements.</li>
          </ol>
        </div>
      </section>

      <section className="space-y-2 text-sm text-gray-700">
        <h2 className="text-xl font-semibold text-gray-900">Bon à savoir</h2>
        <p>La retenue d’un candidat n’active pas la mission : un contrat signé et les validations nécessaires sont requis.</p>
        <p>La plateforme n’intègre pas de signature électronique : le contrat signé est déposé avec sa date et sa preuve de signature.</p>
        <p>Les règlements sont suivis manuellement : la plateforme ne déclenche aucun virement et n’affiche un règlement que lorsqu’il a été enregistré avec sa référence et son justificatif.</p>
      </section>

      <div className="flex flex-wrap gap-3">
        <Link href="/inscription/entreprise" className={buttonClass('primary')}>Créer un compte entreprise</Link>
        <Link href="/inscription/freelance" className={buttonClass('success')}>Créer un compte freelance</Link>
      </div>
    </div>
  );
}
