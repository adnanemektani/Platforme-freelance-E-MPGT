'use client';

import Link from 'next/link';
import { useState, type ReactNode } from 'react';
import { SPACE_HOME, useSession } from '@/lib/session';
import { buttonClass } from '@/components/ui/button';
import { Logo } from './logo';

const NAV = [
  { href: '/fonctionnement', label: 'Fonctionnement' },
  { href: '/profils', label: 'Profils' },
  { href: '/entreprises', label: 'Entreprises' },
  { href: '/freelances', label: 'Freelances' },
  { href: '/contact', label: 'Contact' },
];

function SessionLinks() {
  const { user, loading } = useSession();
  if (loading) return <span className="h-9 w-32" aria-hidden="true" />;
  if (user) {
    return (
      <Link href={SPACE_HOME[user.space]} className={buttonClass('primary', 'sm')}>
        Mon espace
      </Link>
    );
  }
  return (
    <>
      <Link href="/connexion" className={buttonClass('ghost', 'sm')}>
        Se connecter
      </Link>
      <Link href="/inscription" className={buttonClass('primary', 'sm')}>
        Créer un compte
      </Link>
    </>
  );
}

export function PublicLayout({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="flex min-h-screen flex-col bg-white">
      <header className="border-b border-gray-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3">
          <Logo />
          <nav aria-label="Navigation principale" className="hidden items-center gap-1 lg:flex">
            {NAV.map((item) => (
              <Link key={item.href} href={item.href} className="rounded-md px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 hover:text-brand-800">
                {item.label}
              </Link>
            ))}
          </nav>
          <div className="hidden items-center gap-2 lg:flex">
            <SessionLinks />
          </div>
          <button type="button" className="rounded-md p-2 text-gray-700 lg:hidden" aria-expanded={open} aria-controls="menu-mobile" onClick={() => setOpen((v) => !v)}>
            <span className="sr-only">Menu</span>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <path d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
        </div>
        {open && (
          <nav id="menu-mobile" aria-label="Navigation principale" className="space-y-1 border-t border-gray-100 px-4 py-3 lg:hidden">
            {NAV.map((item) => (
              <Link key={item.href} href={item.href} className="block rounded-md px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50" onClick={() => setOpen(false)}>
                {item.label}
              </Link>
            ))}
            <div className="flex gap-2 pt-2">
              <SessionLinks />
            </div>
          </nav>
        )}
      </header>
      <main id="contenu" className="flex-1">
        {children}
      </main>
      <footer className="border-t border-gray-200 bg-gray-50">
        <div className="mx-auto grid max-w-6xl gap-6 px-4 py-8 text-sm text-gray-600 sm:grid-cols-3">
          <div>
            <Logo />
            <p className="mt-2">Mise en relation des freelances du BTP et des entreprises, avec la validation d’E-MPGT.</p>
          </div>
          <nav aria-label="Liens utiles" className="space-y-1">
            <Link href="/fonctionnement" className="block hover:underline">Fonctionnement</Link>
            <Link href="/profils" className="block hover:underline">Profils disponibles</Link>
            <Link href="/contact" className="block hover:underline">Contact</Link>
          </nav>
          <nav aria-label="Informations légales" className="space-y-1">
            <Link href="/mentions-legales" className="block hover:underline">Mentions légales</Link>
            <Link href="/confidentialite" className="block hover:underline">Politique de confidentialité</Link>
            <Link href="/cgu" className="block hover:underline">Conditions d’utilisation</Link>
          </nav>
        </div>
      </footer>
    </div>
  );
}
