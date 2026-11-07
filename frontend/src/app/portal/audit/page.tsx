'use client';

import { useState } from 'react';
import { DataTable, PageHeader, Pager } from '@/components/ui/kit';
import { useApi } from '@/hooks/use-api';

export default function AuditPage() {
  const [page, setPage] = useState(1);
  const list = useApi<any[]>(`/reports/audit-logs?page=${page}`);
  return (
    <>
      <PageHeader title="Audit log" subtitle="Every sensitive change and access is recorded." />
      <DataTable rows={list.data ?? []} columns={[
        { key: 'createdAt', label: 'When', render: (r) => new Date(r.createdAt).toLocaleString('en-IN') },
        { key: 'actor', label: 'Who', render: (r) => r.actor?.name ?? 'System' }, { key: 'actorRole', label: 'Role' }, { key: 'action', label: 'Action' }, { key: 'entityId', label: 'Entity', render: (r) => `${r.entity ?? ''} ${r.entityId ?? ''}`.trim() || '—' },
      ]} />
      {list.meta && <Pager page={page} limit={list.meta.limit ?? 50} total={list.meta.total ?? 0} onPage={setPage} />}
    </>
  );
}
