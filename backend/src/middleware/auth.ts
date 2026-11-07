import type { NextFunction, Request, RequestHandler, Response } from 'express';
import type { ZodTypeAny } from 'zod';
import { hasPermission, ROLE_PERMISSIONS, RoleName } from '../config/permissions';
import { Role, User } from '../models/user';
import { ApiError, asyncHandler } from '../utils/http';
import { safeEqual, verifyAccess } from '../utils/security';

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: RoleName;
  permissions: string[];
}
declare module 'express-serve-static-core' {
  interface Request { user?: AuthUser }
}

const permCache = new Map<string, { at: number; perms: string[] }>();
export const clearPermissionCache = () => permCache.clear();

export async function permissionsFor(role: RoleName): Promise<string[]> {
  const hit = permCache.get(role);
  if (hit && Date.now() - hit.at < 60_000) return hit.perms;
  const doc = await Role.findOne({ name: role }).lean();
  const perms = doc?.permissions?.length ? doc.permissions : ROLE_PERMISSIONS[role] ?? [];
  permCache.set(role, { at: Date.now(), perms });
  return perms;
}

export const authenticate: RequestHandler = asyncHandler(async (req, _res, next) => {
  const header = req.headers.authorization;
  const token = req.cookies?.access_token ?? (header?.startsWith('Bearer ') ? header.slice(7) : undefined);
  if (!token) throw ApiError.unauthorized();
  let payload;
  try {
    payload = verifyAccess(token);
  } catch {
    throw ApiError.unauthorized('Session expired');
  }
  const user = await User.findOne({ _id: payload.sub, deletedAt: null }).lean();
  if (!user || !user.isActive) throw ApiError.unauthorized('Account disabled');
  req.user = {
    id: String(user._id), name: user.name, email: user.email,
    role: user.role as RoleName, permissions: await permissionsFor(user.role as RoleName),
  };
  next();
});

/** Require at least one of the listed permissions. */
export const authorize =
  (...needed: string[]): RequestHandler =>
  (req, _res, next) => {
    if (!req.user) return next(ApiError.unauthorized());
    if (needed.some((p) => hasPermission(req.user!.permissions, p))) return next();
    next(ApiError.forbidden());
  };

export const can = (req: Request, perm: string) => !!req.user && hasPermission(req.user.permissions, perm);

/** Double-submit CSRF: enforced for unsafe methods whenever the browser sent session cookies. */
export const csrfProtection: RequestHandler = (req, _res, next) => {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();
  if (req.path.startsWith('/payments/webhook')) return next(); // signature-verified instead
  // Pre-authentication endpoints: a stale cookie from an expired session must never block signing in again
  if (['/auth/login', '/auth/register', '/auth/forgot-password', '/auth/reset-password'].includes(req.path)) return next();
  const usesCookieAuth = !!(req.cookies?.access_token || req.cookies?.refresh_token);
  if (!usesCookieAuth) return next();
  const cookie = req.cookies?.csrf_token as string | undefined;
  const header = req.headers['x-csrf-token'];
  if (cookie && typeof header === 'string' && safeEqual(cookie, header)) return next();
  next(ApiError.forbidden('Invalid CSRF token'));
};

export const validate =
  (schema: ZodTypeAny, source: 'body' | 'query' | 'params' = 'body'): RequestHandler =>
  (req: Request, _res: Response, next: NextFunction) => {
    const r = schema.safeParse(req[source]);
    if (!r.success) return next(r.error);
    if (source === 'query') Object.defineProperty(req, 'query', { value: r.data, writable: true });
    else (req as any)[source] = r.data;
    next();
  };
