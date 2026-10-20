import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';
import { Providers } from '@/components/layout/providers';
import './globals.css';

export const metadata: Metadata = {
  title: { default: 'Plateforme Freelance E-MPGT', template: '%s — Plateforme Freelance E-MPGT' },
  description:
    'Plateforme B2B de mise en relation entre freelances du BTP et entreprises : missions, candidatures, contrats, CRA et suivi des règlements.',
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#1f3a8a',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="fr" className="h-full">
      <body className="min-h-full font-sans antialiased">
        <a href="#contenu" className="skip-link">
          Aller au contenu
        </a>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
