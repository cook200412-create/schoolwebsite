import { Schema, model } from 'mongoose';
const ref = (to: string, extra: object = {}) => ({ type: Schema.Types.ObjectId, ref: to, ...extra });

const NotificationSchema = new Schema(
  {
    user: ref('User', { required: true, index: true }),
    title: { type: String, required: true },
    body: String,
    type: { type: String, default: 'general' },
    link: String,
    readAt: Date,
  },
  { timestamps: true },
);
NotificationSchema.index({ user: 1, readAt: 1, createdAt: -1 });
export const Notification = model('Notification', NotificationSchema);

export const Message = model(
  'Message',
  new Schema(
    {
      threadKey: { type: String, required: true, index: true },
      from: ref('User', { required: true }),
      to: ref('User', { required: true, index: true }),
      student: ref('Student'),
      body: { type: String, required: true, maxlength: 4000 },
      readAt: Date,
    },
    { timestamps: true },
  ),
);
