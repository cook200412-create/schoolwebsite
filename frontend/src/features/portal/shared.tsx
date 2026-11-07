'use client';

import { useEffect, useState } from 'react';
import { Select } from '@/components/ui/kit';
import { useAuth } from '@/hooks/use-auth';
import { useApi } from '@/hooks/use-api';

export interface Ref { _id: string; name: string; code?: string; class?: any }
export interface Child { _id: string; firstName: string; lastName: string; studentId: string; class?: Ref; section?: Ref }

/** Classes / sections / subjects / years used by most forms. */
export function useAcademics() {
  const years = useApi<Ref[]>('/academic-years?limit=100');
  const classes = useApi<Ref[]>('/classes?limit=100');
  const sections = useApi<Ref[]>('/sections?limit=100');
  const subjects = useApi<Ref[]>('/subjects?limit=100');
  return {
    years: years.data ?? [], classes: classes.data ?? [], sections: sections.data ?? [], subjects: subjects.data ?? [],
    loading: years.loading || classes.loading || sections.loading || subjects.loading,
  };
}

export const sectionLabel = (s: any) => `${s.class?.name ?? ''}-${s.name}`;

/** Children visible to the current parent/student (a student sees themself). */
export function useChildren() {
  const { user } = useAuth();
  const { data, loading, error } = useApi<Child[]>(user ? (user.role === 'parent' ? '/parents/me/children' : '/students?limit=50') : null);
  return { children: data ?? [], loading, error };
}

export function ChildPicker({ value, onChange }: { value: string; onChange: (id: string) => void }) {
  const { children, loading } = useChildren();
  useEffect(() => { if (!value && children[0]) onChange(children[0]._id); }, [children, value, onChange]);
  if (!loading && children.length === 0)
    return <div className="rounded-2xl border border-dashed border-navy-200 bg-navy-50/60 p-5 text-sm text-slate-600">No student is linked to your account yet. Please ask the school office to link your child, then refresh this page.</div>;
  if (loading || children.length <= 1) return null;
  return (
    <Select aria-label="Select child" value={value} onChange={(e) => onChange(e.target.value)} className="max-w-xs">
      {children.map((c) => <option key={c._id} value={c._id}>{c.firstName} {c.lastName}</option>)}
    </Select>
  );
}

export function useSelectedChild() {
  const [id, setId] = useState('');
  const { children, loading } = useChildren();
  return { id, setId, child: children.find((c) => c._id === id), loading, hasChildren: children.length > 0 };
}

export const fmtDate = (d?: string | Date) => (d ? new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(d)) : '—');
export const todayISO = () => new Date().toISOString().slice(0, 10);

/** Search-as-you-type student picker for staff workflows (issue book, assign route…). */
export function StudentPicker({ value, onChange }: { value: string; onChange: (id: string, label: string) => void }) {
  const [q, setQ] = useState('');
  const { data } = useApi<Child[]>(q.length >= 2 ? `/students?q=${encodeURIComponent(q)}&limit=8` : null);
  return (
    <div className="grid gap-2">
      <input className="h-11 w-full rounded-xl border border-slate-200 px-3.5 text-sm" placeholder="Search student by name or ID…" value={q} onChange={(e) => { setQ(e.target.value); onChange('', ''); }} aria-label="Search student" />
      {!value && (data ?? []).length > 0 && (
        <ul className="rounded-xl border bg-white text-sm shadow-card">
          {(data ?? []).map((s) => <li key={s._id}><button type="button" className="w-full px-3 py-2 text-left hover:bg-sky-50" onClick={() => { onChange(s._id, `${s.firstName} ${s.lastName}`); setQ(`${s.firstName} ${s.lastName} (${s.studentId})`); }}>{s.firstName} {s.lastName} · {s.studentId}</button></li>)}
        </ul>
      )}
    </div>
  );
}
