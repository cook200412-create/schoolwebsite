import { Router } from 'express';
import { Types } from 'mongoose';
import { authenticate, authorize, can } from '../middleware/auth';
import { AcademicYear, ClassModel, Section, Subject } from '../models/academic';
import { Admission } from '../models/admission';
import { Attendance, LeaveApplication } from '../models/attendance';
import { ExamResult, Examination } from '../models/exam';
import { Payment, StudentFee } from '../models/finance';
import { AuditLog, Book, BookIssue, Vehicle } from '../models/operations';
import { Staff, Student, Teacher } from '../models/people';
import { SchoolSettings } from '../models/SchoolSettings';
import { startPdf, table } from '../services/pdf.service';
import { asyncHandler, ok } from '../utils/http';
import { rupees, toCsv, toDay } from '../utils/helpers';

export const reportsRouter = Router();
reportsRouter.use(authenticate, authorize('reports:read'));

/** Role-aware dashboard counters (all values come from the database). */
reportsRouter.get('/dashboard', asyncHandler(async (req, res) => {
  const today = toDay(new Date());
  const monthStart = new Date(); monthStart.setDate(1); monthStart.setHours(0, 0, 0, 0);
  const out: Record<string, unknown> = {};
  const jobs: Promise<void>[] = [];
  const add = (k: string, p: Promise<unknown>) => jobs.push(p.then((v) => { out[k] = v; }));

  if (can(req, 'students:read')) {
    add('students', Student.countDocuments({ status: 'active', deletedAt: null }));
    add('classes', ClassModel.countDocuments({ deletedAt: null }));
  }
  if (can(req, 'teachers:read')) add('teachers', Teacher.countDocuments({ deletedAt: null }));
  if (can(req, 'staff:read')) add('staff', Staff.countDocuments({ deletedAt: null }));
  if (can(req, 'admissions:read')) {
    add('admissions', Admission.aggregate([{ $match: { deletedAt: null } }, { $group: { _id: '$status', n: { $sum: 1 } } }]).then((r) => Object.fromEntries(r.map((x) => [x._id, x.n]))));
  }
  if (can(req, 'attendance:read')) {
    add('attendanceToday', Attendance.aggregate([{ $match: { date: today } }, { $group: { _id: '$status', n: { $sum: 1 } } }]).then((r) => {
      const c = Object.fromEntries(r.map((x) => [x._id, x.n])) as Record<string, number>; const t = Object.values(c).reduce((a, b) => a + b, 0);
      return { counts: c, total: t, percentage: t ? Math.round((((c.present ?? 0) + (c.late ?? 0)) / t) * 10000) / 100 : null };
    }));
  }
  if (can(req, 'reports:finance')) {
    add('feeCollectionThisMonth', Payment.aggregate([{ $match: { status: { $in: ['success', 'partially_refunded'] }, paidAt: { $gte: monthStart } } }, { $group: { _id: null, total: { $sum: '$amount' }, count: { $sum: 1 } } }]).then((r) => r[0] ?? { total: 0, count: 0 }));
    add('pendingFees', StudentFee.aggregate([{ $group: { _id: null, due: { $sum: '$totalDue' }, paid: { $sum: '$paid' } } }]).then((r) => ({ pending: (r[0]?.due ?? 0) - (r[0]?.paid ?? 0) })));
  }
  if (can(req, 'leave:approve')) add('pendingLeaves', LeaveApplication.countDocuments({ status: 'pending' }));
  if (can(req, 'results:publish')) add('examsAwaitingApproval', Examination.countDocuments({ status: { $in: ['submitted', 'approved'] } }));
  if (can(req, 'library:read')) add('library', Promise.all([Book.countDocuments({ deletedAt: null }), BookIssue.countDocuments({ returnedOn: null })]).then(([books, issued]) => ({ books, issued })));
  if (can(req, 'transport:read')) add('vehicles', Vehicle.countDocuments({ deletedAt: null }));
  if (can(req, 'audit:read')) add('recentActivity', AuditLog.find().sort({ createdAt: -1 }).limit(10).populate('actor', 'name').lean());
  await Promise.all(jobs);
  ok(res, out);
}));

reportsRouter.get('/attendance-trend', authorize('attendance:read'), asyncHandler(async (_req, res) => {
  const rows = await Attendance.aggregate([
    { $group: { _id: { m: { $substr: ['$date', 0, 7] }, s: '$status' }, n: { $sum: 1 } } },
  ]);
  const months = [...new Set(rows.map((r) => r._id.m))].sort().slice(-12);
  ok(res, months.map((m) => {
    const c = (s: string) => rows.find((r) => r._id.m === m && r._id.s === s)?.n ?? 0;
    const t = c('present') + c('absent') + c('late') + c('leave');
    return { month: m, percentage: t ? Math.round(((c('present') + c('late')) / t) * 10000) / 100 : 0, total: t };
  }));
}));

reportsRouter.get('/class-attendance', authorize('attendance:read'), asyncHandler(async (req, res) => {
  const date = typeof req.query.date === 'string' ? req.query.date : toDay(new Date());
  const rows = await Attendance.aggregate([{ $match: { date } }, { $group: { _id: { section: '$section', s: '$status' }, n: { $sum: 1 } } }]);
  const sections = await Section.find({ _id: { $in: [...new Set(rows.map((r) => r._id.section))] } }).populate('class', 'name').lean();
  ok(res, sections.map((s: any) => {
    const c = (st: string) => rows.find((r) => String(r._id.section) === String(s._id) && r._id.s === st)?.n ?? 0;
    const t = c('present') + c('absent') + c('late') + c('leave');
    return { section: `${s.class?.name}-${s.name}`, present: c('present'), absent: c('absent'), late: c('late'), leave: c('leave'), percentage: t ? Math.round(((c('present') + c('late')) / t) * 10000) / 100 : 0 };
  }));
}));

reportsRouter.get('/exam-performance/:examId', authorize('results:read'), asyncHandler(async (req, res) => {
  const exam = await Examination.findById(req.params.examId).lean();
  if (!exam) return ok(res, null);
  const subs = await Subject.find({ _id: { $in: exam.subjects.map((s) => s.subject) } }).lean();
  const avg = await ExamResult.aggregate([{ $match: { examination: exam._id, absent: false } }, { $group: { _id: '$subject', avg: { $avg: '$marks' }, max: { $max: '$marks' }, n: { $sum: 1 } } }]);
  ok(res, exam.subjects.map((s) => ({ subject: subs.find((x) => String(x._id) === String(s.subject))?.name, maxMarks: s.maxMarks, average: Math.round((avg.find((a) => String(a._id) === String(s.subject))?.avg ?? 0) * 100) / 100, highest: avg.find((a) => String(a._id) === String(s.subject))?.max ?? 0, entries: avg.find((a) => String(a._id) === String(s.subject))?.n ?? 0 })));
}));

reportsRouter.get('/admission-funnel', authorize('admissions:read'), asyncHandler(async (_req, res) => {
  const r = await Admission.aggregate([{ $group: { _id: '$status', n: { $sum: 1 } } }]);
  const total = r.reduce((a, b) => a + b.n, 0); const approved = r.find((x) => x._id === 'approved')?.n ?? 0;
  ok(res, { byStatus: r.map((x) => ({ status: x._id, count: x.n })), total, conversionRate: total ? Math.round((approved / total) * 10000) / 100 : 0 });
}));

reportsRouter.get('/enrollment', authorize('students:read'), asyncHandler(async (_req, res) => {
  const r = await Student.aggregate([{ $match: { deletedAt: null, status: 'active' } }, { $group: { _id: '$class', n: { $sum: 1 } } }]);
  const classes = await ClassModel.find({ _id: { $in: r.map((x) => x._id) } }).sort({ order: 1 }).lean();
  const years = await AcademicYear.find().sort({ startDate: 1 }).lean();
  const trend = await Student.aggregate([{ $match: { deletedAt: null } }, { $group: { _id: '$academicYear', n: { $sum: 1 } } }]);
  ok(res, { byClass: classes.map((c) => ({ class: c.name, count: r.find((x) => String(x._id) === String(c._id))?.n ?? 0 })), byYear: years.map((y) => ({ year: y.name, count: trend.find((t) => String(t._id) === String(y._id))?.n ?? 0 })) });
}));

/** Fee collection grouped by day or month. format=csv|pdf for exports. */
reportsRouter.get('/fee-collection', authorize('reports:finance'), asyncHandler(async (req, res) => {
  const by = req.query.by === 'month' ? 7 : 10;
  const match: any = { status: { $in: ['success', 'partially_refunded', 'refunded'] } };
  if (typeof req.query.from === 'string') match.paidAt = { ...(match.paidAt ?? {}), $gte: new Date(req.query.from) };
  if (typeof req.query.to === 'string') match.paidAt = { ...(match.paidAt ?? {}), $lte: new Date(`${req.query.to}T23:59:59Z`) };
  const rows = (await Payment.aggregate([
    { $match: match },
    { $group: { _id: { $substr: [{ $dateToString: { format: '%Y-%m-%d', date: '$paidAt' } }, 0, by] }, total: { $sum: '$amount' }, count: { $sum: 1 }, online: { $sum: { $cond: [{ $eq: ['$method', 'online'] }, '$amount', 0] } } } },
    { $sort: { _id: 1 } },
  ])).map((r) => ({ period: r._id, transactions: r.count, total: r.total, online: r.online, offline: r.total - r.online }));
  if (req.query.format === 'csv') { res.setHeader('Content-Type', 'text/csv'); res.setHeader('Content-Disposition', 'attachment; filename="fee-collection.csv"'); return res.send(toCsv(rows)); }
  if (req.query.format === 'pdf') {
    const school = await SchoolSettings.findOne({ key: 'default' }).lean();
    const doc = startPdf(res, 'fee-collection.pdf', school?.schoolName ?? 'School', 'Fee collection report');
    table(doc, ['Period', 'Txns', 'Total', 'Online', 'Offline'], rows.map((r) => [r.period, String(r.transactions), rupees(r.total), rupees(r.online), rupees(r.offline)]), [100, 60, 110, 110, 110]);
    return void doc.end();
  }
  ok(res, rows);
}));

reportsRouter.get('/audit-logs', authorize('audit:read'), asyncHandler(async (req, res) => {
  const page = Math.max(1, Number(req.query.page) || 1);
  const [items, total] = await Promise.all([AuditLog.find().sort({ createdAt: -1 }).skip((page - 1) * 50).limit(50).populate('actor', 'name email').lean(), AuditLog.countDocuments()]);
  ok(res, items, { page, limit: 50, total });
}));

export { Types };
