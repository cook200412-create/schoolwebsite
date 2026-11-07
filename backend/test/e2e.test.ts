import crypto from 'crypto';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Teacher } from '../src/models/people';
import { seed } from '../src/seed';
import { app, closeTestDb, connectTestDb, login, mkUser, PASSWORD, world } from './helpers';

const a = app();
beforeAll(connectTestDb);
afterAll(closeTestDb);

/** Full journey across roles, over HTTP, against a real (in-memory) MongoDB replica set. */
describe('end-to-end: admission → student → attendance → marks → results → fee payment', () => {
  it('works for every actor', async () => {
    const w = await world();
    const today = new Date().toISOString().slice(0, 10);
    const officer = await login(a, (await mkUser('admission_officer')).email);
    const admin = await login(a, w.admin.email);
    const accountant = await login(a, w.accountant.email);
    const principal = await login(a, w.principal.email);

    // 1. Parent applies online (public)
    const app1 = await request(a).post('/api/admissions/applications').field('data', JSON.stringify({
      student: { firstName: 'Rahul', lastName: 'Kumar', dob: '2013-08-09', gender: 'male' },
      guardian: { name: 'Suresh Kumar', phone: '9822222222', email: 'suresh@example.com' }, classApplying: '8', academicYear: '2026-27', consent: true,
    }));
    expect(app1.status).toBe(201);

    // 2. Admin approves, converts → student + parent account
    const list = await officer.get(`/admissions?q=${app1.body.data.applicationNumber}`);
    const id = list.body.data[0]._id;
    await officer.patch(`/admissions/${id}/status`).send({ status: 'under_review' });
    await officer.patch(`/admissions/${id}/status`).send({ status: 'approved' });
    const conv = await officer.post(`/admissions/${id}/convert`).send({ class: String(w.cls._id), section: String(w.secA._id), academicYear: String(w.year._id), rollNumber: 7 });
    expect(conv.status).toBe(201);
    const studentId: string = conv.body.data.studentId;

    // 3. Teacher marks attendance (Rahul absent) → parent notified
    const teacher = await login(a, w.teacherUser.email);
    const roster = await teacher.get(`/attendance/class?sectionId=${w.secA._id}&date=${today}`);
    expect(roster.body.data.some((s: any) => String(s._id) === studentId)).toBe(true);
    await teacher.post('/attendance/mark').send({ sectionId: String(w.secA._id), date: today, records: roster.body.data.map((s: any) => ({ studentId: String(s._id), status: String(s._id) === studentId ? 'absent' : 'present' })) });
    const parent = await login(a, 'suresh@example.com', conv.body.data.temporaryPassword);
    const notes = await parent.get('/notifications');
    expect(notes.body.data.some((n: any) => n.type === 'attendance')).toBe(true);
    expect((await parent.get(`/attendance/student/${studentId}`)).body.data.counts.absent).toBe(1);

    // 4. Exam: marks entry → submit → approve → publish
    const exam = await admin.post('/examinations').send({ name: 'Term 1', academicYear: String(w.year._id), class: String(w.cls._id), subjects: [{ subject: String(w.math._id), maxMarks: 100, passMarks: 35 }, { subject: String(w.sci._id), maxMarks: 100, passMarks: 35 }] });
    const examId = exam.body.data._id;
    const all = roster.body.data.flatMap((s: any) => [{ studentId: String(s._id), subjectId: String(w.math._id), marks: 80 }, { studentId: String(s._id), subjectId: String(w.sci._id), marks: 70 }]);
    expect((await teacher.post(`/examinations/${examId}/marks`).send({ sectionId: String(w.secA._id), entries: all.map((e: any) => (e.studentId === studentId ? { ...e, marks: e.subjectId === String(w.math._id) ? 85 : 90 } : e)) })).status).toBe(200);
    // Section B students also need marks before approval
    const bRows = await Teacher.findOne({ employeeId: 'T2' });
    expect(bRows).toBeTruthy();
    const other = await login(a, w.otherTeacherUser.email);
    await other.post(`/examinations/${examId}/marks`).send({ sectionId: String(w.secB._id), entries: [{ studentId: String(w.sB._id), subjectId: String(w.math._id), marks: 60 }] });
    await admin.post(`/examinations/${examId}/marks`).send({ sectionId: String(w.secB._id), entries: [{ studentId: String(w.sB._id), subjectId: String(w.sci._id), marks: 61 }] });
    await teacher.post(`/examinations/${examId}/submit`).send({});
    expect((await principal.post(`/examinations/${examId}/approve`).send({})).status).toBe(200);
    expect((await parent.get(`/results/student/${studentId}`)).body.data).toHaveLength(0);
    expect((await principal.post(`/examinations/${examId}/publish`).send({})).status).toBe(200);

    // 5. Parent views published result
    const res = (await parent.get(`/results/student/${studentId}`)).body.data[0];
    expect(res.total).toBe(175);
    expect(res.percentage).toBe(87.5);

    // 6. Fees: configure, assign, pay online via signed webhook, receipt
    const st = await accountant.post('/fees/structures').send({ name: 'Class 8', class: String(w.cls._id), academicYear: String(w.year._id), items: [{ name: 'Tuition', type: 'tuition', amount: 500000 }] });
    await accountant.post('/fees/assign').send({ structureId: st.body.data._id });
    const ledger = await parent.get(`/fees/student/${studentId}`);
    const feeId = ledger.body.data.fees[0]._id;
    const order = await parent.post('/payments/orders').send({ studentFeeId: feeId, idempotencyKey: 'e2e-order-key-1' });
    expect(order.status).toBe(201);
    const raw = JSON.stringify({ event: 'payment.captured', payload: { payment: { entity: { id: 'pay_e2e', order_id: order.body.data.orderId, amount: 500000 } } } });
    const hook = await request(a).post('/api/payments/webhook/razorpay').set('Content-Type', 'application/json').set('X-Razorpay-Signature', crypto.createHmac('sha256', 'whsec_test_secret').update(raw).digest('hex')).set('X-Razorpay-Event-Id', 'evt_e2e').send(raw);
    expect(hook.status).toBe(200);
    const after = await parent.get(`/fees/student/${studentId}`);
    expect(after.body.data.fees[0].balance).toBe(0);
    expect(after.body.data.payments[0].receiptNumber).toBeTruthy();
    expect((await parent.get(`/payments/${after.body.data.payments[0]._id}/receipt.pdf`)).status).toBe(200);
    expect(PASSWORD).toBeTruthy();
  });
});

describe('demo seed', () => {
  it('seeds fictional data usable for logins (and is idempotent)', async () => {
    const r = await seed();
    await seed();
    const parent = await login(a, 'parent@demo.school', r.password);
    const kids = await parent.get('/students');
    expect(kids.body.data.map((s: any) => s.firstName).sort()).toEqual(['Ananya', 'Rahul']);
    const results = await parent.get(`/results/student/${kids.body.data.find((s: any) => s.firstName === 'Rahul')._id}`);
    expect(results.body.data[0].total).toBe(341); // 85+90+78+88 of 400
    expect(results.body.data[0].percentage).toBe(85.25);
    expect((await request(a).get('/api/settings/public')).body.data.facilities).toHaveLength(0); // nothing published unconfirmed
  });
});
