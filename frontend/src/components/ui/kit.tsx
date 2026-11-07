'use client';

import { AlertCircle, CheckCircle2, Loader2, X } from 'lucide-react';
import * as React from 'react';
import { cn } from '@/lib/utils';

/* ---------- Form controls ---------- */
const control = 'w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 shadow-sm placeholder:text-slate-400 focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-200 disabled:bg-slate-50';

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(({ className, ...p }, ref) => (
  <input ref={ref} className={cn(control, 'h-11', className)} {...p} />
));
Input.displayName = 'Input';

export const Textarea = React.forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(({ className, ...p }, ref) => (
  <textarea ref={ref} className={cn(control, 'min-h-[96px]', className)} {...p} />
));
Textarea.displayName = 'Textarea';

export const Select = React.forwardRef<HTMLSelectElement, React.SelectHTMLAttributes<HTMLSelectElement>>(({ className, children, ...p }, ref) => (
  <select ref={ref} className={cn(control, 'h-11 pr-8', className)} {...p}>{children}</select>
));
Select.displayName = 'Select';

export function Field({ label, error, hint, children, className }: { label: string; error?: string; hint?: string; children: React.ReactNode; className?: string }) {
  return (
    <label className={cn('grid gap-1.5 text-sm', className)}>
      <span className="font-medium text-navy-900">{label}</span>
      {children}
      {hint && !error && <span className="text-xs text-slate-500">{hint}</span>}
      {error && <span role="alert" className="text-xs font-medium text-red-600">{error}</span>}
    </label>
  );
}

/* ---------- Surfaces ---------- */
export const Card = ({ className, ...p }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn('rounded-2xl border border-slate-100 bg-white p-5 shadow-card', className)} {...p} />
);

export function Stat({ label, value, hint, icon }: { label: string; value: React.ReactNode; hint?: string; icon?: React.ReactNode }) {
  return (
    <Card className="flex items-start justify-between gap-3">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">{label}</p>
        <p className="mt-1 font-serif text-3xl font-bold text-navy-900">{value}</p>
        {hint && <p className="mt-1 text-xs text-slate-500">{hint}</p>}
      </div>
      {icon && <span className="grid h-10 w-10 place-items-center rounded-xl bg-sky-100 text-sky-600">{icon}</span>}
    </Card>
  );
}

const tones = {
  gray: 'bg-slate-100 text-slate-700', green: 'bg-emerald-100 text-emerald-800', red: 'bg-red-100 text-red-700',
  amber: 'bg-amber-100 text-amber-800', blue: 'bg-sky-100 text-sky-800', navy: 'bg-navy-100 text-navy-800',
};
export const Badge = ({ tone = 'gray', children }: { tone?: keyof typeof tones; children: React.ReactNode }) => (
  <span className={cn('inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize', tones[tone])}>{children}</span>
);

export const statusTone = (s: string): keyof typeof tones =>
  (['approved', 'success', 'published', 'present', 'reviewed', 'PASS', 'active'].includes(s) ? 'green'
    : ['rejected', 'failed', 'absent', 'FAIL', 'refunded'].includes(s) ? 'red'
    : ['pending', 'created', 'submitted', 'late', 'under_review', 'documents_required', 'waitlisted', 'marks_entry'].includes(s) ? 'amber' : 'gray');

/* ---------- Feedback ---------- */
export const Spinner = ({ className }: { className?: string }) => <Loader2 className={cn('animate-spin text-sky-600', className)} aria-label="Loading" />;

export const PageLoader = () => <div className="grid place-items-center py-20"><Spinner className="h-8 w-8" /></div>;

export function Alert({ tone = 'error', children }: { tone?: 'error' | 'success' | 'info'; children: React.ReactNode }) {
  const cls = tone === 'error' ? 'bg-red-50 text-red-800 border-red-200' : tone === 'success' ? 'bg-emerald-50 text-emerald-800 border-emerald-200' : 'bg-sky-50 text-sky-900 border-sky-200';
  const Icon = tone === 'success' ? CheckCircle2 : AlertCircle;
  return <div role={tone === 'error' ? 'alert' : 'status'} className={cn('flex items-start gap-2 rounded-xl border px-4 py-3 text-sm', cls)}><Icon size={18} className="mt-0.5 shrink-0" /><div>{children}</div></div>;
}

export const Empty = ({ children }: { children: React.ReactNode }) => (
  <div className="rounded-2xl border border-dashed border-navy-200 bg-navy-50/40 p-8 text-center text-sm text-slate-600">{children}</div>
);

/* ---------- Modal ---------- */
export function Modal({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: React.ReactNode }) {
  React.useEffect(() => {
    if (!open) return;
    const h = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', h);
    return () => document.removeEventListener('keydown', h);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 grid place-items-end bg-navy-950/50 p-0 sm:place-items-center sm:p-4" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div role="dialog" aria-modal="true" aria-label={title} className="max-h-[92vh] w-full overflow-y-auto rounded-t-3xl bg-white p-5 shadow-lift sm:max-w-xl sm:rounded-3xl sm:p-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-xl font-bold">{title}</h2>
          <button onClick={onClose} aria-label="Close" className="grid h-9 w-9 place-items-center rounded-lg hover:bg-slate-100"><X size={18} /></button>
        </div>
        {children}
      </div>
    </div>
  );
}

/* ---------- Responsive table → cards on mobile ---------- */
export interface Column<T> { key: string; label: string; render?: (row: T) => React.ReactNode; className?: string }
export function DataTable<T extends { _id?: string }>({ rows, columns, onRowClick, empty = 'No records found.' }: { rows: T[]; columns: Column<T>[]; onRowClick?: (r: T) => void; empty?: string }) {
  if (!rows.length) return <Empty>{empty}</Empty>;
  const cell = (r: T, c: Column<T>) => (c.render ? c.render(r) : String((r as any)[c.key] ?? '—'));
  return (
    <>
      <div className="hidden overflow-x-auto rounded-2xl border border-slate-100 bg-white shadow-card md:block">
        <table className="w-full text-left text-sm">
          <thead className="bg-navy-50 text-xs uppercase tracking-wider text-navy-700">
            <tr>{columns.map((c) => <th key={c.key} className={cn('px-4 py-3 font-semibold', c.className)}>{c.label}</th>)}</tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map((r, i) => (
              <tr key={r._id ?? i} onClick={() => onRowClick?.(r)} className={cn(onRowClick && 'cursor-pointer hover:bg-sky-50/50')}>
                {columns.map((c) => <td key={c.key} className={cn('px-4 py-3', c.className)}>{cell(r, c)}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <ul className="grid gap-3 md:hidden">
        {rows.map((r, i) => (
          <li key={r._id ?? i}>
            <button type="button" onClick={() => onRowClick?.(r)} className="w-full rounded-2xl border border-slate-100 bg-white p-4 text-left shadow-card">
              {columns.map((c) => (
                <div key={c.key} className="flex justify-between gap-4 py-1 text-sm">
                  <span className="text-slate-500">{c.label}</span><span className="text-right font-medium text-navy-900">{cell(r, c)}</span>
                </div>
              ))}
            </button>
          </li>
        ))}
      </ul>
    </>
  );
}

export function Pager({ page, limit, total, onPage }: { page: number; limit: number; total: number; onPage: (p: number) => void }) {
  const pages = Math.max(1, Math.ceil(total / limit));
  if (pages <= 1) return null;
  return (
    <div className="mt-4 flex items-center justify-between text-sm text-slate-600">
      <span>Page {page} of {pages} · {total} records</span>
      <div className="flex gap-2">
        <button disabled={page <= 1} onClick={() => onPage(page - 1)} className="rounded-lg border px-3 py-1.5 disabled:opacity-40">Previous</button>
        <button disabled={page >= pages} onClick={() => onPage(page + 1)} className="rounded-lg border px-3 py-1.5 disabled:opacity-40">Next</button>
      </div>
    </div>
  );
}

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: React.ReactNode }) {
  return (
    <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div><h1 className="text-2xl font-bold sm:text-3xl">{title}</h1>{subtitle && <p className="mt-1 text-sm text-slate-600">{subtitle}</p>}</div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

export const money = (paise?: number) => `₹${((paise ?? 0) / 100).toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
