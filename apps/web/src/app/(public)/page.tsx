import Link from 'next/link';
import { buttonClass } from '@/components/ui/button';

const STEPS = [
  ['Inscription et vérification', 'Chaque compte confirme son adresse e-mail. E-MPGT vérifie les entreprises et valide les profils freelances.'],
  ['Missions validées', 'Les entreprises préparent leurs missions ; E-MPGT les valide avant qu’elles soient visibles des freelances.'],
  ['Candidature et sélection', 'Les freelances validés candidatent ; l’entreprise présélectionne et retient un candidat par poste.'],
  ['Proposition et contrat', 'E-MPGT prépare la proposition commerciale ; après accord des deux parties, le contrat signé est déposé.'],
  ['Activité et CRA', 'Le freelance déclare ses heures ; l’entreprise valide le compte rendu d’activité ou demande une correction.'],
  ['Factures et règlements', 'Les factures sont déposées et les règlements enregistrés avec leur justificatif : chacun suit l’état de ses paiements.'],
];

export default function HomePage() {
  return (
    <>
      <section className="bg-gradient-to-b from-brand-50 to-white">
        <div className="mx-auto max-w-6xl px-4 py-14 sm:py-20">
          <p className="text-sm font-semibold uppercase tracking-wide text-accent-700">Plateforme Freelance E-MPGT</p>
          <h1 className="mt-2 max-w-3xl text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl">
            Les freelances du BTP et les entreprises qui leur confient des missions, sur une seule plateforme.
          </h1>
          <p className="mt-4 max-w-2xl text-lg text-gray-700">
            Ingénieurs travaux, conducteurs de travaux, chefs de projet, MOE / MOEX / OPC, BIM, économistes, coordinateurs SPS / QSE… De la publication de la mission au suivi des règlements.
          </p>
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:max-w-3xl">
            <Link href="/entreprises" className="group rounded-xl border-2 border-brand-700 bg-white p-6 shadow-sm transition hover:bg-brand-700 hover:text-white">
              <span className="block text-xl font-bold text-brand-800 group-hover:text-white">Je suis une entreprise</span>
              <span className="mt-1 block text-sm text-gray-700 group-hover:text-brand-50">Publiez vos besoins, recevez des candidatures, suivez contrats, CRA et factures.</span>
            </Link>
            <Link href="/freelances" className="group rounded-xl border-2 border-accent-700 bg-white p-6 shadow-sm transition hover:bg-accent-700 hover:text-white">
              <span className="block text-xl font-bold text-accent-800 group-hover:text-white">Je suis freelance</span>
              <span className="mt-1 block text-sm text-gray-700 group-hover:text-accent-50">Créez votre profil, candidatez aux missions validées, déclarez votre activité.</span>
            </Link>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-14">
        <h2 className="text-2xl font-semibold text-gray-900">Comment ça marche</h2>
        <ol className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {STEPS.map(([title, text], i) => (
            <li key={title} className="rounded-lg border border-gray-200 bg-white p-5">
              <span className="text-sm font-bold text-accent-700">Étape {i + 1}</span>
              <p className="mt-1 font-semibold text-gray-900">{title}</p>
              <p className="mt-1 text-sm text-gray-700">{text}</p>
            </li>
          ))}
        </ol>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link href="/fonctionnement" className={buttonClass('secondary')}>En savoir plus</Link>
          <Link href="/profils" className={buttonClass('ghost')}>Voir les profils publiés</Link>
        </div>
      </section>
    </>
  );
}
