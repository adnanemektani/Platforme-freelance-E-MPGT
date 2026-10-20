import Link from 'next/link';

/** Logo officiel E-MPGT (provenance : docs/brand/PROVENANCE.md). */
export function Logo({ href = '/', compact = false }: { href?: string; compact?: boolean }) {
  return (
    <Link href={href} className="flex items-center gap-2" aria-label="Plateforme Freelance E-MPGT — accueil">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/brand/logo-empgt.jpg" alt="" width={44} height={42} className="h-10 w-auto rounded" />
      {!compact && (
        <span className="leading-tight">
          <span className="block text-sm font-bold text-brand-800">E-MPGT</span>
          <span className="block text-xs text-gray-600">Plateforme Freelance BTP</span>
        </span>
      )}
    </Link>
  );
}
