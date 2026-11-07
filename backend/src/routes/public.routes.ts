import { Router } from 'express';
import { z } from 'zod';
import { authenticate, authorize, validate } from '../middleware/auth';
import { ClassModel, Subject } from '../models/academic';
import { Achievement } from '../models/cms';
import { GalleryImage } from '../models/operations';
import { SchoolSettings } from '../models/SchoolSettings';
import { getPublicAnnouncements, getPublicSettings, getUpcomingEvents } from '../services/public.service';
import { asyncHandler, ok } from '../utils/http';
import { audit } from '../utils/helpers';

export const settingsRouter = Router();
settingsRouter.get('/public', asyncHandler(async (_req, res) => ok(res, await getPublicSettings())));

const settingsSchema = z.object({
  schoolName: z.string().min(2), shortName: z.string().optional(), tagline: z.string().optional(),
  logoUrl: z.string().url().optional(), heroImageUrl: z.string().url().optional(),
  address: z.string().optional(), phone: z.string().optional(), email: z.string().email().optional(), officeTimings: z.string().optional(),
  mapEmbedUrl: z.string().url().optional(),
  social: z.object({ facebook: z.string().optional(), instagram: z.string().optional(), youtube: z.string().optional(), x: z.string().optional() }).optional(),
  admissionOpen: z.boolean().optional(), admissionBanner: z.string().optional(), academicYear: z.string().optional(),
  principal: z.object({ name: z.string().optional(), message: z.string().optional(), photoUrl: z.string().url().optional() }).optional(),
  vision: z.string().optional(), mission: z.string().optional(),
  stats: z.array(z.object({ label: z.string(), value: z.string() })).max(8).optional(),
  facilities: z.array(z.object({ slug: z.string(), title: z.string(), description: z.string().optional(), icon: z.string().optional(), confirmed: z.boolean().optional() })).optional(),
  libraryFinePerDay: z.number().int().min(0).optional(),
  notificationTemplates: z.record(z.string()).optional(),
  academicContent: z.object({
    history: z.string().optional(), philosophy: z.string().optional(), methodology: z.string().optional(), examinationSystem: z.string().optional(),
    management: z.array(z.object({ name: z.string(), role: z.string() })).optional(), infrastructure: z.string().optional(), calendarNote: z.string().optional(),
  }).optional(),
});

settingsRouter.get('/', authenticate, authorize('settings:write'), asyncHandler(async (_req, res) => ok(res, await SchoolSettings.findOne({ key: 'default' }).lean())));
settingsRouter.put('/', authenticate, authorize('settings:write'), validate(settingsSchema.partial()), asyncHandler(async (req, res) => {
  const s = await SchoolSettings.findOneAndUpdate({ key: 'default' }, { $set: req.body, $setOnInsert: { key: 'default' } }, { upsert: true, new: true, runValidators: true });
  await audit(req, 'Settings.update', 'SchoolSettings', s._id, Object.keys(req.body));
  ok(res, s);
}));

export const announcementsRouter = Router();
announcementsRouter.get('/public', asyncHandler(async (req, res) => ok(res, await getPublicAnnouncements(Math.min(Number(req.query.limit) || 6, 50)))));

export const eventsPublicRouter = Router();
eventsPublicRouter.get('/public', asyncHandler(async (req, res) => ok(res, await getUpcomingEvents(Math.min(Number(req.query.limit) || 6, 50)))));

export const publicContentRouter = Router();
publicContentRouter.get('/academics', asyncHandler(async (_req, res) => {
  const [classes, subjects, s] = await Promise.all([ClassModel.find({ deletedAt: null }).sort({ order: 1 }).select('name level description curriculum').lean(), Subject.find({ deletedAt: null }).select('name code classes').lean(), SchoolSettings.findOne({ key: 'default' }).select('academicContent academicYear').lean()]);
  ok(res, { classes, subjects, content: s?.academicContent ?? {}, academicYear: s?.academicYear });
}));
/** Photos that show students are only exposed when guardian consent was confirmed. */
publicContentRouter.get('/gallery', asyncHandler(async (req, res) => {
  const q: any = { isPublished: true, deletedAt: null, $or: [{ hasStudents: false }, { consentConfirmed: true }] };
  if (typeof req.query.category === 'string') q.category = req.query.category;
  ok(res, await GalleryImage.find(q).sort({ createdAt: -1 }).limit(100).select('url caption category').lean());
}));
publicContentRouter.get('/achievements', asyncHandler(async (_req, res) => {
  ok(res, await Achievement.find({ isPublished: true, deletedAt: null, $or: [{ studentName: null }, { studentName: '' }, { consentConfirmed: true }] }).sort({ createdAt: -1 }).select('title description category year studentName').lean());
}));
