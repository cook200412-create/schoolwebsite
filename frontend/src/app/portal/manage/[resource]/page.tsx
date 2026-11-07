'use client';

import Link from 'next/link';
import { use, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Alert, DataTable, Empty, Field, Input, Modal, PageHeader, PageLoader, Select, Textarea, Badge } from '@/components/ui/kit';
import { useAcademics } from '@/features/portal/shared';
import { useApi } from '@/hooks/use-api';
import { useAuth } from '@/hooks/use-auth';
import { api, errorMessage } from '@/lib/client';
import { cn } from '@/lib/utils';

type FieldDef = { name: string; label: string; type?: 'text' | 'number' | 'date' | 'select' | 'textarea' | 'checkbox' | 'tags' | 'url'; options?: string[] | 'classes' | 'years'; required?: boolean };
interface Resource { title: string; endpoint: string; perm: string; group: 'academics' | 'people' | 'content'; fields: FieldDef[]; columns: { key: string; label: string; render?: (r: any) => React.ReactNode }[]; note?: string }

const LEVELS = ['pre-primary', 'primary', 'middle', 'secondary'];
const RESOURCES: Record<string, Resource> = {
  classes: { title: 'Classes', endpoint: '/classes', perm: 'academics:write', group: 'academics', fields: [{ name: 'name', label: 'Class name', required: true }, { name: 'level', label: 'Section of school', type: 'select', options: LEVELS, required: true }, { name: 'order', label: 'Order', type: 'number' }, { name: 'description', label: 'Description', type: 'textarea' }, { name: 'curriculum', label: 'Curriculum', type: 'textarea' }], columns: [{ key: 'name', label: 'Class' }, { key: 'level', label: 'Level' }, { key: 'order', label: 'Order' }] },
  sections: { title: 'Sections', endpoint: '/sections', perm: 'academics:write', group: 'academics', fields: [{ name: 'class', label: 'Class', type: 'select', options: 'classes', required: true }, { name: 'name', label: 'Section name', required: true }, { name: 'capacity', label: 'Capacity', type: 'number' }, { name: 'room', label: 'Room' }], columns: [{ key: 'class', label: 'Class', render: (r) => r.class?.name }, { key: 'name', label: 'Section' }, { key: 'capacity', label: 'Capacity' }, { key: 'room', label: 'Room' }] },
  subjects: { title: 'Subjects', endpoint: '/subjects', perm: 'academics:write', group: 'academics', fields: [{ name: 'name', label: 'Subject', required: true }, { name: 'code', label: 'Code', required: true }], columns: [{ key: 'name', label: 'Subject' }, { key: 'code', label: 'Code' }] },
  'academic-years': { title: 'Academic years', endpoint: '/academic-years', perm: 'academics:write', group: 'academics', fields: [{ name: 'name', label: 'Name (e.g. 2026-27)', required: true }, { name: 'startDate', label: 'Start', type: 'date', required: true }, { name: 'endDate', label: 'End', type: 'date', required: true }], columns: [{ key: 'name', label: 'Year' }, { key: 'isCurrent', label: 'Current', render: (r) => (r.isCurrent ? <Badge tone="green">current</Badge> : '') }] },
  events: { title: 'Calendar & events', endpoint: '/events', perm: 'announcements:write', group: 'academics', fields: [{ name: 'title', label: 'Title', required: true }, { name: 'type', label: 'Type', type: 'select', options: ['event', 'holiday', 'exam', 'meeting'] }, { name: 'startsAt', label: 'Starts', type: 'date', required: true }, { name: 'endsAt', label: 'Ends', type: 'date' }, { name: 'location', label: 'Location' }, { name: 'description', label: 'Description', type: 'textarea' }, { name: 'isPublic', label: 'Show on public website', type: 'checkbox' }], columns: [{ key: 'title', label: 'Title' }, { key: 'type', label: 'Type' }, { key: 'startsAt', label: 'Date', render: (r) => new Date(r.startsAt).toLocaleDateString('en-IN') }] },
  teachers: { title: 'Teachers (faculty directory)', endpoint: '/teachers', perm: 'teachers:write', group: 'people', note: 'Login accounts are created under Users & roles (role: Teacher). Tick “Show on public website” only with the teacher’s consent.', fields: [{ name: 'employeeId', label: 'Employee ID', required: true }, { name: 'name', label: 'Full name', required: true }, { name: 'designation', label: 'Designation' }, { name: 'specialization', label: 'Subject specialization' }, { name: 'qualifications', label: 'Qualifications (comma separated)', type: 'tags' }, { name: 'experienceYears', label: 'Experience (years)', type: 'number' }, { name: 'classesHandled', label: 'Classes handled (comma separated)', type: 'tags' }, { name: 'photoUrl', label: 'Photo URL', type: 'url' }, { name: 'bio', label: 'Short biography', type: 'textarea' }, { name: 'isPublic', label: 'Show on public website', type: 'checkbox' }], columns: [{ key: 'employeeId', label: 'ID' }, { key: 'name', label: 'Name' }, { key: 'designation', label: 'Designation' }, { key: 'isPublic', label: 'Public', render: (r) => (r.isPublic ? <Badge tone="green">yes</Badge> : <Badge>no</Badge>) }] },
  staff: { title: 'Staff', endpoint: '/staff', perm: 'staff:write', group: 'people', fields: [{ name: 'employeeId', label: 'Employee ID', required: true }, { name: 'name', label: 'Full name', required: true }, { name: 'department', label: 'Department' }, { name: 'designation', label: 'Designation' }, { name: 'phone', label: 'Phone' }, { name: 'email', label: 'Email' }], columns: [{ key: 'employeeId', label: 'ID' }, { key: 'name', label: 'Name' }, { key: 'department', label: 'Department' }, { key: 'designation', label: 'Designation' }] },
  gallery: { title: 'Gallery', endpoint: '/gallery', perm: 'cms:write', group: 'content', note: 'Photos showing identifiable students are published only after guardian consent is confirmed.', fields: [{ name: 'url', label: 'Image URL (Cloudinary)', type: 'url', required: true }, { name: 'caption', label: 'Caption' }, { name: 'category', label: 'Category', type: 'select', options: ['campus', 'classroom', 'sports', 'annual-day', 'cultural', 'trips', 'competitions'], required: true }, { name: 'hasStudents', label: 'Shows identifiable students', type: 'checkbox' }, { name: 'consentConfirmed', label: 'Guardian consent confirmed', type: 'checkbox' }, { name: 'isPublished', label: 'Published', type: 'checkbox' }], columns: [{ key: 'caption', label: 'Caption' }, { key: 'category', label: 'Category' }, { key: 'isPublished', label: 'Published', render: (r) => (r.isPublished ? <Badge tone="green">yes</Badge> : <Badge>no</Badge>) }] },
  achievements: { title: 'Results & achievements', endpoint: '/achievements', perm: 'cms:write', group: 'content', note: 'Only items marked Published appear on the public Results page. Named students require consent.', fields: [{ name: 'title', label: 'Title', required: true }, { name: 'category', label: 'Category', type: 'select', options: ['academic', 'topper', 'award', 'competition', 'statistic'], required: true }, { name: 'year', label: 'Year' }, { name: 'studentName', label: 'Student name (optional)' }, { name: 'description', label: 'Description', type: 'textarea' }, { name: 'consentConfirmed', label: 'Guardian consent confirmed', type: 'checkbox' }, { name: 'isPublished', label: 'Published', type: 'checkbox' }], columns: [{ key: 'title', label: 'Title' }, { key: 'category', label: 'Category' }, { key: 'isPublished', label: 'Published', render: (r) => (r.isPublished ? <Badge tone="green">yes</Badge> : <Badge>no</Badge>) }] },
};

function Form({ res, initial, onSaved }: { res: Resource; initial?: any; onSaved: () => void }) {
  const ac = useAcademics();
  const [v, setV] = useState<Record<string, any>>(() => Object.fromEntries(res.fields.map((f) => {
    const raw = initial?.[f.name];
    const val = f.type === 'tags' ? (raw ?? []).join(', ') : f.type === 'date' && raw ? String(raw).slice(0, 10) : f.name === 'class' ? (raw?._id ?? raw ?? '') : raw ?? (f.type === 'checkbox' ? false : '');
    return [f.name, val];
  })));
  const [error, setError] = useState<string | null>(null);
  const opts = (f: FieldDef) => (f.options === 'classes' ? ac.classes.map((c) => ({ v: c._id, l: c.name })) : f.options === 'years' ? ac.years.map((y) => ({ v: y._id, l: y.name })) : (f.options ?? []).map((o) => ({ v: o, l: o })));
  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setError(null);
    const body: Record<string, unknown> = {};
    for (const f of res.fields) {
      const x = v[f.name];
      if (f.type === 'tags') body[f.name] = String(x).split(',').map((s) => s.trim()).filter(Boolean);
      else if (f.type === 'number') { if (x !== '' && x != null) body[f.name] = Number(x); }
      else if (f.type === 'checkbox') body[f.name] = !!x;
      else if (x !== '' && x != null) body[f.name] = x;
    }
    try { await api(initial ? `${res.endpoint}/${initial._id}` : res.endpoint, { method: initial ? 'PATCH' : 'POST', body }); onSaved(); } catch (er) { setError(errorMessage(er)); }
  };
  return (
    <form className="grid gap-3" onSubmit={submit}>
      {error && <Alert>{error}</Alert>}
      {res.fields.map((f) => f.type === 'checkbox' ? (
        <label key={f.name} className="flex items-center gap-2 text-sm"><input type="checkbox" checked={!!v[f.name]} onChange={(e) => setV({ ...v, [f.name]: e.target.checked })} /> {f.label}</label>
      ) : (
        <Field key={f.name} label={f.label}>
          {f.type === 'select' ? <Select required={f.required} value={v[f.name]} onChange={(e) => setV({ ...v, [f.name]: e.target.value })}><option value="">Select…</option>{opts(f).map((o) => <option key={o.v} value={o.v}>{o.l}</option>)}</Select>
            : f.type === 'textarea' ? <Textarea value={v[f.name]} onChange={(e) => setV({ ...v, [f.name]: e.target.value })} />
            : <Input required={f.required} type={f.type === 'number' ? 'number' : f.type === 'date' ? 'date' : f.type === 'url' ? 'url' : 'text'} value={v[f.name]} onChange={(e) => setV({ ...v, [f.name]: e.target.value })} />}
        </Field>
      ))}
      <Button>{initial ? 'Save changes' : 'Create'}</Button>
    </form>
  );
}

export default function ManagePage({ params }: { params: Promise<{ resource: string }> }) {
  const { resource } = use(params);
  const { can } = useAuth();
  const res = RESOURCES[resource];
  const list = useApi<any[]>(res ? `${res.endpoint}?limit=100` : null);
  const [modal, setModal] = useState<{ initial?: any } | null>(null);
  const [err, setErr] = useState<string | null>(null);
  if (!res) return <Empty>Unknown resource.</Empty>;
  if (!can(res.perm)) return <Alert>You do not have permission to manage {res.title.toLowerCase()}.</Alert>;
  const visible = Object.entries(RESOURCES).filter(([, r]) => can(r.perm) && r.group === res.group);

  return (
    <>
      <PageHeader title={res.title} subtitle={res.note} actions={<Button onClick={() => setModal({})}>Add</Button>} />
      <div className="mb-4 flex flex-wrap gap-2">
        {visible.map(([k, r]) => <Link key={k} href={`/portal/manage/${k}`} className={cn('rounded-full px-4 py-1.5 text-sm font-semibold', k === resource ? 'bg-navy-800 text-white' : 'bg-white text-slate-600 shadow-card hover:bg-navy-50')}>{r.title}</Link>)}
      </div>
      {err && <Alert>{err}</Alert>}
      {list.loading ? <PageLoader /> : <DataTable rows={list.data ?? []} onRowClick={(r) => setModal({ initial: r })} columns={[...res.columns, { key: '_a', label: '', render: (r) => (
        <span className="flex gap-2" onClick={(e) => e.stopPropagation()}>
          {resource === 'academic-years' && !r.isCurrent && <Button size="sm" variant="outline" onClick={async () => { try { await api(`/academic-years/${r._id}/set-current`, { body: {} }); list.reload(); } catch (e) { setErr(errorMessage(e)); } }}>Set current</Button>}
          <Button size="sm" variant="ghost" onClick={async () => { if (confirm('Delete this record?')) { try { await api(`${res.endpoint}/${r._id}`, { method: 'DELETE' }); list.reload(); } catch (e) { setErr(errorMessage(e)); } } }}>Delete</Button>
        </span>) }]} />}
      <Modal open={!!modal} onClose={() => setModal(null)} title={modal?.initial ? `Edit ${res.title}` : `Add to ${res.title}`}>
        {modal && <Form res={res} initial={modal.initial} onSaved={() => { setModal(null); list.reload(); }} />}
      </Modal>
    </>
  );
}
