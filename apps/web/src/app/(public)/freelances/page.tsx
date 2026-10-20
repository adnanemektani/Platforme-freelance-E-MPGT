import type { Metadata } from 'next';
import Link from 'next/link';
import { buttonClass } from '@/components/ui/button';

export const metadata: Metadata = { title: 'Je suis freelance' };

const FEATURES = [
  ['Profil complet', 'Expériences, compétences, logiciels, formations, langues, mobilité et modalités d’intervention.'],
  ['Disponibilités', 'Indiquez quand vous êtes disponible et vos préférences tarifaires (privées).'],
  ['Missions', 'Recherchez et filtrez les missions validées par E-MPGT, candidatez en quelques clics.'],
  ['Contrats', 'Consultez propositions et contrats ; seules les conditions qui vous concernent sont affichées.'],
  ['CRA', 'Déclarez vos heures par date, soumettez votre compte rendu et suivez les corrections.'],
  ['Paiements', 'Déposez vos factures et suivez vos échéances et règlements enregistrés.'],
];

export default function FreelancesPage() {
  return (
    <div className="mx-auto max-w-5xl space-y-10 px-4 py-12">
      <header className="space-y-3">
        <h1 className="text-3xl font-bold text-gray-900">Je suis freelance</h1>
        <p className="max-w-2xl text-gray-700">
          Ingénieurs, conducteurs de travaux, chefs de projet, MOE / MOEX / OPC, BIM, géomètres, économistes, coordinateurs SPS / QSE : accédez aux missions BTP publiées par des entreprises vérifiées.
        </p>
        <div className="flex flex-wrap gap-3">
          <Link href="/inscription/freelance" className={buttonClass('success')}>Créer mon compte freelance</Link>
          <Link href="/connexion" className={buttonClass('secondary')}>J’ai déjà un compte</Link>
        </div>
      </header>
      <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {FEATURES.map(([title, text]) => (
          <li key={title} className="rounded-lg border border-gray-200 bg-white p-5">
            <p className="font-semibold text-accent-800">{title}</p>
            <p className="mt-1 text-sm text-gray-700">{text}</p>
          </li>
        ))}
      </ul>
      <p className="text-sm text-gray-600">
        Votre profil est examiné par E-MPGT avant de pouvoir candidater. Il n’apparaît dans le catalogue public que si vous le décidez, sous forme anonymisée.
      </p>
    </div>
  );
}
