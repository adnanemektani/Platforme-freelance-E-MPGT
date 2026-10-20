'use client';

import { useState } from 'react';
import type { ContactRequestView, MessageResponse, Page } from '@empgt/contracts';
import { api } from '@/lib/api';
import { formatDateTime } from '@/lib/format';
import { useAction, useApi } from '@/lib/hooks';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { EmptyState, ResourceView } from '@/components/ui/feedback';
import { PageHeader } from '@/components/ui/page';
import { Pagination } from '@/components/ui/table';
import { contactAudienceLabels, contactStatusLabels } from '@/components/admin/a-labels';
import { AText } from '@/components/admin/a-shared';

export default function ContactPage() {
  const [page, setPage] = useState(1);
  const list = useApi<Page<ContactRequestView>>(`/admin/contact-requests?page=${page}`);

  return (
    <>
      <PageHeader
        title="Demandes de contact"
        description="Messages reçus via le formulaire public. Les demandes nouvelles apparaissent en premier."
      />
      <ResourceView resource={list} loadingLabel="Chargement des demandes…">
        {(data) =>
          data.items.length === 0 ? (
            <EmptyState
              title="Aucune demande de contact"
              description="Les messages envoyés depuis le formulaire public apparaîtront ici."
            />
          ) : (
            <>
              <ul className="space-y-4">
                {data.items.map((r) => (
                  <ContactRequestCard key={r.id} request={r} onHandled={() => void list.reload()} />
                ))}
              </ul>
              <Pagination page={data} onChange={setPage} />
            </>
          )
        }
      </ResourceView>
    </>
  );
}

function ContactRequestCard({
  request: r,
  onHandled,
}: {
  request: ContactRequestView;
  onHandled: () => void;
}) {
  const action = useAction();
  const handled = r.status === 'HANDLED';
  return (
    <li className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="flex flex-wrap items-center gap-2 font-semibold text-gray-900">
            {r.subject}
            <Badge tone={handled ? 'green' : 'amber'}>
              {contactStatusLabels[r.status] ?? r.status}
            </Badge>
            <Badge>{contactAudienceLabels[r.audience] ?? r.audience}</Badge>
          </p>
          <p className="mt-0.5 text-sm text-gray-600">
            {r.name}
            {r.organization ? ` — ${r.organization}` : ''} ·{' '}
            <a href={`mailto:${r.email}`} className="text-brand-700 underline">
              {r.email}
            </a>{' '}
            · reçue le {formatDateTime(r.createdAt)}
            {r.handledAt ? ` · traitée le ${formatDateTime(r.handledAt)}` : ''}
          </p>
        </div>
        {!handled && (
          <Button
            size="sm"
            variant="secondary"
            loading={action.pending}
            onClick={async () => {
              const result = await action.run(
                () => api.post<MessageResponse>(`/admin/contact-requests/${r.id}/handled`),
                { success: 'Demande marquée comme traitée' },
              );
              if (result) onHandled();
            }}
          >
            Marquer comme traitée
          </Button>
        )}
      </div>
      <p className="mt-3 text-sm text-gray-900">
        <AText value={r.message} />
      </p>
    </li>
  );
}
