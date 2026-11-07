import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Student } from '../src/models/people';
import { AuditLog } from '../src/models/operations';
import { app, closeTestDb, connectTestDb, login, world } from './helpers';

const a = app();
let w: Awaited<ReturnType<typeof world>>;
beforeAll(async () => { await connectTestDb(); w = await world(); });
afterAll(closeTestDb);

describe('authorization (RBAC enforced by the API, not the UI)', () => {
  it('rejects unauthenticated access to protected routes', async () => {
    for (const path of ['/students', '/users', '/payments', '/reports/dashboard', '/attendance/class']) expect((await request(a).get(`/api${path}`)).status).toBe(401);
  });

  it('blocks roles lacking the permission', async () => {
    const teacher = await login(a, w.teacherUser.email);
    expect((await teacher.get('/users')).status).toBe(403);
    expect((await teacher.post('/users').send({ name: 'x', email: 'x@y.com', role: 'teacher' })).status).toBe(403);
    expect((await teacher.post('/fees/structures').send({})).status).toBe(403);
    const parent = await login(a, w.parentUser.email);
    expect((await parent.get('/reports/dashboard')).status).toBe(403);
    expect((await parent.get('/admissions')).status).toBe(403);
    expect((await parent.post('/attendance/mark').send({})).status).toBe(403);
    const acct = await login(a, w.accountant.email);
    expect((await acct.post('/examinations/x/publish').send({})).status).toBe(403);
  });

  it('only a Super Admin can create Super Admins or edit roles', async () => {
    const admin = await login(a, w.admin.email);
    expect((await admin.post('/users').send({ name: 'Boss', email: 'boss@t.school', role: 'super_admin' })).status).toBe(403);
    const sa = await login(a, w.superAdmin.email);
    const created = await sa.post('/users').send({ name: 'New Teacher', email: 'nt@t.school', role: 'teacher' });
    expect(created.status).toBe(201);
    expect(created.body.data.temporaryPassword).toBeTruthy();
    expect((await admin.put('/roles/teacher').send({ permissions: ['students:read'] })).status).toBe(403);
    expect((await sa.put('/roles/librarian').send({ permissions: ['library:read'] })).status).toBe(200);
    expect((await sa.put('/roles/super_admin').send({ permissions: [] })).status).toBe(400);
  });

  it('admins cannot demote or disable themselves', async () => {
    const sa = await login(a, w.superAdmin.email);
    expect((await sa.patch(`/users/${w.superAdmin._id}`).send({ isActive: false })).status).toBe(400);
  });

  it('writes an audit log for sensitive changes', async () => {
    expect(await AuditLog.countDocuments({ action: 'User.create' })).toBeGreaterThan(0);
  });
});

describe('parent–child and teacher–class access restrictions', () => {
  it('a parent sees only their own linked children', async () => {
    const p = await login(a, w.parentUser.email);
    const list = await p.get('/students');
    expect(list.status).toBe(200);
    expect(list.body.data.map((s: any) => s._id)).toEqual([String(w.s1._id)]);
    expect((await p.get(`/students/${w.s1._id}`)).status).toBe(200);
    expect((await p.get(`/students/${w.s2._id}`)).status).toBe(404); // another family's child
    expect((await p.get(`/attendance/student/${w.s2._id}`)).status).toBe(404);
    expect((await p.get(`/results/student/${w.s2._id}`)).status).toBe(404);
    expect((await p.get(`/fees/student/${w.s2._id}`)).status).toBe(404);
    expect((await p.get(`/homework/student/${w.s2._id}`)).status).toBe(404);
    expect((await p.patch(`/students/${w.s1._id}`).send({ firstName: 'Hacked' })).status).toBe(403);
  });

  it('a student sees only themself', async () => {
    const s = await login(a, w.studentUser.email);
    const list = await s.get('/students');
    expect(list.body.data).toHaveLength(1);
    expect((await s.get(`/students/${w.s2._id}`)).status).toBe(404);
  });

  it('a teacher sees only students of assigned sections', async () => {
    const t = await login(a, w.teacherUser.email);
    const ids = (await t.get('/students')).body.data.map((s: any) => s._id);
    expect(ids).toContain(String(w.s1._id));
    expect(ids).not.toContain(String(w.sB._id));
    expect((await t.get(`/students/${w.sB._id}`)).status).toBe(404);
  });

  it('parents cannot message arbitrary users, only teachers of their child and leadership', async () => {
    const p = await login(a, w.parentUser.email);
    expect((await p.post('/messages').send({ to: String(w.accountant._id), body: 'hi' })).status).toBe(403);
    expect((await p.post('/messages').send({ to: String(w.otherTeacherUser._id), body: 'hi' })).status).toBe(403);
    expect((await p.post('/messages').send({ to: String(w.teacherUser._id), body: 'Question about homework' })).status).toBe(201);
    expect((await p.post('/messages').send({ to: String(w.principal._id), body: 'Hello' })).status).toBe(201);
    const t = await login(a, w.teacherUser.email);
    const thread = await t.get(`/messages/thread/${w.parentUser._id}`);
    expect(thread.body.data).toHaveLength(1);
    const notes = await t.get('/notifications');
    expect(notes.body.data.some((n: any) => n.type === 'message')).toBe(true);
  });
});

describe('student CRUD', () => {
  it('admin creates, updates, searches, transfers, archives; validation + duplicates enforced', async () => {
    const admin = await login(a, w.admin.email);
    const body = { firstName: 'Zed', lastName: 'Zebra', dob: '2014-05-05', gender: 'male', class: String(w.cls._id), section: String(w.secA._id), academicYear: String(w.year._id), rollNumber: 9, admissionNumber: 'ADM-ZED-1' };
    const bad = await admin.post('/students').send({ ...body, dob: 'nope' });
    expect(bad.status).toBe(422);
    const created = await admin.post('/students').send(body);
    expect(created.status).toBe(201);
    const id = created.body.data.student._id;
    expect(created.body.data.student.studentId).toMatch(/^STU/);
    expect((await admin.post('/students').send(body)).status).toBe(409); // duplicate admission number
    const wrongSection = await admin.post('/students').send({ ...body, admissionNumber: 'X2', section: String((await import('../src/models/academic')).Section.hydrate({ _id: w.cls._id })._id) });
    expect(wrongSection.status).toBe(400);
    expect((await admin.patch(`/students/${id}`).send({ phone: '9999999999' })).status).toBe(200);
    const search = await admin.get('/students?q=zebra');
    expect(search.body.data).toHaveLength(1);
    expect((await admin.post(`/students/${id}/transfer`).send({ note: 'moved' })).body.data.status).toBe('transferred');
    expect((await admin.post(`/students/${id}/archive`).send({})).body.data.status).toBe('archived');
    expect((await admin.get('/students?q=zebra')).body.data).toHaveLength(0); // archived hidden by default
    expect((await admin.get('/students?q=zebra&status=archived')).body.data).toHaveLength(1);
  });

  it('imports CSV with per-row errors and exports CSV', async () => {
    const admin = await login(a, w.admin.email);
    const csv = 'firstName,lastName,dob,gender,class,section,academicYear,rollNumber\nImp,One,2014-01-01,female,8,A,2026-27,20\nBad,Row,not-a-date,male,8,A,2026-27,21\nNo,Class,2014-01-01,male,99,A,2026-27,22';
    const r = await admin.post('/students/import').send({ csv });
    expect(r.status).toBe(200);
    expect(r.body.data.created).toBe(1);
    expect(r.body.data.errors).toHaveLength(2);
    const exp = await admin.get('/students/export');
    expect(exp.headers['content-type']).toContain('text/csv');
    expect(exp.text).toContain('Imp');
  });

  it('promotes students in a transaction and keeps history', async () => {
    const admin = await login(a, w.admin.email);
    const { ClassModel, Section } = await import('../src/models/academic');
    const c9 = await ClassModel.create({ name: '9', level: 'secondary', order: 9 });
    const s9 = await Section.create({ class: c9._id, name: 'A' });
    const r = await admin.post('/students/promote').send({ studentIds: [String(w.s2._id)], toClass: String(c9._id), toSection: String(s9._id), toAcademicYear: String(w.year._id) });
    expect(r.body.data.promoted).toBe(1);
    const s = await Student.findById(w.s2._id);
    expect(String(s!.class)).toBe(String(c9._id));
    expect(s!.history.map((h: any) => h.action)).toContain('promoted');
  });

  it('formula-injection is neutralised in CSV exports', async () => {
    const admin = await login(a, w.admin.email);
    await Student.updateOne({ _id: w.s1._id }, { firstName: '=HYPERLINK("x")' });
    const exp = await admin.get('/students/export');
    expect(exp.text).not.toMatch(/(^|,)=HYPERLINK/);
  });
});
