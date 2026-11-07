import { Schema, model } from 'mongoose';
const ref = (to: string, extra: object = {}) => ({ type: Schema.Types.ObjectId, ref: to, ...extra });

export const AcademicYear = model(
  'AcademicYear',
  new Schema(
    {
      name: { type: String, required: true, unique: true },
      startDate: { type: Date, required: true },
      endDate: { type: Date, required: true },
      isCurrent: { type: Boolean, default: false },
      deletedAt: { type: Date, default: null },
    },
    { timestamps: true },
  ),
);

export const ClassModel = model(
  'Class',
  new Schema(
    {
      name: { type: String, required: true, unique: true, trim: true },
      level: { type: String, enum: ['pre-primary', 'primary', 'middle', 'secondary'], required: true },
      order: { type: Number, default: 0 },
      description: String,
      curriculum: String,
      deletedAt: { type: Date, default: null },
    },
    { timestamps: true },
  ),
);

const SectionSchema = new Schema(
  {
    class: ref('Class', { required: true, index: true }),
    name: { type: String, required: true, trim: true },
    classTeacher: ref('Teacher'),
    capacity: { type: Number, default: 40 },
    room: String,
    deletedAt: { type: Date, default: null },
  },
  { timestamps: true },
);
SectionSchema.index({ class: 1, name: 1 }, { unique: true });
export const Section = model('Section', SectionSchema);

export const Subject = model(
  'Subject',
  new Schema(
    {
      name: { type: String, required: true, trim: true },
      code: { type: String, required: true, unique: true, uppercase: true },
      classes: [ref('Class')],
      isOptional: { type: Boolean, default: false },
      deletedAt: { type: Date, default: null },
    },
    { timestamps: true },
  ),
);

const TimetableSchema = new Schema(
  {
    section: ref('Section', { required: true }),
    academicYear: ref('AcademicYear'),
    day: { type: Number, min: 1, max: 7, required: true },
    periods: [
      {
        period: { type: Number, required: true },
        startTime: { type: String, required: true },
        endTime: { type: String, required: true },
        subject: ref('Subject'),
        teacher: ref('Teacher'),
        room: String,
      },
    ],
  },
  { timestamps: true },
);
TimetableSchema.index({ section: 1, day: 1 }, { unique: true });
export const Timetable = model('Timetable', TimetableSchema);
