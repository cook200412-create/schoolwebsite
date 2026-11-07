import { Router } from 'express';
import mongoose from 'mongoose';
import { z } from 'zod';
import { authenticate, authorize, can, validate } from '../middleware/auth';
import { Book, BookIssue, TransportRoute } from '../models/operations';
import { SchoolSettings } from '../models/SchoolSettings';
import { Student } from '../models/people';
import { assertStudentAccess } from '../services/access.service';
import { ApiError, asyncHandler, ok } from '../utils/http';
import { audit, mustId, objectId, paginate } from '../utils/helpers';

// ---------------- Library ----------------
export const libraryRouter = Router();
libraryRouter.use(authenticate);

libraryRouter.get('/available', authorize('library:read', 'library:own'), asyncHandler(async (req, res) => {
  const q: any = { deletedAt: null, available: { $gt: 0 } };
  if (typeof req.query.q === 'string' && req.query.q) q.$text = { $search: req.query.q };
  ok(res, await Book.find(q).select('title author category shelf available').limit(50).lean());
}));

libraryRouter.post('/issue', authorize('library:write'), validate(z.object({ bookId: objectId, studentId: objectId, days: z.number().int().min(1).max(60).default(14) })), asyncHandler(async (req, res) => {
  const session = await mongoose.startSession(); let issue: any;
  try {
    await session.withTransaction(async () => {
      const book = await Book.findOneAndUpdate({ _id: req.body.bookId, available: { $gt: 0 }, deletedAt: null }, { $inc: { available: -1 } }, { new: true, session });
      if (!book) throw ApiError.conflict('Book not available');
      if (!(await Student.exists({ _id: req.body.studentId, status: 'active' }))) throw ApiError.notFound('Student not found');
      if (await BookIssue.exists({ book: book._id, student: req.body.studentId, returnedOn: null })) throw ApiError.conflict('Student already has this book');
      [issue] = await BookIssue.create([{ book: book._id, student: req.body.studentId, dueDate: new Date(Date.now() + req.body.days * 86400000), issuedBy: req.user!.id }], { session });
    });
  } finally { await session.endSession(); }
  await audit(req, 'Library.issue', 'BookIssue', issue._id); ok(res, issue, undefined, 201);
}));

libraryRouter.post('/return/:issueId', authorize('library:write'), asyncHandler(async (req, res) => {
  const session = await mongoose.startSession(); let issue: any;
  try {
    await session.withTransaction(async () => {
      issue = await BookIssue.findOne({ _id: mustId(req.params.issueId), returnedOn: null }).session(session);
      if (!issue) throw ApiError.notFound('Active issue not found');
      const rate = (await SchoolSettings.findOne({ key: 'default' }).lean())?.libraryFinePerDay ?? 500;
      const lateDays = Math.max(0, Math.floor((Date.now() - issue.dueDate.getTime()) / 86400000));
      issue.returnedOn = new Date(); issue.fine = lateDays * rate;
      await issue.save({ session });
      await Book.updateOne({ _id: issue.book }, { $inc: { available: 1 } }, { session });
    });
  } finally { await session.endSession(); }
  await audit(req, 'Library.return', 'BookIssue', issue._id, { fine: issue.fine }); ok(res, issue);
}));

libraryRouter.get('/issues', authorize('library:write'), asyncHandler(async (req, res) => {
  const { page, limit, skip } = paginate(req);
  const q: any = {}; if (req.query.active === 'true') q.returnedOn = null;
  const [items, total] = await Promise.all([BookIssue.find(q).populate('book', 'title isbn').populate('student', 'firstName lastName studentId').sort({ createdAt: -1 }).skip(skip).limit(limit).lean(), BookIssue.countDocuments(q)]);
  ok(res, items, { page, limit, total });
}));

libraryRouter.get('/student/:studentId', authorize('library:read', 'library:own'), asyncHandler(async (req, res) => {
  const s = await assertStudentAccess(req, mustId(req.params.studentId));
  ok(res, await BookIssue.find({ student: s._id }).populate('book', 'title author').sort({ createdAt: -1 }).lean());
}));

// ---------------- Transport ----------------
export const transportRouter = Router();
transportRouter.use(authenticate);

transportRouter.post('/assign', authorize('transport:write'), validate(z.object({ routeId: objectId.nullable(), studentIds: z.array(objectId).min(1).max(200) })), asyncHandler(async (req, res) => {
  if (req.body.routeId && !(await TransportRoute.exists({ _id: req.body.routeId, deletedAt: null }))) throw ApiError.notFound('Route not found');
  const r = await Student.updateMany({ _id: { $in: req.body.studentIds } }, { transportRoute: req.body.routeId });
  await audit(req, 'Transport.assign', 'TransportRoute', req.body.routeId, { count: r.modifiedCount }); ok(res, { updated: r.modifiedCount });
}));

transportRouter.get('/routes/:routeId/students', authorize('transport:read'), asyncHandler(async (req, res) => {
  ok(res, await Student.find({ transportRoute: mustId(req.params.routeId), status: 'active' }).select('firstName lastName studentId class section').populate('class section', 'name').lean());
}));

/** Parent/student: transport info for their own child. No live location is ever exposed. */
transportRouter.get('/student/:studentId', authorize('transport:own', 'transport:read'), asyncHandler(async (req, res) => {
  const s = await assertStudentAccess(req, mustId(req.params.studentId));
  if (!s.transportRoute) return ok(res, null);
  const staff = can(req, 'transport:read');
  // Families see route, stops and the bus number only – never driver phone/licence or any location data.
  const r = await TransportRoute.findById(s.transportRoute).populate('vehicle', staff ? 'registrationNumber type driver' : 'registrationNumber type').lean();
  ok(res, staff ? r : r && { name: r.name, stops: r.stops, vehicle: r.vehicle });
}));
