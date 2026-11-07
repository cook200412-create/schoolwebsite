import { Router } from 'express';
import { dbState } from '../config/db';
import { csrfProtection } from '../middleware/auth';
import { admissionsRouter, documentsRouter } from './admissions.routes';
import { attendanceRouter, leaveRouter } from './attendance.routes';
import { authRouter } from './auth.routes';
import { announcementsAdminRouter, messagesRouter, notificationsRouter } from './comms.routes';
import { complaintsRouter, remarksRouter } from './feedback.routes';
import { examsRouter, resultsRouter } from './exams.routes';
import { feesRouter, paymentsRouter } from './fees.routes';
import { assignmentsRouter, homeworkRouter } from './homework.routes';
import { libraryRouter, transportRouter } from './operations.routes';
import { announcementsRouter, eventsPublicRouter, publicContentRouter, settingsRouter } from './public.routes';
import {
  achievementsRouter, booksRouter, classesRouter, enquiriesRouter, eventsRouter, galleryRouter, routesRouter, sectionsRouter,
  staffRouter, subjectsRouter, timetableRouter, vehiclesRouter, yearsRouter,
} from './reference.routes';
import { reportsRouter } from './reports.routes';
import { parentsRouter, studentsRouter, teachersRouter } from './students.routes';
import { rolesRouter, usersRouter } from './users.routes';

export const api = Router();

api.get('/health', (_req, res) => {
  const db = dbState();
  res.status(db === 'connected' ? 200 : 503).json({
    success: db === 'connected',
    data: { status: db === 'connected' ? 'ok' : 'degraded', db, uptime: Math.round(process.uptime()) },
  });
});

api.use(csrfProtection);

api.use('/auth', authRouter);
api.use('/users', usersRouter);
api.use('/roles', rolesRouter);
api.use('/settings', settingsRouter);
api.use('/public', publicContentRouter);
api.use('/students', studentsRouter);
api.use('/parents', parentsRouter);
api.use('/teachers', teachersRouter);
api.use('/staff', staffRouter);
api.use('/academic-years', yearsRouter);
api.use('/classes', classesRouter);
api.use('/sections', sectionsRouter);
api.use('/subjects', subjectsRouter);
api.use('/admissions', admissionsRouter);
api.use('/documents', documentsRouter);
api.use('/attendance', attendanceRouter);
api.use('/leave', leaveRouter);
api.use('/timetable', timetableRouter);
api.use('/homework', homeworkRouter);
api.use('/assignments', assignmentsRouter);
api.use('/examinations', examsRouter);
api.use('/results', resultsRouter);
api.use('/fees', feesRouter);
api.use('/payments', paymentsRouter);
api.use('/announcements', announcementsRouter); // GET /public
api.use('/announcements', announcementsAdminRouter);
api.use('/notifications', notificationsRouter);
api.use('/messages', messagesRouter);
api.use('/events', eventsPublicRouter); // GET /public
api.use('/events', eventsRouter);
api.use('/enquiries', enquiriesRouter);
api.use('/library', libraryRouter);
api.use('/books', booksRouter);
api.use('/transport', transportRouter);
api.use('/vehicles', vehiclesRouter);
api.use('/routes', routesRouter);
api.use('/gallery', galleryRouter);
api.use('/achievements', achievementsRouter);
api.use('/reports', reportsRouter);
api.use('/complaints', complaintsRouter);
api.use('/remarks', remarksRouter);
