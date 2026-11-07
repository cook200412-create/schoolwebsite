import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Attendance } from '../src/models/attendance';
import { Notification } from '../src/models/comms';
import { ExamResult, Examination } from '../src/models/exam';
import { app, closeTestDb, connectTestDb, login, world } from './helpers';

const a = app();
let w: Awaited<ReturnType<typeof world>>;
const today = new Date().toISOString().slice(0, 10);
beforeAll(async () => { await connectTestDb(); w = await world(); });
afterAll(closeTestDb);

describe('attendance', () => {
  it('teacher marks attendance for an assigned section; parents of absentees are notified', async () => {
    const t = await login(a, w.teacherUser.email);
    const r = await t.post('/attendance/mark').send({ sectionId: String(w.secA._id), date: today, records: [{ studentId: String(w.s1._id), status: 'absent' }, { studentId: String(w.s2._id), status: 'present' }] });
    expect(r.status).toBe(201);
    expect(r.body.data.created).toBe(2);
    expect(await Notification.countDocuments({ user: w.parentUser._id, type: 'attendance' })).toBe(1);
    expect(await Notification.countDocuments({ user: w.otherParentUser._id, type: 'attendance' })).toBe(0);
  });

  it('never creates duplicate records for the same student and date; resubmits are audited', async () => {
    const t = await login(a, w.teacherUser.email);
    const again = await t.post('/attendance/mark').send({ sectionId: String(w.secA._id), date: today, records: [{ studentId: String(w.s1._id), status: 'late' }, { studentId: String(w.s2._id), status: 'present' }] });
    expect(again.body.data).toEqual({ created: 0, updated: 1 });
    expect(await Attendance.countDocuments({ student: w.s1._id, date: today })).toBe(1);
    const rec = await Attendance.findOne({ student: w.s1._id, date: today });
    expect(rec!.history.length).toBe(2);
    await expect(Attendance.create({ student: w.s1._id, class: w.cls._id, section: w.secA._id, date: today, status: 'present', markedBy: w.teacherUser._id })).rejects.toThrow(/duplicate key/);
  });

  it('rejects future dates, unassigned sections, foreign students and duplicate rows', async () => {
    const t = await login(a, w.teacherUser.email);
    const future = new Date(Date.now() + 3 * 86400000).toISOString().slice(0, 10);
    expect((await t.post('/attendance/mark').send({ sectionId: String(w.secA._id), date: future, records: [{ studentId: String(w.s1._id), status: 'present' }] })).status).toBe(400);
    expect((await t.post('/attendance/mark').send({ sectionId: String(w.secB._id), date: today, records: [{ studentId: String(w.sB._id), status: 'present' }] })).status).toBe(403);
    expect((await t.post('/attendance/mark').send({ sectionId: String(w.secA._id), date: today, records: [{ studentId: String(w.sB._id), status: 'present' }] })).status).toBe(400);
    expect((await t.post('/attendance/mark').send({ sectionId: String(w.secA._id), date: today, records: [{ studentId: String(w.s1._id), status: 'present' }, { studentId: String(w.s1._id), status: 'absent' }] })).status).toBe(400);
    const past = '2026-01-05';
    expect((await t.post('/attendance/mark').send({ sectionId: String(w.secA._id), date: past, records: [{ studentId: String(w.s1._id), status: 'present' }] })).status).toBe(403); // past dates need admin
  });

  it('a teacher cannot bypass section scope with a query filter', async () => {
    const t = await login(a, w.teacherUser.email);
    const r = await t.get(`/students?section=${w.secB._id}`);
    expect(r.body.data).toHaveLength(0);
    expect((await t.get(`/attendance/class?sectionId=${w.secB._id}&date=${today}`)).status).toBe(403);
  });

  it('parent sees own child attendance with percentage; admin corrects with audit history', async () => {
    const p = await login(a, w.parentUser.email);
    const mine = await p.get(`/attendance/student/${w.s1._id}`);
    expect(mine.body.data.counts.late).toBe(1);
    expect(mine.body.data.percentage).toBe(100); // late counts as attended
    const admin = await login(a, w.admin.email);
    const rec = await Attendance.findOne({ student: w.s1._id, date: today });
    expect((await admin.patch(`/attendance/${rec!._id}/correct`).send({ status: 'present' })).status).toBe(422); // reason required
    const fixed = await admin.patch(`/attendance/${rec!._id}/correct`).send({ status: 'present', reason: 'Bus delay confirmed' });
    expect(fixed.body.data.history.at(-1).reason).toBe('Bus delay confirmed');
    expect((await login(a, w.teacherUser.email).then((c) => c.patch(`/attendance/${rec!._id}/correct`).send({ status: 'absent', reason: 'tamper' }))).status).toBe(403);
    const report = await admin.get(`/attendance/report/monthly?sectionId=${w.secA._id}&month=${today.slice(0, 7)}`);
    expect(report.body.data.find((r: any) => r.total > 0)).toBeTruthy();
    expect((await admin.get(`/attendance/report/monthly?sectionId=${w.secA._id}&month=${today.slice(0, 7)}&format=csv`)).headers['content-type']).toContain('text/csv');
  });

  it('a parent without a linked child can type the child name; missing name is rejected', async () => {
    const p = await login(a, w.otherParentUser.email);
    expect((await p.post('/leave').send({ fromDate: '2026-12-01', toDate: '2026-12-01', reason: 'Family function' })).status).toBe(400);
    const r = await p.post('/leave').send({ childName: 'Meera Nair', fromDate: '2026-12-01', toDate: '2026-12-01', reason: 'Family function' });
    expect(r.status).toBe(201);
    expect(r.body.data.childName).toBe('Meera Nair');
  });

  it('parents apply for leave only for their own child; teacher approves and attendance becomes "leave"', async () => {
    const p = await login(a, w.parentUser.email);
    expect((await p.post('/leave').send({ studentId: String(w.s2._id), fromDate: '2026-11-02', toDate: '2026-11-02', reason: 'Fever' })).status).toBe(403);
    const l = await p.post('/leave').send({ studentId: String(w.s1._id), fromDate: '2026-11-02', toDate: '2026-11-03', reason: 'Fever' });
    expect(l.status).toBe(201);
    const t = await login(a, w.teacherUser.email);
    expect((await t.get('/leave')).body.data).toHaveLength(1);
    expect((await p.patch(`/leave/${l.body.data._id}/decide`).send({ status: 'approved' })).status).toBe(403);
    expect((await t.patch(`/leave/${l.body.data._id}/decide`).send({ status: 'approved' })).status).toBe(200);
    expect(await Attendance.countDocuments({ student: w.s1._id, status: 'leave' })).toBe(2);
  });
});

describe('examinations, marks and results', () => {
  let examId: string;
  const subjects = () => [{ subject: String(w.math._id), maxMarks: 100, passMarks: 35 }, { subject: String(w.sci._id), maxMarks: 100, passMarks: 35 }];

  it('only authorised staff create exams; pass marks cannot exceed max', async () => {
    const t = await login(a, w.teacherUser.email);
    expect((await t.post('/examinations').send({})).status).toBe(403);
    const admin = await login(a, w.admin.email);
    expect((await admin.post('/examinations').send({ name: 'Bad', academicYear: String(w.year._id), class: String(w.cls._id), subjects: [{ subject: String(w.math._id), maxMarks: 50, passMarks: 60 }] })).status).toBe(422);
    const r = await admin.post('/examinations').send({ name: 'Term 1', academicYear: String(w.year._id), class: String(w.cls._id), subjects: subjects() });
    expect(r.status).toBe(201);
    examId = r.body.data._id;
  });

  it('teacher enters marks within limits for assigned section only', async () => {
    const t = await login(a, w.teacherUser.email);
    const over = await t.post(`/examinations/${examId}/marks`).send({ sectionId: String(w.secA._id), entries: [{ studentId: String(w.s1._id), subjectId: String(w.math._id), marks: 101 }] });
    expect(over.status).toBe(400);
    const wrongSection = await t.post(`/examinations/${examId}/marks`).send({ sectionId: String(w.secB._id), entries: [{ studentId: String(w.sB._id), subjectId: String(w.math._id), marks: 50 }] });
    expect(wrongSection.status).toBe(403);
    const other = await login(a, w.otherTeacherUser.email);
    expect((await other.post(`/examinations/${examId}/marks`).send({ sectionId: String(w.secA._id), entries: [{ studentId: String(w.s1._id), subjectId: String(w.math._id), marks: 50 }] })).status).toBe(403);
    // The example from the brief: Rahul → 85/100 + 90/100 etc. (two subjects here)
    const ok = await t.post(`/examinations/${examId}/marks`).send({ sectionId: String(w.secA._id), entries: [
      { studentId: String(w.s1._id), subjectId: String(w.math._id), marks: 85 }, { studentId: String(w.s1._id), subjectId: String(w.sci._id), marks: 90 },
      { studentId: String(w.s2._id), subjectId: String(w.math._id), marks: 30 }, { studentId: String(w.s2._id), subjectId: String(w.sci._id), marks: 70 },
    ] });
    expect(ok.status).toBe(200);
    expect(await ExamResult.countDocuments({ examination: examId })).toBe(4);
  });

  it('results are hidden from parents until approved AND published; marks lock after submission', async () => {
    const p = await login(a, w.parentUser.email);
    expect((await p.get(`/results/student/${w.s1._id}`)).body.data).toHaveLength(0);
    const t = await login(a, w.teacherUser.email);
    expect((await t.post(`/examinations/${examId}/approve`).send({})).status).toBe(403);
    expect((await t.post(`/examinations/${examId}/submit`).send({})).status).toBe(200);
    expect((await t.post(`/examinations/${examId}/marks`).send({ sectionId: String(w.secA._id), entries: [{ studentId: String(w.s1._id), subjectId: String(w.math._id), marks: 99 }] })).status).toBe(409);
    const pr = await login(a, w.principal.email);
    expect((await pr.post(`/examinations/${examId}/publish`).send({})).status).toBe(409); // must approve first
    // Incomplete (sB missing marks) → approval blocked
    expect((await pr.post(`/examinations/${examId}/approve`).send({})).status).toBe(400);
    await ExamResult.insertMany([{ examination: examId, student: w.sB._id, subject: w.math._id, marks: 60 }, { examination: examId, student: w.sB._id, subject: w.sci._id, marks: 61 }]);
    expect((await pr.post(`/examinations/${examId}/approve`).send({})).status).toBe(200);
    expect((await p.get(`/results/student/${w.s1._id}`)).body.data).toHaveLength(0);
    expect((await pr.post(`/examinations/${examId}/publish`).send({})).status).toBe(200);
    expect(await Notification.countDocuments({ user: w.parentUser._id, type: 'results' })).toBe(1);
  });

  it('parents see published results with correct totals, percentage, grade and failed subjects', async () => {
    const p = await login(a, w.parentUser.email);
    const r = await p.get(`/results/student/${w.s1._id}`);
    const res = r.body.data[0];
    expect(res.total).toBe(175);
    expect(res.max).toBe(200);
    expect(res.percentage).toBe(87.5);
    expect(res.grade).toBe('A');
    expect(res.result).toBe('PASS');
    const p2 = await login(a, w.otherParentUser.email);
    const fail = (await p2.get(`/results/student/${w.s2._id}`)).body.data[0];
    expect(fail.result).toBe('FAIL');
    expect(fail.failedSubjects).toEqual(['Mathematics']);
    expect(fail.percentage).toBe(50);
  });

  it('marksheet PDF respects ownership', async () => {
    const p = await login(a, w.parentUser.email);
    const pdf = await p.get(`/results/student/${w.s1._id}/marksheet.pdf?examId=${examId}`).buffer(true).parse((res, cb) => { const c: Buffer[] = []; res.on('data', (d: Buffer) => c.push(d)); res.on('end', () => cb(null, Buffer.concat(c))); });
    expect(pdf.status).toBe(200);
    expect((pdf.body as Buffer).slice(0, 4).toString()).toBe('%PDF');
    expect((await p.get(`/results/student/${w.s2._id}/marksheet.pdf?examId=${examId}`)).status).toBe(404);
  });

  it('published results cannot be edited; only a reasoned reopen by leadership allows changes (audited)', async () => {
    const admin = await login(a, w.admin.email);
    expect((await admin.post(`/examinations/${examId}/marks`).send({ sectionId: String(w.secA._id), entries: [{ studentId: String(w.s1._id), subjectId: String(w.math._id), marks: 100 }] })).status).toBe(409);
    const t = await login(a, w.teacherUser.email);
    expect((await t.post(`/examinations/${examId}/reopen`).send({ reason: 'typo' })).status).toBe(403);
    const pr = await login(a, w.principal.email);
    expect((await pr.post(`/examinations/${examId}/reopen`).send({})).status).toBe(400);
    expect((await pr.post(`/examinations/${examId}/reopen`).send({ reason: 'Marks correction approved' })).status).toBe(200);
    const e = await Examination.findById(examId);
    expect(e!.audit.at(-1)!.reason).toBe('Marks correction approved');
    expect(e!.status).toBe('marks_entry');
  });

  it('class rankings use competition ranking', async () => {
    const pr = await login(a, w.principal.email);
    const r = await pr.get(`/results/class/${examId}/rankings`);
    expect(r.body.data[0].rank).toBe(1);
    expect(r.body.data.map((x: any) => x.total)).toEqual([...r.body.data.map((x: any) => x.total)].sort((x: number, y: number) => y - x));
  });
});
