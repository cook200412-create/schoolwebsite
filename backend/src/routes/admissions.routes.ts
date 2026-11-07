import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import mongoose from 'mongoose';
import { z } from 'zod';
import { env } from '../config/env';
import { authenticate, authorize, validate } from '../middleware/auth';
import { AcademicYear, ClassModel, Section } from '../models/academic';
import { Admission, ADMISSION_STATUSES, Enquiry } from '../models/admission';
import { DocumentModel } from '../models/operations';
import { Parent } from '../models/people';
import { SchoolSettings } from '../models/SchoolSettings';
import { User } from '../models/user';
import { hashPassword } from '../services/auth.service';
import { sendMail } from '../services/mail.service';
import { notifyUsers } from '../services/notify.service';
import { kv, startPdf } from '../services/pdf.service';
import { saveFile, upload } from '../services/storage.service';
import { createStudentRecord } from './students.routes';
import { nextSeq, pad } from '../utils/counter';
import { ApiError, asyncHandler, ok } from '../utils/http';
import { audit, mustId, objectId, paginate } from '../utils/helpers';
import { randomToken } from '../utils/security';

export const admissionsRouter = Router();
const AdmissionM = Admission as mongoose.Model<any>;
const publicLimiter = rateLimit({ windowMs: 60 * 60 * 1000, limit: env.isTest ? 10_000 : 20, standardHeaders: true, legacyHeaders: false });

const applicationSchema = z.object({
  student: z.object({ firstName: z.string().trim().min(1), lastName: z.string().trim().optional(), dob: z.coerce.date(), gender: z.enum(['male', 'female', 'other']) }),
  guardian: z.object({ name: z.string().trim().min(2), relation: z.string().optional(), phone: z.string().trim().regex(/^[0-9+\-\s]{10,15}$/, 'Invalid phone'), email: z.string().trim().toLowerCase().email(), occupation: z.string().optional() }),
  address: z.object({ line1: z.string().optional(), city: z.string().optional(), state: z.string().optional(), pincode: z.string().optional() }).optional(),
  previousSchool: z.object({ name: z.string().optional(), lastClass: z.string().optional(), marks: z.string().optional() }).optional(),
  classApplying: z.string().trim().min(1),
  academicYear: z.string().trim().min(4),
  consent: z.literal(true, { errorMap: () => ({ message: 'Parent/guardian consent is required' }) }),
});

// ---------- PUBLIC ----------
admissionsRouter.post('/enquiries', publicLimiter,
  validate(z.object({ name: z.string().trim().min(2), email: z.string().email().optional(), phone: z.string().trim().min(10).max(15), message: z.string().trim().min(5).max(2000), kind: z.enum(['admission', 'contact']).default('contact'), classInterested: z.string().optional() })),
  asyncHandler(async (req, res) => { await Enquiry.create(req.body); ok(res, { received: true }, undefined, 201); }));

admissionsRouter.post('/applications', publicLimiter,
  upload.fields([{ name: 'birth_certificate', maxCount: 1 }, { name: 'previous_record', maxCount: 1 }, { name: 'photograph', maxCount: 1 }]),
  asyncHandler(async (req, res) => {
    let raw: unknown;
    try { raw = typeof req.body.data === 'string' ? JSON.parse(req.body.data) : req.body; } catch { throw ApiError.badRequest('Invalid application data'); }
    const data = applicationSchema.parse(raw);
    const dedupeKey = [data.student.firstName, data.student.lastName ?? '', data.student.dob.toISOString().slice(0, 10), data.guardian.phone.replace(/\D/g, ''), data.academicYear].join('|').toLowerCase();
    if (await AdmissionM.exists({ dedupeKey })) throw ApiError.conflict('An application for this student already exists. Use the tracking page.');
    const seq = await nextSeq(`admission-${data.academicYear}`);
    const applicationNumber = `APP${data.academicYear.slice(0, 4)}${pad(seq, 5)}`;
    const adm = await AdmissionM.create({ ...data, applicationNumber, dedupeKey, consent: { given: true, at: new Date(), ip: req.ip, policyVersion: '1.0' }, statusHistory: [{ status: 'submitted' }] });
    const files = (req.files ?? {}) as Record<string, Express.Multer.File[]>;
    for (const type of ['birth_certificate', 'previous_record', 'photograph'] as const) {
      const f = files[type]?.[0];
      if (f) { const d = await saveFile(f, { admission: String(adm._id) }); adm.documents.push({ type, document: d._id } as any); }
    }
    await adm.save();
    await sendMail(data.guardian.email, 'Application received', `Your application number is ${applicationNumber}. Use it with your phone number to track the status.`);
    ok(res, { applicationNumber, status: adm.status }, undefined, 201);
  }));

admissionsRouter.get('/track/:applicationNumber', publicLimiter,
  validate(z.object({ phone: z.string().min(10) }), 'query'),
  asyncHandler(async (req, res) => {
    const a: any = await AdmissionM.findOne({ applicationNumber: req.params.applicationNumber }).lean();
    const digits = (s: string) => s.replace(/\D/g, '').slice(-10);
    if (!a || digits(a.guardian.phone) !== digits(String(req.query.phone))) throw ApiError.notFound('No application found for those details');
    ok(res, { applicationNumber: a.applicationNumber, studentName: a.student.firstName, classApplying: a.classApplying, status: a.status, interview: a.interview, updatedAt: a.updatedAt });
  }));

// ---------- STAFF ----------
admissionsRouter.use(authenticate);

admissionsRouter.get('/', authorize('admissions:read'), asyncHandler(async (req, res) => {
  const { page, limit, skip } = paginate(req);
  const q: any = { deletedAt: null };
  if (typeof req.query.status === 'string' && req.query.status) q.status = req.query.status;
  if (typeof req.query.classApplying === 'string' && req.query.classApplying) q.classApplying = req.query.classApplying;
  if (typeof req.query.q === 'string' && req.query.q) {
    const rx = new RegExp(req.query.q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    q.$or = [{ applicationNumber: rx }, { 'student.firstName': rx }, { 'student.lastName': rx }, { 'guardian.name': rx }, { 'guardian.phone': rx }];
  }
  const [items, total] = await Promise.all([AdmissionM.find(q).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(), AdmissionM.countDocuments(q)]);
  ok(res, items, { page, limit, total });
}));

admissionsRouter.get('/:id', authorize('admissions:read'), asyncHandler(async (req, res) => {
  const a = await AdmissionM.findOne({ _id: mustId(req.params.id), deletedAt: null }).populate('documents.document', 'originalName mimeType size').lean();
  if (!a) throw ApiError.notFound();
  ok(res, a);
}));

admissionsRouter.patch('/:id/status', authorize('admissions:write'), validate(z.object({ status: z.enum(ADMISSION_STATUSES), note: z.string().max(1000).optional() })), asyncHandler(async (req, res) => {
  const a = await AdmissionM.findOne({ _id: mustId(req.params.id), deletedAt: null });
  if (!a) throw ApiError.notFound();
  if (a.convertedStudent) throw ApiError.conflict('Application already converted to a student');
  a.status = req.body.status;
  a.statusHistory.push({ status: req.body.status, by: req.user!.id as any, note: req.body.note } as any);
  await a.save();
  await sendMail(a.guardian.email, `Admission update: ${a.applicationNumber}`, `Your application status is now: ${req.body.status.replace('_', ' ')}.${req.body.note ? `\nNote: ${req.body.note}` : ''}`);
  await audit(req, 'Admission.status', 'Admission', a._id, { status: req.body.status });
  ok(res, a);
}));

admissionsRouter.post('/:id/notes', authorize('admissions:write'), validate(z.object({ text: z.string().min(1).max(2000) })), asyncHandler(async (req, res) => {
  const a = await AdmissionM.findByIdAndUpdate(mustId(req.params.id), { $push: { notes: { by: req.user!.id, text: req.body.text } } }, { new: true });
  if (!a) throw ApiError.notFound(); ok(res, a.notes);
}));

admissionsRouter.post('/:id/documents/:docId/verify', authorize('admissions:write'), asyncHandler(async (req, res) => {
  const a = await AdmissionM.findOneAndUpdate({ _id: mustId(req.params.id), 'documents.document': mustId(req.params.docId) }, { $set: { 'documents.$.verified': true } }, { new: true });
  if (!a) throw ApiError.notFound(); await audit(req, 'Admission.verify_document', 'Admission', a._id); ok(res, a.documents);
}));

admissionsRouter.post('/:id/interview', authorize('admissions:write'), validate(z.object({ scheduledAt: z.coerce.date(), venue: z.string().optional() })), asyncHandler(async (req, res) => {
  const a = await AdmissionM.findByIdAndUpdate(mustId(req.params.id), { interview: req.body }, { new: true });
  if (!a) throw ApiError.notFound();
  await sendMail(a.guardian.email, 'Admission interview scheduled', `Interview on ${req.body.scheduledAt.toISOString()}${req.body.venue ? ` at ${req.body.venue}` : ''}.`);
  ok(res, a);
}));

admissionsRouter.get('/:id/letter', authorize('admissions:write'), asyncHandler(async (req, res) => {
  const a = await AdmissionM.findOne({ _id: mustId(req.params.id), deletedAt: null });
  if (!a) throw ApiError.notFound();
  if (a.status !== 'approved') throw ApiError.badRequest('Admission letter is available only for approved applications');
  const school = await SchoolSettings.findOne({ key: 'default' }).lean();
  const doc = startPdf(res, `admission-${a.applicationNumber}.pdf`, school?.schoolName ?? 'School', 'Admission letter');
  doc.fontSize(12).text(`Dear ${a.guardian.name},`).moveDown().text(`We are pleased to confirm admission of ${a.student.firstName} ${a.student.lastName ?? ''} to Class ${a.classApplying} for the academic year ${a.academicYear}.`).moveDown();
  kv(doc, [['Application No', a.applicationNumber], ['Academic year', a.academicYear]]);
  doc.moveDown().text('Please visit the school office with original documents to complete the formalities.');
  doc.end();
}));

/** Approve → create student (+ parent account when needed) atomically. */
admissionsRouter.post('/:id/convert', authorize('admissions:write', 'students:write'),
  validate(z.object({ class: objectId, section: objectId, academicYear: objectId, rollNumber: z.number().int().positive().optional() })),
  asyncHandler(async (req, res) => {
    const id = mustId(req.params.id);
    const session = await mongoose.startSession();
    let result: any;
    try {
      await session.withTransaction(async () => {
        const a = await AdmissionM.findOne({ _id: id, deletedAt: null }).session(session);
        if (!a) throw ApiError.notFound();
        if (a.status !== 'approved') throw ApiError.badRequest('Only approved applications can be converted');
        if (a.convertedStudent) throw ApiError.conflict('Already converted');
        let user = await User.findOne({ email: a.guardian.email }).session(session);
        let temp: string | undefined;
        if (!user) {
          temp = `Par-${randomToken(6)}5`;
          [user] = await User.create([{ name: a.guardian.name, email: a.guardian.email, phone: a.guardian.phone, role: 'parent', passwordHash: await hashPassword(temp), mustChangePassword: true }], { session });
        }
        if (user.role !== 'parent') throw ApiError.conflict('Guardian email belongs to a non-parent account');
        let parent = await Parent.findOne({ user: user._id }).session(session);
        if (!parent) [parent] = await Parent.create([{ user: user._id, phone: a.guardian.phone, consent: { given: true, at: a.consent.at, policyVersion: a.consent.policyVersion } }], { session });
        const student = await createStudentRecord({
          firstName: a.student.firstName, lastName: a.student.lastName ?? '', dob: a.student.dob, gender: a.student.gender as any,
          class: req.body.class, section: req.body.section, academicYear: req.body.academicYear, rollNumber: req.body.rollNumber,
          address: a.address as any, previousSchool: a.previousSchool as any, parents: [String(parent._id)], phone: a.guardian.phone,
        } as any, session);
        await Student_linkParent(student._id, parent._id, session);
        a.convertedStudent = student._id;
        a.statusHistory.push({ status: 'converted', by: req.user!.id as any } as any);
        await a.save({ session });
        result = { studentId: student._id, admissionNumber: student.admissionNumber, parentEmail: user.email, temp };
      });
    } finally { await session.endSession(); }
    if (result.temp) await sendMail(result.parentEmail, 'Your parent portal account', `Temporary password: ${result.temp}\nSign in at ${env.CLIENT_URL}/login`);
    await audit(req, 'Admission.convert', 'Admission', id, { student: result.studentId });
    ok(res, { studentId: result.studentId, admissionNumber: result.admissionNumber, parentEmail: result.parentEmail, ...(result.temp && !env.isProd ? { temporaryPassword: result.temp } : {}) }, undefined, 201);
  }));

async function Student_linkParent(studentId: unknown, parentId: unknown, session: mongoose.ClientSession) {
  const { Student } = await import('../models/people');
  await Student.updateOne({ _id: studentId }, { $addToSet: { parents: parentId } }, { session });
}

// ---------- Secure document download ----------
export const documentsRouter = Router();
documentsRouter.use(authenticate);
documentsRouter.get('/:id', asyncHandler(async (req, res) => {
  const d = await DocumentModel.findById(mustId(req.params.id)).lean();
  if (!d) throw ApiError.notFound();
  const isOwner = d.owner && String(d.owner) === req.user!.id;
  const staff = req.user!.permissions.includes('*') || req.user!.permissions.includes('admissions:read');
  let allowed = isOwner || staff;
  if (!allowed && d.student) { const { assertStudentAccess } = await import('../services/access.service'); allowed = await assertStudentAccess(req, String(d.student)).then(() => true, () => false); }
  if (!allowed) throw ApiError.notFound();
  await audit(req, 'Document.download', 'Document', d._id);
  const s = await import('../services/storage.service');
  if (d.storage === 'cloudinary') return res.redirect(await s.cloudinarySignedUrl(d.key));
  res.setHeader('Content-Type', d.mimeType ?? 'application/octet-stream');
  res.setHeader('Content-Disposition', `inline; filename="${(d.originalName ?? 'file').replace(/[^\w.-]/g, '_')}"`);
  res.setHeader('Cache-Control', 'private, no-store');
  res.send(await s.readLocal(d.key));
}));

export { AcademicYear, ClassModel, Section };
