import { Router } from 'express';
import type { Model } from 'mongoose';
import { z } from 'zod';
import { authenticate, authorize, can, validate } from '../middleware/auth';
import { Assignment, AssignmentSubmission, Homework } from '../models/learning';
import { Student, Teacher } from '../models/people';
import { assertStudentAccess, parentChildIds, teacherSectionIds, teacherSubjectsFor } from '../services/access.service';
import { notifyUsers } from '../services/notify.service';
import { ApiError, asyncHandler, ok } from '../utils/http';
import { audit, mustId, objectId, paginate } from '../utils/helpers';

function taskRouter(kind: 'homework' | 'assignment', model: Model<any>) {
  const r = Router();
  r.use(authenticate);
  const schema = z.object({
    section: objectId, subject: objectId, title: z.string().min(2).max(200), description: z.string().max(5000).optional(),
    dueDate: z.coerce.date(), maxMarks: z.number().positive().optional(),
  });

  r.post('/', authorize('homework:write'), validate(schema), asyncHandler(async (req, res) => {
    const teacher = await Teacher.findOne({ user: req.user!.id, deletedAt: null });
    if (!teacher) throw ApiError.forbidden('Only teachers can create tasks');
    const { section, subject } = req.body;
    if (!(await teacherSubjectsFor(req.user!.id, section)).includes(subject)) throw ApiError.forbidden('You are not assigned to teach this subject in this section');
    const sec: any = await (await import('../models/academic')).Section.findById(section).lean();
    const doc = await model.create({ ...req.body, teacher: teacher._id, class: sec.class });
    const kids = await Student.find({ section, status: 'active' }).select('user parents').populate('parents', 'user').lean();
    await notifyUsers(kids.flatMap((k: any) => [k.user, ...(k.parents ?? []).map((p: any) => p.user)]), { title: `New ${kind}: ${doc.title}`, body: `Due ${doc.dueDate.toISOString().slice(0, 10)}`, type: kind, link: `/portal/parent/homework` });
    await audit(req, `${kind}.create`, kind, doc._id);
    ok(res, doc, undefined, 201);
  }));

  r.get('/', authorize('homework:read', 'homework:own'), asyncHandler(async (req, res) => {
    const { page, limit, skip } = paginate(req);
    const q: any = { deletedAt: null };
    if (req.user!.role === 'teacher') q.section = { $in: await teacherSectionIds(req.user!.id) };
    else if (!can(req, 'homework:read')) {
      const ids = req.user!.role === 'parent' ? await parentChildIds(req.user!.id) : (await Student.find({ user: req.user!.id }).select('_id').lean()).map((s) => String(s._id));
      q.section = { $in: (await Student.find({ _id: { $in: ids } }).select('section').lean()).map((s) => s.section) };
    }
    if (typeof req.query.section === 'string') q.section = req.query.section;
    const [items, total] = await Promise.all([model.find(q).populate('subject', 'name').populate('section', 'name').sort({ dueDate: -1 }).skip(skip).limit(limit).lean(), model.countDocuments(q)]);
    ok(res, items, { page, limit, total });
  }));

  /** Parent/student view: all tasks of the child's section with this child's submission state. */
  r.get('/student/:studentId', asyncHandler(async (req, res) => {
    const s = await assertStudentAccess(req, mustId(req.params.studentId));
    const tasks = (await model.find({ section: s.section, deletedAt: null }).populate('subject', 'name').sort({ dueDate: -1 }).limit(100).lean()) as any[];
    const subs = await AssignmentSubmission.find({ kind, student: s._id, task: { $in: tasks.map((t) => t._id) } }).lean();
    ok(res, tasks.map((t) => ({ ...t, submission: subs.find((x) => String(x.task) === String(t._id)) ?? null })));
  }));

  r.post('/:id/submit', authorize('homework:submit'), validate(z.object({ content: z.string().max(10000).optional(), studentId: objectId.optional() })), asyncHandler(async (req, res) => {
    const student = await Student.findOne({ user: req.user!.id, deletedAt: null });
    if (!student) throw ApiError.forbidden('No student profile linked to this account');
    const task = await model.findOne({ _id: mustId(req.params.id), section: student.section, deletedAt: null });
    if (!task) throw ApiError.notFound('Task not found for your class');
    if (!req.body.content) throw ApiError.badRequest('Submission content is required');
    const sub = await AssignmentSubmission.findOneAndUpdate({ kind, task: task._id, student: student._id }, { content: req.body.content, submittedAt: new Date(), late: new Date() > task.dueDate, status: 'submitted', $unset: { marks: 1, feedback: 1 } }, { upsert: true, new: true, setDefaultsOnInsert: true });
    ok(res, sub, undefined, 201);
  }));

  r.get('/:id/submissions', authorize('homework:write'), asyncHandler(async (req, res) => {
    const task: any = await model.findById(mustId(req.params.id)).lean();
    if (!task) throw ApiError.notFound();
    if (!(await teacherSectionIds(req.user!.id)).includes(String(task.section))) throw ApiError.forbidden();
    const students = await Student.find({ section: task.section, status: 'active' }).select('firstName lastName rollNumber').lean();
    const subs = await AssignmentSubmission.find({ kind, task: task._id }).lean();
    ok(res, students.map((s) => ({ student: s, submission: subs.find((x) => String(x.student) === String(s._id)) ?? null })));
  }));

  r.patch('/submissions/:subId/review', authorize('homework:write'), validate(z.object({ marks: z.number().min(0).optional(), feedback: z.string().max(2000).optional() })), asyncHandler(async (req, res) => {
    const sub = await AssignmentSubmission.findOne({ _id: mustId(req.params.subId), kind });
    if (!sub) throw ApiError.notFound();
    const task: any = await model.findById(sub.task).lean();
    if (!task || !(await teacherSectionIds(req.user!.id)).includes(String(task.section))) throw ApiError.forbidden();
    if (req.body.marks !== undefined && kind === 'assignment' && req.body.marks > (task.maxMarks ?? 0)) throw ApiError.badRequest(`Marks cannot exceed ${task.maxMarks}`);
    Object.assign(sub, req.body, { reviewedBy: req.user!.id, reviewedAt: new Date(), status: 'reviewed' });
    await sub.save();
    const st = await Student.findById(sub.student).populate('parents', 'user').lean();
    await notifyUsers([(st as any)?.user, ...((st as any)?.parents ?? []).map((p: any) => p.user)], { title: `${kind} reviewed: ${task.title}`, body: req.body.feedback, type: kind });
    ok(res, sub);
  }));
  return r;
}

export const homeworkRouter = taskRouter('homework', Homework);
export const assignmentsRouter = taskRouter('assignment', Assignment);
