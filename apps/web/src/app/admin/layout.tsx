import { Suspense, type ReactNode } from 'react';
import { SpaceShell } from '@/components/layout/space-shell';
import { LoadingBlock } from '@/components/ui/feedback';

export default function Layout({ children }: { children: ReactNode }) {
  return (
    <Suspense fallback={<LoadingBlock />}>
      <SpaceShell space="admin">{children}</SpaceShell>
    </Suspense>
  );
}
