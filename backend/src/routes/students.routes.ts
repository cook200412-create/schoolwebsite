import { Router } from 'express';
import { parse } from 'csv-parse/sync';
import mongoose from 'mongoose';
import { z } from 'zod';
import { authenticate, authorize, validate } from '../middleware/auth';
import { AcademicYear, ClassModel, Section } from '../models/academic';
import { Parent, Student, Teacher } from '../models/people';
import { User } from '../models/user';
import { SchoolSettings } from '../models/SchoolSettings';
import { assertStudentAccess, studentScope } from '../services/access.service';
import { hashPassword } from '../services/auth.service';
import { sendMail } from '../services/mail.service';
import { kv, startPdf } from '../services/pdf.service';
import { ApiError, asyncHandler, ok } from '../utils/http';
import { audit, mustId, objectId, paginate, toCsv } from '../utils/helpers';
import { nextSeq, pad } from '../utils/counter';
import { randomToken } from '../utils/security';

export const studentsRouter = Router();
studentsRouter.use(authenticate);

const address = z.object({ line1: z.string().optional(), city: z.string().optional(), state: z.string().optional(), pincode: z.string().optional() });
export const studentSchema = z.object({
  firstName: z.string().trim().min(1), lastName: z.string().trim().optional(),
  dob: z.coerce.date(), gender: z.enum(['male', 'female', 'other']),
  class: objectId, section: objectId, academicYear: objectId, rollNumber: z.number().int().positive().optional(),
  admissionNumber: z.string().trim().optional(), phone: z.string().optional(), address: address.optional(),
  emergencyContact: z.object({ name: z.string().optional(), phone: z.string().optional(), relation: z.string().optional() }).optional(),
  previousSchool: z.object({ name: z.string().optional(), lastClass: z.string().optional() }).optional(),
  photoUrl: z.string().url().optional(), photoConsent: z.boolean().optional(), parents: z.array(objectId).optional(),
  createAccount: z.boolean().optional(), accountEmail: z.string().email().optional(),
});

export async function createStudentRecord(b: z.infer<typeof studentSchema>, session?: mongoose.ClientSession) {
  const sec = await Section.findOne({ _id: b.section, class: b.class }).session(session ?? null);
  if (!sec) throw ApiError.badRequest('Section does not belong to the chosen class');
  const year = await AcademicYear.findById(b.academicYear).session(session ?? null);
  if (!year) throw ApiError.badRequest('Unknown academic year');
  const seq = await nextSeq(`student-${year.name}`, session);
  const admissionNumber = b.admissionNumber || `ADM${year.name.slice(0, 4)}${pad(seq, 4)}`;
  const { createAccount, accountEmail, ...rest } = b;
  const [student] = await Student.create([{
    ...rest, admissionNumber, studentId: `STU${year.name.slice(2, 4)}${pad(seq, 4)}`,
    history: [{ academicYear: b.academicYear, class: b.class, section: b.section, rollNumber: b.rollNumber, action: 'admitted' }],
  }], { session });
  if (b.parents?.length) await Parent.updateMany({ _id: { $in: b.parents } }, { $addToSet: { children: student._id } }, { session });
  return student;
}

studentsRouter.get('/', asyncHandler(async (req, res) => {
  const scope = await studentScope(req);
  if (!scope) throw ApiError.forbidden();
  const { page, limit, skip } = paginate(req);
  const q: any = { deletedAt: null };
  for (const f of ['class', 'section', 'status', 'academicYear']) if (typeof req.query[f] === 'string' && req.query[f]) q[f] = req.query[f];
  if (!q.status) q.status = { $ne: 'archived' };
  if (typeof req.query.q === 'string' && req.query.q) {
    const rx = new RegExp(req.query.q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    q.$or = [{ firstName: rx }, { lastName: rx }, { admissionNumber: rx }, { studentId: rx }];
  }
  const scoped = { $and: [q, scope] }; // scope can never be overridden by query filters
  const [items, total] = await Promise.all([
    Student.find(scoped).populate('class section', 'name').sort({ class: 1, section: 1, rollNumber: 1 }).skip(skip).limit(limit).lean(),
    Student.countDocuments(scoped),
  ]);
  ok(res, items, { page, limit, total });
}));

studentsRouter.get('/export', authorize('students:read'), asyncHandler(async (req, res) => {
  const scope = (await studentScope(req)) ?? {};
  const rows = await Student.find({ $and: [{ deletedAt: null }, scope] }).populate('class section', 'name').lean();
  const csv = toCsv(rows.map((s: any) => ({ admissionNumber: s.admissionNumber, studentId: s.studentId, firstName: s.firstName, lastName: s.lastName, class: s.class?.name, section: s.section?.name, rollNumber: s.rollNumber, gender: s.gender, status: s.status })));
  res.setHeader('Content-Type', 'text/csv'); res.setHeader('Content-Disposition', 'attachment; filename="students.csv"');
  res.send(csv);
}));

studentsRouter.get('/:id', asyncHandler(async (req, res) => {
  const s = await assertStudentAccess(req, mustId(req.params.id));
  await s.populate('class section academicYear transportRoute', 'name');
  await audit(req, 'Student.view', 'Student', s._id);
  ok(res, s);
}));

studentsRouter.post('/', authorize('students:write'), validate(studentSchema), asyncHandler(async (req, res) => {
  const b = req.body as z.infer<typeof studentSchema>;
  let temp: string | undefined;
  const student = await createStudentRecord(b);
  if (b.createAccount) {
    if (!b.accountEmail) throw ApiError.badRequest('accountEmail is required to create a login');
    temp = `Stu-${randomToken(6)}7`;
    const u = await User.create({ name: `${b.firstName} ${b.lastName ?? ''}`.trim(), email: b.accountEmail.toLowerCase(), role: 'student', passwordHash: await hashPassword(temp), mustChangePassword: true });
    student.user = u._id; await student.save();
    await sendMail(u.email, 'Your student portal account', `Temporary password: ${temp}`);
  }
  await audit(req, 'Student.create', 'Student', student._id);
  ok(res, { student, ...(temp && !process.env.NODE_ENV?.includes('prod') ? { temporaryPassword: temp } : {}) }, undefined, 201);
}));

studentsRouter.patch('/:id', authorize('students:write'), validate(studentSchema.partial()), asyncHandler(async (req, res) => {
  const { createAccount, accountEmail, parents, ...b } = req.body;
  const s = await Student.findOneAndUpdate({ _id: mustId(req.params.id), deletedAt: null }, b, { new: true, runValidators: true });
  if (!s) throw ApiError.notFound();
  await audit(req, 'Student.update', 'Student', s._id);
  ok(res, s);
}));

studentsRouter.post('/:id/transfer', authorize('students:write'), validate(z.object({ note: z.string().optional() })), asyncHandler(async (req, res) => {
  const s = await Student.findOneAndUpdate({ _id: mustId(req.params.id), deletedAt: null }, { status: 'transferred', $push: { history: { action: 'transferred', note: req.body.note } } }, { new: true });
  if (!s) throw ApiError.notFound();
  await audit(req, 'Student.transfer', 'Student', s._id);
  ok(res, s);
}));

studentsRouter.post('/:id/archive', authorize('students:write'), asyncHandler(async (req, res) => {
  const s = await Student.findOneAndUpdate({ _id: mustId(req.params.id), deletedAt: null }, { status: 'archived', $push: { history: { action: 'archived' } } }, { new: true });
  if (!s) throw ApiError.notFound();
  await audit(req, 'Student.archive', 'Student', s._id);
  ok(res, s);
}));

/** Promote students to another class/section for a new academic year, keeping history. */
studentsRouter.post('/promote', authorize('students:write'),
  validate(z.object({ studentIds: z.array(objectId).min(1).max(500), toClass: objectId, toSection: objectId, toAcademicYear: objectId })),
  asyncHandler(async (req, res) => {
    const b = req.body;
    if (!(await Section.exists({ _id: b.toSection, class: b.toClass }))) throw ApiError.badRequest('Section does not belong to class');
    const session = await mongoose.startSession();
    let count = 0;
    try {
      await session.withTransaction(async () => {
        const students = await Student.find({ _id: { $in: b.studentIds }, status: 'active' }).session(session);
        for (const s of students) {
          s.history.push({ academicYear: b.toAcademicYear, class: b.toClass, section: b.toSection, action: 'promoted' } as any);
          s.class = b.toClass; s.section = b.toSection; s.academicYear = b.toAcademicYear; s.rollNumber = undefined as any;
          await s.save({ session });
          count++;
        }
      });
    } finally { await session.endSession(); }
    await audit(req, 'Student.promote', 'Student', undefined, { count, to: b.toSection });
    ok(res, { promoted: count });
  }));

/** CSV import. Body: { csv: "firstName,lastName,dob,gender,class,section,academicYear,..." } with class/section by name. */
studentsRouter.post('/import', authorize('students:write'), validate(z.object({ csv: z.string().min(10).max(2_000_000) })), asyncHandler(async (req, res) => {
  const rows = parse(req.body.csv, { columns: true, skip_empty_lines: true, trim: true }) as Record<string, string>[];
  if (rows.length > 1000) throw ApiError.badRequest('Maximum 1000 rows per import');
  const created: string[] = []; const errors: { row: number; message: string }[] = [];
  for (const [i, r] of rows.entries()) {
    try {
      const cls = await ClassModel.findOne({ name: r.class });
      const sec = cls && (await Section.findOne({ class: cls._id, name: r.section }));
      const year = await AcademicYear.findOne({ name: r.academicYear });
      if (!cls || !sec || !year) throw new Error('Unknown class, section or academic year');
      const data = studentSchema.parse({ firstName: r.firstName, lastName: r.lastName, dob: r.dob, gender: r.gender, class: String(cls._id), section: String(sec._id), academicYear: String(year._id), rollNumber: r.rollNumber ? Number(r.rollNumber) : undefined, phone: r.phone || undefined });
      created.push(String((await createStudentRecord(data))._id));
    } catch (e: any) { errors.push({ row: i + 2, message: e.message }); }
  }
  await audit(req, 'Student.import', 'Student', undefined, { created: created.length, errors: errors.length });
  ok(res, { created: created.length, errors });
}));

studentsRouter.get('/:id/id-card', asyncHandler(async (req, res) => {
  const s = await assertStudentAccess(req, mustId(req.params.id));
  if (!['school_admin', 'super_admin', 'principal', 'admission_officer'].includes(req.user!.role) && req.user!.role !== 'student' && req.user!.role !== 'parent') throw ApiError.forbidden();
  await s.populate('class section', 'name');
  const school = await SchoolSettings.findOne({ key: 'default' }).lean();
  const doc = startPdf(res, `id-${s.studentId}.pdf`, school?.schoolName ?? 'School', 'Student ID card');
  kv(doc, [['Name', `${s.firstName} ${s.lastName}`], ['Student ID', s.studentId], ['Admission No', s.admissionNumber], ['Class', `${(s.class as any).name}-${(s.section as any).name}`], ['Roll No', String(s.rollNumber ?? '-')], ['Emergency contact', s.emergencyContact?.phone ?? '-']]);
  doc.end();
}));

// ---- Parents ----
export const parentsRouter = Router();
parentsRouter.use(authenticate);
parentsRouter.get('/', authorize('parents:read'), asyncHandler(async (req, res) => {
  const { page, limit, skip } = paginate(req);
  const [items, total] = await Promise.all([Parent.find({ deletedAt: null }).populate('user', 'name email phone').populate('children', 'firstName lastName studentId').skip(skip).limit(limit).lean(), Parent.countDocuments({ deletedAt: null })]);
  ok(res, items, { page, limit, total });
}));
parentsRouter.get('/me/children', asyncHandler(async (req, res) => {
  const p = await Parent.findOne({ user: req.user!.id }).populate({ path: 'children', select: 'firstName lastName studentId class section photoUrl status', populate: { path: 'class section', select: 'name' } }).lean();
  ok(res, p?.children ?? []);
}));
parentsRouter.post('/:id/link-student', authorize('parents:write'), validate(z.object({ studentId: objectId })), asyncHandler(async (req, res) => {
  const [p, s] = await Promise.all([Parent.findById(mustId(req.params.id)), Student.findById(req.body.studentId)]);
  if (!p || !s) throw ApiError.notFound();
  await Promise.all([Parent.updateOne({ _id: p._id }, { $addToSet: { children: s._id } }), Student.updateOne({ _id: s._id }, { $addToSet: { parents: p._id } })]);
  await audit(req, 'Parent.link_student', 'Parent', p._id, { student: s._id });
  ok(res, { linked: true });
}));

// ---- Teachers ----
export const teachersRouter = Router();
const teacherSchema = z.object({
  employeeId: z.string().min(1), name: z.string().min(2), designation: z.string().optional(), specialization: z.string().optional(),
  qualifications: z.array(z.string()).optional(), experienceYears: z.number().min(0).optional(), bio: z.string().optional(),
  photoUrl: z.string().url().optional(), phone: z.string().optional(), email: z.string().email().optional(), classesHandled: z.array(z.string()).optional(), isPublic: z.boolean().optional(),
});
teachersRouter.get('/public', asyncHandler(async (_req, res) => {
  ok(res, await Teacher.find({ isPublic: true, deletedAt: null }).select('name designation specialization qualifications experienceYears bio photoUrl classesHandled').lean());
}));
teachersRouter.get('/public/:id', asyncHandler(async (req, res) => {
  const t = await Teacher.findOne({ _id: mustId(req.params.id), isPublic: true, deletedAt: null }).select('name designation specialization qualifications experienceYears bio photoUrl classesHandled').lean();
  if (!t) throw ApiError.notFound();
  ok(res, t);
}));
teachersRouter.use(authenticate);
teachersRouter.get('/me', authorize('attendance:mark'), asyncHandler(async (req, res) => {
  ok(res, await Teacher.findOne({ user: req.user!.id }).populate('assignments.class assignments.section assignments.subject', 'name code').lean());
}));
teachersRouter.get('/', authorize('teachers:read', 'students:read'), asyncHandler(async (req, res) => {
  const { page, limit, skip } = paginate(req);
  const [items, total] = await Promise.all([Teacher.find({ deletedAt: null }).skip(skip).limit(limit).lean(), Teacher.countDocuments({ deletedAt: null })]);
  ok(res, items, { page, limit, total });
}));
teachersRouter.post('/', authorize('teachers:write'), validate(teacherSchema), asyncHandler(async (req, res) => { const t = await Teacher.create(req.body); await audit(req, 'Teacher.create', 'Teacher', t._id); ok(res, t, undefined, 201); }));
teachersRouter.patch('/:id', authorize('teachers:write'), validate(teacherSchema.partial()), asyncHandler(async (req, res) => {
  const t = await Teacher.findOneAndUpdate({ _id: mustId(req.params.id), deletedAt: null }, req.body, { new: true });
  if (!t) throw ApiError.notFound(); await audit(req, 'Teacher.update', 'Teacher', t._id); ok(res, t);
}));
teachersRouter.delete('/:id', authorize('teachers:write'), asyncHandler(async (req, res) => { await Teacher.findByIdAndUpdate(mustId(req.params.id), { deletedAt: new Date() }); await audit(req, 'Teacher.delete', 'Teacher', req.params.id); ok(res, { deleted: true }); }));
teachersRouter.put('/:id/assignments', authorize('teachers:write'), validate(z.object({ assignments: z.array(z.object({ class: objectId, section: objectId, subject: objectId })), classTeacherOf: objectId.optional() })), asyncHandler(async (req, res) => {
  const t = await Teacher.findByIdAndUpdate(mustId(req.params.id), { assignments: req.body.assignments, classTeacherOf: req.body.classTeacherOf }, { new: true });
  if (!t) throw ApiError.notFound(); await audit(req, 'Teacher.assign', 'Teacher', t._id); ok(res, t);
}));
