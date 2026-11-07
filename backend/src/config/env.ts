import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const isTest = process.env.NODE_ENV === 'test';
const secret = isTest ? z.string().default('test-secret-test-secret-test-secret-123456') : z.string().min(32, 'must be at least 32 chars');

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(5000),
  MONGODB_URI: isTest ? z.string().default('mongodb://127.0.0.1:27017/test') : z.string().min(1, 'MONGODB_URI is required'),
  CLIENT_ORIGINS: z.string().default('http://localhost:3000'),
  CLIENT_URL: z.string().default('http://localhost:3000'),
  JWT_ACCESS_SECRET: secret,
  JWT_REFRESH_SECRET: secret,
  CLOUDINARY_CLOUD_NAME: z.string().optional(),
  CLOUDINARY_API_KEY: z.string().optional(),
  CLOUDINARY_API_SECRET: z.string().optional(),
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().default(587),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  MAIL_FROM: z.string().default('Sri Satya Sai Vidyanikethan <no-reply@example.com>'),
  RAZORPAY_KEY_ID: z.string().optional(),
  RAZORPAY_KEY_SECRET: z.string().optional(),
  RAZORPAY_WEBHOOK_SECRET: z.string().optional(),
  UPLOAD_DIR: z.string().default('uploads'),
  TRUST_PROXY: z.coerce.number().int().min(0).max(5).default(1),
  COOKIE_SAMESITE: z.enum(['lax', 'strict', 'none']).default('lax'),
});

const parsed = schema.safeParse(process.env);
if (!parsed.success) {
  // eslint-disable-next-line no-console
  console.error('Invalid environment configuration:', parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = {
  ...parsed.data,
  isProd: parsed.data.NODE_ENV === 'production',
  isTest,
  clientOrigins: parsed.data.CLIENT_ORIGINS.split(',').map((s) => s.trim()).filter(Boolean),
};
