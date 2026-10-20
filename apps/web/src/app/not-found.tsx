import Link from 'next/link';
import { buttonClass } from '@/components/ui/button';

export default function NotFound() {
  return (
    <div className="mx-auto max-w-xl px-4 py-24 text-center">
      <p className="text-sm font-semibold text-brand-700">Erreur 404</p>
      <h1 className="mt-2 text-2xl font-bold text-gray-900">Page introuvable</h1>
      <p className="mt-2 text-gray-700">La page demandée n’existe pas ou n’est plus disponible.</p>
      <Link href="/" className={`${buttonClass('primary')} mt-6`}>Retour à l’accueil</Link>
    </div>
  );
}
