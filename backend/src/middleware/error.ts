import type { ErrorRequestHandler, RequestHandler } from 'express';
import { ZodError } from 'zod';
import { env } from '../config/env';
import { ApiError } from '../utils/http';

export const notFound: RequestHandler = (req, _res, next) =>
  next(ApiError.notFound(`Route ${req.method} ${req.originalUrl} not found`));

export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  if (err instanceof ZodError) {
    return res.status(422).json({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Validation failed',
        details: err.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
      },
    });
  }
  if (err?.message === 'CORS blocked') return res.status(403).json({ success: false, error: { code: 'CORS', message: 'Origin not allowed. Add it to CLIENT_ORIGINS.' } });
  if (err?.name === 'MulterError') {
    const tooBig = err.code === 'LIMIT_FILE_SIZE';
    return res.status(tooBig ? 413 : 400).json({ success: false, error: { code: tooBig ? 'FILE_TOO_LARGE' : 'UPLOAD_ERROR', message: tooBig ? 'File exceeds the 5 MB limit' : 'Invalid upload' } });
  }
  if (err instanceof ApiError) {
    return res
      .status(err.status)
      .json({ success: false, error: { code: err.code, message: err.message, details: err.details } });
  }
  if (err?.code === 11000) {
    return res
      .status(409)
      .json({ success: false, error: { code: 'DUPLICATE', message: 'A record with these details already exists' } });
  }
  // eslint-disable-next-line no-console
  console.error('[error]', err);
  return res.status(500).json({
    success: false,
    error: { code: 'INTERNAL', message: env.isProd ? 'Something went wrong' : String(err?.message ?? err) },
  });
};
