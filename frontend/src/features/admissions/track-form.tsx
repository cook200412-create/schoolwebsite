'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Alert, Badge, Card, Field, Input, statusTone } from '@/components/ui/kit';
import { api, errorMessage } from '@/lib/client';
import { formatDate } from '@/lib/utils';

export function TrackForm() {
  const [no, setNo] = useState('');
  const [phone, setPhone] = useState('');
  const [res, setRes] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  return (
    <div className="mx-auto grid max-w-xl gap-5">
      <Card>
        <form className="grid gap-4" onSubmit={async (e) => { e.preventDefault(); setError(null); setRes(null); setLoading(true); try { setRes(await api(`/admissions/track/${encodeURIComponent(no.trim())}?phone=${encodeURIComponent(phone.trim())}`)); } catch (er) { setError(errorMessage(er)); } finally { setLoading(false); } }}>
          <Field label="Application number"><Input required placeholder="APP202600001" value={no} onChange={(e) => setNo(e.target.value)} /></Field>
          <Field label="Guardian mobile number"><Input required type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} /></Field>
          <Button disabled={loading}>{loading ? 'Checking…' : 'Track status'}</Button>
        </form>
      </Card>
      {error && <Alert>{error}</Alert>}
      {res && (
        <Card>
          <p className="text-xs uppercase tracking-wider text-slate-500">{res.applicationNumber}</p>
          <h2 className="font-sans text-xl font-semibold">{res.studentName} · Class {res.classApplying}</h2>
          <p className="mt-3">Status: <Badge tone={statusTone(res.status)}>{res.status.replace('_', ' ')}</Badge></p>
          {res.interview?.scheduledAt && <p className="mt-2 text-sm">Interview: <b>{new Date(res.interview.scheduledAt).toLocaleString('en-IN')}</b>{res.interview.venue ? ` · ${res.interview.venue}` : ''}</p>}
          <p className="mt-2 text-xs text-slate-500">Last updated {formatDate(res.updatedAt)}</p>
        </Card>
      )}
    </div>
  );
}
