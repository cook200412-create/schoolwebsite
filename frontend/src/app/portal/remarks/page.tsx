'use client';

import { Lightbulb, MessageSquareText, ShieldAlert, ThumbsUp, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Alert, Card, Empty, Field, PageHeader, PageLoader, Select, Textarea } from '@/components/ui/kit';
import { ChildPicker, fmtDate, StudentPicker } from '@/features/portal/shared';
import { useApi } from '@/hooks/use-api';
import { useAuth } from '@/hooks/use-auth';
import { api, errorMessage } from '@/lib/client';

const CAT = {
  positive: { label: 'Positive', icon: ThumbsUp, cls: 'bg-emerald-50 text-emerald-800 border-emerald-200' },
  improvement: { label: 'Needs improvement', icon: Lightbulb, cls: 'bg-amber-50 text-amber-800 border-amber-200' },
  concern: { label: 'Concern', icon: ShieldAlert, cls: 'bg-red-50 text-red-800 border-red-200' },
  general: { label: 'General', icon: MessageSquareText, cls: 'bg-sky-50 text-sky-800 border-sky-200' },
} as const;

function RemarkCard({ r, onDelete }: { r: any; onDelete?: () => void }) {
  const c = CAT[r.category as keyof typeof CAT] ?? CAT.general;
  const Icon = c.icon;
  return (
    <li className={`rounded-2xl border p-4 ${c.cls}`}>
      <div className="flex items-start justify-between gap-3">
        <span className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider"><Icon size={15} /> {c.label}{r.subject?.name ? ` · ${r.subject.name}` : ''}{r.visibleToParent === false && ' · private'}</span>
        {onDelete && <button onClick={onDelete} aria-label="Delete remark" className="text-slate-500 hover:text-red-600"><Trash2 size={15} /></button>}
      </div>
      <p className="mt-2 whitespace-pre-wrap text-[15px] text-slate-800">{r.text}</p>
      <p className="mt-2 text-xs text-slate-600">— {r.teacherName ?? 'Teacher'} · {fmtDate(r.createdAt)}{r.student?.firstName ? ` · ${r.student.firstName} ${r.student.lastName}` : ''}</p>
    </li>
  );
}

function Family() {
  const [child, setChild] = useState('');
  const list = useApi<any[]>(child ? `/remarks/student/${child}` : null);
  return (
    <>
      <div className="mb-4"><ChildPicker value={child} onChange={setChild} /></div>
      {list.loading ? <PageLoader /> : !(list.data ?? []).length ? <Empty>No teacher remarks yet.</Empty> : <ul className="grid gap-3">{(list.data ?? []).map((r) => <RemarkCard key={r._id} r={r} />)}</ul>}
    </>
  );
}

function Teacher() {
  const mine = useApi<any[]>('/remarks/mine');
  const [student, setStudent] = useState('');
  const [f, setF] = useState({ category: 'positive', text: '', visibleToParent: true });
  const [msg, setMsg] = useState<{ tone: 'success' | 'error'; text: string } | null>(null);
  const [key, setKey] = useState(0);
  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_1.2fr]">
      <Card>
        <h2 className="mb-3 font-sans text-base font-semibold">Write a remark</h2>
        <form className="grid gap-3" onSubmit={async (e) => { e.preventDefault(); setMsg(null); try { await api('/remarks', { body: { studentId: student, ...f } }); setMsg({ tone: 'success', text: 'Remark saved' + (f.visibleToParent ? ' and the parent was notified.' : ' (private).') }); setF({ ...f, text: '' }); setStudent(''); setKey((k) => k + 1); mine.reload(); } catch (er) { setMsg({ tone: 'error', text: errorMessage(er) }); } }}>
          {msg && <Alert tone={msg.tone}>{msg.text}</Alert>}
          <Field label="Student"><StudentPicker key={key} value={student} onChange={(id) => setStudent(id)} /></Field>
          <Field label="Type"><Select value={f.category} onChange={(e) => setF({ ...f, category: e.target.value })}>{Object.entries(CAT).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}</Select></Field>
          <Field label="Remark"><Textarea required minLength={3} maxLength={2000} value={f.text} onChange={(e) => setF({ ...f, text: e.target.value })} placeholder="Be specific, factual and constructive." /></Field>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={f.visibleToParent} onChange={(e) => setF({ ...f, visibleToParent: e.target.checked })} /> Visible to parent and student</label>
          <Button disabled={!student}>Save remark</Button>
        </form>
      </Card>
      <div>
        <h2 className="mb-3 font-sans text-base font-semibold">My recent remarks</h2>
        {mine.loading ? <PageLoader /> : !(mine.data ?? []).length ? <Empty>You haven&apos;t written any remarks yet.</Empty> : (
          <ul className="grid gap-3">{(mine.data ?? []).map((r) => <RemarkCard key={r._id} r={r} onDelete={async () => { if (confirm('Delete this remark?')) { await api(`/remarks/${r._id}`, { method: 'DELETE' }); mine.reload(); } }} />)}</ul>
        )}
      </div>
    </div>
  );
}

function Leadership() {
  const [student, setStudent] = useState('');
  const list = useApi<any[]>(student ? `/remarks/student/${student}` : null);
  return (
    <>
      <div className="mb-4 max-w-md"><StudentPicker value={student} onChange={(id) => setStudent(id)} /></div>
      {student && (list.loading ? <PageLoader /> : !(list.data ?? []).length ? <Empty>No remarks for this student.</Empty> : <ul className="grid gap-3">{(list.data ?? []).map((r) => <RemarkCard key={r._id} r={r} />)}</ul>)}
    </>
  );
}

export default function RemarksPage() {
  const { can } = useAuth();
  return (
    <>
      <PageHeader title="Teacher remarks" subtitle={can('remarks:write') ? 'Share progress notes with parents and track your feedback.' : "Your teachers' feedback and progress notes."} />
      {can('remarks:write') ? <Teacher /> : can('remarks:read') ? <Leadership /> : <Family />}
    </>
  );
}
