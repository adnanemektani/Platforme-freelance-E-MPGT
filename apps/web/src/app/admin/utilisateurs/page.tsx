'use client';

import Link from 'next/link';
import { useState } from 'react';
import {
  labels,
  RoleCode,
  UserStatus,
  type AdminUserListItem,
  type MessageResponse,
  type Page,
} from '@empgt/contracts';
import { qs } from '@/lib/api';
import { formatDate, formatDateTime } from '@/lib/format';
import { useApi } from '@/lib/hooks';
import { ActionButton } from '@/components/ui/actions';
import { Badge, StatusBadge } from '@/components/ui/badge';
import { Alert, ResourceView } from '@/components/ui/feedback';
import { Field, Input, optionsFrom, Select } from '@/components/ui/form';
import { PageHeader } from '@/components/ui/page';
import { DataTable, Pagination } from '@/components/ui/table';
import { AFilterForm } from '@/components/admin/a-shared';

const EMPTY = { role: '', status: '', q: '' };

export default function UtilisateursPage() {
  const [filters, setFilters] = useState(EMPTY);
  const [applied, setApplied] = useState(EMPTY);
  const [page, setPage] = useState(1);
  const list = useApi<Page<AdminUserListItem>>(`/admin/users${qs({ ...applied, page })}`);
  const reload = () => void list.reload();

  return (
    <>
      <PageHeader
        title="Utilisateurs"
        description="Comptes de la plateforme : rôle, état, vérification de l’adresse e-mail et dernière connexion."
      />
      <div className="mb-4">
        <Alert tone="info" title="Comptes d’administration">
          La création d’un compte d’administration E-MPGT se fait en ligne de commande sur le
          serveur (<code className="font-mono">pnpm admin:create</code>), jamais depuis l’interface.
          Les comptes d’administration ne peuvent pas être suspendus ici.
        </Alert>
      </div>
      <AFilterForm
        onSubmit={() => {
          setPage(1);
          setApplied(filters);
        }}
        onReset={() => {
          setFilters(EMPTY);
          setApplied(EMPTY);
          setPage(1);
        }}
      >
        <Field label="Recherche">
          {(p) => (
            <Input
              {...p}
              placeholder="Nom, prénom, e-mail…"
              value={filters.q}
              onChange={(e) => setFilters({ ...filters, q: e.target.value })}
            />
          )}
        </Field>
        <Field label="Rôle">
          {(p) => (
            <Select
              {...p}
              value={filters.role}
              placeholder="Tous les rôles"
              options={optionsFrom(RoleCode, labels.role)}
              onChange={(e) => setFilters({ ...filters, role: e.target.value })}
            />
          )}
        </Field>
        <Field label="État">
          {(p) => (
            <Select
              {...p}
              value={filters.status}
              placeholder="Tous les états"
              options={optionsFrom(UserStatus, labels.userStatus)}
              onChange={(e) => setFilters({ ...filters, status: e.target.value })}
            />
          )}
        </Field>
      </AFilterForm>

      <ResourceView resource={list} loadingLabel="Chargement des utilisateurs…">
        {(data) => (
          <>
            <DataTable
              rows={data.items}
              rowKey={(u) => u.id}
              caption="Utilisateurs"
              empty={{
                title: 'Aucun utilisateur ne correspond',
                description: 'Modifiez les filtres pour élargir la recherche.',
              }}
              columns={[
                {
                  header: 'Utilisateur',
                  cell: (u) => (
                    <span className="block">
                      <span className="flex flex-wrap items-center gap-1.5 font-medium text-gray-900">
                        {`${u.firstName} ${u.lastName}`.trim() || '—'}
                        {u.isDemo && <Badge tone="purple">Démo</Badge>}
                      </span>
                      <span className="block text-xs text-gray-600">{u.email}</span>
                    </span>
                  ),
                },
                {
                  header: 'Rôles',
                  cell: (u) => u.roles.map((r) => labels.role[r]).join(', ') || '—',
                },
                {
                  header: 'État',
                  cell: (u) => (
                    <span className="flex flex-wrap items-center gap-1">
                      <StatusBadge status={u.status} label={labels.userStatus[u.status]} />
                      {!u.emailVerified && u.status !== 'PENDING_VERIFICATION' && (
                        <Badge tone="amber">E-mail non vérifié</Badge>
                      )}
                    </span>
                  ),
                },
                {
                  header: 'Rattachement',
                  cell: (u) =>
                    u.profileId ? (
                      <Link
                        href={`/admin/freelances/${u.profileId}`}
                        className="text-brand-700 underline"
                      >
                        Profil freelance
                      </Link>
                    ) : (
                      (u.companyName ?? '—')
                    ),
                },
                { header: 'Dernière connexion', cell: (u) => formatDateTime(u.lastLoginAt) },
                { header: 'Créé le', cell: (u) => formatDate(u.createdAt) },
                {
                  header: 'Actions',
                  cell: (u) => (
                    <span className="flex flex-wrap items-start gap-2">
                      <ActionButton<MessageResponse>
                        actions={u.actions}
                        action="suspend"
                        label="Suspendre"
                        endpoint={`/admin/users/${u.id}/suspend`}
                        reason="required"
                        variant="danger"
                        size="sm"
                        confirm={{
                          title: `Suspendre le compte de ${u.email}`,
                          message:
                            'Toutes ses sessions seront fermées et un e-mail l’informera de la suspension et de son motif.',
                        }}
                        success="Compte suspendu"
                        onDone={reload}
                      />
                      <ActionButton<MessageResponse>
                        actions={u.actions}
                        action="reactivate"
                        label="Réactiver"
                        endpoint={`/admin/users/${u.id}/reactivate`}
                        reason="required"
                        variant="success"
                        size="sm"
                        confirm={{ title: `Réactiver le compte de ${u.email}` }}
                        success="Compte réactivé"
                        onDone={reload}
                      />
                      <ActionButton<MessageResponse>
                        actions={u.actions}
                        action="resendVerification"
                        label="Renvoyer l’e-mail de vérification"
                        endpoint={`/admin/users/${u.id}/resend-verification`}
                        variant="secondary"
                        size="sm"
                        confirm={{
                          title: 'Renvoyer l’e-mail de vérification',
                          message: `Un nouvel e-mail de vérification sera envoyé à ${u.email}.`,
                          confirmLabel: 'Renvoyer',
                        }}
                        success="E-mail de vérification renvoyé"
                        onDone={reload}
                      />
                    </span>
                  ),
                },
              ]}
            />
            <Pagination page={data} onChange={setPage} />
          </>
        )}
      </ResourceView>
    </>
  );
}
