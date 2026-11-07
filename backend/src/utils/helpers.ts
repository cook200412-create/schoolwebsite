import type { Request } from 'express';
import { Types } from 'mongoose';
import { z } from 'zod';
import { AuditLog, DocumentModel } from '../models/operations';
import { ApiError } from './http';

export const objectId = z.string().refine((v) => Types.ObjectId.isValid(v), 'Invalid id');
export const isId = (v: unknown): v is string => typeof v === 'string' && Types.ObjectId.isValid(v);
export const mustId = (v: unknown, label = 'id') => {
  if (!isId(v)) throw ApiError.badRequest(`Invalid ${label}`);
  return v;
};

export function paginate(req: Request) {
  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 20));
  return { page, limit, skip: (page - 1) * limit };
}

export const audit = (req: Request, action: string, entity?: string, entityId?: unknown, meta?: unknown) =>
  AuditLog.create({
    actor: req.user?.id, actorRole: req.user?.role, action, entity,
    entityId: entityId ? String(entityId) : undefined, meta, ip: req.ip,
  }).catch(() => undefined);

export const toDay = (d: Date | string) => new Date(d).toISOString().slice(0, 10);

export const rupees = (paise: number) => `₹${(paise / 100).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;

export function toCsv(rows: Record<string, unknown>[], columns?: string[]) {
  const cols = columns ?? (rows[0] ? Object.keys(rows[0]) : []);
  const esc = (v: unknown) => {
    let s = v == null ? '' : v instanceof Date ? v.toISOString() : String(v);
    if (/^[=+\-@]/.test(s)) s = `'${s}`; // neutralise spreadsheet formula injection
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [cols.join(','), ...rows.map((r) => cols.map((c) => esc(r[c])).join(','))].join('\n');
}

export { DocumentModel };
