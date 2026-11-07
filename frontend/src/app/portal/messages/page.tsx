'use client';

import { Send } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Alert, Card, Empty, Input, PageHeader, PageLoader, Select } from '@/components/ui/kit';
import { useApi } from '@/hooks/use-api';
import { useAuth } from '@/hooks/use-auth';
import { api, errorMessage } from '@/lib/client';
import { cn } from '@/lib/utils';

export default function MessagesPage() {
  const { user } = useAuth();
  const contacts = useApi<{ id: string; name: string; role: string; child?: string }[]>('/messages/contacts');
  const threads = useApi<any[]>('/messages/threads');
  const [other, setOther] = useState('');
  const thread = useApi<any[]>(other ? `/messages/thread/${other}` : null);
  const [text, setText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const end = useRef<HTMLDivElement>(null);
  useEffect(() => { end.current?.scrollIntoView({ block: 'end' }); }, [thread.data]);
  const name = (contacts.data ?? []).find((c) => c.id === other)?.name ?? (threads.data ?? []).find((t) => t.with.id === other)?.with.name ?? '';

  const send = async () => {
    setError(null);
    try { await api('/messages', { body: { to: other, body: text } }); setText(''); thread.reload(); threads.reload(); } catch (e) { setError(errorMessage(e)); }
  };

  return (
    <>
      <PageHeader title="Messages" subtitle="Secure messaging with authorised school staff and parents. Conversations are logged for safeguarding." />
      <div className="grid gap-4 lg:grid-cols-[280px_1fr]">
        <Card className="!p-3">
          <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-slate-500">New conversation</label>
          <Select value="" onChange={(e) => setOther(e.target.value)} aria-label="Start conversation"><option value="">Choose a person…</option>{(contacts.data ?? []).map((c) => <option key={c.id} value={c.id}>{c.name} ({c.role.replace('_', ' ')}{c.child ? ` · ${c.child}` : ''})</option>)}</Select>
          <ul className="mt-3 grid gap-1">
            {(threads.data ?? []).map((t) => (
              <li key={t.with.id}><button onClick={() => setOther(t.with.id)} className={cn('w-full rounded-xl px-3 py-2 text-left text-sm hover:bg-navy-50', other === t.with.id && 'bg-navy-50')}>
                <span className="flex justify-between"><b>{t.with.name}</b>{t.unread > 0 && <span className="rounded-full bg-gold-400 px-2 text-xs font-bold">{t.unread}</span>}</span><span className="line-clamp-1 text-xs text-slate-500">{t.last}</span></button></li>
            ))}
          </ul>
        </Card>
        <Card className="flex min-h-[420px] flex-col !p-0">
          {!other ? <div className="m-4"><Empty>Select a conversation.</Empty></div> : (
            <>
              <div className="border-b px-4 py-3 font-semibold">{name}</div>
              <div className="flex-1 space-y-2 overflow-y-auto p-4" style={{ maxHeight: 420 }}>
                {thread.loading ? <PageLoader /> : (thread.data ?? []).map((m) => (
                  <div key={m._id} className={cn('max-w-[80%] rounded-2xl px-3 py-2 text-sm', m.from === user?.id ? 'ml-auto bg-navy-800 text-white' : 'bg-slate-100')}>{m.body}<span className={cn('mt-1 block text-[10px]', m.from === user?.id ? 'text-navy-200' : 'text-slate-400')}>{new Date(m.createdAt).toLocaleString('en-IN')}</span></div>
                ))}
                <div ref={end} />
              </div>
              {error && <div className="px-4"><Alert>{error}</Alert></div>}
              <form className="flex gap-2 border-t p-3" onSubmit={(e) => { e.preventDefault(); if (text.trim()) void send(); }}>
                <Input value={text} onChange={(e) => setText(e.target.value)} placeholder="Type a message" aria-label="Message" maxLength={4000} />
                <Button aria-label="Send"><Send size={16} /></Button>
              </form>
            </>
          )}
        </Card>
      </div>
    </>
  );
}
