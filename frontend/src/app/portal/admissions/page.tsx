'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Alert, Badge, Card, DataTable, Field, Input, Modal, PageHeader, PageLoader, Pager, Select, Textarea, statusTone } from '@/components/ui/kit';
import { fmtDate, sectionLabel, useAcademics } from '@/features/portal/shared';
import { useApi } from '@/hooks/use-api';
import { useAuth } from '@/hooks/use-auth';
import { api, download, errorMessage } from '@/lib/client';

const STATUSES = ['submitted', 'under_review', 'documents_required', 'approved', 'rejected', 'waitlisted'];

function Detail({ id, onChanged }: { id: string; onChanged: () => void }) {
  const { can } = useAuth();
  const ac = useAcademics();
  const d = useApi<any>(`/admissions/${id}`);
  const [msg, setMsg] = useState<{ tone: 'success' | 'error'; text: string } | null>(null);
  const [note, setNote] = useState('');
  const [status, setStatus] = useState('');
  const [statusNote, setStatusNote] = useState('');
  const [iv, setIv] = useState({ scheduledAt: '', venue: '' });
  const [conv, setConv] = useState({ class: '', section: '', academicYear: '', rollNumber: '' });
  const run = async (fn: () => Promise<unknown>, ok: string) => { setMsg(null); try { await fn(); setMsg({ tone: 'success', text: ok }); d.reload(); onChanged(); } catch (e) { setMsg({ tone: 'error', text: errorMessage(e) }); } };
  if (d.loading) return <PageLoader />;
  const a = d.data; if (!a) return <Alert>{d.error}</Alert>;
  const write = can('admissions:write');
  return (
    <div className="grid gap-4 text-sm">
      {msg && <Alert tone={msg.tone}>{msg.text}</Alert>}
      <Card className="!p-4">
        <p className="text-xs uppercase tracking-wider text-slate-500">{a.applicationNumber}</p>
        <h3 className="font-sans text-lg font-semibold">{a.student.firstName} {a.student.lastName} · Class {a.classApplying}</h3>
        <p>DOB {fmtDate(a.student.dob)} · {a.student.gender} · Year {a.academicYear}</p>
        <p className="mt-2">Guardian: <b>{a.guardian.name}</b> ({a.guardian.relation}) · {a.guardian.phone} · {a.guardian.email}</p>
        {a.previousSchool?.name && <p>Previous school: {a.previousSchool.name} ({a.previousSchool.lastClass})</p>}
        <p className="mt-2"><Badge tone={statusTone(a.status)}>{a.status.replace('_', ' ')}</Badge> {a.convertedStudent && <Badge tone="green">converted</Badge>}</p>
      </Card>
      <Card className="!p-4">
        <h4 className="mb-2 font-semibold">Documents</h4>
        {a.documents.length ? <ul className="grid gap-2">{a.documents.map((x: any) => (
          <li key={x.document?._id} className="flex flex-wrap items-center justify-between gap-2">
            <span>{x.type.replace('_', ' ')} · {x.document?.originalName}</span>
            <span className="flex gap-2">
              <Button size="sm" variant="outline" onClick={() => download(`/documents/${x.document._id}`, x.document.originalName)}>Open</Button>
              {write && (x.verified ? <Badge tone="green">verified</Badge> : <Button size="sm" onClick={() => run(() => api(`/admissions/${id}/documents/${x.document._id}/verify`, { body: {} }), 'Document verified')}>Verify</Button>)}
            </span>
          </li>))}</ul> : <p className="text-slate-500">No documents uploaded.</p>}
      </Card>
      {write && !a.convertedStudent && (
        <>
          <Card className="!p-4">
            <h4 className="mb-2 font-semibold">Update status</h4>
            <div className="grid gap-2 sm:grid-cols-[200px_1fr_auto]">
              <Select value={status} onChange={(e) => setStatus(e.target.value)}><option value="">Select…</option>{STATUSES.map((s) => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}</Select>
              <Input placeholder="Note to parent (optional)" value={statusNote} onChange={(e) => setStatusNote(e.target.value)} />
              <Button disabled={!status} onClick={() => run(() => api(`/admissions/${id}/status`, { method: 'PATCH', body: { status, note: statusNote || undefined } }), 'Status updated and parent notified')}>Update</Button>
            </div>
            <h4 className="mb-2 mt-4 font-semibold">Schedule interview</h4>
            <div className="grid gap-2 sm:grid-cols-[1fr_1fr_auto]"><Input type="datetime-local" value={iv.scheduledAt} onChange={(e) => setIv({ ...iv, scheduledAt: e.target.value })} /><Input placeholder="Venue" value={iv.venue} onChange={(e) => setIv({ ...iv, venue: e.target.value })} /><Button disabled={!iv.scheduledAt} onClick={() => run(() => api(`/admissions/${id}/interview`, { body: { scheduledAt: new Date(iv.scheduledAt).toISOString(), venue: iv.venue || undefined } }), 'Interview scheduled')}>Schedule</Button></div>
          </Card>
          {a.status === 'approved' && (
            <Card className="!p-4">
              <h4 className="mb-2 font-semibold">Convert to student</h4>
              <div className="grid gap-2 sm:grid-cols-4">
                <Select value={conv.academicYear} onChange={(e) => setConv({ ...conv, academicYear: e.target.value })}><option value="">Year…</option>{ac.years.map((y) => <option key={y._id} value={y._id}>{y.name}</option>)}</Select>
                <Select value={conv.class} onChange={(e) => setConv({ ...conv, class: e.target.value, section: '' })}><option value="">Class…</option>{ac.classes.map((c) => <option key={c._id} value={c._id}>{c.name}</option>)}</Select>
                <Select value={conv.section} onChange={(e) => setConv({ ...conv, section: e.target.value })}><option value="">Section…</option>{ac.sections.filter((s) => (s.class?._id ?? s.class) === conv.class).map((s) => <option key={s._id} value={s._id}>{sectionLabel(s)}</option>)}</Select>
                <Input type="number" placeholder="Roll no." value={conv.rollNumber} onChange={(e) => setConv({ ...conv, rollNumber: e.target.value })} />
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <Button disabled={!conv.class || !conv.section || !conv.academicYear} onClick={() => run(async () => { const r = await api<any>(`/admissions/${id}/convert`, { body: { class: conv.class, section: conv.section, academicYear: conv.academicYear, ...(conv.rollNumber ? { rollNumber: Number(conv.rollNumber) } : {}) } }); setMsg({ tone: 'success', text: `Student ${r.admissionNumber} created. Parent account: ${r.parentEmail}${r.temporaryPassword ? ` · temp password ${r.temporaryPassword}` : ' (credentials emailed)'}` }); }, 'Converted')}>Create student & parent account</Button>
                <Button variant="outline" onClick={() => download(`/admissions/${id}/letter`, `admission-${a.applicationNumber}.pdf`)}>Admission letter</Button>
              </div>
            </Card>
          )}
          <Card className="!p-4">
            <h4 className="mb-2 font-semibold">Internal notes</h4>
            <ul className="mb-2 grid gap-1 text-slate-700">{a.notes.map((n: any, i: number) => <li key={i}>• {n.text} <span className="text-xs text-slate-400">{fmtDate(n.at)}</span></li>)}</ul>
            <div className="flex gap-2"><Textarea className="min-h-[60px]" value={note} onChange={(e) => setNote(e.target.value)} /><Button disabled={!note.trim()} onClick={() => run(async () => { await api(`/admissions/${id}/notes`, { body: { text: note } }); setNote(''); }, 'Note added')}>Add</Button></div>
          </Card>
        </>
      )}
    </div>
  );
}

export default function AdmissionsAdmin() {
  const [page, setPage] = useState(1);
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('');
  const [sel, setSel] = useState<string | null>(null);
  const list = useApi<any[]>(`/admissions?page=${page}&limit=20&q=${encodeURIComponent(q)}${status ? `&status=${status}` : ''}`);
  return (
    <>
      <PageHeader title="Admissions" subtitle="Review applications, verify documents and convert approved applicants into students." />
      <div className="mb-4 flex flex-col gap-3 sm:flex-row">
        <Input placeholder="Search name, phone, application no." value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} className="sm:max-w-sm" aria-label="Search" />
        <Select value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }} className="sm:max-w-[220px]" aria-label="Status filter"><option value="">All statuses</option>{STATUSES.map((s) => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}</Select>
      </div>
      {list.error && <Alert>{list.error}</Alert>}
      {!list.loading && <DataTable rows={list.data ?? []} onRowClick={(r) => setSel(r._id)} columns={[
        { key: 'applicationNumber', label: 'Application' }, { key: 's', label: 'Student', render: (r) => `${r.student.firstName} ${r.student.lastName}` }, { key: 'classApplying', label: 'Class' },
        { key: 'g', label: 'Guardian', render: (r) => `${r.guardian.name} · ${r.guardian.phone}` }, { key: 'status', label: 'Status', render: (r) => <Badge tone={statusTone(r.status)}>{r.status.replace('_', ' ')}</Badge> },
      ]} />}
      {list.meta && <Pager page={page} limit={list.meta.limit ?? 20} total={list.meta.total ?? 0} onPage={setPage} />}
      <Modal open={!!sel} onClose={() => setSel(null)} title="Application">{sel && <Detail id={sel} onChanged={list.reload} />}</Modal>
    </>
  );
}
