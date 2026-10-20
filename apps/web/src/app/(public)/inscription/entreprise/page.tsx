import type { Metadata } from 'next';
import { RegisterForm } from '@/components/shared/register-form';

export const metadata: Metadata = { title: 'Inscription entreprise' };

export default function Page() {
  return <RegisterForm kind="company" />;
}
