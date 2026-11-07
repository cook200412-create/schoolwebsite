import { Schema, model } from 'mongoose';
const ref = (to: string, extra: object = {}) => ({ type: Schema.Types.ObjectId, ref: to, ...extra });

const BookSchema = new Schema(
  {
    title: { type: String, required: true },
    author: String,
    isbn: { type: String, unique: true, sparse: true },
    category: { type: String, index: true },
    copies: { type: Number, default: 1, min: 0 },
    available: { type: Number, default: 1, min: 0 },
    shelf: String,
    deletedAt: { type: Date, default: null },
  },
  { timestamps: true },
);
BookSchema.index({ title: 'text', author: 'text' });
export const Book = model('Book', BookSchema);

export const BookIssue = model(
  'BookIssue',
  new Schema(
    {
      book: ref('Book', { required: true }),
      student: ref('Student', { required: true, index: true }),
      issuedOn: { type: Date, default: Date.now },
      dueDate: { type: Date, required: true },
      returnedOn: Date,
      fine: { type: Number, default: 0 },
      issuedBy: ref('User'),
    },
    { timestamps: true },
  ),
);

export const Vehicle = model(
  'Vehicle',
  new Schema(
    {
      registrationNumber: { type: String, required: true, unique: true, uppercase: true },
      type: String,
      capacity: Number,
      driver: { name: String, phone: String, licenseNumber: String },
      insuranceExpiry: Date,
      fitnessExpiry: Date,
      deletedAt: { type: Date, default: null },
    },
    { timestamps: true },
  ),
);

export const TransportRoute = model(
  'TransportRoute',
  new Schema(
    {
      name: { type: String, required: true, unique: true },
      vehicle: ref('Vehicle'),
      stops: [{ name: String, order: Number, pickupTime: String }],
      monthlyFee: { type: Number, default: 0 },
      deletedAt: { type: Date, default: null },
    },
    { timestamps: true },
  ),
);

export const DocumentModel = model(
  'Document',
  new Schema(
    {
      owner: ref('User'),
      student: ref('Student'),
      admission: ref('Admission'),
      originalName: String,
      mimeType: String,
      size: Number,
      storage: { type: String, enum: ['local', 'cloudinary'], default: 'local' },
      key: { type: String, required: true },
      visibility: { type: String, enum: ['private', 'public'], default: 'private' },
    },
    { timestamps: true },
  ),
);

export const AuditLog = model(
  'AuditLog',
  new Schema(
    {
      actor: ref('User', { index: true }),
      actorRole: String,
      action: { type: String, required: true, index: true },
      entity: String,
      entityId: String,
      meta: Schema.Types.Mixed,
      ip: String,
    },
    { timestamps: { createdAt: true, updatedAt: false } },
  ),
);

export const GalleryImage = model(
  'GalleryImage',
  new Schema(
    {
      url: { type: String, required: true },
      caption: String,
      category: {
        type: String,
        enum: ['campus', 'classroom', 'sports', 'annual-day', 'cultural', 'trips', 'competitions'],
        default: 'campus',
        index: true,
      },
      hasStudents: { type: Boolean, default: false },
      consentConfirmed: { type: Boolean, default: false },
      isPublished: { type: Boolean, default: true },
      deletedAt: { type: Date, default: null },
    },
    { timestamps: true },
  ),
);
