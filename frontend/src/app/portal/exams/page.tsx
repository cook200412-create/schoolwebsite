'use client';

import { Plus, Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Alert, Badge, Card, DataTable, Field, Input, Modal, PageHeader, PageLoader, Select, statusTone } from '@/components/ui/kit';
import { sectionLabel, useAcademics } from '@/features/portal/shared';
import { useApi } from '@/hooks/use-api';
import { useAuth } from '@/hooks/use-auth';
import { api, download, errorMessage } from '@/lib/client';

function CreateExam({ onDone }: { onDone: () => void }) {
  const ac = useAcademics();
  const [f, setF] = useState({ name: '', type: 'term', academicYear: '', class: '' });
  const [rows, setRows] = useState<{ subject: string; maxMarks: number; passMarks: number }[]>([{ subject: '', maxMarks: 100, passMarks: 35 }]);
  const [error, setError] = useState<string | null>(null);
  return (
    <form className="grid gap-3" onSubmit={async (e) => { e.preventDefault(); setError(null); try { await api('/examinations', { body: { ...f, subjects: rows } }); onDone(); } catch (er) { setError(errorMessage(er)); } }}>
      {error && <Alert>{error}</Alert>}
      <Field label="Name"><Input required value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="Term 1 / Unit Test 2" /></Field>
      <div className="grid gap-3 sm:grid-cols-3">
        <Field label="Type"><Select value={f.type} onChange={(e) => setF({ ...f, type: e.target.value })}>{['unit_test', 'term', 'half_yearly', 'annual', 'other'].map((t) => <option key={t} value={t}>{t.replace('_', ' ')}</option>)}</Select></Field>
        <Field label="Academic year"><Select required value={f.academicYear} onChange={(e) => setF({ ...f, academicYear: e.target.value })}><option value="">Select…</option>{ac.years.map((y) => <option key={y._id} value={y._id}>{y.name}</option>)}</Select></Field>
        <Field label="Class"><Select required value={f.class} onChange={(e) => setF({ ...f, class: e.target.value })}><option value="">Select…</option>{ac.classes.map((c) => <option key={c._id} value={c._id}>{c.name}</option>)}</Select></Field>
      </div>
      <p className="text-sm font-semibold">Subjects</p>
      {rows.map((r, i) => (
        <div key={i} className="grid grid-cols-[1fr_80px_80px_40px] items-end gap-2">
          <Select required aria-label="Subject" value={r.subject} onChange={(e) => setRows(rows.map((x, j) => (j === i ? { ...x, subject: e.target.value } : x)))}><option value="">Subject…</option>{ac.subjects.map((s) => <option key={s._id} value={s._id}>{s.name}</option>)}</Select>
          <Input type="number" aria-label="Max marks" min={1} value={r.maxMarks} onChange={(e) => setRows(rows.map((x, j) => (j === i ? { ...x, maxMarks: Number(e.target.value) } : x)))} />
          <Input type="number" aria-label="Pass marks" min={0} value={r.passMarks} onChange={(e) => setRows(rows.map((x, j) => (j === i ? { ...x, passMarks: Number(e.target.value) } : x)))} />
          <button type="button" aria-label="Remove subject" className="grid h-11 place-items-center text-red-600" onClick={() => setRows(rows.filter((_, j) => j !== i))}><Trash2 size={16} /></button>
        </div>
      ))}
      <Button type="button" variant="outline" size="sm" onClick={() => setRows([...rows, { subject: '', maxMarks: 100, passMarks: 35 }])}><Plus size={14} /> Add subject</Button>
      <Button>Create examination</Button>
    </form>
  );
}

function MarksEntry({ exam, onChanged }: { exam: any; onChanged: () => void }) {
  const ac = useAcademics();
  const { can } = useAuth();
  const me = useApi<any>(can('exams:write') ? null : '/teachers/me');
  const sections = can('exams:write') ? ac.sections.filter((s) => (s.class?._id ?? s.class) === (exam.class?._id ?? exam.class)).map((s) => ({ id: s._id, label: sectionLabel(s) }))
    : [...new Map((me.data?.assignments ?? []).map((a: any) => [a.section._id, { id: a.section._id, label: `${a.class.name}-${a.section.name}` }])).values()] as { id: string; label: string }[];
  const [section, setSection] = useState('');
  useEffect(() => { if (!section && sections[0]) setSection(sections[0].id); }, [sections, section]);
  const sheet = useApi<{ status: string; students: any[] }>(section ? `/examinations/${exam._id}/marks?sectionId=${section}` : null);
  const [vals, setVals] = useState<Record<string, string>>({});
  const [msg, setMsg] = useState<{ tone: 'success' | 'error'; text: string } | null>(null);
  useEffect(() => {
    const v: Record<string, string> = {};
    (sheet.data?.students ?? []).forEach((s) => Object.entries(s.marks).forEach(([sub, m]: any) => { v[`${s._id}|${sub}`] = m.absent ? 'AB' : String(m.marks); }));
    setVals(v);
  }, [sheet.data]);
  const locked = exam.status !== 'marks_entry';

  const save = async () => {
    const entries = Object.entries(vals).filter(([, v]) => v !== '').map(([k, v]) => { const [studentId, subjectId] = k.split('|'); return v.toUpperCase() === 'AB' ? { studentId, subjectId, marks: 0, absent: true } : { studentId, subjectId, marks: Number(v) }; });
    try { const r = await api<{ saved: number }>(`/examinations/${exam._id}/marks`, { body: { sectionId: section, entries } }); setMsg({ tone: 'success', text: `${r.saved} marks saved.` }); sheet.reload(); } catch (e) { setMsg({ tone: 'error', text: errorMessage(e) }); }
  };

  return (
    <Card className="mt-4">
      <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
        <h3 className="font-sans text-base font-semibold">Marks entry</h3>
        <Select aria-label="Section" value={section} onChange={(e) => setSection(e.target.value)} className="max-w-[200px]">{sections.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}</Select>
      </div>
      {locked && <Alert tone="info">Marks are locked ({exam.status}). Leadership can reopen the examination with a reason.</Alert>}
      {msg && <div className="my-2"><Alert tone={msg.tone}>{msg.text}</Alert></div>}
      {sheet.loading ? <PageLoader /> : (
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[520px] text-sm">
            <thead><tr className="text-left text-xs uppercase text-slate-500"><th className="py-2">Student</th>{exam.subjects.map((s: any) => <th key={s.subject._id} className="px-2">{s.subject.name}<span className="block normal-case text-slate-400">/{s.maxMarks}</span></th>)}</tr></thead>
            <tbody className="divide-y">
              {(sheet.data?.students ?? []).map((s) => (
                <tr key={s._id}><td className="py-2 pr-3 font-medium">{s.rollNumber ?? ''} {s.firstName} {s.lastName}</td>
                  {exam.subjects.map((sub: any) => (
                    <td key={sub.subject._id} className="px-1 py-1"><Input disabled={locked} inputMode="numeric" aria-label={`${s.firstName} ${sub.subject.name}`} className="h-10 w-20" value={vals[`${s._id}|${sub.subject._id}`] ?? ''} onChange={(e) => setVals({ ...vals, [`${s._id}|${sub.subject._id}`]: e.target.value })} /></td>
                  ))}</tr>
              ))}
            </tbody>
          </table>
          <p className="mt-2 text-xs text-slate-500">Type AB for absent. You can only save marks for subjects you are assigned to.</p>
          {!locked && <Button className="mt-3" onClick={save}>Save marks</Button>}
        </div>
      )}
    </Card>
  );
}

export default function ExamsPage() {
  const { can } = useAuth();
  const list = useApi<any[]>('/examinations?limit=50');
  const [open, setOpen] = useState(false);
  const [sel, setSel] = useState<any | null>(null);
  const [error, setError] = useState<string | null>(null);

  const act = async (action: string, reason?: string) => {
    setError(null);
    try { const e = await api<any>(`/examinations/${sel._id}/${action}`, { body: reason ? { reason } : {} }); setSel({ ...sel, status: e.status }); list.reload(); } catch (e) { setError(errorMessage(e)); }
  };
  const live = sel ? { ...sel, status: list.data?.find((x) => x._id === sel._id)?.status ?? sel.status } : null;

  return (
    <>
      <PageHeader title="Examinations" subtitle="Create exams, enter marks, approve and publish results." actions={can('exams:write') && <Button onClick={() => setOpen(true)}><Plus size={16} /> New examination</Button>} />
      {list.loading ? <PageLoader /> : <DataTable rows={list.data ?? []} onRowClick={(r) => { setSel(r); setError(null); }} columns={[
        { key: 'name', label: 'Exam' }, { key: 'class', label: 'Class', render: (r) => r.class?.name }, { key: 'type', label: 'Type', render: (r) => r.type.replace('_', ' ') },
        { key: 'status', label: 'Status', render: (r) => <Badge tone={statusTone(r.status)}>{r.status.replace('_', ' ')}</Badge> },
      ]} />}
      <Modal open={open} onClose={() => setOpen(false)} title="New examination"><CreateExam onDone={() => { setOpen(false); list.reload(); }} /></Modal>
      {live && (
        <div className="mt-6">
          <Card>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div><h2 className="font-sans text-lg font-semibold">{live.name}</h2><p className="text-sm text-slate-500">Status: {live.status.replace('_', ' ')}</p></div>
              <div className="flex flex-wrap gap-2">
                {live.status === 'marks_entry' && can('marks:enter') && <Button size="sm" onClick={() => act('submit')}>Submit for approval</Button>}
                {live.status === 'submitted' && can('results:publish') && <Button size="sm" onClick={() => act('approve')}>Approve</Button>}
                {live.status === 'approved' && can('results:publish') && <Button size="sm" variant="gold" onClick={() => act('publish')}>Publish to parents</Button>}
                {live.status !== 'marks_entry' && can('results:publish') && <Button size="sm" variant="outline" onClick={() => { const r = prompt('Reason for reopening (audited):'); if (r) void act('reopen', r); }}>Reopen</Button>}
                {can('results:read') && <Button size="sm" variant="outline" onClick={() => download(`/results/class/${live._id}/rankings?format=csv`, 'rankings.csv').catch((e) => setError(errorMessage(e)))}>Rankings CSV</Button>}
              </div>
            </div>
            {error && <div className="mt-3"><Alert>{error}</Alert></div>}
          </Card>
          {can('marks:enter') && <MarksEntry exam={live} onChanged={list.reload} />}
        </div>
      )}
    </>
  );
}
