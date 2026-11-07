'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { CheckCircle2 } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Alert, Card, Field, Input, Select } from '@/components/ui/kit';
import { api, errorMessage } from '@/lib/client';

const MAX = 5 * 1024 * 1024;
const TYPES = ['application/pdf', 'image/jpeg', 'image/png'];

export const applicationSchema = z.object({
  firstName: z.string().trim().min(1, 'Required'), lastName: z.string().trim().optional(),
  dob: z.string().min(1, 'Required').refine((d) => new Date(d) < new Date(), 'Date of birth must be in the past'),
  gender: z.enum(['male', 'female', 'other']), classApplying: z.string().trim().min(1, 'Required'), academicYear: z.string().trim().min(4, 'e.g. 2026-27'),
  guardianName: z.string().trim().min(2, 'Required'), relation: z.string().optional(),
  phone: z.string().trim().regex(/^[0-9+\-\s]{10,15}$/, 'Enter a valid phone number'), email: z.string().trim().email('Enter a valid email'),
  line1: z.string().optional(), city: z.string().optional(), state: z.string().optional(), pincode: z.string().regex(/^\d{6}$/, '6-digit PIN').optional().or(z.literal('')),
  prevSchool: z.string().optional(), prevClass: z.string().optional(),
  consent: z.literal(true, { errorMap: () => ({ message: 'Consent is required to submit' }) }),
});
type Values = z.infer<typeof applicationSchema>;

const FILES = [{ key: 'birth_certificate', label: 'Birth certificate' }, { key: 'previous_record', label: 'Previous academic record' }, { key: 'photograph', label: 'Student photograph' }] as const;

export function ApplyForm({ defaultYear }: { defaultYear?: string }) {
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<Values>({ resolver: zodResolver(applicationSchema), defaultValues: { academicYear: defaultYear ?? '', gender: 'male' } });
  const [files, setFiles] = useState<Record<string, File | undefined>>({});
  const [fileErr, setFileErr] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  const pick = (key: string, f?: File) => {
    if (f && !TYPES.includes(f.type)) return setFileErr((e) => ({ ...e, [key]: 'Only PDF, JPG or PNG' }));
    if (f && f.size > MAX) return setFileErr((e) => ({ ...e, [key]: 'File must be under 5 MB' }));
    setFileErr((e) => ({ ...e, [key]: '' })); setFiles((s) => ({ ...s, [key]: f }));
  };

  if (done) return (
    <Card className="mx-auto max-w-xl text-center">
      <CheckCircle2 className="mx-auto text-emerald-600" size={48} />
      <h2 className="mt-3 text-2xl font-bold">Application submitted</h2>
      <p className="mt-2 text-slate-600">Your application number is</p>
      <p className="my-2 font-mono text-2xl font-bold text-navy-800">{done}</p>
      <p className="text-sm text-slate-600">We have emailed you a confirmation. Keep this number and your phone number to track your application.</p>
      <Button asChild className="mt-5"><Link href="/admissions/track">Track application</Link></Button>
    </Card>
  );

  return (
    <form noValidate className="grid gap-6" onSubmit={handleSubmit(async (v) => {
      setError(null);
      const data = {
        student: { firstName: v.firstName, lastName: v.lastName || undefined, dob: v.dob, gender: v.gender },
        guardian: { name: v.guardianName, relation: v.relation || 'parent', phone: v.phone, email: v.email },
        address: { line1: v.line1 || undefined, city: v.city || undefined, state: v.state || undefined, pincode: v.pincode || undefined },
        previousSchool: { name: v.prevSchool || undefined, lastClass: v.prevClass || undefined },
        classApplying: v.classApplying, academicYear: v.academicYear, consent: true,
      };
      const form = new FormData();
      form.set('data', JSON.stringify(data));
      Object.entries(files).forEach(([k, f]) => f && form.set(k, f));
      try { const r = await api<{ applicationNumber: string }>('/admissions/applications', { form }); setDone(r.applicationNumber); window.scrollTo({ top: 0, behavior: 'smooth' }); }
      catch (e) { setError(errorMessage(e)); }
    })}>
      {error && <Alert>{error}</Alert>}
      <Card>
        <h2 className="mb-4 font-sans text-lg font-semibold">Student information</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="First name *" error={errors.firstName?.message}><Input autoComplete="off" {...register('firstName')} /></Field>
          <Field label="Last name"><Input {...register('lastName')} /></Field>
          <Field label="Date of birth *" error={errors.dob?.message}><Input type="date" {...register('dob')} /></Field>
          <Field label="Gender *"><Select {...register('gender')}><option value="male">Male</option><option value="female">Female</option><option value="other">Other</option></Select></Field>
          <Field label="Class applying for *" error={errors.classApplying?.message}><Input placeholder="e.g. 1, LKG, 8" {...register('classApplying')} /></Field>
          <Field label="Academic year *" error={errors.academicYear?.message}><Input placeholder="2026-27" {...register('academicYear')} /></Field>
        </div>
      </Card>
      <Card>
        <h2 className="mb-4 font-sans text-lg font-semibold">Parent / guardian</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Full name *" error={errors.guardianName?.message}><Input autoComplete="name" {...register('guardianName')} /></Field>
          <Field label="Relationship"><Input placeholder="Father / Mother / Guardian" {...register('relation')} /></Field>
          <Field label="Mobile number *" error={errors.phone?.message}><Input type="tel" inputMode="tel" autoComplete="tel" {...register('phone')} /></Field>
          <Field label="Email *" error={errors.email?.message}><Input type="email" autoComplete="email" {...register('email')} /></Field>
        </div>
      </Card>
      <Card>
        <h2 className="mb-4 font-sans text-lg font-semibold">Address & previous school</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Address" className="sm:col-span-2"><Input autoComplete="street-address" {...register('line1')} /></Field>
          <Field label="City"><Input {...register('city')} /></Field><Field label="State"><Input {...register('state')} /></Field>
          <Field label="PIN code" error={errors.pincode?.message}><Input inputMode="numeric" {...register('pincode')} /></Field><span />
          <Field label="Previous school"><Input {...register('prevSchool')} /></Field><Field label="Last class attended"><Input {...register('prevClass')} /></Field>
        </div>
      </Card>
      <Card>
        <h2 className="mb-1 font-sans text-lg font-semibold">Documents</h2>
        <p className="mb-4 text-sm text-slate-500">PDF, JPG or PNG, up to 5 MB each. Documents are stored privately and seen only by admissions staff.</p>
        <div className="grid gap-4 sm:grid-cols-3">
          {FILES.map((f) => (
            <Field key={f.key} label={f.label} error={fileErr[f.key]}>
              <input type="file" accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png" onChange={(e) => pick(f.key, e.target.files?.[0])} className="block w-full text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-navy-50 file:px-3 file:py-2 file:font-semibold file:text-navy-800" />
            </Field>
          ))}
        </div>
      </Card>
      <label className="flex items-start gap-3 text-sm text-slate-600">
        <input type="checkbox" className="mt-1 h-4 w-4" {...register('consent')} />
        <span>I am the parent/legal guardian and consent to the school collecting and processing my child&apos;s and my personal data for admission and school administration, in line with the privacy policy.</span>
      </label>
      {errors.consent && <p role="alert" className="-mt-4 text-xs font-medium text-red-600">{errors.consent.message}</p>}
      <Button size="lg" disabled={isSubmitting} className="sm:w-fit">{isSubmitting ? 'Submitting…' : 'Submit application'}</Button>
    </form>
  );
}
