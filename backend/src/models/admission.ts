import { Schema, model } from 'mongoose';
const ref = (to: string, extra: object = {}) => ({ type: Schema.Types.ObjectId, ref: to, ...extra });

export const ADMISSION_STATUSES = ['submitted', 'under_review', 'documents_required', 'approved', 'rejected', 'waitlisted'] as const;

const AdmissionSchema = new Schema(
  {
    applicationNumber: { type: String, required: true, unique: true },
    dedupeKey: { type: String, required: true, unique: true },
    student: {
      firstName: { type: String, required: true, trim: true },
      lastName: { type: String, trim: true, default: '' },
      dob: { type: Date, required: true },
      gender: { type: String, enum: ['male', 'female', 'other'], required: true },
    },
    guardian: {
      name: { type: String, required: true },
      relation: { type: String, default: 'parent' },
      phone: { type: String, required: true },
      email: { type: String, required: true, lowercase: true },
      occupation: String,
    },
    address: { line1: String, city: String, state: String, pincode: String },
    previousSchool: { name: String, lastClass: String, marks: String },
    classApplying: { type: String, required: true },
    academicYear: { type: String, required: true },
    documents: [
      {
        type: { type: String, enum: ['birth_certificate', 'previous_record', 'photograph', 'other'] },
        document: ref('Document'),
        verified: { type: Boolean, default: false },
      },
    ],
    consent: { given: { type: Boolean, required: true }, at: Date, ip: String, policyVersion: String },
    status: { type: String, enum: ADMISSION_STATUSES, default: 'submitted', index: true },
    statusHistory: [{ status: String, by: ref('User'), at: { type: Date, default: Date.now }, note: String }],
    notes: [{ by: ref('User'), text: String, at: { type: Date, default: Date.now } }],
    interview: { scheduledAt: Date, venue: String },
    convertedStudent: ref('Student'),
    deletedAt: { type: Date, default: null },
  },
  { timestamps: true },
);
AdmissionSchema.index({ 'guardian.phone': 1 });
export const Admission = model('Admission', AdmissionSchema);

export const Enquiry = model(
  'Enquiry',
  new Schema(
    {
      name: { type: String, required: true },
      email: String,
      phone: { type: String, required: true },
      message: { type: String, required: true },
      kind: { type: String, enum: ['admission', 'contact'], default: 'contact' },
      classInterested: String,
      status: { type: String, enum: ['new', 'contacted', 'closed'], default: 'new' },
    },
    { timestamps: true },
  ),
);
