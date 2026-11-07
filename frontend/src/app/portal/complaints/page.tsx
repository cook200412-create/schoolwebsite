'use client';

import { Send } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Alert, Badge, Card, Empty, Field, Input, Modal, PageHeader, PageLoader, Select, Textarea } from '@/components/ui/kit';
import { fmtDate, useChildren } from '@/features/portal/shared';
import { useApi } from '@/hooks/use-api';
import { useAuth } from '@/hooks/use-auth';
import { api, errorMessage } from '@/lib/client';
import { cn } from '@/lib/utils';

const CATEGORIES = [['teacher', 'About a teacher'], ['academic', 'Academics / homework'], ['fees', 'Fees & payments'], ['transport', 'Transport'], ['safety', 'Safety & discipline'], ['facilities', 'Facilities'], ['other', 'Other']];
const STATUS_TONE: Record<string, 'amber' | 'blue' | 'green' | 'gray'> = { open: 'amber', in_review: 'blue', resolved: 'green', closed: 'gray' };

function Thread({ id, manage, onChanged }: { id: string; manage: boolean; onChanged: () => void }) {
  const t = useApi<any>(`/complaints/${id}`);
  const [text, setText] = useState('');
  const [internal, setInternal] = useState(false);
  const [error, setError] = useState<string | null>(null);
  if (t.loading) return <PageLoader />;
  const c = t.data; if (!c) return <Alert>{t.error}</Alert>;
  const act = async (fn: () => Promise<unknown>) => { setError(null); try { await fn(); t.reload(); onChanged(); } catch (e) { setError(errorMessage(e)); } };
  return (
    <div className="grid gap-4 text-sm">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">{c.ticketNumber} · {c.category}</p>
        <h3 className="font-sans text-lg font-semibold">{c.subject}</h3>
        <p className="mt-1 text-xs text-slate-500">{c.parentUser?.name}{c.student ? ` · about ${c.student.firstName} ${c.student.lastName}` : ''} · {fmtDate(c.createdAt)}</p>
        <p className="mt-3 whitespace-pre-wrap rounded-xl bg-slate-50 p-3 text-slate-700">{c.description}</p>
      </div>
      <div className="flex flex-wrap items-center gap-2"><Badge tone={STATUS_TONE[c.status]}>{c.status.replace('_', ' ')}</Badge>
        {manage && ['in_review', 'resolved', 'closed'].filter((s) => s !== c.status).map((s) => <Button key={s} size="sm" variant="outline" onClick={() => act(() => api(`/complaints/${id}/status`, { method: 'PATCH', body: { status: s } }))}>Mark {s.replace('_', ' ')}</Button>)}</div>
      <ul className="grid gap-2">
        {c.replies.map((r: any, i: number) => (
          <li key={i} className={cn('rounded-xl p-3', r.internal ? 'border border-dashed border-amber-300 bg-amber-50' : r.byRole === 'parent' ? 'bg-sky-50' : 'bg-navy-50')}>
            <p className="text-xs font-semibold text-navy-800">{r.byName} <span className="font-normal text-slate-500">· {r.byRole?.replace('_', ' ')} · {new Date(r.at).toLocaleString('en-IN')}</span>{r.internal && <b className="ml-2 text-amber-700">internal note</b>}</p>
            <p className="mt-1 whitespace-pre-wrap">{r.text}</p>
          </li>
        ))}
      </ul>
      {error && <Alert>{error}</Alert>}
      {c.status !== 'closed' && (
        <div className="grid gap-2">
          <Textarea className="min-h-[80px]" placeholder="Write a reply…" value={text} onChange={(e) => setText(e.target.value)} />
          <div className="flex flex-wrap items-center justify-between gap-2">
            {manage ? <label className="flex items-center gap-2 text-xs"><input type="checkbox" checked={internal} onChange={(e) => setInternal(e.target.checked)} /> Internal note (not visible to parent)</label> : <span />}
            <Button disabled={!text.trim()} onClick={() => act(async () => { await api(`/complaints/${id}/replies`, { body: { text, internal } }); setText(''); })}><Send size={15} /> Send reply</Button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function ComplaintsPage() {
  const { can } = useAuth();
  const manage = can('complaints:manage');
  const [status, setStatus] = useState('');
  const list = useApi<any[]>(`/complaints?limit=50${status ? `&status=${status}` : ''}`);
  const { children } = useChildren();
  const [open, setOpen] = useState(false);
  const [sel, setSel] = useState<string | null>(null);
  const [f, setF] = useState({ category: 'academic', subject: '', description: '', studentId: '', priority: 'normal' });
  const [error, setError] = useState<string | null>(null);

  return (
    <>
      <PageHeader title={manage ? 'Parent complaints' : 'Complaints & feedback'} subtitle={manage ? 'Review, reply to and resolve concerns raised by parents.' : 'Raise a concern with the school and follow it until it is resolved.'} actions={!manage && <Button onClick={() => { setOpen(true); setError(null); }}>Raise a complaint</Button>} />
      {manage && <Select aria-label="Status filter" value={status} onChange={(e) => setStatus(e.target.value)} className="mb-4 max-w-[220px]"><option value="">All statuses</option>{['open', 'in_review', 'resolved', 'closed'].map((s) => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}</Select>}
      {list.loading ? <PageLoader /> : !(list.data ?? []).length ? <Empty>{manage ? 'No complaints to show.' : 'You have not raised any complaints. Use the button above if you need to contact the school about a concern.'}</Empty> : (
        <ul className="grid gap-3">
          {(list.data ?? []).map((c) => (
            <li key={c._id}><button onClick={() => setSel(c._id)} className="w-full text-left"><Card className="!p-4 transition hover:shadow-lift">
              <div className="flex flex-wrap items-center justify-between gap-2"><span className="text-xs font-semibold uppercase tracking-wider text-slate-500">{c.ticketNumber} · {c.category}</span><Badge tone={STATUS_TONE[c.status]}>{c.status.replace('_', ' ')}</Badge></div>
              <p className="mt-1 font-sans text-base font-semibold text-navy-900">{c.subject}</p>
              <p className="mt-0.5 text-xs text-slate-500">{manage && c.parentUser ? `${c.parentUser.name} · ` : ''}{c.student ? `${c.student.firstName} · ` : ''}{c.replies.length} repl{c.replies.length === 1 ? 'y' : 'ies'} · updated {fmtDate(c.updatedAt)}</p>
            </Card></button></li>
          ))}
        </ul>
      )}
      <Modal open={!!sel} onClose={() => setSel(null)} title="Complaint">{sel && <Thread id={sel} manage={manage} onChanged={list.reload} />}</Modal>
      <Modal open={open} onClose={() => setOpen(false)} title="Raise a complaint">
        <form className="grid gap-3" onSubmit={async (e) => { e.preventDefault(); setError(null); try { await api('/complaints', { body: { ...f, studentId: f.studentId || undefined } }); setOpen(false); setF({ category: 'academic', subject: '', description: '', studentId: '', priority: 'normal' }); list.reload(); } catch (er) { setError(errorMessage(er)); } }}>
          {error && <Alert>{error}</Alert>}
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Category"><Select value={f.category} onChange={(e) => setF({ ...f, category: e.target.value })}>{CATEGORIES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</Select></Field>
            <Field label="Regarding child (optional)"><Select value={f.studentId} onChange={(e) => setF({ ...f, studentId: e.target.value })}><option value="">General</option>{children.map((c) => <option key={c._id} value={c._id}>{c.firstName} {c.lastName}</option>)}</Select></Field>
          </div>
          <Field label="Subject"><Input required minLength={3} maxLength={200} value={f.subject} onChange={(e) => setF({ ...f, subject: e.target.value })} /></Field>
          <Field label="Describe the issue" hint="At least 10 characters. The Principal and administration will see this."><Textarea required minLength={10} value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} /></Field>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={f.priority === 'high'} onChange={(e) => setF({ ...f, priority: e.target.checked ? 'high' : 'normal' })} /> This is urgent</label>
          <Button>Submit complaint</Button>
        </form>
      </Modal>
    </>
  );
}
