'use client';

import { useState } from 'react';
import {
  ContactKind,
  labels,
  type CompanyContactInput,
  type CompanyContactView,
  type CompanyView,
} from '@empgt/contracts';
import { api } from '@/lib/api';
import { useAction } from '@/lib/hooks';
import { ActionButton, findAction } from '@/components/ui/actions';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Dialog } from '@/components/ui/dialog';
import { EmptyState } from '@/components/ui/feedback';
import { Field, FormError, formValue, Input, optionsFrom, Select } from '@/components/ui/form';
import { GatedButton } from './widgets';

const kindOptions = optionsFrom(ContactKind, labels.contactKind);

function ContactForm({
  contact,
  onSaved,
  onCancel,
}: {
  contact: CompanyContactView | null;
  onSaved: (company: CompanyView) => void;
  onCancel: () => void;
}) {
  const action = useAction();
  return (
    <form
      className="space-y-4"
      onSubmit={async (e) => {
        e.preventDefault();
        const form = new FormData(e.currentTarget);
        const body: CompanyContactInput = {
          kind: (formValue(form, 'kind') ?? 'PRIMARY') as ContactKind,
          fullName: String(form.get('fullName') ?? '').trim(),
          jobTitle: formValue(form, 'jobTitle'),
          email: formValue(form, 'email'),
          phone: formValue(form, 'phone'),
        };
        const saved = await action.run(
          () =>
            contact
              ? api.patch<CompanyView>(`/company/contacts/${contact.id}`, body)
              : api.post<CompanyView>('/company/contacts', body),
          { success: contact ? 'Contact modifié' : 'Contact ajouté' },
        );
        if (saved) onSaved(saved);
      }}
    >
      <Field label="Rôle du contact" required>
        {(p) => (
          <Select
            {...p}
            name="kind"
            defaultValue={contact?.kind ?? 'PRIMARY'}
            options={kindOptions}
          />
        )}
      </Field>
      <Field label="Nom complet" required>
        {(p) => (
          <Input
            {...p}
            name="fullName"
            maxLength={200}
            defaultValue={contact?.fullName ?? ''}
            autoComplete="name"
          />
        )}
      </Field>
      <Field label="Fonction">
        {(p) => (
          <Input
            {...p}
            name="jobTitle"
            maxLength={200}
            defaultValue={contact?.jobTitle ?? ''}
            autoComplete="organization-title"
          />
        )}
      </Field>
      <Field label="E-mail">
        {(p) => (
          <Input
            {...p}
            name="email"
            type="email"
            maxLength={254}
            defaultValue={contact?.email ?? ''}
            autoComplete="email"
          />
        )}
      </Field>
      <Field label="Téléphone">
        {(p) => (
          <Input
            {...p}
            name="phone"
            type="tel"
            maxLength={40}
            defaultValue={contact?.phone ?? ''}
            autoComplete="tel"
          />
        )}
      </Field>
      <FormError error={action.error} />
      <div className="flex justify-end gap-2 border-t border-gray-100 pt-3">
        <Button variant="secondary" onClick={onCancel} disabled={action.pending}>
          Annuler
        </Button>
        <Button type="submit" loading={action.pending}>
          {contact ? 'Enregistrer' : 'Ajouter le contact'}
        </Button>
      </div>
    </form>
  );
}

/** Contacts de l'entreprise : interlocuteurs d'E-MPGT (au moins un requis pour la vérification). */
export function CompanyContacts({
  company,
  onChange,
}: {
  company: CompanyView;
  onChange: (company: CompanyView) => void;
}) {
  const manage = findAction(company.actions, 'manageContacts');
  const [editing, setEditing] = useState<CompanyContactView | 'new' | null>(null);
  const allowed = Boolean(manage?.allowed);

  return (
    <Card
      title="Contacts"
      description="Vos interlocuteurs pour E-MPGT (principal, facturation, opérationnel). Au moins un contact est requis pour la vérification."
      actions={
        <GatedButton
          actions={company.actions}
          action="manageContacts"
          size="sm"
          variant="primary"
          onClick={() => setEditing('new')}
        >
          Ajouter un contact
        </GatedButton>
      }
    >
      {company.contacts.length === 0 ? (
        <EmptyState
          title="Aucun contact"
          description="Ajoutez au moins un contact avant de demander la vérification de votre entreprise."
        />
      ) : (
        <ul className="divide-y divide-gray-100">
          {company.contacts.map((c) => (
            <li
              key={c.id}
              className="flex flex-wrap items-start justify-between gap-3 py-3 text-sm"
            >
              <div className="min-w-0">
                <p className="font-medium text-gray-900">
                  {c.fullName} <Badge tone="blue">{labels.contactKind[c.kind]}</Badge>
                </p>
                {c.jobTitle && <p className="text-gray-600">{c.jobTitle}</p>}
                <p className="text-gray-600">
                  {c.email && (
                    <a href={`mailto:${c.email}`} className="text-brand-700 underline">
                      {c.email}
                    </a>
                  )}
                  {c.email && c.phone && ' · '}
                  {c.phone}
                </p>
              </div>
              {allowed && (
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" variant="secondary" onClick={() => setEditing(c)}>
                    Modifier
                  </Button>
                  <ActionButton<CompanyView>
                    actions={company.actions}
                    action="manageContacts"
                    label="Supprimer"
                    method="delete"
                    endpoint={`/company/contacts/${c.id}`}
                    variant="danger"
                    size="sm"
                    confirm={{
                      title: 'Supprimer ce contact',
                      message: `${c.fullName} ne sera plus un interlocuteur d’E-MPGT.`,
                      confirmLabel: 'Supprimer',
                    }}
                    success="Contact supprimé"
                    onDone={onChange}
                  />
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      <Dialog
        open={editing !== null}
        onClose={() => setEditing(null)}
        title={editing === 'new' ? 'Ajouter un contact' : 'Modifier le contact'}
      >
        {editing !== null && (
          <ContactForm
            key={editing === 'new' ? 'new' : editing.id}
            contact={editing === 'new' ? null : editing}
            onCancel={() => setEditing(null)}
            onSaved={(saved) => {
              onChange(saved);
              setEditing(null);
            }}
          />
        )}
      </Dialog>
    </Card>
  );
}
