'use client';

import Link from 'next/link';
import { Card, Empty, PageLoader, Stat, money } from '@/components/ui/kit';
import { useApi } from '@/hooks/use-api';
import { fmtDate, useChildren } from './shared';

function ChildCard({ id, name, cls }: { id: string; name: string; cls: string }) {
  const att = useApi<{ percentage: number | null; counts: Record<string, number> }>(`/attendance/student/${id}`);
  const fees = useApi<{ fees: { totalDue: number; paid: number }[] }>(`/fees/student/${id}`);
  const res = useApi<{ exam: { name: string }; percentage: number; grade: string }[]>(`/results/student/${id}`);
  const rem = useApi<{ _id: string; text: string; category: string; teacherName?: string }[]>(`/remarks/student/${id}`);
  const pending = (fees.data?.fees ?? []).reduce((a, f) => a + (f.totalDue - f.paid), 0);
  const last = res.data?.[0];
  return (
    <Card>
      <div className="mb-4 flex items-center justify-between"><div><h2 className="font-sans text-lg font-semibold">{name}</h2><p className="text-sm text-slate-500">{cls}</p></div><Link className="text-sm font-semibold text-sky-700 hover:underline" href={`/portal/students/${id}`}>Profile →</Link></div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Stat label="Attendance" value={att.data?.percentage == null ? '—' : `${att.data.percentage}%`} />
        <Stat label="Latest result" value={last ? `${last.percentage}%` : '—'} hint={last ? `${last.exam.name} · ${last.grade}` : 'Not published'} />
        <Stat label="Fees due" value={fees.error ? '—' : money(pending)} />
      </div>
      {rem.data?.[0] && (
        <div className="mt-4 rounded-xl bg-navy-50 p-3 text-sm"><p className="text-xs font-semibold uppercase tracking-wider text-navy-700">Latest teacher remark</p><p className="mt-1 text-slate-700">{rem.data[0].text}</p><p className="mt-1 text-xs text-slate-500">— {rem.data[0].teacherName} · <Link className="text-sky-700 hover:underline" href="/portal/remarks">all remarks</Link></p></div>
      )}
    </Card>
  );
}

export function ParentStudentDashboard() {
  const { children, loading } = useChildren();
  const ann = useApi<{ _id: string; title: string; body: string; publishedAt?: string }[]>('/announcements?limit=4');
  if (loading) return <PageLoader />;
  return (
    <div className="grid gap-6">
      {children.length ? children.map((c) => <ChildCard key={c._id} id={c._id} name={`${c.firstName} ${c.lastName}`.trim()} cls={`Class ${c.class?.name ?? ''}${c.section ? `-${c.section.name}` : ''}`} />)
        : <Empty>No student is linked to your account yet. Please contact the school office to link your child.</Empty>}
      <Card>
        <h2 className="mb-3 font-sans text-base font-semibold">Latest announcements</h2>
        <ul className="divide-y text-sm">
          {(ann.data ?? []).map((a) => <li key={a._id} className="py-2"><p className="font-semibold">{a.title}</p><p className="text-slate-600">{a.body}</p><p className="text-xs text-slate-400">{fmtDate(a.publishedAt)}</p></li>)}
          {!ann.data?.length && <li className="py-2 text-slate-500">No announcements.</li>}
        </ul>
      </Card>
    </div>
  );
}
