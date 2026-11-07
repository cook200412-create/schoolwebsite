import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Book, BookIssue } from '../src/models/operations';
import { Notification } from '../src/models/comms';
import { app, closeTestDb, connectTestDb, login, mkUser, world } from './helpers';

const a = app();
let w: Awaited<ReturnType<typeof world>>;
beforeAll(async () => { await connectTestDb(); w = await world(); });
afterAll(closeTestDb);

describe('homework and assignments', () => {
  let hwId: string, asId: string;
  const due = new Date(Date.now() + 5 * 86400000).toISOString();

  it('teachers create tasks only for their own section/subject; parents and students are notified', async () => {
    const t = await login(a, w.teacherUser.email);
    expect((await t.post('/homework').send({ section: String(w.secB._id), subject: String(w.math._id), title: 'Xtra worksheet', dueDate: due })).status).toBe(403);
    const hw = await t.post('/homework').send({ section: String(w.secA._id), subject: String(w.math._id), title: 'Fractions worksheet', dueDate: due });
    expect(hw.status).toBe(201); hwId = hw.body.data._id;
    const as = await t.post('/assignments').send({ section: String(w.secA._id), subject: String(w.sci._id), title: 'Plant project', dueDate: due, maxMarks: 20 });
    asId = as.body.data._id;
    expect(await Notification.countDocuments({ user: w.parentUser._id, type: 'homework' })).toBe(1);
    expect((await (await login(a, w.parentUser.email)).post('/homework').send({})).status).toBe(403);
  });

  it('students submit; parents track completion; teachers review with marks and feedback', async () => {
    const s = await login(a, w.studentUser.email);
    expect((await s.post(`/homework/${hwId}/submit`).send({})).status).toBe(400);
    expect((await s.post(`/homework/${hwId}/submit`).send({ content: 'Done: 1/2 + 1/3 = 5/6' })).status).toBe(201);
    expect((await s.post(`/assignments/${asId}/submit`).send({ content: 'Project report' })).status).toBe(201);
    const p = await login(a, w.parentUser.email);
    const track = await p.get(`/homework/student/${w.s1._id}`);
    expect(track.body.data[0].submission.status).toBe('submitted');
    expect((await p.get(`/homework/student/${w.s2._id}`)).status).toBe(404);
    const t = await login(a, w.teacherUser.email);
    const subs = await t.get(`/assignments/${asId}/submissions`);
    const sub = subs.body.data.find((x: any) => x.submission).submission;
    expect((await t.patch(`/assignments/submissions/${sub._id}/review`).send({ marks: 25 })).status).toBe(400); // above max 20
    const rev = await t.patch(`/assignments/submissions/${sub._id}/review`).send({ marks: 18, feedback: 'Great work' });
    expect(rev.body.data.status).toBe('reviewed');
    const other = await login(a, w.otherTeacherUser.email);
    expect((await other.patch(`/assignments/submissions/${sub._id}/review`).send({ marks: 1 })).status).toBe(403);
    expect((await other.get(`/assignments/${asId}/submissions`)).status).toBe(403);
  });

  it('a student from another section cannot submit', async () => {
    const outsider = await mkUser('student');
    await (await import('../src/models/people')).Student.updateOne({ _id: w.sB._id }, { user: outsider._id });
    const o = await login(a, outsider.email);
    expect((await o.post(`/homework/${hwId}/submit`).send({ content: 'sneaky' })).status).toBe(404);
  });
});

describe('library', () => {
  it('issues, prevents over-issue, returns with fines', async () => {
    const lib = await login(a, (await mkUser('librarian')).email);
    const book = await Book.create({ title: 'Malgudi Days', isbn: '111', copies: 1, available: 1, category: 'Fiction' });
    const issue = await lib.post('/library/issue').send({ bookId: String(book._id), studentId: String(w.s1._id), days: 7 });
    expect(issue.status).toBe(201);
    expect((await lib.post('/library/issue').send({ bookId: String(book._id), studentId: String(w.s2._id) })).status).toBe(409); // none left
    expect((await Book.findById(book._id))!.available).toBe(0);
    await BookIssue.updateOne({ _id: issue.body.data._id }, { dueDate: new Date(Date.now() - 3 * 86400000) });
    const ret = await lib.post(`/library/return/${issue.body.data._id}`).send({});
    expect(ret.body.data.fine).toBe(3 * 500);
    expect((await Book.findById(book._id))!.available).toBe(1);
    expect((await lib.post(`/library/return/${issue.body.data._id}`).send({})).status).toBe(404);
    const p = await login(a, w.parentUser.email);
    expect((await p.get(`/library/student/${w.s1._id}`)).body.data).toHaveLength(1);
    expect((await p.get(`/library/student/${w.s2._id}`)).status).toBe(404);
    expect((await p.post('/library/issue').send({})).status).toBe(403);
  });
});

describe('transport', () => {
  it('manager assigns students to a route; parents see route info but not driver details', async () => {
    const tm = await login(a, (await mkUser('transport_manager')).email);
    const v = await tm.post('/vehicles').send({ registrationNumber: 'ts09ab1234', capacity: 30, driver: { name: 'Raju', phone: '9000000000' } });
    expect(v.status).toBe(201);
    const r = await tm.post('/routes').send({ name: 'Route A', vehicle: v.body.data._id, monthlyFee: 100000, stops: [{ name: 'Gate', order: 1, pickupTime: '07:30' }] });
    expect((await tm.post('/transport/assign').send({ routeId: r.body.data._id, studentIds: [String(w.s1._id)] })).body.data.updated).toBe(1);
    const p = await login(a, w.parentUser.email);
    const info = await p.get(`/transport/student/${w.s1._id}`);
    expect(info.body.data.name).toBe('Route A');
    expect(JSON.stringify(info.body.data)).not.toContain('9000000000');
    expect(JSON.stringify(info.body.data)).not.toMatch(/lat|lng|location/i);
    expect((await p.get('/vehicles')).status).toBe(403);
  });
});

describe('announcements, notifications and CMS', () => {
  it('publishing notifies the right audience, with read/unread tracking', async () => {
    const admin = await login(a, w.admin.email);
    const draft = await admin.post('/announcements').send({ title: 'PTM on Friday', body: 'Parent meeting at 10am', category: 'parent-meeting', audience: 'parents' });
    const p = await login(a, w.parentUser.email);
    expect((await p.get('/announcements')).body.data).toHaveLength(0); // drafts hidden
    expect((await admin.post(`/announcements/${draft.body.data._id}/publish`).send({})).status).toBe(200);
    expect((await p.get('/announcements')).body.data).toHaveLength(1);
    const n = await p.get('/notifications?unread=true');
    expect(n.body.meta.unread).toBeGreaterThan(0);
    const first = n.body.data[0]._id;
    expect((await p.patch(`/notifications/${first}/read`).send({})).status).toBe(200);
    expect((await p.post('/notifications/read-all').send({})).status).toBe(200);
    expect((await p.get('/notifications?unread=true')).body.meta.unread).toBe(0);
    expect((await (await login(a, w.studentUser.email)).get('/announcements')).body.data).toHaveLength(0);
  });

  it('teachers may post class announcements only to their own sections', async () => {
    const t = await login(a, w.teacherUser.email);
    expect((await t.post('/announcements').send({ title: 'Quiz', body: 'Tomorrow', audience: 'parents', sections: [String(w.secB._id)], publish: true })).status).toBe(403);
    expect((await t.post('/announcements').send({ title: 'Quiz', body: 'Tomorrow', audience: 'public', publish: true })).status).toBe(403);
    expect((await t.post('/announcements').send({ title: 'Quiz', body: 'Tomorrow', audience: 'parents', sections: [String(w.secA._id)], publish: true })).status).toBe(201);
  });

  it('public endpoints expose only published, consented content; facilities need confirmation', async () => {
    const admin = await login(a, w.admin.email);
    await admin.put('/settings').send({ schoolName: 'SSSV', facilities: [{ slug: 'library', title: 'Library', confirmed: true }, { slug: 'cctv', title: 'CCTV', confirmed: false }] });
    const pub = await request(a).get('/api/settings/public');
    expect(pub.body.data.facilities.map((f: any) => f.slug)).toEqual(['library']);
    const cms = await login(a, w.superAdmin.email);
    expect((await cms.post('/gallery').send({ url: 'https://res.cloudinary.com/x/a.jpg', category: 'sports', hasStudents: true, isPublished: true })).status).toBe(400);
    await cms.post('/gallery').send({ url: 'https://res.cloudinary.com/x/b.jpg', category: 'sports', hasStudents: true, consentConfirmed: true, isPublished: true });
    await cms.post('/gallery').send({ url: 'https://res.cloudinary.com/x/c.jpg', category: 'campus', isPublished: true });
    await cms.post('/gallery').send({ url: 'https://res.cloudinary.com/x/d.jpg', category: 'campus', isPublished: false });
    expect((await request(a).get('/api/public/gallery')).body.data).toHaveLength(2);
    expect((await request(a).get('/api/settings')).status).toBe(401);
    expect((await (await login(a, w.teacherUser.email)).put('/settings').send({ schoolName: 'Hacked' })).status).toBe(403);
  });

  it('dashboard counters are role-scoped and use real data', async () => {
    const sa = await login(a, w.superAdmin.email);
    const d = (await sa.get('/reports/dashboard')).body.data;
    expect(d.students).toBeGreaterThanOrEqual(3);
    expect(d.teachers).toBe(2);
    expect(d.recentActivity.length).toBeGreaterThan(0);
    const t = (await (await login(a, w.teacherUser.email)).get('/reports/dashboard')).body.data;
    expect(t.feeCollectionThisMonth).toBeUndefined();
    expect(t.recentActivity).toBeUndefined();
  });
});
