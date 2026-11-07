import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Notification } from '../src/models/comms';
import { app, closeTestDb, connectTestDb, login, world } from './helpers';

const a = app();
let w: Awaited<ReturnType<typeof world>>;
beforeAll(async () => { await connectTestDb(); w = await world(); });
afterAll(closeTestDb);

describe('parent complaints', () => {
  let id: string;
  it('a parent raises a complaint about their own child; leadership is notified', async () => {
    const p = await login(a, w.parentUser.email);
    const bad = await p.post('/complaints').send({ category: 'teacher', subject: 'Homework load', description: 'Too much homework every day for class 8.', studentId: String(w.s2._id) });
    expect(bad.status).toBe(403); // someone else's child
    expect((await p.post('/complaints').send({ category: 'teacher', subject: 'x', description: 'short' })).status).toBe(422);
    const ok = await p.post('/complaints').send({ category: 'academic', subject: 'Homework load', description: 'Too much homework every day for class 8.', studentId: String(w.s1._id) });
    expect(ok.status).toBe(201);
    expect(ok.body.data.ticketNumber).toMatch(/^CMP\d{4}\d{5}$/);
    id = ok.body.data._id;
    expect(await Notification.countDocuments({ user: w.principal._id, type: 'complaint' })).toBe(1);
  });

  it('families only see their own tickets; teachers and students cannot use the module', async () => {
    const other = await login(a, w.otherParentUser.email);
    expect((await other.get('/complaints')).body.data).toHaveLength(0);
    expect((await other.get(`/complaints/${id}`)).status).toBe(404);
    expect((await other.post(`/complaints/${id}/replies`).send({ text: 'hi' })).status).toBe(404);
    expect((await (await login(a, w.teacherUser.email)).get('/complaints')).status).toBe(403);
    expect((await (await login(a, w.studentUser.email)).post('/complaints').send({ category: 'other', subject: 'abc', description: 'long enough text here' })).status).toBe(403);
  });

  it('leadership replies (public + internal), parent sees only public replies, status workflow notifies parent', async () => {
    const pr = await login(a, w.principal.email);
    expect((await pr.get('/complaints')).body.data).toHaveLength(1);
    expect((await pr.post(`/complaints/${id}/replies`).send({ text: 'We are reviewing with the class teacher.' })).status).toBe(201);
    expect((await pr.post(`/complaints/${id}/replies`).send({ text: 'Internal: check workload policy', internal: true })).status).toBe(201);
    const p = await login(a, w.parentUser.email);
    const t = (await p.get(`/complaints/${id}`)).body.data;
    expect(t.status).toBe('in_review');
    expect(t.replies).toHaveLength(1);
    expect(JSON.stringify(t)).not.toContain('Internal');
    expect((await p.post(`/complaints/${id}/replies`).send({ text: 'Thank you', internal: true })).status).toBe(403);
    expect((await p.post(`/complaints/${id}/replies`).send({ text: 'Thank you' })).status).toBe(201);
    expect((await p.patch(`/complaints/${id}/status`).send({ status: 'closed' })).status).toBe(403);
    expect((await pr.patch(`/complaints/${id}/status`).send({ status: 'resolved' })).status).toBe(200);
    expect(await Notification.countDocuments({ user: w.parentUser._id, type: 'complaint' })).toBeGreaterThanOrEqual(2);
    await pr.patch(`/complaints/${id}/status`).send({ status: 'closed' });
    expect((await p.post(`/complaints/${id}/replies`).send({ text: 'more' })).status).toBe(409);
  });
});

describe('teacher remarks', () => {
  it('teachers write remarks only for students in their sections; parents are notified', async () => {
    const t = await login(a, w.teacherUser.email);
    expect((await t.post('/remarks').send({ studentId: String(w.sB._id), category: 'positive', text: 'Great effort' })).status).toBe(403);
    const r = await t.post('/remarks').send({ studentId: String(w.s1._id), category: 'positive', text: 'Excellent participation in class discussions.', subject: String(w.math._id) });
    expect(r.status).toBe(201);
    await t.post('/remarks').send({ studentId: String(w.s1._id), category: 'concern', text: 'Often late submitting homework.', visibleToParent: false });
    expect(await Notification.countDocuments({ user: w.parentUser._id, type: 'remark' })).toBe(1);
    expect((await (await login(a, w.otherTeacherUser.email)).post('/remarks').send({ studentId: String(w.s1._id), category: 'general', text: 'not my class' })).status).toBe(403);
  });

  it('parents and students see only parent-visible remarks of their own child', async () => {
    const p = await login(a, w.parentUser.email);
    const list = (await p.get(`/remarks/student/${w.s1._id}`)).body.data;
    expect(list).toHaveLength(1);
    expect(list[0].category).toBe('positive');
    expect(list[0].teacherName).toBeTruthy();
    expect((await p.get(`/remarks/student/${w.s2._id}`)).status).toBe(404);
    expect((await p.post('/remarks').send({ studentId: String(w.s1._id), category: 'general', text: 'self-written' })).status).toBe(403);
    expect((await (await login(a, w.studentUser.email)).get(`/remarks/student/${w.s1._id}`)).body.data).toHaveLength(1);
    const t = await login(a, w.teacherUser.email);
    expect((await t.get(`/remarks/student/${w.s1._id}`)).body.data).toHaveLength(2); // teacher sees private note too
    expect((await (await login(a, w.principal.email)).get(`/remarks/student/${w.s1._id}`)).body.data).toHaveLength(2);
  });

  it('only the author can delete a remark', async () => {
    const t = await login(a, w.teacherUser.email);
    const mine = (await t.get('/remarks/mine')).body.data;
    const other = await login(a, w.otherTeacherUser.email);
    expect((await other.del(`/remarks/${mine[0]._id}`)).status).toBe(404);
    expect((await t.del(`/remarks/${mine[0]._id}`)).status).toBe(200);
  });
});
