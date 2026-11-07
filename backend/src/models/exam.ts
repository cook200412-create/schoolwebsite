import { Schema, model } from 'mongoose';
const ref = (to: string, extra: object = {}) => ({ type: Schema.Types.ObjectId, ref: to, ...extra });

export const DEFAULT_GRADING = [
  { min: 90, grade: 'A+' }, { min: 80, grade: 'A' }, { min: 70, grade: 'B+' }, { min: 60, grade: 'B' },
  { min: 50, grade: 'C' }, { min: 40, grade: 'D' }, { min: 0, grade: 'F' },
];

export const Examination = model(
  'Examination',
  new Schema(
    {
      name: { type: String, required: true },
      type: { type: String, enum: ['unit_test', 'term', 'half_yearly', 'annual', 'other'], default: 'term' },
      term: String,
      academicYear: ref('AcademicYear', { required: true }),
      class: ref('Class', { required: true, index: true }),
      subjects: [
        {
          subject: ref('Subject', { required: true }),
          maxMarks: { type: Number, required: true, min: 1 },
          passMarks: { type: Number, required: true, min: 0 },
        },
      ],
      gradingScale: { type: [{ min: Number, grade: String }], default: DEFAULT_GRADING },
      status: { type: String, enum: ['draft', 'marks_entry', 'submitted', 'approved', 'published'], default: 'marks_entry', index: true },
      approvedBy: ref('User'),
      publishedAt: Date,
      audit: [{ action: String, by: ref('User'), at: { type: Date, default: Date.now }, reason: String }],
      deletedAt: { type: Date, default: null },
    },
    { timestamps: true },
  ),
);

const ExamResultSchema = new Schema(
  {
    examination: ref('Examination', { required: true, index: true }),
    student: ref('Student', { required: true, index: true }),
    subject: ref('Subject', { required: true }),
    marks: { type: Number, min: 0, default: 0 },
    absent: { type: Boolean, default: false },
    remarks: String,
    enteredBy: ref('User'),
  },
  { timestamps: true },
);
ExamResultSchema.index({ examination: 1, student: 1, subject: 1 }, { unique: true });
export const ExamResult = model('ExamResult', ExamResultSchema);
