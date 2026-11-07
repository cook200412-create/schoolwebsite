import { Schema, model } from 'mongoose';

const ref = (to: string, extra: object = {}) => ({ type: Schema.Types.ObjectId, ref: to, ...extra });

const StudentSchema = new Schema(
  {
    user: ref('User', { index: true, sparse: true }),
    admissionNumber: { type: String, required: true, unique: true, trim: true },
    studentId: { type: String, required: true, unique: true, trim: true },
    firstName: { type: String, required: true, trim: true },
    lastName: { type: String, trim: true, default: '' },
    dob: { type: Date, required: true },
    gender: { type: String, enum: ['male', 'female', 'other'], required: true },
    photoUrl: String,
    photoConsent: { type: Boolean, default: false },
    class: ref('Class', { required: true, index: true }),
    section: ref('Section', { required: true, index: true }),
    rollNumber: { type: Number },
    academicYear: ref('AcademicYear', { required: true, index: true }),
    parents: [ref('Parent')],
    phone: String,
    address: { line1: String, city: String, state: String, pincode: String },
    emergencyContact: { name: String, phone: String, relation: String },
    previousSchool: { name: String, lastClass: String },
    transportRoute: ref('TransportRoute'),
    status: { type: String, enum: ['active', 'archived', 'transferred', 'alumni'], default: 'active', index: true },
    history: [
      {
        academicYear: ref('AcademicYear'),
        class: ref('Class'),
        section: ref('Section'),
        rollNumber: Number,
        action: { type: String, enum: ['admitted', 'promoted', 'transferred', 'archived', 'repeated'] },
        at: { type: Date, default: Date.now },
        note: String,
      },
    ],
    deletedAt: { type: Date, default: null },
  },
  { timestamps: true },
);
StudentSchema.index({ firstName: 'text', lastName: 'text', admissionNumber: 'text' });
StudentSchema.index({ section: 1, rollNumber: 1 });
export const Student = model('Student', StudentSchema);

export const Parent = model(
  'Parent',
  new Schema(
    {
      user: ref('User', { required: true, unique: true }),
      children: [ref('Student')],
      phone: String,
      occupation: String,
      address: String,
      consent: { given: Boolean, at: Date, policyVersion: String, ip: String },
      deletedAt: { type: Date, default: null },
    },
    { timestamps: true },
  ),
);

export const Teacher = model(
  'Teacher',
  new Schema(
    {
      user: ref('User', { unique: true, sparse: true }),
      employeeId: { type: String, required: true, unique: true },
      name: { type: String, required: true, trim: true },
      designation: String,
      specialization: String,
      qualifications: [String],
      experienceYears: { type: Number, min: 0 },
      bio: String,
      photoUrl: String,
      phone: String,
      email: String,
      classesHandled: [String],
      assignments: [{ class: ref('Class'), section: ref('Section'), subject: ref('Subject') }],
      classTeacherOf: ref('Section'),
      isPublic: { type: Boolean, default: false },
      deletedAt: { type: Date, default: null },
    },
    { timestamps: true },
  ),
);

export const Staff = model(
  'Staff',
  new Schema(
    {
      user: ref('User', { unique: true, sparse: true }),
      employeeId: { type: String, required: true, unique: true },
      name: { type: String, required: true },
      department: String,
      designation: String,
      phone: String,
      email: String,
      joinedOn: Date,
      deletedAt: { type: Date, default: null },
    },
    { timestamps: true },
  ),
);
