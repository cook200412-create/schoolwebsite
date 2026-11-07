'use client';

import { useEffect, useState } from 'react';
import Script from 'next/script';
import { Button } from '@/components/ui/button';
import { Alert, Badge, Card, DataTable, Empty, Field, Input, Modal, PageHeader, PageLoader, Select, statusTone, money } from '@/components/ui/kit';
import { ChildPicker, fmtDate, useAcademics } from '@/features/portal/shared';
import { useApi } from '@/hooks/use-api';
import { useAuth } from '@/hooks/use-auth';
import { api, download, errorMessage } from '@/lib/client';

declare global { interface Window { Razorpay?: new (o: any) => { open: () => void; on: (e: string, cb: (r: any) => void) => void } } }

function Ledger({ studentId, canPay }: { studentId: string; canPay: boolean }) {
  const led = useApi<{ fees: any[]; payments: any[] }>(studentId ? `/fees/student/${studentId}` : null);
  const [msg, setMsg] = useState<{ tone: 'success' | 'error' | 'info'; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const pay = async (fee: any) => {
    setBusy(true); setMsg(null);
    try {
      const o = await api<{ orderId: string; amount: number; keyId?: string }>('/payments/orders', { body: { studentFeeId: fee._id, idempotencyKey: `${fee._id}-${Date.now()}`.slice(0, 60) } });
      if (!o.keyId || !window.Razorpay) throw new Error('Online payment gateway is not available. Please pay at the school office.');
      const rz = new window.Razorpay({
        key: o.keyId, order_id: o.orderId, amount: o.amount, currency: 'INR', name: 'School fees',
        // The browser result is only informational: the ledger changes when the signed webhook arrives.
        handler: () => { setMsg({ tone: 'info', text: 'Payment submitted. Your receipt appears here once the bank confirms (usually under a minute).' }); setTimeout(led.reload, 4000); setTimeout(led.reload, 12000); },
        modal: { ondismiss: () => setBusy(false) },
      });
      rz.on('payment.failed', () => setMsg({ tone: 'error', text: 'Payment failed. You were not charged for this attempt.' }));
      rz.open();
    } catch (e) { setMsg({ tone: 'error', text: errorMessage(e) }); } finally { setBusy(false); }
  };

  if (led.loading) return <PageLoader />;
  if (led.error) return <Alert>{led.error}</Alert>;
  return (
    <>
      <Script src="https://checkout.razorpay.com/v1/checkout.js" strategy="lazyOnload" />
      {msg && <div className="mb-4"><Alert tone={msg.tone}>{msg.text}</Alert></div>}
      {!led.data?.fees.length ? <Empty>No fees have been assigned yet.</Empty> : led.data.fees.map((f) => (
        <Card key={f._id} className="mb-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div><h2 className="font-sans text-base font-semibold">Fees {f.academicYear?.name}</h2>
              <p className="text-sm text-slate-600">Total {money(f.totalDue)} · Paid {money(f.paid)} · <b className={f.balance > 0 ? 'text-red-700' : 'text-emerald-700'}>Balance {money(f.balance)}</b></p></div>
            {canPay && f.balance > 0 && <Button disabled={busy} onClick={() => pay(f)}>Pay {money(f.balance)}</Button>}
          </div>
          <ul className="mt-3 grid gap-1 text-sm text-slate-600">{f.items.map((i: any, k: number) => <li key={k} className="flex justify-between"><span>{i.name}{i.dueDate ? ` · due ${fmtDate(i.dueDate)}` : ''}</span><span>{money(i.amount)}</span></li>)}
            {f.discount + f.scholarship > 0 && <li className="flex justify-between text-emerald-700"><span>Discount / scholarship</span><span>−{money(f.discount + f.scholarship)}</span></li>}
            {f.lateFee > 0 && <li className="flex justify-between text-red-700"><span>Late fee</span><span>{money(f.lateFee)}</span></li>}</ul>
        </Card>
      ))}
      <h2 className="mb-3 mt-6 text-xl font-bold">Payment history</h2>
      <DataTable rows={led.data?.payments ?? []} columns={[
        { key: 'paidAt', label: 'Date', render: (p) => fmtDate(p.paidAt ?? p.createdAt) }, { key: 'transactionId', label: 'Transaction' }, { key: 'amount', label: 'Amount', render: (p) => money(p.amount) },
        { key: 'status', label: 'Status', render: (p) => <Badge tone={statusTone(p.status)}>{p.status.replace('_', ' ')}</Badge> },
        { key: 'r', label: '', render: (p) => p.receiptNumber ? <Button size="sm" variant="outline" onClick={() => download(`/payments/${p._id}/receipt.pdf`, `${p.receiptNumber}.pdf`).catch((e) => setMsg({ tone: 'error', text: errorMessage(e) }))}>Receipt</Button> : null },
      ]} />
    </>
  );
}

function FamilyFees() {
  const [child, setChild] = useState('');
  return (<><div className="mb-4"><ChildPicker value={child} onChange={setChild} /></div>{child && <Ledger studentId={child} canPay />}</>);
}

function Structures() {
  const ac = useAcademics();
  const list = useApi<any[]>('/fees/structures?limit=50');
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({ name: '', class: '', academicYear: '', tuition: '', exam: '', lateFeePerDay: '' });
  const [msg, setMsg] = useState<string | null>(null);
  return (
    <>
      <div className="mb-3 flex justify-end"><Button onClick={() => setOpen(true)}>New fee structure</Button></div>
      {msg && <div className="mb-3"><Alert tone="info">{msg}</Alert></div>}
      <DataTable rows={list.data ?? []} columns={[
        { key: 'name', label: 'Name' }, { key: 'class', label: 'Class', render: (r) => r.class?.name ?? 'All' },
        { key: 'total', label: 'Total', render: (r) => money(r.items.reduce((a: number, i: any) => a + i.amount, 0)) },
        { key: 'a', label: '', render: (r) => <Button size="sm" variant="outline" onClick={async () => { try { const x = await api<{ assigned: number; skippedExisting: number }>('/fees/assign', { body: { structureId: r._id } }); setMsg(`Assigned to ${x.assigned} student(s); ${x.skippedExisting} already had it.`); } catch (e) { setMsg(errorMessage(e)); } }}>Assign to class</Button> },
      ]} />
      <Modal open={open} onClose={() => setOpen(false)} title="New fee structure">
        <form className="grid gap-3" onSubmit={async (e) => {
          e.preventDefault();
          const items = [{ name: 'Tuition', type: 'tuition', amount: Math.round(Number(f.tuition || 0) * 100) }, ...(f.exam ? [{ name: 'Examination', type: 'examination', amount: Math.round(Number(f.exam) * 100) }] : [])].filter((i) => i.amount > 0);
          try { await api('/fees/structures', { body: { name: f.name, class: f.class || undefined, academicYear: f.academicYear, items, lateFeePerDay: Math.round(Number(f.lateFeePerDay || 0) * 100) } }); setOpen(false); list.reload(); } catch (er) { setMsg(errorMessage(er)); }
        }}>
          <Field label="Name"><Input required value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></Field>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Class"><Select value={f.class} onChange={(e) => setF({ ...f, class: e.target.value })}><option value="">Select…</option>{ac.classes.map((c) => <option key={c._id} value={c._id}>{c.name}</option>)}</Select></Field>
            <Field label="Academic year"><Select required value={f.academicYear} onChange={(e) => setF({ ...f, academicYear: e.target.value })}><option value="">Select…</option>{ac.years.map((y) => <option key={y._id} value={y._id}>{y.name}</option>)}</Select></Field>
            <Field label="Tuition (₹)"><Input type="number" min={0} required value={f.tuition} onChange={(e) => setF({ ...f, tuition: e.target.value })} /></Field>
            <Field label="Examination (₹)"><Input type="number" min={0} value={f.exam} onChange={(e) => setF({ ...f, exam: e.target.value })} /></Field>
            <Field label="Late fee per day (₹)"><Input type="number" min={0} value={f.lateFeePerDay} onChange={(e) => setF({ ...f, lateFeePerDay: e.target.value })} /></Field>
          </div>
          <Button>Save structure</Button>
        </form>
      </Modal>
    </>
  );
}

function Collections() {
  const pending = useApi<any[]>('/fees/pending?limit=50');
  const pays = useApi<any[]>('/payments?limit=30');
  const [rec, setRec] = useState<any | null>(null);
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState('cash');
  const [msg, setMsg] = useState<{ tone: 'success' | 'error'; text: string } | null>(null);
  const { can } = useAuth();
  const refund = async (p: any) => { const reason = prompt('Refund reason?'); const amt = prompt('Refund amount (₹)?', String(p.amount / 100)); if (!reason || !amt) return; try { await api(`/payments/${p._id}/refund-request`, { body: { amount: Math.round(Number(amt) * 100), reason } }); setMsg({ tone: 'success', text: 'Refund requested; awaiting approval.' }); } catch (e) { setMsg({ tone: 'error', text: errorMessage(e) }); } };
  return (
    <>
      <div className="mb-3 flex flex-wrap gap-2">
        <Button variant="outline" onClick={() => download('/fees/pending?format=csv', 'pending-fees.csv').catch((e) => setMsg({ tone: 'error', text: errorMessage(e) }))}>Pending CSV</Button>
        <Button variant="outline" onClick={() => download('/reports/fee-collection?by=day&format=csv', 'daily-collection.csv')}>Daily collection CSV</Button>
        <Button variant="outline" onClick={() => download('/reports/fee-collection?by=month&format=pdf', 'monthly-collection.pdf')}>Monthly report PDF</Button>
        <Button variant="outline" onClick={async () => { const r = await api<{ updated: number }>('/fees/apply-late-fees', { body: {} }); setMsg({ tone: 'success', text: `Late fees updated for ${r.updated} account(s).` }); pending.reload(); }}>Apply late fees</Button>
      </div>
      {msg && <div className="mb-3"><Alert tone={msg.tone}>{msg.text}</Alert></div>}
      <h2 className="mb-2 text-lg font-bold">Outstanding</h2>
      <DataTable rows={pending.data ?? []} columns={[
        { key: 's', label: 'Student', render: (r) => `${r.student?.firstName ?? ''} ${r.student?.lastName ?? ''}` }, { key: 'sid', label: 'ID', render: (r) => r.student?.studentId },
        { key: 'balance', label: 'Balance', render: (r) => money(r.balance) },
        { key: 'a', label: '', render: (r) => can('payments:record') && <Button size="sm" onClick={() => { setRec(r); setAmount(String(r.balance / 100)); }}>Record payment</Button> },
      ]} empty="Nothing outstanding." />
      <h2 className="mb-2 mt-8 text-lg font-bold">Recent payments</h2>
      <DataTable rows={pays.data ?? []} columns={[
        { key: 'receiptNumber', label: 'Receipt' }, { key: 's', label: 'Student', render: (r) => r.student?.firstName }, { key: 'method', label: 'Method' }, { key: 'amount', label: 'Amount', render: (r) => money(r.amount) },
        { key: 'status', label: 'Status', render: (r) => <Badge tone={statusTone(r.status)}>{r.status.replace('_', ' ')}</Badge> },
        { key: 'a', label: '', render: (r) => r.status === 'success' && <Button size="sm" variant="outline" onClick={() => refund(r)}>Refund</Button> },
      ]} />
      <Modal open={!!rec} onClose={() => setRec(null)} title="Record offline payment">
        <form className="grid gap-3" onSubmit={async (e) => { e.preventDefault(); try { await api('/payments/offline', { body: { studentFeeId: rec._id, amount: Math.round(Number(amount) * 100), method } }); setRec(null); setMsg({ tone: 'success', text: 'Payment recorded and receipt generated.' }); pending.reload(); pays.reload(); } catch (er) { setMsg({ tone: 'error', text: errorMessage(er) }); setRec(null); } }}>
          <Field label="Amount (₹)"><Input type="number" min={1} step="0.01" required value={amount} onChange={(e) => setAmount(e.target.value)} /></Field>
          <Field label="Method"><Select value={method} onChange={(e) => setMethod(e.target.value)}>{['cash', 'cheque', 'bank_transfer', 'upi'].map((m) => <option key={m} value={m}>{m.replace('_', ' ')}</option>)}</Select></Field>
          <Button>Save</Button>
        </form>
      </Modal>
    </>
  );
}

export default function FeesPage() {
  const { can } = useAuth();
  const [tab, setTab] = useState<'collections' | 'structures'>('collections');
  useEffect(() => undefined, []);
  if (can('fees:own') && !can('fees:read')) return <><PageHeader title="Fees" subtitle="Pay fees online and download receipts." /><FamilyFees /></>;
  return (
    <>
      <PageHeader title="Fees & payments" subtitle="Structures, collections, receipts and refunds." />
      <div className="mb-4 inline-flex rounded-xl bg-slate-200/60 p-1 text-sm font-semibold">
        {(['collections', 'structures'] as const).map((t) => <button key={t} onClick={() => setTab(t)} className={`rounded-lg px-4 py-2 capitalize ${tab === t ? 'bg-white shadow' : 'text-slate-600'}`}>{t}</button>)}
      </div>
      {tab === 'collections' ? <Collections /> : can('fees:configure') ? <Structures /> : <Empty>You can view collections only.</Empty>}
    </>
  );
}
