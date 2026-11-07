'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Button } from '@/components/ui/button';
import { Alert, Badge, DataTable, Field, Input, Modal, PageHeader, Select, Textarea, statusTone } from '@/components/ui/kit';
import { fmtDate, useChildren } from '@/features/portal/shared';
import { useApi } from '@/hooks/use-api';
import { useAuth } from '@/hooks/use-auth';
import { api, errorMessage } from '@/lib/client';

export default function LeavePage() {
  const { can, user } = useAuth();
  const { children } = useChildren();
  const list = useApi<any[]>('/leave?limit=50');
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { register, handleSubmit, reset } = useForm<{ childName?: string; fromDate: string; toDate: string; reason: string }>();

  const decide = async (id: string, status: 'approved' | 'rejected') => {
    try { await api(`/leave/${id}/decide`, { method: 'PATCH', body: { status } }); list.reload(); } catch (e) { setError(errorMessage(e)); }
  };

  return (
    <>
      <PageHeader title="Leave" subtitle="Apply for leave and review requests." actions={can('leave:apply') && <Button onClick={() => setOpen(true)}>Apply for leave</Button>} />
      {error && <Alert>{error}</Alert>}
      <DataTable rows={list.data ?? []} columns={[
        { key: 'who', label: 'For', render: (r) => (r.student ? `${r.student.firstName} ${r.student.lastName}` : r.childName ?? r.applicant?.name) },
        { key: 'dates', label: 'Dates', render: (r) => `${fmtDate(r.fromDate)} – ${fmtDate(r.toDate)}` },
        { key: 'reason', label: 'Reason' },
        { key: 'status', label: 'Status', render: (r) => <Badge tone={statusTone(r.status)}>{r.status}</Badge> },
        { key: 'act', label: '', render: (r) => r.status === 'pending' && r.applicant?._id !== user?.id && (can('leave:approve') || can('leave:approve-student')) ? (
          <span className="flex gap-2"><Button size="sm" onClick={() => decide(r._id, 'approved')}>Approve</Button><Button size="sm" variant="outline" onClick={() => decide(r._id, 'rejected')}>Reject</Button></span>) : null },
      ]} />
      <Modal open={open} onClose={() => setOpen(false)} title="Apply for leave">
        <form className="grid gap-3" onSubmit={handleSubmit(async (v) => { setError(null); try { const match = children.find((c) => `${c.firstName} ${c.lastName}`.trim().toLowerCase() === (v.childName ?? '').trim().toLowerCase()); await api('/leave', { body: { fromDate: v.fromDate, toDate: v.toDate, reason: v.reason, ...(match ? { studentId: match._id } : { childName: v.childName?.trim() }) } }); reset(); setOpen(false); list.reload(); } catch (e) { setError(errorMessage(e)); } })}>
          {user?.role === 'parent' && (
            <Field label="Child's name" hint={children.length ? 'Type the name or pick one of your linked children' : undefined}>
              <Input required list="child-names" autoComplete="off" placeholder="e.g. Rahul Kumar" {...register('childName')} />
              <datalist id="child-names">{children.map((c) => <option key={c._id} value={`${c.firstName} ${c.lastName}`.trim()} />)}</datalist>
            </Field>
          )}
          <div className="grid gap-3 sm:grid-cols-2"><Field label="From"><Input type="date" required {...register('fromDate')} /></Field><Field label="To"><Input type="date" required {...register('toDate')} /></Field></div>
          <Field label="Reason"><Textarea required minLength={3} {...register('reason')} /></Field>
          <Button>Submit request</Button>
        </form>
      </Modal>
    </>
  );
}
