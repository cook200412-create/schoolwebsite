'use client';

import { useState } from 'react';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Button } from '@/components/ui/button';
import { Alert, Card, DataTable, Empty, Field, Input, PageHeader, PageLoader, Select } from '@/components/ui/kit';
import { sectionLabel, todayISO, useAcademics } from '@/features/portal/shared';
import { useApi } from '@/hooks/use-api';
import { useAuth } from '@/hooks/use-auth';
import { download, errorMessage } from '@/lib/client';

export default function ReportsPage() {
  const { can } = useAuth();
  const ac = useAcademics();
  const [date, setDate] = useState(todayISO());
  const [section, setSection] = useState('');
  const [examId, setExamId] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const classAtt = useApi<any[]>(can('attendance:read') ? `/reports/class-attendance?date=${date}` : null);
  const exams = useApi<any[]>(can('exams:read') ? '/examinations?limit=50' : null);
  const perf = useApi<any[]>(examId ? `/reports/exam-performance/${examId}` : null);
  const fn = (p: string, name: string) => download(p, name).catch((e) => setErr(errorMessage(e)));
  return (
    <>
      <PageHeader title="Reports & exports" subtitle="Analytics from live data. Export to CSV or PDF." />
      {err && <Alert>{err}</Alert>}
      <div className="grid gap-6">
        {can('attendance:read') && (
          <Card>
            <h2 className="mb-3 font-sans text-base font-semibold">Class-wise attendance</h2>
            <Field label="Date" className="mb-3 max-w-[200px]"><Input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></Field>
            {classAtt.loading ? <PageLoader /> : <DataTable rows={(classAtt.data ?? []).map((r, i) => ({ ...r, _id: String(i) }))} columns={[{ key: 'section', label: 'Section' }, { key: 'present', label: 'Present' }, { key: 'absent', label: 'Absent' }, { key: 'late', label: 'Late' }, { key: 'percentage', label: '%' }]} empty="No attendance marked on this date." />}
            <div className="mt-4 flex flex-wrap items-end gap-2">
              <Select aria-label="Section for monthly report" value={section} onChange={(e) => setSection(e.target.value)} className="max-w-[200px]"><option value="">Section…</option>{ac.sections.map((s) => <option key={s._id} value={s._id}>{sectionLabel(s)}</option>)}</Select>
              <Button variant="outline" disabled={!section} onClick={() => fn(`/attendance/report/monthly?sectionId=${section}&month=${date.slice(0, 7)}&format=csv`, `attendance-${date.slice(0, 7)}.csv`)}>Monthly attendance CSV</Button>
            </div>
          </Card>
        )}
        {can('exams:read') && (
          <Card>
            <h2 className="mb-3 font-sans text-base font-semibold">Subject-wise averages</h2>
            <Select aria-label="Examination" value={examId} onChange={(e) => setExamId(e.target.value)} className="mb-3 max-w-xs"><option value="">Choose examination…</option>{(exams.data ?? []).map((e) => <option key={e._id} value={e._id}>{e.name} · Class {e.class?.name}</option>)}</Select>
            {perf.data && (perf.data.length ? <div className="h-64"><ResponsiveContainer><BarChart data={perf.data}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="subject" /><YAxis /><Tooltip /><Bar dataKey="average" fill="#0ea5e9" radius={[6, 6, 0, 0]} /><Bar dataKey="highest" fill="#d9ad26" radius={[6, 6, 0, 0]} /></BarChart></ResponsiveContainer></div> : <Empty>No marks yet.</Empty>)}
            {examId && <Button className="mt-3" variant="outline" onClick={() => fn(`/results/class/${examId}/rankings?format=csv`, 'class-rankings.csv')}>Class rankings CSV</Button>}
          </Card>
        )}
        {can('reports:finance') && (
          <Card>
            <h2 className="mb-3 font-sans text-base font-semibold">Finance</h2>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" onClick={() => fn('/reports/fee-collection?by=day&format=csv', 'daily-collection.csv')}>Daily collection (CSV)</Button>
              <Button variant="outline" onClick={() => fn('/reports/fee-collection?by=month&format=csv', 'monthly-collection.csv')}>Monthly (CSV)</Button>
              <Button variant="outline" onClick={() => fn('/reports/fee-collection?by=month&format=pdf', 'monthly-collection.pdf')}>Monthly (PDF)</Button>
              <Button variant="outline" onClick={() => fn('/fees/pending?format=csv', 'pending-fees.csv')}>Pending fees (CSV)</Button>
            </div>
          </Card>
        )}
        {can('students:read') && <Card><h2 className="mb-3 font-sans text-base font-semibold">Students</h2><Button variant="outline" onClick={() => fn('/students/export', 'students.csv')}>Export student list (CSV)</Button></Card>}
      </div>
    </>
  );
}
