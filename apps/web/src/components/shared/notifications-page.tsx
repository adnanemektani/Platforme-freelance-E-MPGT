'use client';

import Link from 'next/link';
import { useState } from 'react';
import type { NotificationView, Page } from '@empgt/contracts';
import { api } from '@/lib/api';
import { formatDateTime } from '@/lib/format';
import { useAction, useApi } from '@/lib/hooks';
import { useSession } from '@/lib/session';
import { Button } from '@/components/ui/button';
import { EmptyState, ResourceView } from '@/components/ui/feedback';
import { PageHeader, Tabs } from '@/components/ui/page';
import { Pagination } from '@/components/ui/table';

export function NotificationsPage() {
  const [page, setPage] = useState(1);
  const [tab, setTab] = useState<'all' | 'unread'>('all');
  const resource = useApi<Page<NotificationView>>(`/notifications?page=${page}&pageSize=20${tab === 'unread' ? '&unread=true' : ''}`);
  const { run, pending } = useAction();
  const { refresh } = useSession();

  const markAll = async () => {
    await run(() => api.post('/notifications/read-all'), { success: 'Notifications marquées comme lues' });
    await Promise.all([resource.reload(), refresh()]);
  };

  return (
    <>
      <PageHeader
        title="Notifications"
        description="Validations, candidatures, décisions, contrats, CRA, corrections et règlements enregistrés."
        actions={<Button variant="secondary" onClick={markAll} loading={pending}>Tout marquer comme lu</Button>}
      />
      <Tabs tabs={[{ id: 'all', label: 'Toutes' }, { id: 'unread', label: 'Non lues' }]} current={tab} onChange={(id) => { setTab(id as 'all' | 'unread'); setPage(1); }} />
      <ResourceView resource={resource}>
        {(data) =>
          data.items.length === 0 ? (
            <EmptyState title="Aucune notification" />
          ) : (
            <>
              <ul className="divide-y divide-gray-100 rounded-lg border border-gray-200 bg-white">
                {data.items.map((n) => (
                  <li key={n.id} className={`flex flex-wrap items-start justify-between gap-3 px-4 py-3 ${n.readAt ? '' : 'bg-brand-50/60'}`}>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-gray-900">
                        {!n.readAt && <span className="mr-2 inline-block h-2 w-2 rounded-full bg-brand-600" aria-label="Non lue" />}
                        {n.title}
                      </p>
                      <p className="text-sm text-gray-700">{n.body}</p>
                      <p className="mt-0.5 text-xs text-gray-500">{formatDateTime(n.createdAt)}</p>
                    </div>
                    <div className="flex gap-2">
                      {n.link && (
                        <Link
                          href={n.link}
                          className="text-sm font-medium text-brand-700 underline"
                          onClick={() => void api.post(`/notifications/${n.id}/read`).then(() => refresh())}
                        >
                          Ouvrir
                        </Link>
                      )}
                      {!n.readAt && (
                        <button
                          type="button"
                          className="text-sm text-gray-600 underline"
                          onClick={async () => {
                            await api.post(`/notifications/${n.id}/read`);
                            await Promise.all([resource.reload(), refresh()]);
                          }}
                        >
                          Marquer comme lue
                        </button>
                      )}
                    </div>
                  </li>
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
