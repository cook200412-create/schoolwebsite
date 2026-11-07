import { Router } from 'express';
import { z } from 'zod';
import { authenticate, authorize, can, validate } from '../middleware/auth';
import { COMPLAINT_CATEGORIES, COMPLAINT_STATUSES, Complaint, REMARK_CATEGORIES, Remark } from '../models/feedback';
import { Student } from '../models/people';
import { User } from '../models/user';
import { assertStudentAccess, parentChildIds, teacherSectionIds } from '../services/access.service';
import { notifyUsers } from '../services/notify.service';
import { nextSeq, pad } from '../utils/counter';
import { ApiError, asyncHandler, ok } from '../utils/http';
import { audit, mustId, objectId, paginate } from '../utils/helpers';

// ======================= Complaints (parents ↔ school leadership) =======================
export const complaintsRouter = Router();
complaintsRouter.use(authenticate);

const leadership = () => User.find({ role: { $in: ['principal', 'school_admin'] }, isActive: true, deletedAt: null }).select('_id').lean();
const publicReply = (c: any, hideInternal: boolean) => ({ ...c, replies: (c.replies ?? []).filter((r: any) => !(hideInternal && r.internal)) });

complaintsRouter.post('/', authorize('complaints:own'),
  validate(z.object({ category: z.enum(COMPLAINT_CATEGORIES), subject: z.string().trim().min(3).max(200), description: z.string().trim().min(10).max(5000), studentId: objectId.optional(), priority: z.enum(['normal', 'high']).optional() })),
  asyncHandler(async (req, res) => {
    const b = req.body;
    if (b.studentId && !(await parentChildIds(req.user!.id)).includes(b.studentId)) throw ApiError.forbidden('You can only raise a complaint about your own child');
    const seq = await nextSeq(`complaint-${new Date().getFullYear()}`);
    const c = await Complaint.create({ ticketNumber: `CMP${new Date().getFullYear()}${pad(seq, 5)}`, parentUser: req.user!.id, student: b.studentId, category: b.category, subject: b.subject, description: b.description, priority: b.priority ?? 'normal' });
    await notifyUsers((await leadership()).map((u) => u._id), { title: `New complaint ${c.ticketNumber}`, body: c.subject, type: 'complaint', link: '/portal/complaints' }, true);
    await audit(req, 'Complaint.create', 'Complaint', c._id);
    ok(res, c, undefined, 201);
  }));

complaintsRouter.get('/', authorize('complaints:own', 'complaints:manage'), asyncHandler(async (req, res) => {
  const { page, limit, skip } = paginate(req);
  const q: any = { deletedAt: null };
  const manage = can(req, 'complaints:manage');
  if (!manage) q.parentUser = req.user!.id;
  for (const f of ['status', 'category']) if (typeof req.query[f] === 'string' && req.query[f]) q[f] = req.query[f];
  const [items, total] = await Promise.all([
    Complaint.find(q).populate('student', 'firstName lastName studentId').populate('parentUser', 'name phone').sort({ updatedAt: -1 }).skip(skip).limit(limit).lean(),
    Complaint.countDocuments(q),
  ]);
  ok(res, items.map((c) => publicReply(c, !manage)), { page, limit, total });
}));

async function loadComplaint(req: any) {
  const c = await Complaint.findOne({ _id: mustId(req.params.id), deletedAt: null });
  if (!c) throw ApiError.notFound();
  const manage = can(req, 'complaints:manage');
  if (!manage && String(c.parentUser) !== req.user.id) throw ApiError.notFound(); // other families' tickets are invisible
  return { c, manage };
}

complaintsRouter.get('/:id', authorize('complaints:own', 'complaints:manage'), asyncHandler(async (req, res) => {
  const { c, manage } = await loadComplaint(req);
  await c.populate([{ path: 'student', select: 'firstName lastName studentId' }, { path: 'parentUser', select: 'name phone email' }]);
  ok(res, publicReply(c.toObject(), !manage));
}));

complaintsRouter.post('/:id/replies', authorize('complaints:own', 'complaints:manage'), validate(z.object({ text: z.string().trim().min(1).max(4000), internal: z.boolean().optional() })), asyncHandler(async (req, res) => {
  const { c, manage } = await loadComplaint(req);
  if (c.status === 'closed') throw ApiError.conflict('This complaint is closed');
  if (req.body.internal && !manage) throw ApiError.forbidden();
  c.replies.push({ by: req.user!.id, byName: req.user!.name, byRole: req.user!.role, text: req.body.text, internal: !!req.body.internal } as any);
  if (manage && c.status === 'open' && !req.body.internal) c.status = 'in_review';
  await c.save();
  if (manage && !req.body.internal) await notifyUsers([c.parentUser], { title: `Reply on ${c.ticketNumber}`, body: req.body.text.slice(0, 140), type: 'complaint', link: '/portal/complaints' }, true);
  if (!manage) await notifyUsers((await leadership()).map((u) => u._id), { title: `Parent replied on ${c.ticketNumber}`, body: req.body.text.slice(0, 140), type: 'complaint', link: '/portal/complaints' });
  await audit(req, 'Complaint.reply', 'Complaint', c._id);
  ok(res, publicReply(c.toObject(), !manage), undefined, 201);
}));

complaintsRouter.patch('/:id/status', authorize('complaints:manage'), validate(z.object({ status: z.enum(COMPLAINT_STATUSES), assignedTo: objectId.optional() })), asyncHandler(async (req, res) => {
  const { c } = await loadComplaint(req);
  c.status = req.body.status;
  if (req.body.assignedTo) c.assignedTo = req.body.assignedTo;
  c.resolvedAt = ['resolved', 'closed'].includes(c.status) ? new Date() : undefined;
  await c.save();
  await notifyUsers([c.parentUser], { title: `Complaint ${c.ticketNumber} is ${c.status.replace('_', ' ')}`, type: 'complaint', link: '/portal/complaints' }, true);
  await audit(req, 'Complaint.status', 'Complaint', c._id, { status: c.status });
  ok(res, c);
}));

// ======================= Teacher remarks =======================
export const remarksRouter = Router();
remarksRouter.use(authenticate);

remarksRouter.post('/', authorize('remarks:write'),
  validate(z.object({ studentId: objectId, category: z.enum(REMARK_CATEGORIES), text: z.string().trim().min(3).max(2000), subject: objectId.optional(), visibleToParent: z.boolean().optional() })),
  asyncHandler(async (req, res) => {
    const st = await Student.findOne({ _id: req.body.studentId, status: 'active', deletedAt: null }).populate('parents', 'user');
    if (!st) throw ApiError.notFound('Student not found');
    if (!(await teacherSectionIds(req.user!.id)).includes(String(st.section))) throw ApiError.forbidden('You can only write remarks for students in your own sections');
    const r = await Remark.create({ student: st._id, section: st.section, subject: req.body.subject, teacherUser: req.user!.id, teacherName: req.user!.name, category: req.body.category, text: req.body.text, visibleToParent: req.body.visibleToParent ?? true });
    if (r.visibleToParent) await notifyUsers([...(st.parents as any[]).map((p) => p.user), st.user], { title: `New teacher remark for ${st.firstName}`, body: `${req.user!.name}: ${req.body.text.slice(0, 120)}`, type: 'remark', link: '/portal/remarks' }, req.body.category === 'concern');
    await audit(req, 'Remark.create', 'Remark', r._id);
    ok(res, r, undefined, 201);
  }));

remarksRouter.get('/student/:studentId', authorize('remarks:own', 'remarks:read', 'remarks:write'), asyncHandler(async (req, res) => {
  const s = await assertStudentAccess(req, mustId(req.params.studentId));
  const q: any = { student: s._id, deletedAt: null };
  if (!can(req, 'remarks:read') && !can(req, 'remarks:write')) q.visibleToParent = true; // families never see private notes
  ok(res, await Remark.find(q).populate('subject', 'name').sort({ createdAt: -1 }).limit(200).lean());
}));

remarksRouter.get('/mine', authorize('remarks:write'), asyncHandler(async (req, res) => {
  ok(res, await Remark.find({ teacherUser: req.user!.id, deletedAt: null }).populate('student', 'firstName lastName studentId').sort({ createdAt: -1 }).limit(100).lean());
}));

remarksRouter.delete('/:id', authorize('remarks:write'), asyncHandler(async (req, res) => {
  const r = await Remark.findOneAndUpdate({ _id: mustId(req.params.id), teacherUser: req.user!.id, deletedAt: null }, { deletedAt: new Date() });
  if (!r) throw ApiError.notFound();
  await audit(req, 'Remark.delete', 'Remark', r._id);
  ok(res, { deleted: true });
}));
