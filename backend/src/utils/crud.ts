import { Router } from 'express';
import type { FilterQuery, Model } from 'mongoose';
import type { ZodObject, ZodRawShape } from 'zod';
import { authenticate, authorize, validate } from '../middleware/auth';
import { ApiError, asyncHandler, ok } from './http';
import { audit, mustId, paginate } from './helpers';

interface CrudOptions {
  name: string;
  model: Model<any>;
  read: string[];
  write: string[];
  schema: ZodObject<ZodRawShape>;
  search?: string[];
  filters?: string[];
  populate?: string | string[];
  sort?: Record<string, 1 | -1>;
  softDelete?: boolean;
  /** Extra business validation run on create and update; throw ApiError to reject. */
  check?: (body: any) => void;
}

/** Permission-guarded paginated CRUD with validation, soft delete and audit logging. */
export function crudRouter(o: CrudOptions) {
  const r = Router();
  const soft = o.softDelete !== false;
  r.use(authenticate);

  r.get('/', authorize(...o.read), asyncHandler(async (req, res) => {
    const { page, limit, skip } = paginate(req);
    const q: FilterQuery<any> = soft ? { deletedAt: null } : {};
    for (const f of o.filters ?? []) if (typeof req.query[f] === 'string' && req.query[f]) q[f] = req.query[f];
    if (typeof req.query.q === 'string' && req.query.q && o.search?.length) {
      const rx = new RegExp(req.query.q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      q.$or = o.search.map((f) => ({ [f]: rx }));
    }
    const query = o.model.find(q).sort(o.sort ?? { createdAt: -1 }).skip(skip).limit(limit);
    if (o.populate) query.populate(o.populate as any);
    const [items, total] = await Promise.all([query.lean(), o.model.countDocuments(q)]);
    ok(res, items, { page, limit, total });
  }));

  r.get('/:id', authorize(...o.read), asyncHandler(async (req, res) => {
    const q = o.model.findOne({ _id: mustId(req.params.id), ...(soft ? { deletedAt: null } : {}) });
    if (o.populate) q.populate(o.populate as any);
    const doc = await q.lean();
    if (!doc) throw ApiError.notFound();
    ok(res, doc);
  }));

  r.post('/', authorize(...o.write), validate(o.schema), asyncHandler(async (req, res) => {
    o.check?.(req.body);
    const doc = await o.model.create(req.body);
    await audit(req, `${o.name}.create`, o.name, doc._id);
    ok(res, doc, undefined, 201);
  }));

  r.patch('/:id', authorize(...o.write), validate(o.schema.partial()), asyncHandler(async (req, res) => {
    o.check?.(req.body);
    const doc = await o.model.findOneAndUpdate({ _id: mustId(req.params.id), ...(soft ? { deletedAt: null } : {}) }, req.body, { new: true, runValidators: true });
    if (!doc) throw ApiError.notFound();
    await audit(req, `${o.name}.update`, o.name, doc._id);
    ok(res, doc);
  }));

  r.delete('/:id', authorize(...o.write), asyncHandler(async (req, res) => {
    const id = mustId(req.params.id);
    const doc = soft ? await o.model.findOneAndUpdate({ _id: id, deletedAt: null }, { deletedAt: new Date() }) : await o.model.findByIdAndDelete(id);
    if (!doc) throw ApiError.notFound();
    await audit(req, `${o.name}.delete`, o.name, id);
    ok(res, { deleted: true });
  }));

  return r;
}
