import { Router } from 'express';
import { z } from 'zod';
import { authenticate, authorize } from '../middleware/auth';
import { AcademicYear, ClassModel, Section, Subject, Timetable } from '../models/academic';
import { Staff } from '../models/people';
import { Book, DocumentModel, GalleryImage, TransportRoute, Vehicle } from '../models/operations';
import { Event } from '../models/Event';
import { Enquiry } from '../models/admission';
import { Achievement } from '../models/cms';
import { asyncHandler, ok, ApiError } from '../utils/http';
import { audit, mustId, objectId } from '../utils/helpers';
import { crudRouter } from '../utils/crud';

const date = z.coerce.date();

export const yearsRouter = crudRouter({
  name: 'AcademicYear', model: AcademicYear, read: ['academics:read'], write: ['academics:write'], sort: { startDate: -1 },
  schema: z.object({ name: z.string().min(4), startDate: date, endDate: date, isCurrent: z.boolean().optional() }),
});
yearsRouter.post('/:id/set-current', authorize('academics:write'), asyncHandler(async (req, res) => {
  const id = mustId(req.params.id);
  await AcademicYear.updateMany({}, { isCurrent: false });
  const y = await AcademicYear.findByIdAndUpdate(id, { isCurrent: true }, { new: true });
  if (!y) throw ApiError.notFound();
  await audit(req, 'AcademicYear.set_current', 'AcademicYear', id);
  ok(res, y);
}));

export const classesRouter = crudRouter({
  name: 'Class', model: ClassModel, read: ['academics:read'], write: ['academics:write'], search: ['name'], sort: { order: 1 },
  schema: z.object({ name: z.string().trim().min(1), level: z.enum(['pre-primary', 'primary', 'middle', 'secondary']), order: z.number().optional(), description: z.string().optional(), curriculum: z.string().optional() }),
});

export const sectionsRouter = crudRouter({
  name: 'Section', model: Section, read: ['academics:read'], write: ['academics:write'], filters: ['class'], populate: ['class', 'classTeacher'],
  schema: z.object({ class: objectId, name: z.string().trim().min(1), classTeacher: objectId.optional(), capacity: z.number().int().positive().optional(), room: z.string().optional() }),
});

export const subjectsRouter = crudRouter({
  name: 'Subject', model: Subject, read: ['academics:read'], write: ['academics:write'], search: ['name', 'code'], sort: { name: 1 },
  schema: z.object({ name: z.string().trim().min(1), code: z.string().trim().min(1), classes: z.array(objectId).optional(), isOptional: z.boolean().optional() }),
});

export const staffRouter = crudRouter({
  name: 'Staff', model: Staff, read: ['staff:read'], write: ['staff:write'], search: ['name', 'employeeId'],
  schema: z.object({ employeeId: z.string().min(1), name: z.string().min(2), department: z.string().optional(), designation: z.string().optional(), phone: z.string().optional(), email: z.string().email().optional(), joinedOn: date.optional() }),
});

export const booksRouter = crudRouter({
  name: 'Book', model: Book, read: ['library:read'], write: ['library:write'], search: ['title', 'author', 'isbn'], filters: ['category'],
  schema: z.object({ title: z.string().min(1), author: z.string().optional(), isbn: z.string().optional(), category: z.string().optional(), copies: z.number().int().min(0), shelf: z.string().optional() }),
});

export const vehiclesRouter = crudRouter({
  name: 'Vehicle', model: Vehicle, read: ['transport:read'], write: ['transport:write'], search: ['registrationNumber'],
  schema: z.object({ registrationNumber: z.string().min(4), type: z.string().optional(), capacity: z.number().int().positive().optional(), driver: z.object({ name: z.string().optional(), phone: z.string().optional(), licenseNumber: z.string().optional() }).optional(), insuranceExpiry: date.optional(), fitnessExpiry: date.optional() }),
});

export const routesRouter = crudRouter({
  name: 'TransportRoute', model: TransportRoute, read: ['transport:read'], write: ['transport:write'], populate: 'vehicle',
  schema: z.object({ name: z.string().min(2), vehicle: objectId.optional(), monthlyFee: z.number().int().min(0).optional(), stops: z.array(z.object({ name: z.string(), order: z.number(), pickupTime: z.string().optional() })).optional() }),
});

export const eventsRouter = crudRouter({
  name: 'Event', model: Event, read: ['announcements:read'], write: ['announcements:write'], sort: { startsAt: 1 },
  schema: z.object({ title: z.string().min(2), description: z.string().optional(), startsAt: date, endsAt: date.optional(), location: z.string().optional(), type: z.enum(['event', 'holiday', 'exam', 'meeting']).optional(), isPublic: z.boolean().optional() }),
});

export const enquiriesRouter = crudRouter({
  name: 'Enquiry', model: Enquiry, read: ['admissions:read'], write: ['admissions:write'], softDelete: false,
  schema: z.object({ status: z.enum(['new', 'contacted', 'closed']) }) as any,
});

export const achievementsRouter = crudRouter({
  name: 'Achievement', model: Achievement, read: ['cms:write'], write: ['cms:write'],
  schema: z.object({ title: z.string().min(2), description: z.string().optional(), category: z.enum(['academic', 'topper', 'award', 'competition', 'statistic']), year: z.string().optional(), studentName: z.string().optional(), consentConfirmed: z.boolean().optional(), isPublished: z.boolean().optional() }),
});

export const galleryRouter = crudRouter({
  name: 'GalleryImage', model: GalleryImage, read: ['cms:write'], write: ['cms:write'], filters: ['category'],
  schema: z.object({ url: z.string().url(), caption: z.string().optional(), category: z.enum(['campus', 'classroom', 'sports', 'annual-day', 'cultural', 'trips', 'competitions']), hasStudents: z.boolean().optional(), consentConfirmed: z.boolean().optional(), isPublished: z.boolean().optional() }),
  check: (b) => { if (b.hasStudents && b.isPublished !== false && !b.consentConfirmed) throw ApiError.badRequest('Guardian consent must be confirmed before publishing photos with students'); },
});

// ---- Timetable (custom: per section/day upsert) ----
export const timetableRouter = Router();
timetableRouter.use(authenticate);
timetableRouter.get('/section/:sectionId', authorize('timetable:read', 'timetable:own'), asyncHandler(async (req, res) => {
  const { assertSectionAccess } = await import('../services/access.service');
  const { Student } = await import('../models/people');
  const sectionId = mustId(req.params.sectionId);
  if (req.user!.role === 'parent' || req.user!.role === 'student') {
    const { studentScope } = await import('../services/access.service');
    const scope = await studentScope(req);
    if (!scope || !(await Student.exists({ section: sectionId, ...scope }))) throw ApiError.forbidden();
  } else await assertSectionAccess(req, sectionId).catch(() => undefined);
  ok(res, await Timetable.find({ section: sectionId }).populate('periods.subject periods.teacher', 'name code').sort({ day: 1 }).lean());
}));
timetableRouter.put('/section/:sectionId/day/:day', authorize('timetable:write'),
  asyncHandler(async (req, res) => {
    const body = z.object({ periods: z.array(z.object({ period: z.number(), startTime: z.string(), endTime: z.string(), subject: objectId.optional(), teacher: objectId.optional(), room: z.string().optional() })) }).parse(req.body);
    const tt = await Timetable.findOneAndUpdate({ section: mustId(req.params.sectionId), day: Number(req.params.day) }, { periods: body.periods }, { upsert: true, new: true, runValidators: true });
    await audit(req, 'Timetable.upsert', 'Timetable', tt._id);
    ok(res, tt);
  }));

export const documentsRouter = Router();
documentsRouter.use(authenticate);
export { DocumentModel };
