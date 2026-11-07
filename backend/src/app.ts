import compression from 'compression';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import express from 'express';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import morgan from 'morgan';
import swaggerUi from 'swagger-ui-express';
import { env } from './config/env';
import { openApiSpec } from './docs/openapi';
import { errorHandler, notFound } from './middleware/error';
import { api } from './routes';

export function createApp() {
  const app = express();
  app.set('trust proxy', 1);

  app.use(helmet());
  app.use(
    cors({
      origin: (origin, cb) => (!origin || env.clientOrigins.includes(origin) ? cb(null, true) : cb(new Error('CORS blocked'))),
      credentials: true,
    }),
  );
  app.use(compression());
  if (!env.isTest) app.use(morgan(env.isProd ? 'combined' : 'dev'));

  // Payment webhooks need the untouched raw body for HMAC verification.
  app.use('/api/payments/webhook', express.raw({ type: '*/*', limit: '1mb' }));
  app.use(express.json({ limit: '1mb' }));
  app.use(cookieParser());
  app.use(rateLimit({ windowMs: 15 * 60 * 1000, limit: env.isTest ? 100_000 : 600, standardHeaders: true, legacyHeaders: false }));

  app.get('/api/docs.json', (_req, res) => res.json(openApiSpec));
  app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(openApiSpec));

  app.use('/api', api);
  app.use(notFound);
  app.use(errorHandler);
  return app;
}
