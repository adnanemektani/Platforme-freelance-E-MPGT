import type { Metadata } from 'next';
import Link from 'next/link';
import { buttonClass } from '@/components/ui/button';

export const metadata: Metadata = { title: 'Je suis une entreprise' };

const FEATURES = [
  ['Missions validées', 'Créez vos missions en autonomie ; E-MPGT en vérifie la qualité avant publication.'],
  ['Candidatures', 'Consultez les profils professionnels des candidats, présélectionnez et retenez.'],
  ['Contrats et avenants', 'Conditions figées dans le contrat, avenants tracés, contrat signé archivé.'],
  ['CRA', 'Validez les comptes rendus d’activité ou demandez une correction motivée.'],
  ['Factures et règlements', 'Factures disponibles en ligne, échéances et état des règlements.'],
  ['Équipe', 'Le créateur du compte est responsable de son organisation et peut inviter des collègues.'],
];

export default function EntreprisesPage() {
  return (
    <div className="mx-auto max-w-5xl space-y-10 px-4 py-12">
      <header className="space-y-3">
        <h1 className="text-3xl font-bold text-gray-900">Je suis une entreprise</h1>
        <p className="max-w-2xl text-gray-700">
          Entreprises générales, maîtres d’ouvrage, cabinets d’ingénierie : confiez vos missions BTP à des freelances dont le profil a été validé par E-MPGT.
        </p>
        <div className="flex flex-wrap gap-3">
          <Link href="/inscription/entreprise" className={buttonClass('primary')}>Créer un compte entreprise</Link>
          <Link href="/connexion" className={buttonClass('secondary')}>J’ai déjà un compte</Link>
        </div>
      </header>
      <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {FEATURES.map(([title, text]) => (
          <li key={title} className="rounded-lg border border-gray-200 bg-white p-5">
            <p className="font-semibold text-brand-800">{title}</p>
            <p className="mt-1 text-sm text-gray-700">{text}</p>
          </li>
        ))}
      </ul>
      <p className="text-sm text-gray-600">
        Votre entreprise doit être vérifiée par E-MPGT avant la publication de votre première mission. Vous pouvez préparer vos missions dès l’inscription.
      </p>
    </div>
  );
}
