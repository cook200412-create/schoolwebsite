'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Alert, Card, Field, Input } from '@/components/ui/kit';
import { PasswordInput } from '@/components/ui/password-input';
import { useAuth } from '@/hooks/use-auth';
import { api, errorMessage } from '@/lib/client';

export const passwordSchema = z.string().min(10, 'At least 10 characters').regex(/[a-z]/, 'Include a lowercase letter').regex(/[A-Z]/, 'Include an uppercase letter').regex(/\d/, 'Include a number');
export const loginSchema = z.object({ email: z.string().trim().email('Enter a valid email'), password: z.string().min(1, 'Password is required') });
export const registerSchema = z.object({
  name: z.string().trim().min(2, 'Enter your full name'), email: z.string().trim().email('Enter a valid email'), phone: z.string().trim().regex(/^[0-9+\-\s]{10,15}$/, 'Enter a valid phone number').optional().or(z.literal('')),
  password: passwordSchema, confirm: z.string(), consent: z.literal(true, { errorMap: () => ({ message: 'Consent is required to create an account' }) }),
}).refine((v) => v.password === v.confirm, { path: ['confirm'], message: 'Passwords do not match' });

const Shell = ({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) => (
  <section className="container grid place-items-center py-12 sm:py-20">
    <Card className="w-full max-w-md !p-6 sm:!p-8">
      <h1 className="text-3xl font-bold">{title}</h1>
      <p className="mt-1 text-sm text-slate-600">{subtitle}</p>
      <div className="mt-6">{children}</div>
    </Card>
  </section>
);

function LoginInner() {
  const { login, user } = useAuth();
  const router = useRouter();
  const next = useSearchParams().get('next');
  const target = next && next.startsWith('/portal') ? next : '/portal/dashboard';
  // already signed in → go straight to the portal instead of showing the form again
  useEffect(() => { if (user) router.replace(target); }, [user, router, target]);
  const [error, setError] = useState<string | null>(null);
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<z.infer<typeof loginSchema>>({ resolver: zodResolver(loginSchema) });

  return (
    <Shell title="Portal login" subtitle="Parents, students, teachers and staff sign in here.">
      <form className="grid gap-4" noValidate onSubmit={handleSubmit(async (v) => {
        setError(null);
        try {
          const u = await login(v.email, v.password);
          router.replace(target);
          void u;
        } catch (e) { setError(errorMessage(e)); }
      })}>
        {error && <Alert>{error}</Alert>}
        <Field label="Email" error={errors.email?.message}><Input type="email" autoComplete="username" inputMode="email" {...register('email')} /></Field>
        <Field label="Password" error={errors.password?.message}><PasswordInput autoComplete="current-password" {...register('password')} /></Field>
        <Button size="lg" disabled={isSubmitting}>{isSubmitting ? 'Signing in…' : 'Sign in'}</Button>
        <div className="flex justify-between text-sm"><Link href="/forgot-password" className="text-sky-700 hover:underline">Forgot password?</Link><Link href="/register" className="text-sky-700 hover:underline">Parent sign-up</Link></div>
      </form>
    </Shell>
  );
}
export const LoginForm = () => <Suspense><LoginInner /></Suspense>;

export function RegisterForm() {
  const router = useRouter();
  const { refresh } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<z.infer<typeof registerSchema>>({ resolver: zodResolver(registerSchema) });
  return (
    <Shell title="Parent sign-up" subtitle="Create your account. The school links your child's record after verification.">
      <form className="grid gap-4" noValidate onSubmit={handleSubmit(async (v) => {
        setError(null);
        try {
          await api('/auth/register', { body: { name: v.name, email: v.email, phone: v.phone || undefined, password: v.password, consent: true } });
          await refresh(); router.replace('/portal/dashboard');
        } catch (e) { setError(errorMessage(e)); }
      })}>
        {error && <Alert>{error}</Alert>}
        <Field label="Full name" error={errors.name?.message}><Input autoComplete="name" {...register('name')} /></Field>
        <Field label="Email" error={errors.email?.message}><Input type="email" autoComplete="email" {...register('email')} /></Field>
        <Field label="Mobile (optional)" error={errors.phone?.message}><Input type="tel" autoComplete="tel" {...register('phone')} /></Field>
        <Field label="Password" error={errors.password?.message} hint="10+ characters with upper, lower case and a number"><PasswordInput autoComplete="new-password" {...register('password')} /></Field>
        <Field label="Confirm password" error={errors.confirm?.message}><PasswordInput autoComplete="new-password" {...register('confirm')} /></Field>
        <label className="flex items-start gap-3 text-sm text-slate-600">
          <input type="checkbox" className="mt-1 h-4 w-4" {...register('consent')} />
          <span>I am a parent/guardian and consent to the school processing my and my child&apos;s data for educational administration, as described in the privacy policy.</span>
        </label>
        {errors.consent && <p role="alert" className="text-xs font-medium text-red-600">{errors.consent.message}</p>}
        <Button size="lg" disabled={isSubmitting}>{isSubmitting ? 'Creating account…' : 'Create account'}</Button>
        <p className="text-sm">Already registered? <Link href="/login" className="text-sky-700 hover:underline">Sign in</Link></p>
      </form>
    </Shell>
  );
}

export function ForgotForm() {
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<{ email: string }>({ resolver: zodResolver(z.object({ email: z.string().trim().email('Enter a valid email') })) });
  return (
    <Shell title="Forgot password" subtitle="We will email you a reset link valid for 30 minutes.">
      {done ? <Alert tone="success">If that email is registered, a reset link has been sent.</Alert> : (
        <form className="grid gap-4" noValidate onSubmit={handleSubmit(async (v) => { setError(null); try { await api('/auth/forgot-password', { body: v }); setDone(true); } catch (e) { setError(errorMessage(e)); } })}>
          {error && <Alert>{error}</Alert>}
          <Field label="Email" error={errors.email?.message}><Input type="email" {...register('email')} /></Field>
          <Button size="lg" disabled={isSubmitting}>Send reset link</Button>
        </form>
      )}
    </Shell>
  );
}

const resetSchema = z.object({ password: passwordSchema, confirm: z.string() }).refine((v) => v.password === v.confirm, { path: ['confirm'], message: 'Passwords do not match' });
function ResetInner() {
  const token = useSearchParams().get('token') ?? '';
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<z.infer<typeof resetSchema>>({ resolver: zodResolver(resetSchema) });
  return (
    <Shell title="Set a new password" subtitle="Choose a strong password you don't use elsewhere.">
      {!token ? <Alert>This reset link is missing its token. Request a new one.</Alert> : done ? <Alert tone="success">Password updated. Redirecting to sign in…</Alert> : (
        <form className="grid gap-4" noValidate onSubmit={handleSubmit(async (v) => { setError(null); try { await api('/auth/reset-password', { body: { token, password: v.password } }); setDone(true); setTimeout(() => router.replace('/login'), 1500); } catch (e) { setError(errorMessage(e)); } })}>
          {error && <Alert>{error}</Alert>}
          <Field label="New password" error={errors.password?.message}><PasswordInput autoComplete="new-password" {...register('password')} /></Field>
          <Field label="Confirm password" error={errors.confirm?.message}><PasswordInput autoComplete="new-password" {...register('confirm')} /></Field>
          <Button size="lg" disabled={isSubmitting}>Update password</Button>
        </form>
      )}
    </Shell>
  );
}
export const ResetForm = () => <Suspense><ResetInner /></Suspense>;
