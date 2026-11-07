import { connectDb, disconnectDb } from './config/db';
import { env } from './config/env';
import { ROLES, ROLE_PERMISSIONS } from './config/permissions';
import { AcademicYear, ClassModel, Section, Subject, Timetable } from './models/academic';
import { Announcement } from './models/Announcement';
import { Attendance } from './models/attendance';
import { Event } from './models/Event';
import { Complaint, Remark } from './models/feedback';
import { ExamResult, Examination } from './models/exam';
import { FeeStructure, StudentFee } from './models/finance';
import { Book, TransportRoute, Vehicle } from './models/operations';
import { Parent, Student, Teacher } from './models/people';
import { SchoolSettings } from './models/SchoolSettings';
import { Role, User } from './models/user';
import { hashPassword } from './services/auth.service';

/**
 * Seeds configuration + FICTIONAL demo records. Never run against real student data.
 * Facilities stay unpublished (confirmed=false); demo teachers are not public.
 * Demo login password comes from SEED_PASSWORD (default only for development).
 */
export async function seed() {
  if (env.isProd && process.env.ALLOW_DEMO_SEED !== 'true') throw new Error('Refusing to seed demo data in production (set ALLOW_DEMO_SEED=true to override).');
  const password = process.env.SEED_PASSWORD ?? 'Demo@12345678';
  const hash = await hashPassword(password);

  await SchoolSettings.findOneAndUpdate({ key: 'default' }, {
    $setOnInsert: {
      key: 'default', schoolName: 'Sri Satya Sai Vidyanikethan', shortName: 'SSSV',
      tagline: 'Education in human values – nurturing character, knowledge and service.',
      address: '[School address – configure in Admin ▸ Settings]', officeTimings: 'Monday – Saturday, 9:00 AM – 4:00 PM',
      admissionOpen: true, admissionBanner: 'Admissions are open for the upcoming academic year.', academicYear: '2026-27',
      principal: { name: '[Principal name]', message: 'Welcome to our school family. (Sample text – replace from Admin ▸ Settings.)' },
      vision: 'To nurture confident, compassionate and capable young people who serve society with integrity.',
      mission: 'To provide a safe, inclusive and joyful learning environment grounded in strong values, academic excellence and holistic development.',
      stats: [],
      facilities: [['classrooms', 'Classrooms'], ['science-labs', 'Science Laboratories'], ['computer-labs', 'Computer Laboratories'], ['library', 'Library'], ['sports', 'Sports & Playground'], ['transport', 'Transportation'], ['drinking-water', 'Drinking Water'], ['sanitation', 'Sanitation'], ['cctv', 'CCTV & Campus Safety'], ['smart-classrooms', 'Smart Classrooms'], ['extracurricular', 'Extracurricular Activities']].map(([slug, title]) => ({ slug, title, description: '', confirmed: false })),
    },
  }, { upsert: true });

  for (const name of ROLES) await Role.updateOne({ name }, { $setOnInsert: { name, permissions: ROLE_PERMISSIONS[name] } }, { upsert: true });

  const year = await AcademicYear.findOneAndUpdate({ name: '2026-27' }, { $setOnInsert: { name: '2026-27', startDate: new Date('2026-06-01'), endDate: new Date('2027-04-30'), isCurrent: true } }, { upsert: true, new: true });

  const levels: [string, any, number][] = [['LKG', 'pre-primary', 0], ['1', 'primary', 1], ['5', 'primary', 5], ['8', 'middle', 8], ['10', 'secondary', 10]];
  const classes: Record<string, any> = {}; const sections: Record<string, any> = {};
  for (const [name, level, order] of levels) {
    classes[name] = await ClassModel.findOneAndUpdate({ name }, { $setOnInsert: { name, level, order } }, { upsert: true, new: true });
    sections[name] = await Section.findOneAndUpdate({ class: classes[name]._id, name: 'A' }, { $setOnInsert: { class: classes[name]._id, name: 'A' } }, { upsert: true, new: true });
  }
  const subjects: Record<string, any> = {};
  for (const [code, name] of [['MAT', 'Mathematics'], ['SCI', 'Science'], ['ENG', 'English'], ['SOC', 'Social Studies']]) {
    subjects[code] = await Subject.findOneAndUpdate({ code }, { $setOnInsert: { code, name, classes: Object.values(classes).map((c: any) => c._id) } }, { upsert: true, new: true });
  }

  const mkUser = async (email: string, name: string, role: string) => (await User.findOne({ email })) ?? User.create({ email, name, role, passwordHash: hash });
  const users: Record<string, any> = {};
  for (const r of ROLES) users[r] = await mkUser(`${r.replace('_', '.')}@demo.school`, `Demo ${r.replace('_', ' ')}`, r);

  const teacher = (await Teacher.findOne({ user: users.teacher._id })) ?? await Teacher.create({
    user: users.teacher._id, employeeId: 'T-DEMO-1', name: 'Demo Teacher', designation: 'Mathematics Teacher', isPublic: false,
    assignments: Object.keys(subjects).map((c) => ({ class: classes['8']._id, section: sections['8']._id, subject: subjects[c]._id })), classTeacherOf: sections['8']._id,
  });

  const kids = [['Rahul', 'Kumar'], ['Ananya', 'Reddy'], ['Kiran', 'Sharma'], ['Meera', 'Nair'], ['Arjun', 'Das']];
  const students: any[] = [];
  for (const [i, [firstName, lastName]] of kids.entries()) {
    const admissionNumber = `DEMO-ADM-${i + 1}`;
    students.push((await Student.findOne({ admissionNumber })) ?? await Student.create({
      admissionNumber, studentId: `DEMO-STU-${i + 1}`, firstName, lastName, dob: new Date(`2013-0${i + 1}-15`), gender: i % 2 ? 'female' : 'male',
      class: classes['8']._id, section: sections['8']._id, rollNumber: i + 1, academicYear: year._id,
      history: [{ academicYear: year._id, class: classes['8']._id, section: sections['8']._id, action: 'admitted' }],
    }));
  }
  const parent = (await Parent.findOne({ user: users.parent._id })) ?? await Parent.create({ user: users.parent._id, consent: { given: true, at: new Date(), policyVersion: '1.0' } });
  await Parent.updateOne({ _id: parent._id }, { $addToSet: { children: { $each: [students[0]._id, students[1]._id] } } });
  await Student.updateMany({ _id: { $in: [students[0]._id, students[1]._id] } }, { $addToSet: { parents: parent._id } });
  await Student.updateOne({ _id: students[0]._id }, { user: users.student._id });

  const today = new Date().toISOString().slice(0, 10);
  for (const s of students) await Attendance.updateOne({ student: s._id, date: today }, { $setOnInsert: { class: classes['8']._id, section: sections['8']._id, status: 'present', markedBy: users.teacher._id } }, { upsert: true });

  const exam = (await Examination.findOne({ name: 'Term 1 (demo)' })) ?? await Examination.create({
    name: 'Term 1 (demo)', academicYear: year._id, class: classes['8']._id, status: 'published', publishedAt: new Date(),
    subjects: Object.values(subjects).map((s: any) => ({ subject: s._id, maxMarks: 100, passMarks: 35 })),
  });
  const rahul = { MAT: 85, SCI: 90, ENG: 78, SOC: 88 } as Record<string, number>;
  for (const [i, s] of students.entries()) for (const code of Object.keys(subjects)) {
    await ExamResult.updateOne({ examination: exam._id, student: s._id, subject: subjects[code]._id }, { $setOnInsert: { marks: i === 0 ? rahul[code] : 55 + ((i * 7 + code.length * 5) % 40), enteredBy: users.teacher._id } }, { upsert: true });
  }

  const structure = (await FeeStructure.findOne({ name: 'Class 8 Annual (demo)' })) ?? await FeeStructure.create({
    name: 'Class 8 Annual (demo)', class: classes['8']._id, academicYear: year._id, lateFeePerDay: 1000,
    items: [{ name: 'Tuition', type: 'tuition', amount: 4500000, dueDate: new Date('2026-07-10') }, { name: 'Examination', type: 'examination', amount: 300000, dueDate: new Date('2026-07-10') }],
  });
  for (const s of students) await StudentFee.updateOne({ student: s._id, academicYear: year._id, structure: structure._id }, { $setOnInsert: { items: structure.items.map((i: any) => ({ name: i.name, type: i.type, amount: i.amount, dueDate: i.dueDate })), totalDue: 4800000, paid: 0 } }, { upsert: true });

  const days = [1, 2, 3, 4, 5];
  for (const day of days) await Timetable.updateOne({ section: sections['8']._id, day }, { $setOnInsert: { academicYear: year._id, periods: ['MAT', 'ENG', 'SCI', 'SOC'].map((c, i) => ({ period: i + 1, startTime: `${9 + i}:00`, endTime: `${9 + i}:45`, subject: subjects[c]._id, teacher: teacher._id, room: '8A' })) } }, { upsert: true });

  if (!(await Book.countDocuments())) await Book.create([{ title: 'Wings of Fire', author: 'A. P. J. Abdul Kalam', isbn: '9788173711466', category: 'Biography', copies: 3, available: 3 }, { title: 'Malgudi Days', author: 'R. K. Narayan', isbn: '9788185986173', category: 'Fiction', copies: 2, available: 2 }]);
  if (!(await Vehicle.countDocuments())) { const v = await Vehicle.create({ registrationNumber: 'TS09DEMO1234', type: 'Bus', capacity: 40, driver: { name: 'Demo Driver' } }); await TransportRoute.create({ name: 'Route 1 (demo)', vehicle: v._id, monthlyFee: 120000, stops: [{ name: 'Stop A', order: 1, pickupTime: '07:30' }] }); }
  if (!(await Announcement.countDocuments())) await Announcement.create({ title: 'Admissions open for the new academic year', body: 'Online applications are now being accepted. Visit the Admissions page to apply.', category: 'admission', isPublished: true, publishedAt: new Date() });
  if (!(await Event.countDocuments())) await Event.create({ title: 'Parent–Teacher Meeting (sample event)', startsAt: new Date(Date.now() + 21 * 86400000), type: 'meeting', location: 'School campus' });

  if (!(await Remark.countDocuments())) {
    await Remark.create([
      { student: students[0]._id, section: sections['8']._id, subject: subjects.MAT._id, teacherUser: users.teacher._id, teacherName: 'Demo Teacher', category: 'positive', text: 'Rahul solves problems methodically and helps classmates. Keep it up!' },
      { student: students[0]._id, section: sections['8']._id, subject: subjects.ENG._id, teacherUser: users.teacher._id, teacherName: 'Demo Teacher', category: 'improvement', text: 'Practise handwriting and read one short story a week to improve English expression.' },
    ]);
  }
  if (!(await Complaint.countDocuments())) {
    await Complaint.create({ ticketNumber: 'CMP202600001', parentUser: users.parent._id, student: students[0]._id, category: 'transport', subject: 'Bus pickup time', description: 'The morning pickup has been 15 minutes late this week. Please look into it.', replies: [{ by: users.principal._id, byName: 'Demo principal', byRole: 'principal', text: 'Thank you for reporting. We have spoken to the transport manager.' }], status: 'in_review' });
  }

  return { password, logins: ROLES.map((r) => `${r.replace('_', '.')}@demo.school`) };
}

if (require.main === module) {
  (async () => {
    await connectDb();
    const r = await seed();
    console.log('[seed] done. Demo logins (password from SEED_PASSWORD or default Demo@12345678):\n  ' + r.logins.join('\n  '));
    await disconnectDb();
  })().catch((e) => { console.error(e); process.exit(1); });
}
