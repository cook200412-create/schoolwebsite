import crypto from 'crypto';
import type { CookieOptions, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../config/env';

export const ACCESS_TTL_S = 15 * 60;
export const REFRESH_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export const sha256 = (v: string) => crypto.createHash('sha256').update(v).digest('hex');
export const randomToken = (bytes = 48) => crypto.randomBytes(bytes).toString('hex');

export interface AccessPayload { sub: string; role: string }
export const signAccess = (p: AccessPayload) => jwt.sign(p, env.JWT_ACCESS_SECRET, { expiresIn: ACCESS_TTL_S });
export const verifyAccess = (t: string) => jwt.verify(t, env.JWT_ACCESS_SECRET) as AccessPayload & jwt.JwtPayload;

const base = (): CookieOptions => ({
  secure: env.isProd || env.COOKIE_SAMESITE === 'none',
  sameSite: env.COOKIE_SAMESITE,
  path: '/',
});

export function setAuthCookies(res: Response, access: string, refresh: string) {
  res.cookie('access_token', access, { ...base(), httpOnly: true, maxAge: ACCESS_TTL_S * 1000 });
  res.cookie('refresh_token', refresh, { ...base(), httpOnly: true, maxAge: REFRESH_TTL_MS, path: '/api/auth' });
  res.cookie('csrf_token', randomToken(24), { ...base(), httpOnly: false, maxAge: REFRESH_TTL_MS });
}

export function clearAuthCookies(res: Response) {
  res.clearCookie('access_token', { ...base() });
  res.clearCookie('refresh_token', { ...base(), path: '/api/auth' });
  res.clearCookie('csrf_token', { ...base() });
}

export const clientIp = (req: Request) => req.ip ?? '';

export function safeEqual(a: string, b: string) {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && crypto.timingSafeEqual(ab, bb);
}
