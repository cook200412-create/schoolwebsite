import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { env } from '../config/env';
import { authenticate, validate } from '../middleware/auth';
import * as svc from '../services/auth.service';
import { asyncHandler, ok } from '../utils/http';
import { audit } from '../utils/helpers';
import { clearAuthCookies, setAuthCookies } from '../utils/security';

export const password = z
  .string()
  .min(10, 'At least 10 characters')
  .max(128)
  .regex(/[a-z]/, 'Include a lowercase letter')
  .regex(/[A-Z]/, 'Include an uppercase letter')
  .regex(/\d/, 'Include a number');

const email = z.string().trim().toLowerCase().email();

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, limit: env.isTest ? 10_000 : 20, standardHeaders: true, legacyHeaders: false,
  message: { success: false, error: { code: 'RATE_LIMITED', message: 'Too many attempts, please try later.' } },
});

export const authRouter = Router();
const meta = (req: any) => ({ ip: req.ip, ua: req.headers['user-agent'] });

authRouter.post('/register', limiter,
  validate(z.object({ name: z.string().trim().min(2).max(120), email, password, phone: z.string().trim().max(20).optional(), consent: z.literal(true, { errorMap: () => ({ message: 'Parental consent is required' }) }) })),
  asyncHandler(async (req, res) => {
    const user = await svc.register(req.body, req.ip);
    const { tokens } = await svc.login(user.email, req.body.password, meta(req));
    setAuthCookies(res, tokens.access, tokens.refresh);
    ok(res, { user: svc.publicUser(user) }, undefined, 201);
  }));

authRouter.post('/login', limiter, validate(z.object({ email, password: z.string().min(1).max(128) })),
  asyncHandler(async (req, res) => {
    const { user, tokens } = await svc.login(req.body.email, req.body.password, meta(req));
    setAuthCookies(res, tokens.access, tokens.refresh);
    req.user = { id: String(user._id), role: user.role as any, name: user.name, email: user.email, permissions: [] };
    await audit(req, 'auth.login', 'User', user._id);
    ok(res, { user: svc.publicUser(user) });
  }));

authRouter.post('/refresh', limiter, asyncHandler(async (req, res) => {
  const { user, tokens } = await svc.refresh(req.cookies?.refresh_token, meta(req));
  setAuthCookies(res, tokens.access, tokens.refresh);
  ok(res, { user: svc.publicUser(user) });
}));

authRouter.post('/logout', asyncHandler(async (req, res) => {
  await svc.logout(req.cookies?.refresh_token);
  clearAuthCookies(res);
  ok(res, { loggedOut: true });
}));

authRouter.post('/forgot-password', limiter, validate(z.object({ email })), asyncHandler(async (req, res) => {
  await svc.forgotPassword(req.body.email);
  ok(res, { message: 'If that email is registered, a reset link has been sent.' });
}));

authRouter.post('/reset-password', limiter, validate(z.object({ token: z.string().min(20), password })), asyncHandler(async (req, res) => {
  await svc.resetPassword(req.body.token, req.body.password);
  ok(res, { message: 'Password updated. Please sign in.' });
}));

authRouter.get('/me', authenticate, (req, res) => ok(res, { user: { ...req.user, permissions: req.user!.permissions } }));

authRouter.post('/change-password', authenticate,
  validate(z.object({ currentPassword: z.string().min(1), newPassword: password })),
  asyncHandler(async (req, res) => {
    await svc.changePassword(req.user!.id, req.body.currentPassword, req.body.newPassword);
    clearAuthCookies(res);
    await audit(req, 'auth.change_password');
    ok(res, { message: 'Password changed. Please sign in again.' });
  }));
