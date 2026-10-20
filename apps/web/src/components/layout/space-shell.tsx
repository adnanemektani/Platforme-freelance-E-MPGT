'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState, type ReactNode } from 'react';
import type { Space } from '@empgt/contracts';
import { labels } from '@empgt/contracts';
import { SPACE_HOME, useSession } from '@/lib/session';
import { Alert, LoadingBlock } from '@/components/ui/feedback';
import { buttonClass } from '@/components/ui/button';
import { Logo } from './logo';

export interface NavItem {
  href: string;
  label: string;
}

export const COMPANY_NAV: NavItem[] = [
  { href: '/entreprise', label: 'Tableau de bord' },
  { href: '/entreprise/organisation', label: 'Entreprise et membres' },
  { href: '/entreprise/missions', label: 'Mes missions' },
  { href: '/entreprise/candidatures', label: 'Candidatures' },
  { href: '/entreprise/propositions', label: 'Propositions' },
  { href: '/entreprise/contrats', label: 'Contrats' },
  { href: '/entreprise/cra', label: 'CRA à valider' },
  { href: '/entreprise/documents', label: 'Documents' },
  { href: '/entreprise/factures', label: 'Factures et règlements' },
  { href: '/entreprise/notifications', label: 'Notifications' },
  { href: '/entreprise/parametres', label: 'Paramètres' },
];

export const FREELANCER_NAV: NavItem[] = [
  { href: '/freelance', label: 'Tableau de bord' },
  { href: '/freelance/profil', label: 'Mon profil' },
  { href: '/freelance/disponibilites', label: 'Disponibilités' },
  { href: '/freelance/missions', label: 'Missions' },
  { href: '/freelance/candidatures', label: 'Candidatures' },
  { href: '/freelance/propositions', label: 'Propositions' },
  { href: '/freelance/contrats', label: 'Contrats' },
  { href: '/freelance/cra', label: 'Activité / CRA' },
  { href: '/freelance/documents', label: 'Documents' },
  { href: '/freelance/paiements', label: 'Factures et paiements' },
  { href: '/freelance/notifications', label: 'Notifications' },
  { href: '/freelance/parametres', label: 'Paramètres' },
];

export const ADMIN_NAV: NavItem[] = [
  { href: '/admin', label: 'Vue globale' },
  { href: '/admin/validations', label: 'Validations' },
  { href: '/admin/utilisateurs', label: 'Utilisateurs' },
  { href: '/admin/entreprises', label: 'Entreprises' },
  { href: '/admin/freelances', label: 'Freelances' },
  { href: '/admin/missions', label: 'Missions' },
  { href: '/admin/candidatures', label: 'Candidatures' },
  { href: '/admin/propositions', label: 'Propositions' },
  { href: '/admin/contrats', label: 'Contrats et avenants' },
  { href: '/admin/cra', label: 'CRA et litiges' },
  { href: '/admin/documents', label: 'Documents' },
  { href: '/admin/finance', label: 'Finance' },
  { href: '/admin/imports', label: 'Imports' },
  { href: '/admin/integration', label: 'Intégration' },
  { href: '/admin/contact', label: 'Demandes de contact' },
  { href: '/admin/parametres', label: 'Paramètres' },
  { href: '/admin/audit', label: 'Audit' },
];

const TITLES: Record<Space, string> = { company: 'Espace entreprise', freelancer: 'Espace freelance', admin: 'Administration E-MPGT' };

function isActive(pathname: string, href: string, root: string): boolean {
  return href === root ? pathname === root : pathname === href || pathname.startsWith(`${href}/`);
}

/**
 * Coquille des espaces connectés : vérifie la session côté navigateur pour l'affichage.
 * La sécurité réelle est appliquée par l'API, qui contrôle chaque requête.
 */
const NAVS: Record<Space, NavItem[]> = { company: COMPANY_NAV, freelancer: FREELANCER_NAV, admin: ADMIN_NAV };

export function SpaceShell({ space, children }: { space: Space; children: ReactNode }) {
  const nav = NAVS[space];
  const { user, loading, logout, unreadNotifications } = useSession();
  const pathname = usePathname();
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);
  const root = SPACE_HOME[space];

  useEffect(() => {
    if (!loading && !user) router.replace(`/connexion?suite=${encodeURIComponent(pathname)}`);
  }, [loading, user, router, pathname]);

  if (loading || !user) return <div className="p-8"><LoadingBlock label="Vérification de la session…" /></div>;

  if (user.space !== space) {
    return (
      <div className="mx-auto max-w-xl p-8">
        <Alert tone="warning" title="Espace non accessible">
          <p>Cet espace est réservé : {TITLES[space].toLowerCase()}. Votre compte relève de l’{TITLES[user.space].toLowerCase()}.</p>
          <Link href={SPACE_HOME[user.space]} className={`${buttonClass('primary', 'sm')} mt-3`}>
            Aller à mon espace
          </Link>
        </Alert>
      </div>
    );
  }

  const subtitle =
    space === 'company'
      ? user.company?.legalName
      : space === 'freelancer'
        ? user.freelancerProfile?.headline ?? 'Profil à compléter'
        : labels.role.PLATFORM_ADMIN;

  const navigation = (
    <nav aria-label={TITLES[space]} className="space-y-0.5">
      {nav.map((item) => {
        const active = isActive(pathname, item.href, root);
        const isNotifications = item.href.endsWith('/notifications');
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={() => setMenuOpen(false)}
            aria-current={active ? 'page' : undefined}
            className={`flex items-center justify-between rounded-md px-3 py-2 text-sm font-medium ${active ? 'bg-brand-700 text-white' : 'text-gray-700 hover:bg-brand-50 hover:text-brand-800'}`}
          >
            {item.label}
            {isNotifications && unreadNotifications > 0 && (
              <span className={`rounded-full px-1.5 text-xs ${active ? 'bg-white text-brand-800' : 'bg-red-600 text-white'}`} aria-label={`${unreadNotifications} non lues`}>
                {unreadNotifications}
              </span>
            )}
          </Link>
        );
      })}
    </nav>
  );

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="sticky top-0 z-30 border-b border-gray-200 bg-white">
        <div className="flex items-center justify-between gap-4 px-4 py-2.5">
          <div className="flex items-center gap-3">
            <button type="button" className="rounded-md p-2 text-gray-700 lg:hidden" aria-expanded={menuOpen} aria-controls="menu-espace" onClick={() => setMenuOpen((v) => !v)}>
              <span className="sr-only">Menu</span>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                <path d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
            <Logo href={root} compact />
            <div className="hidden leading-tight sm:block">
              <p className="text-sm font-semibold text-gray-900">{TITLES[space]}</p>
              <p className="max-w-xs truncate text-xs text-gray-600">{subtitle}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {user.isDemo && <span className="rounded bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-900">Données de démonstration</span>}
            <span className="hidden text-sm text-gray-700 md:inline">
              {user.firstName} {user.lastName}
            </span>
            <button
              type="button"
              className={buttonClass('secondary', 'sm')}
              onClick={async () => {
                await logout();
                router.replace('/connexion');
              }}
            >
              Se déconnecter
            </button>
          </div>
        </div>
      </header>
      <div className="flex">
        <aside className="hidden w-64 shrink-0 border-r border-gray-200 bg-white p-3 lg:block">{navigation}</aside>
        {menuOpen && (
          <div id="menu-espace" className="fixed inset-0 z-40 bg-gray-900/30 lg:hidden" onClick={() => setMenuOpen(false)}>
            <aside className="h-full w-72 overflow-y-auto bg-white p-3 shadow-xl" onClick={(e) => e.stopPropagation()}>
              {navigation}
            </aside>
          </div>
        )}
        <main id="contenu" className="min-w-0 flex-1 px-4 py-6 lg:px-8">
          <div className="mx-auto max-w-6xl">{children}</div>
        </main>
      </div>
    </div>
  );
}
