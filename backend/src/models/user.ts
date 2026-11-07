import { Schema, model } from 'mongoose';
import { ROLES } from '../config/permissions';

const UserSchema = new Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 120 },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    phone: { type: String, trim: true },
    passwordHash: { type: String, required: true, select: false },
    role: { type: String, enum: ROLES, required: true, index: true },
    isActive: { type: Boolean, default: true },
    mustChangePassword: { type: Boolean, default: false },
    failedLogins: { type: Number, default: 0 },
    lockUntil: { type: Date },
    lastLoginAt: { type: Date },
    resetTokenHash: { type: String, select: false },
    resetTokenExpires: { type: Date, select: false },
    fcmTokens: [String],
    deletedAt: { type: Date, default: null },
  },
  { timestamps: true },
);
export const User = model('User', UserSchema);

const RefreshTokenSchema = new Schema(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    tokenHash: { type: String, required: true, unique: true },
    family: { type: String, required: true, index: true },
    expiresAt: { type: Date, required: true, index: { expireAfterSeconds: 0 } },
    revokedAt: { type: Date },
    userAgent: String,
    ip: String,
  },
  { timestamps: true },
);
export const RefreshToken = model('RefreshToken', RefreshTokenSchema);

export const Role = model(
  'Role',
  new Schema(
    { name: { type: String, enum: ROLES, required: true, unique: true }, label: String, permissions: [String] },
    { timestamps: true },
  ),
);
