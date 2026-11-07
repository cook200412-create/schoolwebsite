'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Alert, Card, Field, Input, PageHeader, PageLoader, Textarea } from '@/components/ui/kit';
import { useApi } from '@/hooks/use-api';
import { api, errorMessage } from '@/lib/client';

export default function SettingsPage() {
  const s = useApi<any>('/settings');
  const [f, setF] = useState<any>(null);
  const [msg, setMsg] = useState<{ tone: 'success' | 'error'; text: string } | null>(null);
  useEffect(() => { if (s.data) setF({ ...s.data, facilities: s.data.facilities ?? [] }); }, [s.data]);
  if (s.loading || !f) return <PageLoader />;
  const set = (k: string, v: unknown) => setF({ ...f, [k]: v });
  const nested = (o: string, k: string, v: string) => setF({ ...f, [o]: { ...(f[o] ?? {}), [k]: v } });

  const save = async () => {
    setMsg(null);
    const clean = (v: string | undefined) => (v === '' ? undefined : v);
    try {
      await api('/settings', { method: 'PUT', body: {
        schoolName: f.schoolName, shortName: clean(f.shortName), tagline: clean(f.tagline), address: clean(f.address), phone: clean(f.phone), email: clean(f.email), officeTimings: clean(f.officeTimings),
        logoUrl: clean(f.logoUrl), heroImageUrl: clean(f.heroImageUrl), academicYear: clean(f.academicYear), admissionOpen: !!f.admissionOpen, admissionBanner: clean(f.admissionBanner), vision: clean(f.vision), mission: clean(f.mission),
        principal: { name: clean(f.principal?.name), message: clean(f.principal?.message) },
        social: { facebook: clean(f.social?.facebook), instagram: clean(f.social?.instagram), youtube: clean(f.social?.youtube) },
        facilities: f.facilities.map((x: any) => ({ slug: x.slug, title: x.title, description: x.description || undefined, confirmed: !!x.confirmed })),
        academicContent: { history: clean(f.academicContent?.history), philosophy: clean(f.academicContent?.philosophy), methodology: clean(f.academicContent?.methodology), examinationSystem: clean(f.academicContent?.examinationSystem), infrastructure: clean(f.academicContent?.infrastructure) },
      } });
      setMsg({ tone: 'success', text: 'Settings saved. The public website updates within a minute.' });
    } catch (e) { setMsg({ tone: 'error', text: errorMessage(e) }); }
  };

  return (
    <>
      <PageHeader title="School settings" subtitle="Everything shown on the public website and in documents is configured here." actions={<Button onClick={save}>Save changes</Button>} />
      {msg && <div className="mb-4"><Alert tone={msg.tone}>{msg.text}</Alert></div>}
      <div className="grid gap-6">
        <Card><h2 className="mb-3 font-sans text-base font-semibold">Identity & contact</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="School name"><Input value={f.schoolName ?? ''} onChange={(e) => set('schoolName', e.target.value)} /></Field>
            <Field label="Short name"><Input value={f.shortName ?? ''} onChange={(e) => set('shortName', e.target.value)} /></Field>
            <Field label="Tagline" className="sm:col-span-2"><Input value={f.tagline ?? ''} onChange={(e) => set('tagline', e.target.value)} /></Field>
            <Field label="Address" className="sm:col-span-2"><Textarea value={f.address ?? ''} onChange={(e) => set('address', e.target.value)} /></Field>
            <Field label="Phone"><Input value={f.phone ?? ''} onChange={(e) => set('phone', e.target.value)} /></Field>
            <Field label="Official email"><Input type="email" value={f.email ?? ''} onChange={(e) => set('email', e.target.value)} /></Field>
            <Field label="Office timings"><Input value={f.officeTimings ?? ''} onChange={(e) => set('officeTimings', e.target.value)} /></Field>
            <Field label="Logo URL"><Input value={f.logoUrl ?? ''} onChange={(e) => set('logoUrl', e.target.value)} /></Field>
            <Field label="Homepage hero image URL"><Input value={f.heroImageUrl ?? ''} onChange={(e) => set('heroImageUrl', e.target.value)} /></Field>
            <Field label="Facebook"><Input value={f.social?.facebook ?? ''} onChange={(e) => nested('social', 'facebook', e.target.value)} /></Field>
            <Field label="Instagram"><Input value={f.social?.instagram ?? ''} onChange={(e) => nested('social', 'instagram', e.target.value)} /></Field>
          </div></Card>
        <Card><h2 className="mb-3 font-sans text-base font-semibold">Admissions</h2>
          <label className="mb-3 flex items-center gap-2 text-sm"><input type="checkbox" checked={!!f.admissionOpen} onChange={(e) => set('admissionOpen', e.target.checked)} /> Admissions are open (shows banner)</label>
          <div className="grid gap-3 sm:grid-cols-2"><Field label="Banner text"><Input value={f.admissionBanner ?? ''} onChange={(e) => set('admissionBanner', e.target.value)} /></Field><Field label="Current academic year"><Input value={f.academicYear ?? ''} onChange={(e) => set('academicYear', e.target.value)} /></Field></div></Card>
        <Card><h2 className="mb-3 font-sans text-base font-semibold">About, vision & principal</h2>
          <div className="grid gap-3">
            <Field label="Vision"><Textarea value={f.vision ?? ''} onChange={(e) => set('vision', e.target.value)} /></Field>
            <Field label="Mission"><Textarea value={f.mission ?? ''} onChange={(e) => set('mission', e.target.value)} /></Field>
            <Field label="Principal name"><Input value={f.principal?.name ?? ''} onChange={(e) => nested('principal', 'name', e.target.value)} /></Field>
            <Field label="Principal's message"><Textarea value={f.principal?.message ?? ''} onChange={(e) => nested('principal', 'message', e.target.value)} /></Field>
            {(['history', 'philosophy', 'methodology', 'examinationSystem', 'infrastructure'] as const).map((k) => <Field key={k} label={k === 'examinationSystem' ? 'Examination system' : k[0].toUpperCase() + k.slice(1)}><Textarea value={f.academicContent?.[k] ?? ''} onChange={(e) => nested('academicContent', k, e.target.value)} /></Field>)}
          </div></Card>
        <Card><h2 className="mb-1 font-sans text-base font-semibold">Facilities</h2><p className="mb-3 text-sm text-slate-500">Only facilities marked <b>confirmed</b> are published on the website.</p>
          <ul className="grid gap-3">
            {f.facilities.map((x: any, i: number) => (
              <li key={x.slug} className="grid gap-2 rounded-xl border p-3 sm:grid-cols-[1fr_2fr_auto] sm:items-center">
                <b className="text-sm">{x.title}</b>
                <Input aria-label={`${x.title} description`} placeholder="Short description (what the school actually has)" value={x.description ?? ''} onChange={(e) => set('facilities', f.facilities.map((y: any, j: number) => (j === i ? { ...y, description: e.target.value } : y)))} />
                <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={!!x.confirmed} onChange={(e) => set('facilities', f.facilities.map((y: any, j: number) => (j === i ? { ...y, confirmed: e.target.checked } : y)))} /> Confirmed</label>
              </li>
            ))}
          </ul></Card>
      </div>
    </>
  );
}
