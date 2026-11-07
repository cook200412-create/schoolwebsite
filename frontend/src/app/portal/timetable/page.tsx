'use client';

import { useEffect, useState } from 'react';
import { Alert, Card, Empty, PageHeader, PageLoader, Select } from '@/components/ui/kit';
import { sectionLabel, useAcademics, useChildren } from '@/features/portal/shared';
import { useApi } from '@/hooks/use-api';
import { useAuth } from '@/hooks/use-auth';

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export default function TimetablePage() {
  const { can, user } = useAuth();
  const staff = !['parent', 'student'].includes(user?.role ?? '');
  const ac = useAcademics();
  const { children } = useChildren();
  const [section, setSection] = useState('');
  const options = staff ? ac.sections.map((s) => ({ id: s._id, label: sectionLabel(s) })) : children.filter((c) => c.section).map((c) => ({ id: (c.section as any)._id ?? String(c.section), label: `${c.firstName} · ${c.class?.name}-${c.section?.name}` }));
  useEffect(() => { if (!section && options[0]) setSection(options[0].id); }, [options, section]);
  const tt = useApi<any[]>(section ? `/timetable/section/${section}` : null);

  return (
    <>
      <PageHeader title="Timetable" subtitle="Weekly class schedule." />
      {options.length > 1 && <Select aria-label="Section" value={section} onChange={(e) => setSection(e.target.value)} className="mb-4 max-w-xs">{options.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}</Select>}
      {options.length === 1 && <p className="mb-4 text-sm font-semibold text-navy-800">{options[0].label}</p>}
      {options.length === 0 && <Empty>{staff ? 'No sections have been created yet.' : 'No student is linked to your account yet, so there is no timetable to show. Please ask the school office to link your child.'}</Empty>}
      {tt.error && <Alert>{tt.error}</Alert>}
      {options.length === 0 ? null : tt.loading ? <PageLoader /> : !(tt.data ?? []).length ? <Empty>No timetable has been published for this section yet.</Empty> : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {(tt.data ?? []).map((d) => (
            <Card key={d._id}>
              <h2 className="mb-3 font-sans text-base font-semibold">{DAYS[d.day - 1]}</h2>
              <ul className="grid gap-2 text-sm">
                {d.periods.sort((a: any, b: any) => a.period - b.period).map((p: any) => (
                  <li key={p.period} className="flex justify-between gap-3 rounded-lg bg-navy-50/60 px-3 py-2">
                    <span><b>P{p.period}</b> {p.subject?.name ?? '—'}</span><span className="text-slate-500">{p.startTime}–{p.endTime}{p.room ? ` · ${p.room}` : ''}</span>
                  </li>
                ))}
              </ul>
            </Card>
          ))}
        </div>
      )}
      {can('timetable:write') && <p className="mt-6 text-xs text-slate-500">Administrators edit periods through the API (PUT /timetable/section/:id/day/:day); a visual editor is a planned enhancement.</p>}
    </>
  );
}
