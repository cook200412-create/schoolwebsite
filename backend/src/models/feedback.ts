import { Schema, model } from 'mongoose';
const ref = (to: string, extra: object = {}) => ({ type: Schema.Types.ObjectId, ref: to, ...extra });

export const COMPLAINT_CATEGORIES = ['teacher', 'academic', 'fees', 'transport', 'safety', 'facilities', 'other'] as const;
export const COMPLAINT_STATUSES = ['open', 'in_review', 'resolved', 'closed'] as const;

const ComplaintSchema = new Schema(
  {
    ticketNumber: { type: String, required: true, unique: true },
    parentUser: ref('User', { required: true, index: true }),
    student: ref('Student'),
    category: { type: String, enum: COMPLAINT_CATEGORIES, required: true, index: true },
    subject: { type: String, required: true, trim: true, maxlength: 200 },
    description: { type: String, required: true, trim: true, maxlength: 5000 },
    priority: { type: String, enum: ['normal', 'high'], default: 'normal' },
    status: { type: String, enum: COMPLAINT_STATUSES, default: 'open', index: true },
    assignedTo: ref('User'),
    replies: [
      {
        by: ref('User'),
        byName: String,
        byRole: String,
        text: { type: String, required: true, maxlength: 4000 },
        internal: { type: Boolean, default: false },
        at: { type: Date, default: Date.now },
      },
    ],
    resolvedAt: Date,
    deletedAt: { type: Date, default: null },
  },
  { timestamps: true },
);
export const Complaint = model('Complaint', ComplaintSchema);

export const REMARK_CATEGORIES = ['positive', 'improvement', 'concern', 'general'] as const;
const RemarkSchema = new Schema(
  {
    student: ref('Student', { required: true, index: true }),
    section: ref('Section', { required: true }),
    subject: ref('Subject'),
    teacherUser: ref('User', { required: true, index: true }),
    teacherName: String,
    category: { type: String, enum: REMARK_CATEGORIES, default: 'general' },
    text: { type: String, required: true, trim: true, maxlength: 2000 },
    visibleToParent: { type: Boolean, default: true },
    deletedAt: { type: Date, default: null },
  },
  { timestamps: true },
);
export const Remark = model('Remark', RemarkSchema);
