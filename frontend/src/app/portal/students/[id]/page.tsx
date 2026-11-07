'use client';

import { use, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Alert, Badge, Card, DataTable, PageHeader, PageLoader, statusTone, money } from '@/components/ui/kit';
import { fmtDate } from '@/features/portal/shared';
import { useApi } from '@/hooks/use-api';
import { useAuth } from '@/hooks/use-auth';
import { api, download, errorMessage } from '@/lib/client';

export default function StudentDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { can } = useAuth();
  const s = useApi<any>(`/students/${id}`);
  const att = useApi<any>(`/attendance/student/${id}`);
  const res = useApi<any[]>(`/results/student/${id}`);
  const fees = useApi<any>(can('fees:read', 'fees:own') ? `/fees/student/${id}` : null);
  const [msg, setMsg] = useState<string | null>(null);

  if (s.loading) return <PageLoader />;
  if (s.error) return <Alert>{s.error}</Alert>;
  const st = s.data;
  return (
    <>
      <PageHeader title={`${st.firstName} ${st.lastName}`} subtitle={`${st.studentId} · Admission ${st.admissionNumber}`}
        actions={<>
          <Button variant="outline" onClick={() => download(`/students/${id}/id-card`, `id-${st.studentId}.pdf`).catch((e) => setMsg(errorMessage(e)))}>ID card (PDF)</Button>
          {can('students:write') && st.status === 'active' && <Button variant="outline" onClick={async () => { if (confirm('Archive this student?')) { await api(`/students/${id}/archive`, { body: {} }); s.reload(); } }}>Archive</Button>}
        </>} />
      {msg && <Alert>{msg}</Alert>}
      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-1">
          <h2 className="mb-3 font-sans text-base font-semibold">Profile</h2>
          <dl className="grid gap-2 text-sm">
            {[['Class', `${st.class?.name}-${st.section?.name}`], ['Roll no.', st.rollNumber ?? '—'], ['Date of birth', fmtDate(st.dob)], ['Gender', st.gender], ['Academic year', st.academicYear?.name], ['Status', st.status]].map(([k, v]) => (
              <div key={k as string} className="flex justify-between gap-3"><dt className="text-slate-500">{k}</dt><dd className="font-medium capitalize">{v as string}</dd></div>
            ))}
          </dl>
        </Card>
        <Card className="lg:col-span-2">
          <h2 className="mb-3 font-sans text-base font-semibold">Attendance</h2>
          {att.data && <p className="text-sm">Overall: <b>{att.data.percentage ?? '—'}%</b> · Present {att.data.counts.present} · Absent {att.data.counts.absent} · Late {att.data.counts.late} · Leave {att.data.counts.leave}</p>}
        </Card>
      </div>
      <h2 className="mb-3 mt-8 text-xl font-bold">Results</h2>
      {(res.data ?? []).length === 0 ? <p className="text-sm text-slate-500">No published results.</p> : (res.data ?? []).map((r) => (
        <Card key={r.exam.id} className="mb-4">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <div><h3 className="font-sans text-base font-semibold">{r.exam.name}</h3><p className="text-sm text-slate-600">{r.total}/{r.max} · {r.percentage}% · Grade {r.grade} · <Badge tone={statusTone(r.result)}>{r.result}</Badge></p></div>
            <Button size="sm" variant="outline" onClick={() => download(`/results/student/${id}/marksheet.pdf?examId=${r.exam.id}`, 'marksheet.pdf').catch((e) => setMsg(errorMessage(e)))}>Marksheet PDF</Button>
          </div>
          <DataTable rows={r.subjects} columns={[{ key: 'name', label: 'Subject' }, { key: 'marks', label: 'Marks', render: (x: any) => `${x.absent ? 'AB' : x.marks}/${x.max}` }, { key: 'grade', label: 'Grade' }]} />
        </Card>
      ))}
      {fees.data && (
        <>
          <h2 className="mb-3 mt-8 text-xl font-bold">Fees</h2>
          <DataTable rows={fees.data.fees} columns={[{ key: 'academicYear', label: 'Year', render: (f: any) => f.academicYear?.name }, { key: 'totalDue', label: 'Total', render: (f: any) => money(f.totalDue) }, { key: 'paid', label: 'Paid', render: (f: any) => money(f.paid) }, { key: 'balance', label: 'Balance', render: (f: any) => money(f.balance) }]} />
        </>
      )}
    </>
  );
}
