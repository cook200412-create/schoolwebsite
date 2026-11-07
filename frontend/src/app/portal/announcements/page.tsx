'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Alert, Badge, Card, Empty, Field, Input, Modal, PageHeader, PageLoader, Select, Textarea } from '@/components/ui/kit';
import { fmtDate, sectionLabel, useAcademics } from '@/features/portal/shared';
import { useApi } from '@/hooks/use-api';
import { useAuth } from '@/hooks/use-auth';
import { api, errorMessage } from '@/lib/client';

export default function AnnouncementsPage() {
  const { can } = useAuth();
  const list = useApi<any[]>('/announcements?limit=50');
  const ac = useAcademics();
  const me = useApi<any>(can('announcements:write') ? null : can('announcements:class') ? '/teachers/me' : null);
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({ title: '', body: '', category: 'general', audience: 'parents', section: '', publish: true });
  const [error, setError] = useState<string | null>(null);
  const writer = can('announcements:write') || can('announcements:class');
  const sections = can('announcements:write') ? ac.sections.map((s) => ({ id: s._id, label: sectionLabel(s) })) : [...new Map((me.data?.assignments ?? []).map((a: any) => [a.section._id, { id: a.section._id, label: `${a.class.name}-${a.section.name}` }])).values()] as { id: string; label: string }[];

  return (
    <>
      <PageHeader title="Announcements" subtitle="School circulars, holidays, exams and events." actions={writer && <Button onClick={() => setOpen(true)}>New announcement</Button>} />
      {list.loading ? <PageLoader /> : !(list.data ?? []).length ? <Empty>No announcements yet.</Empty> : (
        <ul className="grid gap-3">
          {(list.data ?? []).map((a) => (
            <Card key={a._id} className="!p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-xs font-semibold uppercase tracking-wider text-sky-600">{a.category.replace('-', ' ')} · {a.audience}</p>
                <span className="flex items-center gap-2 text-xs text-slate-500">{!a.isPublished && <Badge tone="amber">draft</Badge>}{fmtDate(a.publishedAt ?? a.createdAt)}</span>
              </div>
              <h2 className="mt-1 font-sans text-base font-semibold">{a.title}</h2>
              <p className="mt-1 whitespace-pre-wrap text-sm text-slate-600">{a.body}</p>
              {can('announcements:write') && !a.isPublished && <Button size="sm" className="mt-3" onClick={async () => { await api(`/announcements/${a._id}/publish`, { body: {} }); list.reload(); }}>Publish</Button>}
            </Card>
          ))}
        </ul>
      )}
      <Modal open={open} onClose={() => setOpen(false)} title="New announcement">
        <form className="grid gap-3" onSubmit={async (e) => { e.preventDefault(); setError(null); try { await api('/announcements', { body: { title: f.title, body: f.body, category: f.category, audience: f.audience, publish: f.publish, ...(f.section ? { sections: [f.section] } : {}) } }); setOpen(false); list.reload(); } catch (er) { setError(errorMessage(er)); } }}>
          {error && <Alert>{error}</Alert>}
          <Field label="Title"><Input required minLength={3} value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} /></Field>
          <Field label="Message"><Textarea required value={f.body} onChange={(e) => setF({ ...f, body: e.target.value })} /></Field>
          <div className="grid gap-3 sm:grid-cols-3">
            <Field label="Category"><Select value={f.category} onChange={(e) => setF({ ...f, category: e.target.value })}>{['general', 'holiday', 'examination', 'parent-meeting', 'event', 'admission', 'circular'].map((c) => <option key={c} value={c}>{c}</option>)}</Select></Field>
            <Field label="Audience"><Select value={f.audience} onChange={(e) => setF({ ...f, audience: e.target.value })}>{(can('announcements:write') ? ['public', 'parents', 'students', 'staff'] : ['parents', 'students']).map((c) => <option key={c} value={c}>{c}</option>)}</Select></Field>
            <Field label="Section (optional)"><Select value={f.section} onChange={(e) => setF({ ...f, section: e.target.value })}><option value="">All</option>{sections.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}</Select></Field>
          </div>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={f.publish} onChange={(e) => setF({ ...f, publish: e.target.checked })} /> Publish and notify now</label>
          <Button>Save</Button>
        </form>
      </Modal>
    </>
  );
}
