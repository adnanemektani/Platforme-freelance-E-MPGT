'use client';

import { useState } from 'react';
import {
  CompanyRole,
  labels,
  type CompanyInvitationView,
  type CompanyMemberView,
  type CompanyView,
  type InviteMemberInput,
} from '@empgt/contracts';
import { api } from '@/lib/api';
import { formatDate } from '@/lib/format';
import { useAction } from '@/lib/hooks';
import { useSession } from '@/lib/session';
import { ActionButton, findAction } from '@/components/ui/actions';
import { Badge, StatusBadge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import {
  Field,
  FormError,
  formValue,
  Input,
  optionsFrom,
  Select,
  Textarea,
} from '@/components/ui/form';
import { DataTable, type Column } from '@/components/ui/table';
import { INVITATION_STATUS, MEMBERSHIP_STATUS } from './display';
import { ActionUnavailable } from './widgets';

const roleOptions = optionsFrom(CompanyRole, labels.companyRole);

/**
 * Membres et invitations. La gestion (invitation, retrait, révocation) suit l'action
 * « inviteMember » renvoyée par l'API (responsable de l'organisation, entreprise active).
 */
export function CompanyMembers({
  company,
  onChange,
}: {
  company: CompanyView;
  onChange: (company: CompanyView) => void;
}) {
  const { user } = useSession();
  const manage = findAction(company.actions, 'inviteMember');
  const canManage = Boolean(manage?.allowed);
  const action = useAction();
  const [formKey, setFormKey] = useState(0);

  const memberColumns: Column<CompanyMemberView>[] = [
    {
      header: 'Membre',
      cell: (m) => (
        <span className="font-medium text-gray-900">
          {m.firstName} {m.lastName}
          {m.userId === user?.id && (
            <span className="ml-1 text-xs font-normal text-gray-500">(vous)</span>
          )}
        </span>
      ),
    },
    { header: 'E-mail', cell: (m) => <span className="break-all">{m.email}</span> },
    {
      header: 'Rôle',
      cell: (m) => (
        <Badge tone={m.role === 'OWNER' ? 'blue' : 'gray'}>{labels.companyRole[m.role]}</Badge>
      ),
    },
    {
      header: 'Statut',
      cell: (m) => <StatusBadge status={m.status} label={MEMBERSHIP_STATUS[m.status]} />,
    },
    { header: 'Depuis', cell: (m) => formatDate(m.since) },
    {
      header: 'Action',
      cell: (m) =>
        canManage && m.status === 'ACTIVE' && m.userId !== user?.id ? (
          <ActionButton<CompanyView>
            actions={company.actions}
            action="inviteMember"
            label="Retirer"
            method="delete"
            endpoint={`/company/members/${m.membershipId}`}
            variant="danger"
            size="sm"
            confirm={{
              title: 'Retirer ce membre',
              message: `${m.firstName} ${m.lastName} perdra l’accès à l’espace entreprise et ses sessions ouvertes seront fermées.`,
              confirmLabel: 'Retirer',
            }}
            success="Membre retiré"
            onDone={onChange}
          />
        ) : (
          <span className="text-gray-400">—</span>
        ),
    },
  ];

  const invitationColumns: Column<CompanyInvitationView>[] = [
    {
      header: 'E-mail',
      cell: (i) => <span className="break-all font-medium text-gray-900">{i.email}</span>,
    },
    { header: 'Rôle', cell: (i) => (i.role ? labels.companyRole[i.role] : '—') },
    {
      header: 'État',
      cell: (i) => (
        <StatusBadge status={i.status} label={INVITATION_STATUS[i.status] ?? i.status} />
      ),
    },
    { header: 'Envoyée le', cell: (i) => formatDate(i.createdAt) },
    { header: 'Expire le', cell: (i) => formatDate(i.expiresAt) },
    {
      header: 'Action',
      cell: (i) =>
        canManage && i.status === 'PENDING' ? (
          <ActionButton<CompanyView>
            actions={company.actions}
            action="inviteMember"
            label="Révoquer"
            method="delete"
            endpoint={`/company/invitations/${i.id}`}
            variant="secondary"
            size="sm"
            confirm={{
              title: 'Révoquer l’invitation',
              message: `Le lien envoyé à ${i.email} ne sera plus utilisable.`,
              confirmLabel: 'Révoquer',
            }}
            success="Invitation révoquée"
            onDone={onChange}
          />
        ) : (
          <span className="text-gray-400">—</span>
        ),
    },
  ];

  return (
    <div className="space-y-6">
      <Card title="Membres" description="Personnes ayant accès à l’espace entreprise.">
        <div className="space-y-3">
          <ActionUnavailable state={manage} />
          <DataTable
            rows={company.members}
            columns={memberColumns}
            rowKey={(m) => m.membershipId}
            caption="Membres de l’entreprise"
            empty={{ title: 'Aucun membre' }}
          />
        </div>
      </Card>

      {manage && (
        <Card
          title="Inviter un membre"
          description="Un e-mail contenant un lien d’invitation valable 7 jours est envoyé à l’adresse indiquée."
        >
          <form
            key={formKey}
            className="space-y-4"
            onSubmit={async (e) => {
              e.preventDefault();
              const form = new FormData(e.currentTarget);
              const body: InviteMemberInput = {
                email: String(form.get('email') ?? '').trim(),
                role: (formValue(form, 'role') ?? 'MEMBER') as CompanyRole,
                message: formValue(form, 'message'),
              };
              const saved = await action.run(
                () => api.post<CompanyView>('/company/invitations', body),
                { success: `Invitation envoyée à ${body.email}` },
              );
              if (saved) {
                onChange(saved);
                setFormKey((k) => k + 1);
              }
            }}
          >
            <fieldset disabled={!canManage} className="grid gap-4 sm:grid-cols-2">
              <legend className="sr-only">Nouvelle invitation</legend>
              <Field label="Adresse e-mail" required>
                {(p) => (
                  <Input {...p} name="email" type="email" maxLength={254} autoComplete="off" />
                )}
              </Field>
              <Field
                label="Rôle"
                required
                hint="Le responsable gère l’organisation, ses membres et la vérification."
              >
                {(p) => <Select {...p} name="role" defaultValue="MEMBER" options={roleOptions} />}
              </Field>
              <div className="sm:col-span-2">
                <Field label="Message personnel" hint="Facultatif, ajouté à l’e-mail d’invitation.">
                  {(p) => <Textarea {...p} name="message" rows={3} maxLength={1000} />}
                </Field>
              </div>
            </fieldset>
            <FormError error={action.error} />
            {canManage && (
              <Button type="submit" loading={action.pending}>
                Envoyer l’invitation
              </Button>
            )}
          </form>
        </Card>
      )}

      {company.invitations.length > 0 && (
        <Card title="Invitations envoyées" description="20 dernières invitations.">
          <DataTable
            rows={company.invitations}
            columns={invitationColumns}
            rowKey={(i) => i.id}
            caption="Invitations"
          />
        </Card>
      )}
    </div>
  );
}
