import { Router } from 'express';
import { z } from 'zod';
import { authenticate, authorize, can, validate } from '../middleware/auth';
import { Attendance, LeaveApplication } from '../models/attendance';
import { Student } from '../models/people';
import { assertSectionAccess, assertStudentAccess, parentChildIds, teacherSectionIds } from '../services/access.service';
import { notifyUsers } from '../services/notify.service';
import { ApiError, asyncHandler, ok } from '../utils/http';
import { audit, mustId, objectId, paginate, toCsv, toDay } from '../utils/helpers';

export const attendanceRouter = Router();
attendanceRouter.use(authenticate);

const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const STATUS = z.enum(['present', 'absent', 'late', 'leave']);

attendanceRouter.post('/mark', authorize('attendance:mark'),
  validate(z.object({ sectionId: objectId, date: day, records: z.array(z.object({ studentId: objectId, status: STATUS })).min(1).max(200) })),
  asyncHandler(async (req, res) => {
    const { sectionId, date, records } = req.body as { sectionId: string; date: string; records: { studentId: string; status: string }[] };
    await assertSectionAccess(req, sectionId);
    const today = toDay(new Date());
    if (date > today) throw ApiError.badRequest('Cannot mark attendance for a future date');
    const canCorrect = can(req, 'attendance:correct');
    if (date !== today && !canCorrect) throw ApiError.forbidden('Only an administrator can change attendance of a past date');

    const ids = records.map((r) => r.studentId);
    if (new Set(ids).size !== ids.length) throw ApiError.badRequest('Duplicate students in submission');
    const students = await Student.find({ _id: { $in: ids }, section: sectionId, status: 'active', deletedAt: null }).select('class parents').populate('parents', 'user').lean();
    if (students.length !== ids.length) throw ApiError.badRequest('Some students do not belong to this section');
    const byId = new Map(students.map((s: any) => [String(s._id), s]));

    const existing = await Attendance.find({ student: { $in: ids }, date });
    const exMap = new Map(existing.map((e) => [String(e.student), e]));
    let created = 0, updated = 0;
    const absentParents: unknown[] = [];
    for (const r of records) {
      const s: any = byId.get(r.studentId);
      const ex = exMap.get(r.studentId);
      if (!ex) {
        await Attendance.create({ student: r.studentId, class: s.class, section: sectionId, date, status: r.status, markedBy: req.user!.id, history: [{ status: r.status, by: req.user!.id }] });
        created++;
        if (r.status === 'absent') absentParents.push(...(s.parents ?? []).map((p: any) => p.user));
      } else if (ex.status !== r.status) {
        ex.history.push({ status: r.status, by: req.user!.id, reason: 'resubmitted' } as any);
        ex.status = r.status as any; ex.markedBy = req.user!.id as any;
        await ex.save(); updated++;
        if (r.status === 'absent') absentParents.push(...(s.parents ?? []).map((p: any) => p.user));
      }
    }
    await notifyUsers(absentParents, { title: 'Attendance alert', body: `Your child has been marked absent on ${date}.`, type: 'attendance', link: '/portal/parent/attendance' }, true);
    await audit(req, 'Attendance.mark', 'Section', sectionId, { date, created, updated });
    ok(res, { created, updated }, undefined, created ? 201 : 200);
  }));

attendanceRouter.get('/class', authorize('attendance:read'),
  validate(z.object({ sectionId: objectId, date: day }), 'query'),
  asyncHandler(async (req, res) => {
    const { sectionId, date } = req.query as any;
    await assertSectionAccess(req, sectionId);
    const [students, records] = await Promise.all([
      Student.find({ section: sectionId, status: 'active', deletedAt: null }).sort({ rollNumber: 1, firstName: 1 }).select('firstName lastName rollNumber studentId').lean(),
      Attendance.find({ section: sectionId, date }).lean(),
    ]);
    const map = new Map(records.map((r) => [String(r.student), r.status]));
    ok(res, students.map((s) => ({ ...s, status: map.get(String(s._id)) ?? null })));
  }));

attendanceRouter.get('/student/:id', asyncHandler(async (req, res) => {
  const s = await assertStudentAccess(req, mustId(req.params.id));
  const month = typeof req.query.month === 'string' && /^\d{4}-\d{2}$/.test(req.query.month) ? req.query.month : undefined;
  const q: any = { student: s._id };
  if (month) q.date = { $regex: `^${month}` };
  const records = await Attendance.find(q).sort({ date: -1 }).select('date status').lean();
  const counts = { present: 0, absent: 0, late: 0, leave: 0 } as Record<string, number>;
  records.forEach((r) => { counts[r.status]++; });
  const total = records.length;
  const percentage = total ? Math.round(((counts.present + counts.late) / (total - counts.leave || 1)) * 10000) / 100 : null;
  ok(res, { records, counts, total, percentage });
}));

attendanceRouter.patch('/:id/correct', authorize('attendance:correct'), validate(z.object({ status: STATUS, reason: z.string().min(3).max(500) })), asyncHandler(async (req, res) => {
  const a = await Attendance.findById(mustId(req.params.id));
  if (!a) throw ApiError.notFound();
  a.history.push({ status: req.body.status, by: req.user!.id, reason: req.body.reason } as any);
  a.status = req.body.status;
  await a.save();
  await audit(req, 'Attendance.correct', 'Attendance', a._id, { reason: req.body.reason });
  ok(res, a);
}));

attendanceRouter.get('/report/monthly', authorize('attendance:read'),
  validate(z.object({ sectionId: objectId, month: z.string().regex(/^\d{4}-\d{2}$/), format: z.enum(['json', 'csv']).optional() }), 'query'),
  asyncHandler(async (req, res) => {
    const { sectionId, month, format } = req.query as any;
    await assertSectionAccess(req, sectionId);
    const rows = await Attendance.aggregate([
      { $match: { section: new (await import('mongoose')).Types.ObjectId(sectionId), date: { $regex: `^${month}` } } },
      { $group: { _id: { student: '$student', status: '$status' }, n: { $sum: 1 } } },
    ]);
    const students = await Student.find({ section: sectionId, deletedAt: null }).select('firstName lastName studentId').lean();
    const report = students.map((s) => {
      const c = { present: 0, absent: 0, late: 0, leave: 0 } as Record<string, number>;
      rows.filter((r) => String(r._id.student) === String(s._id)).forEach((r) => { c[r._id.status] = r.n; });
      const total = c.present + c.absent + c.late + c.leave;
      return { studentId: s.studentId, name: `${s.firstName} ${s.lastName}`.trim(), ...c, total, percentage: total ? Math.round(((c.present + c.late) / total) * 10000) / 100 : 0 };
    });
    if (format === 'csv') { res.setHeader('Content-Type', 'text/csv'); res.setHeader('Content-Disposition', `attachment; filename="attendance-${month}.csv"`); return res.send(toCsv(report)); }
    ok(res, report);
  }));

// ---------------- Leave applications ----------------
export const leaveRouter = Router();
leaveRouter.use(authenticate);

leaveRouter.post('/', authorize('leave:apply'), validate(z.object({ studentId: objectId.optional(), childName: z.string().trim().min(2).max(120).optional(), fromDate: day, toDate: day, reason: z.string().min(3).max(1000) })), asyncHandler(async (req, res) => {
  const b = req.body;
  if (b.toDate < b.fromDate) throw ApiError.badRequest('End date is before start date');
  let kind: 'student' | 'staff' = 'staff';
  if (req.user!.role === 'parent') {
    if (b.studentId) {
      if (!(await parentChildIds(req.user!.id)).includes(b.studentId)) throw ApiError.forbidden('You can only apply leave for your own child');
    } else if (!b.childName) throw ApiError.badRequest("Enter your child's name");
    kind = 'student';
  }
  const l = await LeaveApplication.create({ applicant: req.user!.id, kind, student: b.studentId, childName: b.studentId ? undefined : b.childName, fromDate: b.fromDate, toDate: b.toDate, reason: b.reason });
  ok(res, l, undefined, 201);
}));

leaveRouter.get('/', asyncHandler(async (req, res) => {
  const { page, limit, skip } = paginate(req);
  const q: any = {};
  if (typeof req.query.status === 'string' && req.query.status) q.status = req.query.status;
  const r = req.user!.role;
  if (r === 'parent' || r === 'student') q.applicant = req.user!.id;
  else if (r === 'teacher') {
    const sections = await teacherSectionIds(req.user!.id);
    const kids = await Student.find({ section: { $in: sections } }).select('_id').lean();
    q.$or = [{ applicant: req.user!.id }, { student: { $in: kids.map((k) => k._id) } }];
  } else if (!can(req, 'leave:approve')) throw ApiError.forbidden();
  const [items, total] = await Promise.all([LeaveApplication.find(q).populate('student', 'firstName lastName').populate('applicant', 'name role').sort({ createdAt: -1 }).skip(skip).limit(limit).lean(), LeaveApplication.countDocuments(q)]);
  ok(res, items, { page, limit, total });
}));

leaveRouter.patch('/:id/decide', validate(z.object({ status: z.enum(['approved', 'rejected']), note: z.string().max(500).optional() })), asyncHandler(async (req, res) => {
  const l = await LeaveApplication.findById(mustId(req.params.id));
  if (!l) throw ApiError.notFound();
  if (l.status !== 'pending') throw ApiError.conflict('Already decided');
  if (l.kind === 'staff' && !can(req, 'leave:approve')) throw ApiError.forbidden();
  if (l.kind === 'student') {
    if (!can(req, 'leave:approve')) {
      if (!can(req, 'leave:approve-student')) throw ApiError.forbidden();
      const st = await Student.findById(l.student).select('section').lean();
      if (!st || !(await teacherSectionIds(req.user!.id)).includes(String(st.section))) throw ApiError.forbidden();
    }
  }
  l.status = req.body.status; l.decisionNote = req.body.note; l.decidedBy = req.user!.id as any; l.decidedAt = new Date();
  await l.save();
  if (l.status === 'approved' && l.kind === 'student' && l.student) {
    const st = await Student.findById(l.student).select('class section').lean();
    const start = new Date(l.fromDate), end = new Date(l.toDate);
    for (let d = start; d <= end && st; d = new Date(d.getTime() + 86400000)) {
      const date = toDay(d);
      if (d.getUTCDay() === 0) continue;
      await Attendance.updateOne({ student: l.student, date }, { $setOnInsert: { class: st.class, section: st.section, markedBy: req.user!.id }, $set: { status: 'leave' }, $push: { history: { status: 'leave', by: req.user!.id, reason: 'approved leave' } } }, { upsert: true });
    }
  }
  await notifyUsers([l.applicant], { title: `Leave ${l.status}`, body: l.decisionNote ?? `Your leave request was ${l.status}.`, type: 'leave' }, true);
  await audit(req, 'Leave.decide', 'LeaveApplication', l._id, { status: l.status });
  ok(res, l);
}));
