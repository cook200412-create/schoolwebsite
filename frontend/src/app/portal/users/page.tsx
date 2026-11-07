'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Alert, Badge, Card, DataTable, Field, Input, Modal, PageHeader, Pager, Select, Textarea } from '@/components/ui/kit';
import { ROLE_LABEL } from '@/features/portal/nav';
import { useApi } from '@/hooks/use-api';
import { useAuth } from '@/hooks/use-auth';
import { api, errorMessage } from '@/lib/client';

const ROLES = Object.keys(ROLE_LABEL);

function Roles() {
  const roles = useApi<{ name: string; permissions: string[]; customised: boolean }[]>('/roles');
  const [edit, setEdit] = useState<{ name: string; text: string } | null>(null);
  const [err, setErr] = useState<string | null>(null);
  return (
    <>
      {err && <Alert>{err}</Alert>}
      <div className="grid gap-3 md:grid-cols-2">
        {(roles.data ?? []).map((r) => (
          <Card key={r.name} className="!p-4">
            <div className="flex items-center justify-between"><h3 className="font-sans text-base font-semibold">{ROLE_LABEL[r.name]}</h3>{r.customised && <Badge tone="blue">customised</Badge>}</div>
            <p className="mt-2 line-clamp-3 text-xs text-slate-500">{r.permissions.join(' · ')}</p>
            {r.name !== 'super_admin' && <Button size="sm" variant="outline" className="mt-3" onClick={() => setEdit({ name: r.name, text: r.permissions.join('\n') })}>Edit permissions</Button>}
          </Card>
        ))}
      </div>
      <Modal open={!!edit} onClose={() => setEdit(null)} title={`Permissions: ${edit ? ROLE_LABEL[edit.name] : ''}`}>
        {edit && <div className="grid gap-3"><p className="text-sm text-slate-600">One permission per line, e.g. <code>students:read</code>. Changes apply within a minute. Only Super Admins can save.</p><Textarea className="min-h-[220px] font-mono text-xs" value={edit.text} onChange={(e) => setEdit({ ...edit, text: e.target.value })} />
          <Button onClick={async () => { try { await api(`/roles/${edit.name}`, { method: 'PUT', body: { permissions: edit.text.split('\n').map((s) => s.trim()).filter(Boolean) } }); setEdit(null); roles.reload(); } catch (e) { setErr(errorMessage(e)); setEdit(null); } }}>Save</Button></div>}
      </Modal>
    </>
  );
}

export default function UsersPage() {
  const { can, user } = useAuth();
  const [tab, setTab] = useState<'users' | 'roles'>('users');
  const [page, setPage] = useState(1);
  const [q, setQ] = useState('');
  const [role, setRole] = useState('');
  const list = useApi<any[]>(`/users?page=${page}&limit=20&q=${encodeURIComponent(q)}${role ? `&role=${role}` : ''}`);
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({ name: '', email: '', role: 'teacher', phone: '' });
  const [msg, setMsg] = useState<{ tone: 'success' | 'error'; text: string } | null>(null);
  const write = can('users:write');
  const patch = async (id: string, body: object) => { try { await api(`/users/${id}`, { method: 'PATCH', body }); list.reload(); } catch (e) { setMsg({ tone: 'error', text: errorMessage(e) }); } };
  return (
    <>
      <PageHeader title="Users & roles" subtitle="Create accounts, assign roles and disable access." actions={write && tab === 'users' && <Button onClick={() => setOpen(true)}>Create user</Button>} />
      <div className="mb-4 inline-flex rounded-xl bg-slate-200/60 p-1 text-sm font-semibold">
        {(['users', 'roles'] as const).map((t) => (t === 'roles' && !can('roles:read') ? null : <button key={t} onClick={() => setTab(t)} className={`rounded-lg px-4 py-2 capitalize ${tab === t ? 'bg-white shadow' : 'text-slate-600'}`}>{t}</button>))}
      </div>
      {msg && <div className="mb-3"><Alert tone={msg.tone}>{msg.text}</Alert></div>}
      {tab === 'roles' ? <Roles /> : (
        <>
          <div className="mb-4 flex flex-col gap-3 sm:flex-row"><Input placeholder="Search name or email" value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} className="sm:max-w-sm" aria-label="Search users" /><Select value={role} onChange={(e) => { setRole(e.target.value); setPage(1); }} className="sm:max-w-[220px]" aria-label="Role filter"><option value="">All roles</option>{ROLES.map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}</Select></div>
          <DataTable rows={list.data ?? []} columns={[
            { key: 'name', label: 'Name' }, { key: 'email', label: 'Email' },
            { key: 'role', label: 'Role', render: (r) => write && r._id !== user?.id ? <Select aria-label={`Role of ${r.name}`} className="h-9 py-1" value={r.role} onChange={(e) => patch(r._id, { role: e.target.value })}>{ROLES.map((x) => <option key={x} value={x}>{ROLE_LABEL[x]}</option>)}</Select> : ROLE_LABEL[r.role] },
            { key: 'isActive', label: 'Status', render: (r) => <Badge tone={r.isActive ? 'green' : 'red'}>{r.isActive ? 'active' : 'disabled'}</Badge> },
            { key: 'a', label: '', render: (r) => write && r._id !== user?.id && <Button size="sm" variant="outline" onClick={() => patch(r._id, { isActive: !r.isActive })}>{r.isActive ? 'Disable' : 'Enable'}</Button> },
          ]} />
          {list.meta && <Pager page={page} limit={list.meta.limit ?? 20} total={list.meta.total ?? 0} onPage={setPage} />}
        </>
      )}
      <Modal open={open} onClose={() => setOpen(false)} title="Create user">
        <form className="grid gap-3" onSubmit={async (e) => { e.preventDefault(); try { const r = await api<any>('/users', { body: { ...f, phone: f.phone || undefined } }); setOpen(false); setMsg({ tone: 'success', text: `Account created for ${r.email}. ${r.temporaryPassword ? `Temporary password: ${r.temporaryPassword}` : 'Credentials were emailed.'}` }); list.reload(); } catch (er) { setMsg({ tone: 'error', text: errorMessage(er) }); setOpen(false); } }}>
          <Field label="Full name"><Input required value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></Field>
          <Field label="Email"><Input required type="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} /></Field>
          <Field label="Phone"><Input value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} /></Field>
          <Field label="Role"><Select value={f.role} onChange={(e) => setF({ ...f, role: e.target.value })}>{ROLES.filter((r) => r !== 'student' && (r !== 'super_admin' || user?.role === 'super_admin')).map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}</Select></Field>
          <Button>Create & email temporary password</Button>
        </form>
      </Modal>
    </>
  );
}
