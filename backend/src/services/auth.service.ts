import argon2 from 'argon2';
import { randomUUID } from 'crypto';
import { env } from '../config/env';
import { Parent } from '../models/people';
import { RefreshToken, User } from '../models/user';
import { ApiError } from '../utils/http';
import { REFRESH_TTL_MS, randomToken, sha256, signAccess } from '../utils/security';
import { sendMail } from './mail.service';

const MAX_FAILS = 5;
const LOCK_MS = 15 * 60 * 1000;
// precomputed hash so unknown-email logins cost the same time as real ones
const DUMMY_HASH = argon2.hash('dummy-password-for-timing');

export const hashPassword = (p: string) => argon2.hash(p, { type: argon2.argon2id });

async function issueTokens(user: { _id: unknown; role: string }, meta: { ip?: string; ua?: string }, family: string = randomUUID()) {
  const refresh = randomToken();
  await RefreshToken.create({
    user: user._id, tokenHash: sha256(refresh), family,
    expiresAt: new Date(Date.now() + REFRESH_TTL_MS), ip: meta.ip, userAgent: meta.ua,
  });
  return { access: signAccess({ sub: String(user._id), role: user.role }), refresh };
}

export const publicUser = (u: any) => ({ id: String(u._id), name: u.name, email: u.email, role: u.role, phone: u.phone, mustChangePassword: u.mustChangePassword });

export async function register(input: { name: string; email: string; password: string; phone?: string; consent: boolean }, ip?: string) {
  if (await User.exists({ email: input.email })) throw ApiError.conflict('An account with this email already exists');
  const user = await User.create({ name: input.name, email: input.email, phone: input.phone, role: 'parent', passwordHash: await hashPassword(input.password) });
  await Parent.create({ user: user._id, phone: input.phone, consent: { given: true, at: new Date(), policyVersion: '1.0', ip } });
  return user;
}

export async function login(email: string, password: string, meta: { ip?: string; ua?: string }) {
  const user = await User.findOne({ email, deletedAt: null }).select('+passwordHash');
  if (!user) {
    await argon2.verify(await DUMMY_HASH, password).catch(() => false);
    throw ApiError.unauthorized('Invalid email or password');
  }
  if (user.lockUntil && user.lockUntil > new Date()) throw new ApiError(423, 'ACCOUNT_LOCKED', 'Too many failed attempts. Try again in 15 minutes.');
  const ok = await argon2.verify(user.passwordHash, password);
  if (!ok) {
    user.failedLogins += 1;
    if (user.failedLogins >= MAX_FAILS) { user.lockUntil = new Date(Date.now() + LOCK_MS); user.failedLogins = 0; }
    await user.save();
    throw ApiError.unauthorized('Invalid email or password');
  }
  if (!user.isActive) throw ApiError.forbidden('Account is disabled. Contact the school office.');
  user.failedLogins = 0; user.lockUntil = undefined; user.lastLoginAt = new Date();
  await user.save();
  return { user, tokens: await issueTokens(user, meta) };
}

export async function refresh(token: string | undefined, meta: { ip?: string; ua?: string }) {
  if (!token) throw ApiError.unauthorized();
  const rec = await RefreshToken.findOne({ tokenHash: sha256(token) });
  if (!rec) throw ApiError.unauthorized();
  if (rec.revokedAt) {
    // reuse of a rotated token → assume theft, kill the whole family
    await RefreshToken.updateMany({ family: rec.family }, { revokedAt: new Date() });
    throw ApiError.unauthorized('Session revoked');
  }
  if (rec.expiresAt < new Date()) throw ApiError.unauthorized('Session expired');
  const user = await User.findOne({ _id: rec.user, deletedAt: null });
  if (!user || !user.isActive) throw ApiError.unauthorized();
  rec.revokedAt = new Date();
  await rec.save();
  return { user, tokens: await issueTokens(user, meta, rec.family) };
}

export async function logout(token?: string) {
  if (!token) return;
  const rec = await RefreshToken.findOne({ tokenHash: sha256(token) });
  if (rec) await RefreshToken.updateMany({ family: rec.family }, { revokedAt: new Date() });
}

export async function forgotPassword(email: string) {
  const user = await User.findOne({ email, deletedAt: null, isActive: true });
  if (!user) return; // never reveal whether the account exists
  const token = randomToken(32);
  user.resetTokenHash = sha256(token);
  user.resetTokenExpires = new Date(Date.now() + 30 * 60 * 1000);
  await user.save();
  await sendMail(user.email, 'Reset your password',
    `Hello ${user.name},\n\nUse this link within 30 minutes to reset your password:\n${env.CLIENT_URL}/reset-password?token=${token}\n\nIf you did not request this, ignore this email.`);
}

export async function resetPassword(token: string, password: string) {
  const user = await User.findOne({ resetTokenHash: sha256(token), resetTokenExpires: { $gt: new Date() } }).select('+resetTokenHash +resetTokenExpires');
  if (!user) throw ApiError.badRequest('Reset link is invalid or has expired');
  user.passwordHash = await hashPassword(password);
  user.resetTokenHash = undefined; user.resetTokenExpires = undefined;
  user.failedLogins = 0; user.lockUntil = undefined; user.mustChangePassword = false;
  await user.save();
  await RefreshToken.updateMany({ user: user._id, revokedAt: null }, { revokedAt: new Date() });
}

export async function changePassword(userId: string, current: string, next: string) {
  const user = await User.findById(userId).select('+passwordHash');
  if (!user || !(await argon2.verify(user.passwordHash, current))) throw ApiError.badRequest('Current password is incorrect');
  user.passwordHash = await hashPassword(next);
  user.mustChangePassword = false;
  await user.save();
  await RefreshToken.updateMany({ user: user._id, revokedAt: null }, { revokedAt: new Date() });
}
