import { Router } from 'express';
import { z } from 'zod';
import { authenticate, authorize, can, validate } from '../middleware/auth';
import { Subject } from '../models/academic';
import { DEFAULT_GRADING, ExamResult, Examination } from '../models/exam';
import { Parent, Student } from '../models/people';
import { SchoolSettings } from '../models/SchoolSettings';
import { assertStudentAccess, teacherSubjectsFor } from '../services/access.service';
import { notifyUsers } from '../services/notify.service';
import { kv, startPdf, table } from '../services/pdf.service';
import { rank, summarize } from '../services/results.service';
import { ApiError, asyncHandler, ok } from '../utils/http';
import { audit, mustId, objectId, paginate, toCsv } from '../utils/helpers';

export const examsRouter = Router();
examsRouter.use(authenticate);

const examSchema = z.object({
  name: z.string().min(2), type: z.enum(['unit_test', 'term', 'half_yearly', 'annual', 'other']).optional(), term: z.string().optional(),
  academicYear: objectId, class: objectId,
  subjects: z.array(z.object({ subject: objectId, maxMarks: z.number().positive(), passMarks: z.number().min(0) }).refine((s) => s.passMarks <= s.maxMarks, 'Pass marks cannot exceed max marks')).min(1),
  gradingScale: z.array(z.object({ min: z.number().min(0).max(100), grade: z.string().min(1) })).min(2).optional(),
});

examsRouter.get('/', authorize('exams:read'), asyncHandler(async (req, res) => {
  const { page, limit, skip } = paginate(req);
  const q: any = { deletedAt: null };
  for (const f of ['class', 'academicYear', 'status']) if (typeof req.query[f] === 'string' && req.query[f]) q[f] = req.query[f];
  const [items, total] = await Promise.all([Examination.find(q).populate('class', 'name').populate('subjects.subject', 'name code').sort({ createdAt: -1 }).skip(skip).limit(limit).lean(), Examination.countDocuments(q)]);
  ok(res, items, { page, limit, total });
}));

examsRouter.post('/', authorize('exams:write'), validate(examSchema), asyncHandler(async (req, res) => {
  const e = await Examination.create({ ...req.body, gradingScale: req.body.gradingScale ?? DEFAULT_GRADING, audit: [{ action: 'created', by: req.user!.id }] });
  await audit(req, 'Exam.create', 'Examination', e._id);
  ok(res, e, undefined, 201);
}));

examsRouter.get('/:id', authorize('exams:read'), asyncHandler(async (req, res) => {
  const e = await Examination.findOne({ _id: mustId(req.params.id), deletedAt: null }).populate('subjects.subject', 'name code').lean();
  if (!e) throw ApiError.notFound(); ok(res, e);
}));

/** Marks sheet for a section/subject (teacher sees only their assigned subjects). */
examsRouter.get('/:id/marks', authorize('marks:enter', 'results:read'), validate(z.object({ sectionId: objectId }), 'query'), asyncHandler(async (req, res) => {
  const e = await Examination.findById(mustId(req.params.id)).lean();
  if (!e) throw ApiError.notFound();
  const sectionId = String(req.query.sectionId);
  if (req.user!.role === 'teacher' && !(await teacherSubjectsFor(req.user!.id, sectionId)).length) throw ApiError.forbidden();
  const students = await Student.find({ section: sectionId, class: e.class, status: 'active', deletedAt: null }).sort({ rollNumber: 1, firstName: 1 }).select('firstName lastName rollNumber').lean();
  const results = await ExamResult.find({ examination: e._id, student: { $in: students.map((s) => s._id) } }).lean();
  ok(res, { status: e.status, students: students.map((s) => ({ ...s, marks: Object.fromEntries(results.filter((r) => String(r.student) === String(s._id)).map((r) => [String(r.subject), { marks: r.marks, absent: r.absent }])) })) });
}));

examsRouter.post('/:id/marks', authorize('marks:enter'),
  validate(z.object({ sectionId: objectId, entries: z.array(z.object({ studentId: objectId, subjectId: objectId, marks: z.number().min(0), absent: z.boolean().optional() })).min(1).max(1000) })),
  asyncHandler(async (req, res) => {
    const e = await Examination.findById(mustId(req.params.id));
    if (!e) throw ApiError.notFound();
    if (e.status !== 'marks_entry') throw ApiError.conflict(`Marks are locked (exam is ${e.status}). Ask the Principal to reopen it.`);
    const { sectionId, entries } = req.body as { sectionId: string; entries: { studentId: string; subjectId: string; marks: number; absent?: boolean }[] };
    const mySubjects = req.user!.role === 'teacher' ? await teacherSubjectsFor(req.user!.id, sectionId) : null;
    if (mySubjects && !mySubjects.length) throw ApiError.forbidden('You are not assigned to this section');
    const cfg = new Map(e.subjects.map((s) => [String(s.subject), s]));
    const studentIds = [...new Set(entries.map((x) => x.studentId))];
    const valid = new Set((await Student.find({ _id: { $in: studentIds }, section: sectionId, class: e.class }).select('_id').lean()).map((s) => String(s._id)));
    for (const x of entries) {
      const c = cfg.get(x.subjectId);
      if (!c) throw ApiError.badRequest('Subject is not part of this examination');
      if (mySubjects && !mySubjects.includes(x.subjectId)) throw ApiError.forbidden('You can only enter marks for your own subjects');
      if (!valid.has(x.studentId)) throw ApiError.badRequest('Student is not in this section');
      if (x.marks > c.maxMarks) throw ApiError.badRequest(`Marks cannot exceed ${c.maxMarks}`);
    }
    await ExamResult.bulkWrite(entries.map((x) => ({
      updateOne: { filter: { examination: e._id, student: x.studentId, subject: x.subjectId }, update: { $set: { marks: x.absent ? 0 : x.marks, absent: !!x.absent, enteredBy: req.user!.id } }, upsert: true },
    })) as any);
    await audit(req, 'Exam.enter_marks', 'Examination', e._id, { count: entries.length });
    ok(res, { saved: entries.length });
  }));

const transition = (action: 'submit' | 'approve' | 'publish' | 'reopen', perm: string, from: string[], to: string) =>
  examsRouter.post(`/:id/${action}`, authorize(perm), validate(z.object({ reason: z.string().min(3).max(500).optional() })), asyncHandler(async (req, res) => {
    const e = await Examination.findById(mustId(req.params.id));
    if (!e) throw ApiError.notFound();
    if (!from.includes(e.status)) throw ApiError.conflict(`Cannot ${action} an examination that is ${e.status}`);
    if (action === 'reopen' && !req.body.reason) throw ApiError.badRequest('A reason is required to reopen');
    if (action === 'approve' || action === 'publish') {
      const expected = e.subjects.length * (await Student.countDocuments({ class: e.class, status: 'active', deletedAt: null }));
      const entered = await ExamResult.countDocuments({ examination: e._id });
      if (entered < expected && action === 'approve') throw ApiError.badRequest(`Marks incomplete: ${entered}/${expected} entries`);
    }
    e.status = to as any;
    if (action === 'approve') e.approvedBy = req.user!.id as any;
    if (action === 'publish') e.publishedAt = new Date();
    e.audit.push({ action, by: req.user!.id, reason: req.body.reason } as any);
    await e.save();
    if (action === 'publish') {
      const kids = await Student.find({ class: e.class, status: 'active' }).select('parents user').populate('parents', 'user').lean();
      const users = kids.flatMap((k: any) => [...(k.parents ?? []).map((p: any) => p.user), k.user]);
      await notifyUsers(users, { title: `Results published: ${e.name}`, body: 'Your child\'s examination results have been published.', type: 'results', link: '/portal/parent/results' }, true);
    }
    await audit(req, `Exam.${action}`, 'Examination', e._id, { reason: req.body.reason });
    ok(res, e);
  }));
transition('submit', 'marks:enter', ['marks_entry'], 'submitted');
transition('approve', 'results:publish', ['submitted'], 'approved');
transition('publish', 'results:publish', ['approved'], 'published');
transition('reopen', 'results:publish', ['submitted', 'approved', 'published'], 'marks_entry');

// ---------------- Results ----------------
export const resultsRouter = Router();
resultsRouter.use(authenticate);

async function buildReport(exam: any, studentId: string) {
  const [results, subs] = await Promise.all([ExamResult.find({ examination: exam._id, student: studentId }).lean(), Subject.find({ _id: { $in: exam.subjects.map((s: any) => s.subject) } }).lean()]);
  return summarize(exam, results as any, new Map(subs.map((s) => [String(s._id), s.name])));
}

async function visibleExam(req: any, examId: string) {
  const exam = await Examination.findOne({ _id: examId, deletedAt: null }).lean();
  if (!exam) throw ApiError.notFound();
  const staffView = can(req, 'results:read');
  if (!staffView && exam.status !== 'published') throw ApiError.notFound('Results are not published yet');
  if (staffView && !['published'].includes(exam.status) && !can(req, 'results:publish') && req.user.role !== 'teacher') throw ApiError.notFound();
  return exam;
}

resultsRouter.get('/student/:id', asyncHandler(async (req, res) => {
  const s = await assertStudentAccess(req, mustId(req.params.id));
  const q: any = { class: s.class, deletedAt: null };
  if (!can(req, 'results:read')) q.status = 'published';
  if (typeof req.query.examId === 'string') q._id = req.query.examId;
  const exams = await Examination.find(q).sort({ createdAt: -1 }).lean();
  const out = [];
  for (const e of exams) out.push({ exam: { id: e._id, name: e.name, type: e.type, term: e.term, status: e.status }, ...(await buildReport(e, String(s._id))) });
  ok(res, out);
}));

resultsRouter.get('/class/:examId/rankings', authorize('results:read'), validate(z.object({ sectionId: objectId.optional(), format: z.enum(['json', 'csv']).optional() }), 'query'), asyncHandler(async (req, res) => {
  const exam = await visibleExam(req, mustId(req.params.examId));
  const sf: any = { class: exam.class, status: 'active', deletedAt: null };
  if (req.query.sectionId) sf.section = req.query.sectionId;
  const students = await Student.find(sf).select('firstName lastName rollNumber').lean();
  const [results, subs] = await Promise.all([ExamResult.find({ examination: exam._id, student: { $in: students.map((s) => s._id) } }).lean(), Subject.find({ _id: { $in: exam.subjects.map((s) => s.subject) } }).lean()]);
  const names = new Map(subs.map((s) => [String(s._id), s.name]));
  const rows = students.map((s) => ({ studentId: String(s._id), name: `${s.firstName} ${s.lastName}`.trim(), ...summarize(exam as any, results.filter((r) => String(r.student) === String(s._id)) as any, names) }));
  const ranked = rank(rows);
  if (req.query.format === 'csv') { res.setHeader('Content-Type', 'text/csv'); return res.send(toCsv(ranked.map((r) => ({ rank: r.rank, name: r.name, total: r.total, max: r.max, percentage: r.percentage, grade: r.grade, result: r.result })))); }
  ok(res, ranked.map(({ subjects, ...r }) => r));
}));

resultsRouter.get('/student/:id/marksheet.pdf', validate(z.object({ examId: objectId }), 'query'), asyncHandler(async (req, res) => {
  const s = await assertStudentAccess(req, mustId(req.params.id));
  const exam = await visibleExam(req, String(req.query.examId));
  if (String(exam.class) !== String(s.class)) throw ApiError.notFound();
  const rep = await buildReport(exam, String(s._id));
  await s.populate('class section', 'name');
  const school = await SchoolSettings.findOne({ key: 'default' }).lean();
  const doc = startPdf(res, `marksheet-${s.studentId}.pdf`, school?.schoolName ?? 'School', `Marksheet – ${exam.name}`);
  kv(doc, [['Student', `${s.firstName} ${s.lastName}`.trim()], ['Student ID', s.studentId], ['Class', `${(s.class as any).name}-${(s.section as any).name}`]]);
  table(doc, ['Subject', 'Marks', 'Max', 'Grade', 'Status'], rep.subjects.map((x) => [x.name, x.absent ? 'AB' : String(x.marks), String(x.max), x.grade, x.failed ? 'Fail' : 'Pass']), [190, 70, 70, 70, 95]);
  kv(doc, [['Total', `${rep.total}/${rep.max}`], ['Percentage', `${rep.percentage}%`], ['Grade', rep.grade], ['Result', rep.result]]);
  if (exam.status !== 'published') doc.fillColor('red').text('PROVISIONAL – not yet published', { align: 'center' });
  doc.end();
  await audit(req, 'Result.marksheet', 'Student', s._id, { exam: exam._id });
}));

export { Parent };
