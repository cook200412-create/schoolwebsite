import { randomUUID } from 'crypto';
import mongoose from 'mongoose';
import request from 'supertest';
import { AcademicYear, ClassModel, Section, Subject } from '../src/models/academic';
import { Parent, Student, Teacher } from '../src/models/people';
import { User } from '../src/models/user';
import { hashPassword } from '../src/services/auth.service';
import { createApp } from '../src/app';

export const PASSWORD = 'Str0ngPassw0rd!';

export async function connectTestDb() {
  const uri = process.env.TEST_MONGO_URI!;
  await mongoose.connect(uri, { dbName: `t_${randomUUID().replace(/-/g, '').slice(0, 16)}` });
  await mongoose.connection.syncIndexes?.().catch(() => undefined);
  await Promise.all(Object.values(mongoose.models).map((m) => m.init()));
}
export async function closeTestDb() {
  await mongoose.connection.dropDatabase();
  await mongoose.disconnect();
}

export const app = () => createApp();

export interface Client {
  get: (u: string) => request.Test;
  post: (u: string) => request.Test;
  put: (u: string) => request.Test;
  patch: (u: string) => request.Test;
  del: (u: string) => request.Test;
  cookies: string;
  csrf: string;
}

/** Authenticated client that behaves like a browser: sends cookies + CSRF header. */
export async function login(a: ReturnType<typeof createApp>, email: string, password = PASSWORD): Promise<Client> {
  const res = await request(a).post('/api/auth/login').send({ email, password });
  if (res.status !== 200) throw new Error(`login failed for ${email}: ${res.status} ${JSON.stringify(res.body)}`);
  const set = (res.headers['set-cookie'] as unknown as string[]) ?? [];
  const cookies = set.map((c) => c.split(';')[0]).join('; ');
  const csrf = set.find((c) => c.startsWith('csrf_token='))!.split(';')[0].split('=')[1];
  const wrap = (m: 'get' | 'post' | 'put' | 'patch' | 'delete') => (u: string) => {
    const t = request(a)[m](`/api${u}`).set('Cookie', cookies);
    return m === 'get' ? t : t.set('X-CSRF-Token', csrf);
  };
  return { get: wrap('get'), post: wrap('post'), put: wrap('put'), patch: wrap('patch'), del: wrap('delete'), cookies, csrf };
}

export async function mkUser(role: string, email?: string, extra: object = {}) {
  return User.create({ name: `Test ${role}`, email: email ?? `${role}-${randomUUID().slice(0, 6)}@t.school`, role, passwordHash: await hashPassword(PASSWORD), ...extra });
}

/** A small school: 1 year, class 8, sections A/B, 2 subjects, teacher (assigned to 8A), students, parent with 1 child. */
export async function world() {
  const year = await AcademicYear.create({ name: '2026-27', startDate: new Date('2026-06-01'), endDate: new Date('2027-04-30'), isCurrent: true });
  const cls = await ClassModel.create({ name: '8', level: 'middle', order: 8 });
  const secA = await Section.create({ class: cls._id, name: 'A' });
  const secB = await Section.create({ class: cls._id, name: 'B' });
  const math = await Subject.create({ name: 'Mathematics', code: 'MAT', classes: [cls._id] });
  const sci = await Subject.create({ name: 'Science', code: 'SCI', classes: [cls._id] });

  const admin = await mkUser('school_admin');
  const superAdmin = await mkUser('super_admin');
  const principal = await mkUser('principal');
  const accountant = await mkUser('accountant');
  const teacherUser = await mkUser('teacher');
  const otherTeacherUser = await mkUser('teacher');
  const teacher = await Teacher.create({ user: teacherUser._id, employeeId: 'T1', name: 'Tina Teacher', assignments: [{ class: cls._id, section: secA._id, subject: math._id }, { class: cls._id, section: secA._id, subject: sci._id }], classTeacherOf: secA._id });
  await Teacher.create({ user: otherTeacherUser._id, employeeId: 'T2', name: 'Other Teacher', assignments: [{ class: cls._id, section: secB._id, subject: math._id }] });

  const mkStudent = (n: number, section = secA, extra: object = {}) =>
    Student.create({ admissionNumber: `A${n}${randomUUID().slice(0, 4)}`, studentId: `S${n}${randomUUID().slice(0, 4)}`, firstName: `Kid${n}`, lastName: 'Test', dob: new Date('2013-01-01'), gender: 'male', class: cls._id, section: section._id, rollNumber: n, academicYear: year._id, ...extra });
  const s1 = await mkStudent(1); const s2 = await mkStudent(2); const sB = await mkStudent(3, secB);

  const parentUser = await mkUser('parent');
  const parent = await Parent.create({ user: parentUser._id, children: [s1._id] });
  await Student.updateOne({ _id: s1._id }, { parents: [parent._id] });
  const otherParentUser = await mkUser('parent');
  const otherParent = await Parent.create({ user: otherParentUser._id, children: [s2._id] });
  await Student.updateOne({ _id: s2._id }, { parents: [otherParent._id] });
  const studentUser = await mkUser('student');
  await Student.updateOne({ _id: s1._id }, { user: studentUser._id });

  return { year, cls, secA, secB, math, sci, admin, superAdmin, principal, accountant, teacherUser, otherTeacherUser, teacher, s1, s2, sB, parentUser, otherParentUser, parent, studentUser, mkStudent };
}
