import { Schema, model } from 'mongoose';

export const ANNOUNCEMENT_CATEGORIES = [
  'general',
  'holiday',
  'examination',
  'parent-meeting',
  'event',
  'admission',
  'circular',
] as const;

const AnnouncementSchema = new Schema(
  {
    title: { type: String, required: true, trim: true, maxlength: 200 },
    body: { type: String, required: true, trim: true },
    category: { type: String, enum: ANNOUNCEMENT_CATEGORIES, default: 'general', index: true },
    audience: { type: String, enum: ['public', 'parents', 'students', 'staff'], default: 'public', index: true },
    sections: [{ type: Schema.Types.ObjectId, ref: 'Section' }],
    isPublished: { type: Boolean, default: false, index: true },
    publishedAt: { type: Date },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
    deletedAt: { type: Date, default: null },
  },
  { timestamps: true },
);
AnnouncementSchema.index({ isPublished: 1, audience: 1, publishedAt: -1 });

export const Announcement = model('Announcement', AnnouncementSchema);
