import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globalSetup: ['./test/global-setup.ts'],
    include: ['src/**/*.test.ts', 'test/**/*.test.ts'],
    testTimeout: 30_000,
    hookTimeout: 120_000,
    pool: 'forks',
    env: { NODE_ENV: 'test', RAZORPAY_WEBHOOK_SECRET: 'whsec_test_secret', RAZORPAY_KEY_ID: '', RAZORPAY_KEY_SECRET: '' },
  },
});
