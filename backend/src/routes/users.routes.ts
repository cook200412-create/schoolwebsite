import { Router } from 'express';
import { z } from 'zod';
import { ROLES, ROLE_PERMISSIONS } from '../config/permissions';
import { authenticate, authorize, clearPermissionCache, validate } from '../middleware/auth';
import { Parent, Staff, Teacher } from '../models/people';
import { RefreshToken, Role, User } from '../models/user';
import { hashPassword } from '../services/auth.service';
import { sendMail } from '../services/mail.service';
import { ApiError, asyncHandler, ok } from '../utils/http';
import { audit, mustId, paginate } from '../utils/helpers';
import { randomToken } from '../utils/security';
import { env } from '../config/env';

export const usersRouter = Router();
usersRouter.use(authenticate);

usersRouter.get('/', authorize('users:read'), asyncHandler(async (req, res) => {
  const { page, limit, skip } = paginate(req);
  const q: any = { deletedAt: null };
  if (typeof req.query.role === 'string') q.role = req.query.role;
  if (typeof req.query.q === 'string' && req.query.q) q.$or = [{ name: new RegExp(req.query.q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i') }, { email: new RegExp(req.query.q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i') }];
  const [items, total] = await Promise.all([User.find(q).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(), User.countDocuments(q)]);
  ok(res, items, { page, limit, total });
}));

const createSchema = z.object({
  name: z.string().trim().min(2), email: z.string().trim().toLowerCase().email(), phone: z.string().optional(),
  role: z.enum(ROLES), employeeId: z.string().optional(),
});

/** Admin-created accounts get a one-time temporary password delivered by email. */
usersRouter.post('/', authorize('users:write'), validate(createSchema), asyncHandler(async (req, res) => {
  const b = req.body as z.infer<typeof createSchema>;
  if (b.role === 'super_admin' && req.user!.role !== 'super_admin') throw ApiError.forbidden('Only a Super Admin can create Super Admins');
  if (await User.exists({ email: b.email })) throw ApiError.conflict('Email already in use');
  const temp = `Tmp-${randomToken(6)}9`;
  const user = await User.create({ name: b.name, email: b.email, phone: b.phone, role: b.role, passwordHash: await hashPassword(temp), mustChangePassword: true });
  if (b.role === 'parent') await Parent.create({ user: user._id, phone: b.phone });
  if (b.role === 'teacher') await Teacher.create({ user: user._id, name: b.name, email: b.email, phone: b.phone, employeeId: b.employeeId ?? `T-${randomToken(3)}` });
  if (!['parent', 'student', 'teacher'].includes(b.role)) await Staff.create({ user: user._id, name: b.name, email: b.email, phone: b.phone, employeeId: b.employeeId ?? `S-${randomToken(3)}` });
  await sendMail(b.email, 'Your school portal account', `Hello ${b.name},\nAn account has been created for you.\nTemporary password: ${temp}\nSign in at ${env.CLIENT_URL}/login and change it immediately.`);
  await audit(req, 'User.create', 'User', user._id, { role: b.role });
  ok(res, { id: user._id, email: user.email, role: user.role, ...(env.isProd ? {} : { temporaryPassword: temp }) }, undefined, 201);
}));

usersRouter.patch('/:id', authorize('users:write'),
  validate(z.object({ role: z.enum(ROLES).optional(), isActive: z.boolean().optional(), name: z.string().min(2).optional(), phone: z.string().optional() })),
  asyncHandler(async (req, res) => {
    const id = mustId(req.params.id);
    if (id === req.user!.id && (req.body.isActive === false || req.body.role)) throw ApiError.badRequest('You cannot change your own role or disable yourself');
    if (req.body.role === 'super_admin' && req.user!.role !== 'super_admin') throw ApiError.forbidden();
    const target = await User.findOne({ _id: id, deletedAt: null });
    if (!target) throw ApiError.notFound();
    if (target.role === 'super_admin' && req.user!.role !== 'super_admin') throw ApiError.forbidden();
    Object.assign(target, req.body);
    await target.save();
    if (req.body.isActive === false) await RefreshToken.updateMany({ user: id, revokedAt: null }, { revokedAt: new Date() });
    await audit(req, 'User.update', 'User', id, req.body);
    ok(res, { id, role: target.role, isActive: target.isActive });
  }));

usersRouter.delete('/:id', authorize('users:write'), asyncHandler(async (req, res) => {
  const id = mustId(req.params.id);
  if (id === req.user!.id) throw ApiError.badRequest('You cannot delete yourself');
  await User.findByIdAndUpdate(id, { deletedAt: new Date(), isActive: false });
  await RefreshToken.updateMany({ user: id }, { revokedAt: new Date() });
  await audit(req, 'User.delete', 'User', id);
  ok(res, { deleted: true });
}));

// ---- Roles & permissions ----
export const rolesRouter = Router();
rolesRouter.use(authenticate);
rolesRouter.get('/', authorize('roles:read'), asyncHandler(async (_req, res) => {
  const stored = await Role.find().lean();
  ok(res, ROLES.map((name) => ({ name, permissions: stored.find((r) => r.name === name)?.permissions ?? ROLE_PERMISSIONS[name], customised: stored.some((r) => r.name === name) })));
}));
rolesRouter.put('/:name', authorize('roles:read'), validate(z.object({ permissions: z.array(z.string().regex(/^[a-z_*]+(:[a-z_-]+)?$/)).max(200) })),
  asyncHandler(async (req, res) => {
    if (req.user!.role !== 'super_admin') throw ApiError.forbidden();
    const name = z.enum(ROLES).parse(req.params.name);
    if (name === 'super_admin') throw ApiError.badRequest('Super Admin permissions cannot be edited');
    const r = await Role.findOneAndUpdate({ name }, { name, permissions: req.body.permissions }, { upsert: true, new: true });
    clearPermissionCache();
    await audit(req, 'Role.update', 'Role', name, req.body);
    ok(res, r);
  }));
