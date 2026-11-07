import { Schema, model } from 'mongoose';

export const Achievement = model(
  'Achievement',
  new Schema(
    {
      title: { type: String, required: true },
      description: String,
      category: { type: String, enum: ['academic', 'topper', 'award', 'competition', 'statistic'], required: true, index: true },
      year: String,
      studentName: String,
      consentConfirmed: { type: Boolean, default: false },
      isPublished: { type: Boolean, default: false },
      deletedAt: { type: Date, default: null },
    },
    { timestamps: true },
  ),
);
