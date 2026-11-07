import { Schema, model } from 'mongoose';
const ref = (to: string, extra: object = {}) => ({ type: Schema.Types.ObjectId, ref: to, ...extra });

const AttendanceSchema = new Schema(
  {
    student: ref('Student', { required: true }),
    class: ref('Class', { required: true }),
    section: ref('Section', { required: true, index: true }),
    date: { type: String, required: true, match: /^\d{4}-\d{2}-\d{2}$/ },
    status: { type: String, enum: ['present', 'absent', 'late', 'leave'], required: true },
    markedBy: ref('User', { required: true }),
    history: [{ status: String, by: ref('User'), at: { type: Date, default: Date.now }, reason: String }],
  },
  { timestamps: true },
);
AttendanceSchema.index({ student: 1, date: 1 }, { unique: true });
AttendanceSchema.index({ section: 1, date: 1 });
export const Attendance = model('Attendance', AttendanceSchema);

export const LeaveApplication = model(
  'LeaveApplication',
  new Schema(
    {
      applicant: ref('User', { required: true }),
      kind: { type: String, enum: ['student', 'staff'], required: true },
      student: ref('Student'),
      childName: { type: String, trim: true, maxlength: 120 },
      fromDate: { type: String, required: true },
      toDate: { type: String, required: true },
      reason: { type: String, required: true },
      status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending', index: true },
      decidedBy: ref('User'),
      decisionNote: String,
      decidedAt: Date,
    },
    { timestamps: true },
  ),
);
