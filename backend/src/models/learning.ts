import { Schema, model } from 'mongoose';
const ref = (to: string, extra: object = {}) => ({ type: Schema.Types.ObjectId, ref: to, ...extra });

const taskFields = {
  teacher: ref('Teacher', { required: true }),
  class: ref('Class', { required: true }),
  section: ref('Section', { required: true, index: true }),
  subject: ref('Subject', { required: true }),
  title: { type: String, required: true },
  description: String,
  dueDate: { type: Date, required: true },
  attachments: [{ name: String, document: ref('Document') }],
  deletedAt: { type: Date, default: null },
};
export const Homework = model('Homework', new Schema({ ...taskFields }, { timestamps: true }));
export const Assignment = model('Assignment', new Schema({ ...taskFields, maxMarks: { type: Number, default: 10 } }, { timestamps: true }));

const SubmissionSchema = new Schema(
  {
    kind: { type: String, enum: ['homework', 'assignment'], required: true },
    task: { type: Schema.Types.ObjectId, required: true, index: true },
    student: ref('Student', { required: true }),
    content: String,
    attachments: [{ name: String, document: ref('Document') }],
    submittedAt: { type: Date, default: Date.now },
    late: Boolean,
    marks: Number,
    feedback: String,
    reviewedBy: ref('User'),
    reviewedAt: Date,
    status: { type: String, enum: ['submitted', 'reviewed'], default: 'submitted' },
  },
  { timestamps: true },
);
SubmissionSchema.index({ kind: 1, task: 1, student: 1 }, { unique: true });
export const AssignmentSubmission = model('AssignmentSubmission', SubmissionSchema);
