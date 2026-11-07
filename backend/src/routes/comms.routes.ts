import { Router } from 'express';
import { z } from 'zod';
import { authenticate, authorize, can, validate } from '../middleware/auth';
import { Announcement } from '../models/Announcement';
import { Message, Notification } from '../models/comms';
import { Parent, Student, Teacher } from '../models/people';
import { User } from '../models/user';
import { teacherSectionIds } from '../services/access.service';
import { notifyUsers } from '../services/notify.service';
import { ApiError, asyncHandler, ok } from '../utils/http';
import { audit, mustId, objectId, paginate } from '../utils/helpers';

// ---------------- Announcements ----------------
export const announcementsAdminRouter = Router();
announcementsAdminRouter.use(authenticate);
const annSchema = z.object({
  title: z.string().min(3).max(200), body: z.string().min(3).max(5000),
  category: z.enum(['general', 'holiday', 'examination', 'parent-meeting', 'event', 'admission', 'circular']).default('general'),
  audience: z.enum(['public', 'parents', 'students', 'staff']).default('public'),
  sections: z.array(objectId).optional(), publish: z.boolean().default(false),
});

async function recipientsFor(a: { audience: string; sections?: unknown[] }) {
  if (a.audience === 'public') return [];
  if (a.audience === 'staff') return (await User.find({ role: { $nin: ['parent', 'student'] }, isActive: true }).select('_id').lean()).map((u) => u._id);
  const filter: any = { status: 'active' }; if (a.sections?.length) filter.section = { $in: a.sections };
  const kids = await Student.find(filter).select('user parents').populate('parents', 'user').lean();
  return a.audience === 'students' ? kids.map((k: any) => k.user) : kids.flatMap((k: any) => (k.parents ?? []).map((p: any) => p.user));
}

announcementsAdminRouter.get('/', authorize('announcements:read'), asyncHandler(async (req, res) => {
  const { page, limit, skip } = paginate(req);
  const q: any = { deletedAt: null };
  const r = req.user!.role;
  if (r === 'parent') q.audience = { $in: ['public', 'parents'] };
  else if (r === 'student') q.audience = { $in: ['public', 'students'] };
  else if (!can(req, 'announcements:write') && r !== 'teacher') q.isPublished = true;
  if (r === 'parent' || r === 'student') q.isPublished = true;
  const [items, total] = await Promise.all([Announcement.find(q).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(), Announcement.countDocuments(q)]);
  ok(res, items, { page, limit, total });
}));

announcementsAdminRouter.post('/', authorize('announcements:write', 'announcements:class'), validate(annSchema), asyncHandler(async (req, res) => {
  const b = req.body as z.infer<typeof annSchema>;
  if (!can(req, 'announcements:write')) { // teacher: class-wise only, own sections
    const mine = await teacherSectionIds(req.user!.id);
    if (!b.sections?.length || b.sections.some((s) => !mine.includes(s)) || !['parents', 'students'].includes(b.audience)) throw ApiError.forbidden('Teachers can only post to their own sections');
  }
  if (req.user!.role === 'transport_manager') b.audience = b.audience === 'public' ? 'parents' : b.audience;
  const a = await Announcement.create({ ...b, createdBy: req.user!.id, isPublished: b.publish, publishedAt: b.publish ? new Date() : undefined });
  if (b.publish) await notifyUsers(await recipientsFor(b), { title: b.title, body: b.body.slice(0, 200), type: 'announcement' }, b.category === 'circular');
  await audit(req, 'Announcement.create', 'Announcement', a._id);
  ok(res, a, undefined, 201);
}));

announcementsAdminRouter.post('/:id/publish', authorize('announcements:write'), asyncHandler(async (req, res) => {
  const a = await Announcement.findOneAndUpdate({ _id: mustId(req.params.id), deletedAt: null, isPublished: false }, { isPublished: true, publishedAt: new Date() }, { new: true });
  if (!a) throw ApiError.notFound('Announcement not found or already published');
  await notifyUsers(await recipientsFor(a as any), { title: a.title, body: a.body.slice(0, 200), type: 'announcement' });
  await audit(req, 'Announcement.publish', 'Announcement', a._id); ok(res, a);
}));
announcementsAdminRouter.delete('/:id', authorize('announcements:write'), asyncHandler(async (req, res) => {
  await Announcement.findByIdAndUpdate(mustId(req.params.id), { deletedAt: new Date() }); await audit(req, 'Announcement.delete', 'Announcement', req.params.id); ok(res, { deleted: true });
}));

// ---------------- Notifications ----------------
export const notificationsRouter = Router();
notificationsRouter.use(authenticate);
notificationsRouter.get('/', asyncHandler(async (req, res) => {
  const { page, limit, skip } = paginate(req);
  const q: any = { user: req.user!.id }; if (req.query.unread === 'true') q.readAt = null;
  const [items, total, unread] = await Promise.all([Notification.find(q).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(), Notification.countDocuments(q), Notification.countDocuments({ user: req.user!.id, readAt: null })]);
  ok(res, items, { page, limit, total, unread });
}));
notificationsRouter.post('/read-all', asyncHandler(async (req, res) => { await Notification.updateMany({ user: req.user!.id, readAt: null }, { readAt: new Date() }); ok(res, { done: true }); }));
notificationsRouter.patch('/:id/read', asyncHandler(async (req, res) => {
  const n = await Notification.findOneAndUpdate({ _id: mustId(req.params.id), user: req.user!.id }, { readAt: new Date() }, { new: true });
  if (!n) throw ApiError.notFound(); ok(res, n);
}));
notificationsRouter.post('/fcm-token', validate(z.object({ token: z.string().min(20).max(4096) })), asyncHandler(async (req, res) => {
  await User.updateOne({ _id: req.user!.id }, { $addToSet: { fcmTokens: req.body.token } }); ok(res, { registered: true });
}));

// ---------------- Messages (restricted to authorised relationships) ----------------
export const messagesRouter = Router();
messagesRouter.use(authenticate, authorize('messages:use'));

const LEADERSHIP = ['school_admin', 'principal', 'super_admin'];

/** Parent ↔ teachers of their child's section, parent ↔ leadership; teacher ↔ parents of own students; leadership ↔ anyone. */
async function canMessage(fromId: string, fromRole: string, toId: string): Promise<boolean> {
  const to = await User.findOne({ _id: toId, isActive: true, deletedAt: null }).select('role').lean();
  if (!to || toId === fromId) return false;
  if (LEADERSHIP.includes(fromRole) || LEADERSHIP.includes(to.role)) return !(fromRole === 'student' || to.role === 'student');
  const [parentUser, teacherUser] = fromRole === 'parent' && to.role === 'teacher' ? [fromId, toId] : fromRole === 'teacher' && to.role === 'parent' ? [toId, fromId] : [null, null];
  if (!parentUser || !teacherUser) return false;
  const parent = await Parent.findOne({ user: parentUser }).lean();
  const teacher = await Teacher.findOne({ user: teacherUser }).lean();
  if (!parent || !teacher) return false;
  const secs = await teacherSectionIds(teacherUser);
  return !!(await Student.exists({ _id: { $in: parent.children }, section: { $in: secs } }));
}

const threadKey = (a: string, b: string) => [a, b].sort().join(':');

messagesRouter.get('/contacts', asyncHandler(async (req, res) => {
  const role = req.user!.role;
  let users: any[] = [];
  if (role === 'parent') {
    const p = await Parent.findOne({ user: req.user!.id }).lean();
    const secs = (await Student.find({ _id: { $in: p?.children ?? [] } }).select('section').lean()).map((s) => s.section);
    const teachers = await Teacher.find({ $or: [{ 'assignments.section': { $in: secs } }, { classTeacherOf: { $in: secs } }], user: { $ne: null } }).select('user name').lean();
    const lead = await User.find({ role: { $in: ['principal', 'school_admin'] }, isActive: true }).select('name role').lean();
    users = [...teachers.map((t) => ({ id: t.user, name: t.name, role: 'teacher' })), ...lead.map((u) => ({ id: u._id, name: u.name, role: u.role }))];
  } else if (role === 'teacher') {
    const secs = await teacherSectionIds(req.user!.id);
    const kids = await Student.find({ section: { $in: secs } }).populate({ path: 'parents', populate: { path: 'user', select: 'name' } }).lean();
    const seen = new Map<string, any>();
    kids.forEach((k: any) => (k.parents ?? []).forEach((p: any) => p.user && seen.set(String(p.user._id), { id: p.user._id, name: p.user.name, role: 'parent', child: k.firstName })));
    users = [...seen.values()];
    users.push(...(await User.find({ role: { $in: ['principal', 'school_admin'] } }).select('name role').lean()).map((u) => ({ id: u._id, name: u.name, role: u.role })));
  } else users = (await User.find({ _id: { $ne: req.user!.id }, isActive: true, role: { $ne: 'student' } }).select('name role').limit(200).lean()).map((u) => ({ id: u._id, name: u.name, role: u.role }));
  ok(res, users);
}));

messagesRouter.post('/', validate(z.object({ to: objectId, body: z.string().trim().min(1).max(4000), studentId: objectId.optional() })), asyncHandler(async (req, res) => {
  if (!(await canMessage(req.user!.id, req.user!.role, req.body.to))) throw ApiError.forbidden('You are not allowed to message this person');
  const m = await Message.create({ threadKey: threadKey(req.user!.id, req.body.to), from: req.user!.id, to: req.body.to, body: req.body.body, student: req.body.studentId });
  await notifyUsers([req.body.to], { title: `New message from ${req.user!.name}`, body: req.body.body.slice(0, 120), type: 'message' });
  await audit(req, 'Message.send', 'Message', m._id, { to: req.body.to });
  ok(res, m, undefined, 201);
}));

messagesRouter.get('/threads', asyncHandler(async (req, res) => {
  const msgs = await Message.find({ $or: [{ from: req.user!.id }, { to: req.user!.id }] }).sort({ createdAt: -1 }).limit(300).populate('from to', 'name role').lean();
  const map = new Map<string, any>();
  for (const m of msgs) {
    const other: any = String((m.from as any)._id) === req.user!.id ? m.to : m.from;
    const t = map.get(String(other._id)) ?? { with: { id: other._id, name: other.name, role: other.role }, last: m.body, at: (m as any).createdAt, unread: 0 };
    if (String((m.to as any)._id) === req.user!.id && !m.readAt) t.unread++;
    map.set(String(other._id), t);
  }
  ok(res, [...map.values()]);
}));

messagesRouter.get('/thread/:userId', asyncHandler(async (req, res) => {
  const other = mustId(req.params.userId);
  const key = threadKey(req.user!.id, other);
  const items = await Message.find({ threadKey: key }).sort({ createdAt: 1 }).limit(500).lean();
  await Message.updateMany({ threadKey: key, to: req.user!.id, readAt: null }, { readAt: new Date() });
  ok(res, items);
}));
