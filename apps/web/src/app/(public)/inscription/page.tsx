import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = { title: 'Créer un compte' };

export default function Page() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-12">
      <h1 className="text-2xl font-semibold text-gray-900">Créer un compte</h1>
      <p className="mt-1 text-gray-700">Choisissez votre espace.</p>
      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <Link href="/inscription/entreprise" className="rounded-xl border-2 border-brand-700 bg-white p-6 hover:bg-brand-50">
          <span className="block text-lg font-bold text-brand-800">Je suis une entreprise</span>
          <span className="mt-1 block text-sm text-gray-700">Publier des missions et suivre leur réalisation.</span>
        </Link>
        <Link href="/inscription/freelance" className="rounded-xl border-2 border-accent-700 bg-white p-6 hover:bg-accent-50">
          <span className="block text-lg font-bold text-accent-800">Je suis freelance</span>
          <span className="mt-1 block text-sm text-gray-700">Créer mon profil et candidater aux missions.</span>
        </Link>
      </div>
      <p className="mt-6 text-sm text-gray-600">L’administration E-MPGT ne fait l’objet d’aucune inscription publique.</p>
    </div>
  );
}
