'use client';

import { Button } from '@/components/ui/button';
import { Card, Empty, PageHeader, PageLoader } from '@/components/ui/kit';
import { useApi } from '@/hooks/use-api';
import { api } from '@/lib/client';
import { cn } from '@/lib/utils';

export default function NotificationsPage() {
  const list = useApi<any[]>('/notifications?limit=50');
  return (
    <>
      <PageHeader title="Notifications" subtitle="Your in-app notification history." actions={<Button variant="outline" onClick={async () => { await api('/notifications/read-all', { body: {} }); list.reload(); }}>Mark all read</Button>} />
      {list.loading ? <PageLoader /> : !(list.data ?? []).length ? <Empty>You&apos;re all caught up.</Empty> : (
        <ul className="grid gap-2">
          {(list.data ?? []).map((n) => (
            <li key={n._id}>
              <Card className={cn('!p-4', !n.readAt && 'border-l-4 border-l-gold-400')}>
                <div className="flex items-start justify-between gap-3">
                  <div><p className="font-semibold text-navy-900">{n.title}</p>{n.body && <p className="text-sm text-slate-600">{n.body}</p>}<p className="mt-1 text-xs text-slate-400">{new Date(n.createdAt).toLocaleString('en-IN')}</p></div>
                  {!n.readAt && <button className="shrink-0 text-xs font-semibold text-sky-700 hover:underline" onClick={async () => { await api(`/notifications/${n._id}/read`, { method: 'PATCH', body: {} }); list.reload(); }}>Mark read</button>}
                </div>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
