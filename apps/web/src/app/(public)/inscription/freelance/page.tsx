import type { Metadata } from 'next';
import { RegisterForm } from '@/components/shared/register-form';

export const metadata: Metadata = { title: 'Inscription freelance' };

export default function Page() {
  return <RegisterForm kind="freelancer" />;
}
