'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Alert, Badge, Card, DataTable, Empty, PageHeader, PageLoader, statusTone } from '@/components/ui/kit';
import { ChildPicker, useChildren } from '@/features/portal/shared';
import { useApi } from '@/hooks/use-api';
import { download, errorMessage } from '@/lib/client';

export default function ResultsPage() {
  const [child, setChild] = useState('');
  const { children } = useChildren();
  const res = useApi<any[]>(child ? `/results/student/${child}` : null);
  const [error, setError] = useState<string | null>(null);
  return (
    <>
      <PageHeader title="Results" subtitle="Only results published by the school are shown." />
      <div className="mb-4"><ChildPicker value={child} onChange={setChild} /></div>
      {error && <Alert>{error}</Alert>}
      {!children.length ? <Empty>No student linked to this account.</Empty> : res.loading ? <PageLoader /> : !(res.data ?? []).length ? <Empty>No results have been published yet.</Empty> : (
        (res.data ?? []).map((r) => (
          <Card key={r.exam.id} className="mb-5">
            <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="font-sans text-lg font-semibold">{r.exam.name}</h2>
                <p className="mt-1 text-sm text-slate-600">Total <b>{r.total}/{r.max}</b> · <b>{r.percentage}%</b> · Grade <b>{r.grade}</b> · <Badge tone={statusTone(r.result)}>{r.result}</Badge></p>
                {r.failedSubjects.length > 0 && <p className="mt-1 text-sm text-red-700">Needs attention: {r.failedSubjects.join(', ')}</p>}
              </div>
              <Button variant="outline" onClick={() => download(`/results/student/${child}/marksheet.pdf?examId=${r.exam.id}`, `marksheet-${r.exam.name}.pdf`).catch((e) => setError(errorMessage(e)))}>Download marksheet</Button>
            </div>
            <DataTable rows={r.subjects.map((s: any) => ({ ...s, _id: s.subjectId }))} columns={[
              { key: 'name', label: 'Subject' }, { key: 'marks', label: 'Marks', render: (s: any) => (s.absent ? 'Absent' : `${s.marks} / ${s.max}`) },
              { key: 'grade', label: 'Grade' }, { key: 'failed', label: 'Result', render: (s: any) => <Badge tone={s.failed ? 'red' : 'green'}>{s.failed ? 'Fail' : 'Pass'}</Badge> },
            ]} />
          </Card>
        ))
      )}
    </>
  );
}
