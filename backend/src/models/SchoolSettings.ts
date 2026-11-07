import { Schema, model } from 'mongoose';

/**
 * Single-document collection (key = "default") holding every piece of
 * school-specific, admin-editable information so nothing is hardcoded in code.
 */
const SchoolSettingsSchema = new Schema(
  {
    key: { type: String, default: 'default', unique: true },
    schoolName: { type: String, required: true, trim: true },
    shortName: { type: String, trim: true },
    tagline: { type: String, trim: true },
    logoUrl: { type: String },
    heroImageUrl: { type: String },
    address: { type: String, trim: true },
    phone: { type: String, trim: true },
    email: { type: String, trim: true, lowercase: true },
    officeTimings: { type: String, trim: true },
    mapEmbedUrl: { type: String },
    social: {
      facebook: String,
      instagram: String,
      youtube: String,
      x: String,
    },
    admissionOpen: { type: Boolean, default: false },
    admissionBanner: { type: String, trim: true },
    academicYear: { type: String, trim: true },
    principal: {
      name: { type: String, trim: true },
      message: { type: String, trim: true },
      photoUrl: String,
    },
    vision: { type: String, trim: true },
    mission: { type: String, trim: true },
    libraryFinePerDay: { type: Number, default: 500 }, // paise
    notificationTemplates: { type: Map, of: String },
    academicContent: {
      history: String, philosophy: String, methodology: String, examinationSystem: String,
      management: [{ name: String, role: String }], infrastructure: String, calendarNote: String,
    },
    stats: [{ label: { type: String, required: true }, value: { type: String, required: true } }],
    /** Only facilities with confirmed=true are published on the website. */
    facilities: [
      {
        slug: { type: String, required: true },
        title: { type: String, required: true },
        description: { type: String },
        icon: { type: String },
        confirmed: { type: Boolean, default: false },
      },
    ],
  },
  { timestamps: true },
);

export const SchoolSettings = model('SchoolSettings', SchoolSettingsSchema);
