import { Schema, model } from 'mongoose';

const EventSchema = new Schema(
  {
    title: { type: String, required: true, trim: true, maxlength: 200 },
    description: { type: String, trim: true },
    startsAt: { type: Date, required: true, index: true },
    endsAt: { type: Date },
    location: { type: String, trim: true },
    type: { type: String, enum: ['event', 'holiday', 'exam', 'meeting'], default: 'event' },
    isPublic: { type: Boolean, default: true },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
    deletedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

export const Event = model('Event', EventSchema);
