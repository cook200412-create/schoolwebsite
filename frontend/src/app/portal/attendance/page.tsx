'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Alert, Badge, Card, DataTable, Empty, Field, Input, PageHeader, PageLoader, Select, statusTone } from '@/components/ui/kit';
import { ChildPicker, fmtDate, sectionLabel, todayISO, useAcademics } from '@/features/portal/shared';
import { useApi } from '@/hooks/use-api';
import { useAuth } from '@/hooks/use-auth';
import { api, download, errorMessage } from '@/lib/client';
import { cn } from '@/lib/utils';

const STATUSES = [
  { v: 'present', label: 'P', cls: 'bg-emerald-600' }, { v: 'absent', label: 'A', cls: 'bg-red-600' },
  { v: 'late', label: 'L', cls: 'bg-amber-500' }, { v: 'leave', label: 'LV', cls: 'bg-sky-600' },
];

function Marking() {
  const { can } = useAuth();
  const ac = useAcademics();
  const me = useApi<{ assignments: { section: { _id: string; name: string } ; class: { name: string } }[]; classTeacherOf?: string }>(can('attendance:correct') ? null : '/teachers/me');
  const [section, setSection] = useState('');
  const [date, setDate] = useState(todayISO());
  const roster = useApi<any[]>(section ? `/attendance/class?sectionId=${section}&date=${date}` : null);
  const [marks, setMarks] = useState<Record<string, string>>({});
  const [msg, setMsg] = useState<{ tone: 'success' | 'error'; text: string } | null>(null);
  const [saving, setSaving] = useState(false);

  const sections = can('attendance:correct')
    ? ac.sections.map((s) => ({ id: s._id, label: sectionLabel(s) }))
    : [...new Map((me.data?.assignments ?? []).map((a) => [a.section._id, { id: a.section._id, label: `${a.class.name}-${a.section.name}` }])).values()];

  useEffect(() => { if (!section && sections[0]) setSection(sections[0].id); }, [sections, section]);
  useEffect(() => { setMarks(Object.fromEntries((roster.data ?? []).map((s) => [s._id, s.status ?? 'present']))); setMsg(null); }, [roster.data]);

  const submit = async () => {
    setSaving(true); setMsg(null);
    try {
      const r = await api<{ created: number; updated: number }>('/attendance/mark', { body: { sectionId: section, date, records: Object.entries(marks).map(([studentId, status]) => ({ studentId, status })) } });
      setMsg({ tone: 'success', text: `Saved: ${r.created} new, ${r.updated} updated.` }); roster.reload();
    } catch (e) { setMsg({ tone: 'error', text: errorMessage(e) }); } finally { setSaving(false); }
  };

  return (
    <>
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end">
        <Field label="Section" className="sm:w-56"><Select value={section} onChange={(e) => setSection(e.target.value)}>{sections.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}</Select></Field>
        <Field label="Date" className="sm:w-48"><Input type="date" max={todayISO()} value={date} onChange={(e) => setDate(e.target.value)} /></Field>
        <div className="flex gap-2 sm:ml-auto">
          <Button variant="outline" onClick={() => setMarks(Object.fromEntries((roster.data ?? []).map((s) => [s._id, 'present'])))}>All present</Button>
          {can('attendance:read') && section && <Button variant="outline" onClick={() => download(`/attendance/report/monthly?sectionId=${section}&month=${date.slice(0, 7)}&format=csv`, `attendance-${date.slice(0, 7)}.csv`).catch((e) => setMsg({ tone: 'error', text: errorMessage(e) }))}>Monthly CSV</Button>}
        </div>
      </div>
      {msg && <div className="mb-4"><Alert tone={msg.tone}>{msg.text}</Alert></div>}
      {!sections.length && !me.loading && <Empty>No sections are assigned to you yet. Ask the administrator to assign your classes.</Empty>}
      {roster.loading ? <PageLoader /> : (roster.data ?? []).length > 0 && (
        <>
          <ul className="grid gap-2">
            {(roster.data ?? []).map((s) => (
              <li key={s._id} className="flex items-center justify-between gap-3 rounded-2xl border border-slate-100 bg-white p-3 shadow-card">
                <div><p className="font-medium text-navy-900">{s.rollNumber ? `${s.rollNumber}. ` : ''}{s.firstName} {s.lastName}</p><p className="text-xs text-slate-500">{s.studentId}</p></div>
                <div role="radiogroup" aria-label={`Attendance for ${s.firstName}`} className="flex gap-1.5">
                  {STATUSES.map((st) => (
                    <button key={st.v} role="radio" aria-checked={marks[s._id] === st.v} onClick={() => setMarks((m) => ({ ...m, [s._id]: st.v }))}
                      className={cn('h-10 min-w-10 rounded-lg px-2 text-sm font-bold transition', marks[s._id] === st.v ? `${st.cls} text-white` : 'bg-slate-100 text-slate-500 hover:bg-slate-200')}>{st.label}</button>
                  ))}
                </div>
              </li>
            ))}
          </ul>
          <div className="sticky bottom-3 mt-4"><Button size="lg" className="w-full sm:w-auto" disabled={saving} onClick={submit}>{saving ? 'Saving…' : 'Submit attendance'}</Button></div>
          <p className="mt-2 text-xs text-slate-500">P present · A absent · L late · LV approved leave. Parents of absent students are notified automatically.</p>
        </>
      )}
    </>
  );
}

function FamilyView() {
  const [child, setChild] = useState('');
  const [mode, setMode] = useState<'daily' | 'monthly'>('daily');
  const [date, setDate] = useState(todayISO());
  const [month, setMonth] = useState(todayISO().slice(0, 7));
  const key = mode === 'monthly' ? month : date.slice(0, 7);
  const att = useApi<{ records: { date: string; status: string }[]; counts: Record<string, number>; percentage: number | null; total: number }>(child ? `/attendance/student/${child}?month=${key}` : null);
  const day = att.data?.records.find((r) => r.date === date);
  return (
    <>
      <div className="mb-4 flex flex-wrap items-end gap-3">
        <ChildPicker value={child} onChange={setChild} />
        <div className="inline-flex rounded-xl bg-slate-200/60 p-1 text-sm font-semibold">
          {(['daily', 'monthly'] as const).map((m) => <button key={m} onClick={() => setMode(m)} className={cn('rounded-lg px-4 py-2 capitalize', mode === m ? 'bg-white shadow' : 'text-slate-600')}>{m}</button>)}
        </div>
        {mode === 'daily' ? <Field label="Date"><Input type="date" max={todayISO()} value={date} onChange={(e) => setDate(e.target.value)} /></Field> : <Field label="Month"><Input type="month" value={month} onChange={(e) => setMonth(e.target.value)} /></Field>}
      </div>
      {!child ? null : att.loading ? <PageLoader /> : att.data && (mode === 'daily' ? (
        <Card className="max-w-md text-center">
          <p className="text-xs uppercase tracking-wider text-slate-500">{fmtDate(date)}</p>
          {day ? <p className="mt-3"><Badge tone={statusTone(day.status)}>{day.status}</Badge></p> : <p className="mt-3 text-slate-500">Attendance was not recorded for this day.</p>}
          <p className="mt-4 text-xs text-slate-500">Month so far: {att.data.percentage == null ? '—' : `${att.data.percentage}%`} present</p>
        </Card>
      ) : (
        <>
          <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-5">
            {[['Percentage', att.data.percentage == null ? '—' : `${att.data.percentage}%`], ['Present', att.data.counts.present], ['Absent', att.data.counts.absent], ['Late', att.data.counts.late], ['Leave', att.data.counts.leave]].map(([k, v]) => (
              <Card key={k as string} className="!p-4 text-center"><p className="text-xs uppercase tracking-wider text-slate-500">{k}</p><p className="font-serif text-2xl font-bold text-navy-900">{v}</p></Card>
            ))}
          </div>
          <DataTable rows={att.data.records.map((r) => ({ ...r, _id: r.date }))} columns={[{ key: 'date', label: 'Date', render: (r) => fmtDate(r.date) }, { key: 'status', label: 'Status', render: (r) => <Badge tone={statusTone(r.status)}>{r.status}</Badge> }]} empty="No attendance recorded for this month." />
        </>
      ))}
    </>
  );
}

export default function AttendancePage() {
  const { can } = useAuth();
  return (
    <>
      <PageHeader title="Attendance" subtitle={can('attendance:mark') ? 'Mark daily attendance for your sections.' : 'Daily and monthly attendance.'} />
      {can('attendance:mark') ? <Marking /> : can('attendance:own') ? <FamilyView /> : <Empty>Attendance reports are under Reports.</Empty>}
    </>
  );
}
