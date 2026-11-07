import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { outbox } from '../src/services/mail.service';
import { Parent, Student } from '../src/models/people';
import { Admission } from '../src/models/admission';
import { app, closeTestDb, connectTestDb, login, mkUser, world } from './helpers';

const a = app();
let w: Awaited<ReturnType<typeof world>>;
beforeAll(async () => { await connectTestDb(); w = await world(); });
afterAll(closeTestDb);

const PDF = Buffer.from('%PDF-1.4\n%test\n');
const data = (over: object = {}) => JSON.stringify({
  student: { firstName: 'Asha', lastName: 'Rao', dob: '2015-03-02', gender: 'female' },
  guardian: { name: 'Ravi Rao', relation: 'father', phone: '9876543210', email: 'ravi.rao@example.com' },
  classApplying: '8', academicYear: '2026-27', consent: true, ...over,
});

describe('public admissions', () => {
  it('validates required data and consent', async () => {
    const r = await request(a).post('/api/admissions/applications').field('data', data({ consent: false }));
    expect(r.status).toBe(422);
    const r2 = await request(a).post('/api/admissions/applications').field('data', data({ guardian: { name: 'R', phone: '12', email: 'bad' } }));
    expect(r2.status).toBe(422);
  });

  it('saves an application with documents and emails the application number', async () => {
    outbox.length = 0;
    const r = await request(a).post('/api/admissions/applications').field('data', data()).attach('birth_certificate', PDF, { filename: 'bc.pdf', contentType: 'application/pdf' });
    expect(r.status).toBe(201);
    expect(r.body.data.applicationNumber).toMatch(/^APP2026\d{5}$/);
    const saved = await Admission.findOne({ applicationNumber: r.body.data.applicationNumber });
    expect(saved!.documents).toHaveLength(1);
    expect(saved!.consent?.given).toBe(true);
    expect(outbox.some((m) => m.to === 'ravi.rao@example.com')).toBe(true);
  });

  it('prevents duplicate applications', async () => {
    const r = await request(a).post('/api/admissions/applications').field('data', data());
    expect(r.status).toBe(409);
  });

  it('rejects disallowed or disguised files', async () => {
    const exe = await request(a).post('/api/admissions/applications').field('data', data({ student: { firstName: 'B', dob: '2015-01-01', gender: 'male' } })).attach('photograph', Buffer.from('MZ...'), { filename: 'a.exe', contentType: 'application/x-msdownload' });
    expect(exe.status).toBe(400);
    const fake = await request(a).post('/api/admissions/applications').field('data', data({ student: { firstName: 'C', dob: '2015-01-02', gender: 'male' } })).attach('photograph', Buffer.from('not really a png'), { filename: 'a.png', contentType: 'image/png' });
    expect(fake.status).toBe(400);
    const big = await request(a).post('/api/admissions/applications').field('data', data({ student: { firstName: 'D', dob: '2015-01-03', gender: 'male' } })).attach('photograph', Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47]), Buffer.alloc(6 * 1024 * 1024)]), { filename: 'big.png', contentType: 'image/png' });
    expect(big.status).toBe(413);
  });

  it('tracking needs both the application number and the guardian phone', async () => {
    const adm = await Admission.findOne({ 'student.firstName': 'Asha' });
    const ok = await request(a).get(`/api/admissions/track/${adm!.applicationNumber}?phone=9876543210`);
    expect(ok.status).toBe(200);
    expect(ok.body.data.status).toBe('submitted');
    expect(ok.body.data.guardian).toBeUndefined(); // no personal data leaks
    expect((await request(a).get(`/api/admissions/track/${adm!.applicationNumber}?phone=9000000000`)).status).toBe(404);
  });

  it('accepts contact/admission enquiries', async () => {
    const r = await request(a).post('/api/admissions/enquiries').send({ name: 'Asha', phone: '9876543210', message: 'Fee details please' });
    expect(r.status).toBe(201);
  });
});

describe('admission workflow', () => {
  it('staff review → approve → convert to a student with a parent account (atomic)', async () => {
    const officer = await login(a, (await mkUser('admission_officer')).email);
    const adm = await Admission.findOne({ 'student.firstName': 'Asha' });
    const id = String(adm!._id);
    expect((await officer.get('/admissions?status=submitted')).body.data.length).toBeGreaterThan(0);
    expect((await officer.get('/admissions?q=Asha')).body.data).toHaveLength(1);
    const convertEarly = await officer.post(`/admissions/${id}/convert`).send({ class: String(w.cls._id), section: String(w.secA._id), academicYear: String(w.year._id) });
    expect(convertEarly.status).toBe(400); // not approved yet
    expect((await officer.patch(`/admissions/${id}/status`).send({ status: 'documents_required', note: 'Need transfer certificate' })).status).toBe(200);
    expect((await officer.post(`/admissions/${id}/notes`).send({ text: 'Called parent' })).status).toBe(200);
    expect((await officer.post(`/admissions/${id}/interview`).send({ scheduledAt: '2026-12-01T10:00:00Z', venue: 'Office' })).status).toBe(200);
    expect((await officer.get(`/admissions/${id}/letter`)).status).toBe(400); // not approved
    await officer.patch(`/admissions/${id}/status`).send({ status: 'approved' });
    const letter = await officer.get(`/admissions/${id}/letter`);
    expect(letter.status).toBe(200);
    expect(letter.headers['content-type']).toBe('application/pdf');

    const conv = await officer.post(`/admissions/${id}/convert`).send({ class: String(w.cls._id), section: String(w.secA._id), academicYear: String(w.year._id), rollNumber: 5 });
    expect(conv.status).toBe(201);
    expect(conv.body.data.admissionNumber).toMatch(/^ADM2026/);
    const student = await Student.findById(conv.body.data.studentId);
    expect(student!.firstName).toBe('Asha');
    const parent = await Parent.findOne({ children: student!._id });
    expect(parent).toBeTruthy();
    // second conversion is blocked
    expect((await officer.post(`/admissions/${id}/convert`).send({ class: String(w.cls._id), section: String(w.secA._id), academicYear: String(w.year._id) })).status).toBe(409);
    // the new parent can log in and see only the new child
    const pc = await login(a, 'ravi.rao@example.com', conv.body.data.temporaryPassword);
    const kids = await pc.get('/students');
    expect(kids.body.data).toHaveLength(1);
    expect(kids.body.data[0].firstName).toBe('Asha');
  });

  it('a failed conversion leaves no partial records (rollback)', async () => {
    const officer = await login(a, (await mkUser('admission_officer')).email);
    const r = await request(a).post('/api/admissions/applications').field('data', data({ student: { firstName: 'Rollback', dob: '2015-04-04', gender: 'male' }, guardian: { name: 'Gita Rao', phone: '9111111111', email: 'rb@example.com' } }));
    expect(r.status, JSON.stringify(r.body)).toBe(201);
    const adm = await Admission.findOne({ applicationNumber: r.body.data.applicationNumber });
    await officer.patch(`/admissions/${adm!._id}/status`).send({ status: 'approved' });
    const before = await Student.countDocuments();
    const bad = await officer.post(`/admissions/${adm!._id}/convert`).send({ class: String(w.cls._id), section: String(w.cls._id), academicYear: String(w.year._id) });
    expect(bad.status).toBe(400);
    expect(await Student.countDocuments()).toBe(before);
    expect(await mkUserExists('rb@example.com')).toBe(false);
  });

  it('non-staff cannot use the admin admission endpoints', async () => {
    const p = await login(a, w.parentUser.email);
    expect((await p.patch(`/admissions/${w.s1._id}/status`).send({ status: 'approved' })).status).toBe(403);
  });
});

async function mkUserExists(email: string) {
  const { User } = await import('../src/models/user');
  return !!(await User.exists({ email }));
}
