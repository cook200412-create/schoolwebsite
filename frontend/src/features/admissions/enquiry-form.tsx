'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Alert, Card, Field, Input, Textarea } from '@/components/ui/kit';
import { api, errorMessage } from '@/lib/client';

export function EnquiryForm({ kind = 'contact' }: { kind?: 'contact' | 'admission' }) {
  const [f, setF] = useState({ name: '', email: '', phone: '', message: '' });
  const [state, setState] = useState<'idle' | 'sending' | 'done'>('idle');
  const [error, setError] = useState<string | null>(null);
  if (state === 'done') return <Alert tone="success">Thank you — your message has been received. The school office will contact you soon.</Alert>;
  return (
    <Card>
      <form className="grid gap-4" onSubmit={async (e) => { e.preventDefault(); setError(null); setState('sending'); try { await api('/admissions/enquiries', { body: { ...f, email: f.email || undefined, kind } }); setState('done'); } catch (er) { setError(errorMessage(er)); setState('idle'); } }}>
        {error && <Alert>{error}</Alert>}
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Your name"><Input required minLength={2} value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></Field>
          <Field label="Mobile"><Input required type="tel" minLength={10} value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} /></Field>
        </div>
        <Field label="Email (optional)"><Input type="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} /></Field>
        <Field label="Message"><Textarea required minLength={5} value={f.message} onChange={(e) => setF({ ...f, message: e.target.value })} /></Field>
        <Button disabled={state === 'sending'}>{state === 'sending' ? 'Sending…' : 'Send enquiry'}</Button>
      </form>
    </Card>
  );
}
