import type { ReactNode } from 'react';

type Tone = 'gray' | 'blue' | 'green' | 'amber' | 'red' | 'purple';

const TONES: Record<Tone, string> = {
  gray: 'bg-gray-100 text-gray-800 ring-gray-200',
  blue: 'bg-brand-50 text-brand-800 ring-brand-200',
  green: 'bg-accent-50 text-accent-800 ring-accent-100',
  amber: 'bg-amber-50 text-amber-900 ring-amber-200',
  red: 'bg-red-50 text-red-800 ring-red-200',
  purple: 'bg-purple-50 text-purple-800 ring-purple-200',
};

export function Badge({ tone = 'gray', children }: { tone?: Tone; children: ReactNode }) {
  return <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${TONES[tone]}`}>{children}</span>;
}

// Couleur d'un statut : le libellé vient toujours des libellés partagés (@empgt/contracts).
const STATUS_TONES: Record<string, Tone> = {
  DRAFT: 'gray',
  NOT_SUBMITTED: 'gray',
  PENDING_VERIFICATION: 'amber',
  PENDING: 'amber',
  PENDING_REVIEW: 'amber',
  SUBMITTED: 'amber',
  SENT: 'amber',
  AWAITING_SIGNATURE: 'amber',
  CHANGES_REQUESTED: 'amber',
  SHORTLISTED: 'blue',
  PARTIES_AGREED: 'blue',
  SIGNED: 'blue',
  SELECTION: 'blue',
  OPEN: 'blue',
  PARTIALLY_PAID: 'blue',
  ACTIVE: 'green',
  APPROVED: 'green',
  VERIFIED: 'green',
  PUBLISHED: 'green',
  SELECTED: 'green',
  ACCEPTED: 'green',
  PAID: 'green',
  RECORDED: 'green',
  COMPLETED: 'green',
  AVAILABLE_NOW: 'green',
  MANUAL_CONFIRMED: 'green',
  RESOLVED: 'green',
  REJECTED: 'red',
  DECLINED: 'red',
  SUSPENDED: 'red',
  CANCELLED: 'red',
  TERMINATED: 'red',
  DISABLED: 'red',
  UNPAID: 'gray',
  WITHDRAWN: 'gray',
  CLOSED: 'gray',
  SUPERSEDED: 'purple',
  UNPUBLISHED: 'purple',
  OPEN_DISPUTE: 'red',
};

export function StatusBadge({ status, label }: { status: string; label: string }) {
  return <Badge tone={STATUS_TONES[status] ?? 'gray'}>{label}</Badge>;
}
