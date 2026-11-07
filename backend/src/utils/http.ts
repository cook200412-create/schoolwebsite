import type { NextFunction, Request, RequestHandler, Response } from 'express';

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public details?: unknown,
  ) {
    super(message);
  }
  static badRequest = (m = 'Bad request', d?: unknown) => new ApiError(400, 'BAD_REQUEST', m, d);
  static unauthorized = (m = 'Authentication required') => new ApiError(401, 'UNAUTHORIZED', m);
  static forbidden = (m = 'You do not have permission to perform this action') => new ApiError(403, 'FORBIDDEN', m);
  static notFound = (m = 'Resource not found') => new ApiError(404, 'NOT_FOUND', m);
  static conflict = (m = 'Conflict', d?: unknown) => new ApiError(409, 'CONFLICT', m, d);
}

export const asyncHandler =
  (fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>): RequestHandler =>
  (req, res, next) => {
    fn(req, res, next).catch(next);
  };

export const ok = <T>(res: Response, data: T, meta?: Record<string, unknown>, status = 200) =>
  res.status(status).json({ success: true, data, ...(meta ? { meta } : {}) });
