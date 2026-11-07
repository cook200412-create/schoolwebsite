'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { Download, Plus, Upload } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Alert, DataTable, Field, Input, Modal, PageHeader, Pager, Select, Textarea, Badge, statusTone } from '@/components/ui/kit';
import { useAcademics, sectionLabel } from '@/features/portal/shared';
import { useApi } from '@/hooks/use-api';
import { useAuth } from '@/hooks/use-auth';
import { api, download, errorMessage } from '@/lib/client';

const schema = z.object({
  firstName: z.string().trim().min(1, 'Required'), lastName: z.string().trim().optional(), dob: z.string().min(1, 'Required'),
  gender: z.enum(['male', 'female', 'other']), class: z.string().min(1, 'Choose a class'), section: z.string().min(1, 'Choose a section'),
  academicYear: z.string().min(1, 'Choose a year'), rollNumber: z.coerce.number().int().positive().optional().or(z.literal('').transform(() => undefined)),
  phone: z.string().optional(), createAccount: z.boolean().optional(), accountEmail: z.string().email('Valid email').optional().or(z.literal('')),
});

function AddStudent({ onDone }: { onDone: () => void }) {
  const ac = useAcademics();
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<string | null>(null);
  const { register, handleSubmit, watch, formState: { errors, isSubmitting } } = useForm<z.infer<typeof schema>>({ resolver: zodResolver(schema) as any });
  const cls = watch('class');
  return (
    <form className="grid gap-3" noValidate onSubmit={handleSubmit(async (v) => {
      setError(null);
      try {
        const r = await api<{ temporaryPassword?: string; student: { studentId: string } }>('/students', { body: { ...v, accountEmail: v.accountEmail || undefined } });
        setCreated(`Created ${r.student.studentId}.${r.temporaryPassword ? ` Temporary password: ${r.temporaryPassword}` : ''}`);
        onDone();
      } catch (e) { setError(errorMessage(e)); }
    })}>
      {error && <Alert>{error}</Alert>}{created && <Alert tone="success">{created}</Alert>}
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="First name" error={errors.firstName?.message}><Input {...register('firstName')} /></Field>
        <Field label="Last name"><Input {...register('lastName')} /></Field>
        <Field label="Date of birth" error={errors.dob?.message}><Input type="date" {...register('dob')} /></Field>
        <Field label="Gender"><Select {...register('gender')}><option value="male">Male</option><option value="female">Female</option><option value="other">Other</option></Select></Field>
        <Field label="Academic year" error={errors.academicYear?.message}><Select {...register('academicYear')}><option value="">Select…</option>{ac.years.map((y) => <option key={y._id} value={y._id}>{y.name}</option>)}</Select></Field>
        <Field label="Class" error={errors.class?.message}><Select {...register('class')}><option value="">Select…</option>{ac.classes.map((c) => <option key={c._id} value={c._id}>{c.name}</option>)}</Select></Field>
        <Field label="Section" error={errors.section?.message}><Select {...register('section')}><option value="">Select…</option>{ac.sections.filter((s) => !cls || (s.class?._id ?? s.class) === cls).map((s) => <option key={s._id} value={s._id}>{sectionLabel(s)}</option>)}</Select></Field>
        <Field label="Roll number"><Input type="number" {...register('rollNumber')} /></Field>
        <Field label="Contact phone"><Input type="tel" {...register('phone')} /></Field>
        <Field label="Student login email (optional)" error={errors.accountEmail?.message}><Input type="email" {...register('accountEmail')} /></Field>
      </div>
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" {...register('createAccount')} /> Create a student portal login</label>
      <Button disabled={isSubmitting}>{isSubmitting ? 'Saving…' : 'Add student'}</Button>
    </form>
  );
}

function ImportCsv({ onDone }: { onDone: () => void }) {
  const [csv, setCsv] = useState('');
  const [msg, setMsg] = useState<{ tone: 'success' | 'error'; text: string } | null>(null);
  return (
    <div className="grid gap-3">
      <p className="text-sm text-slate-600">Columns: <code>firstName,lastName,dob,gender,class,section,academicYear,rollNumber</code> (class/section/year by name, e.g. 8, A, 2026-27).</p>
      <input type="file" accept=".csv,text/csv" onChange={async (e) => { const f = e.target.files?.[0]; if (f) setCsv(await f.text()); }} />
      <Textarea value={csv} onChange={(e) => setCsv(e.target.value)} placeholder="…or paste CSV here" />
      {msg && <Alert tone={msg.tone}>{msg.text}</Alert>}
      <Button disabled={!csv} onClick={async () => {
        try { const r = await api<{ created: number; errors: { row: number; message: string }[] }>('/students/import', { body: { csv } }); setMsg({ tone: r.errors.length ? 'error' : 'success', text: `${r.created} imported. ${r.errors.map((x) => `Row ${x.row}: ${x.message}`).join(' · ')}` }); onDone(); }
        catch (e) { setMsg({ tone: 'error', text: errorMessage(e) }); }
      }}>Import</Button>
    </div>
  );
}

export default function StudentsPage() {
  const { can } = useAuth();
  const router = useRouter();
  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);
  const [section, setSection] = useState('');
  const [modal, setModal] = useState<'add' | 'import' | null>(null);
  const ac = useAcademics();
  const { data, meta, loading, error, reload } = useApi<any[]>(`/students?page=${page}&limit=20&q=${encodeURIComponent(q)}${section ? `&section=${section}` : ''}`);
  return (
    <>
      <PageHeader title="Students" subtitle="Search and manage student records you are authorised to see."
        actions={<>
          {can('students:write') && <Button onClick={() => setModal('add')}><Plus size={16} /> Add student</Button>}
          {can('students:write') && <Button variant="outline" onClick={() => setModal('import')}><Upload size={16} /> Import CSV</Button>}
          {can('students:read') && <Button variant="outline" onClick={() => download('/students/export', 'students.csv').catch((e) => alert(errorMessage(e)))}><Download size={16} /> Export</Button>}
        </>} />
      {can('students:read') && (
        <div className="mb-4 flex flex-col gap-3 sm:flex-row">
          <Input placeholder="Search name, admission no…" value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} className="sm:max-w-sm" aria-label="Search students" />
          <Select value={section} onChange={(e) => { setSection(e.target.value); setPage(1); }} className="sm:max-w-[200px]" aria-label="Filter by section">
            <option value="">All sections</option>{ac.sections.map((s) => <option key={s._id} value={s._id}>{sectionLabel(s)}</option>)}
          </Select>
        </div>
      )}
      {error && <Alert>{error}</Alert>}
      {!loading && <DataTable rows={data ?? []} onRowClick={(r) => router.push(`/portal/students/${r._id}`)} columns={[
        { key: 'studentId', label: 'Student ID' },
        { key: 'name', label: 'Name', render: (r) => `${r.firstName} ${r.lastName}` },
        { key: 'class', label: 'Class', render: (r) => `${r.class?.name ?? ''}-${r.section?.name ?? ''}` },
        { key: 'rollNumber', label: 'Roll' },
        { key: 'status', label: 'Status', render: (r) => <Badge tone={statusTone(r.status)}>{r.status}</Badge> },
      ]} />}
      {meta && <Pager page={page} limit={meta.limit ?? 20} total={meta.total ?? 0} onPage={setPage} />}
      <Modal open={modal === 'add'} onClose={() => setModal(null)} title="Add student"><AddStudent onDone={reload} /></Modal>
      <Modal open={modal === 'import'} onClose={() => setModal(null)} title="Import students (CSV)"><ImportCsv onDone={reload} /></Modal>
    </>
  );
}
