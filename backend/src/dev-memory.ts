/**
 * Zero-setup demo mode: boots an in-memory MongoDB replica set, seeds FICTIONAL demo data and starts the API.
 * Data is lost on exit. For development/demo only – never use in production.
 */
import { MongoMemoryReplSet } from 'mongodb-memory-server';

async function main() {
  const repl = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  process.env.MONGODB_URI = repl.getUri('ssv_demo');
  process.env.JWT_ACCESS_SECRET ??= 'dev-only-access-secret-dev-only-access-secret';
  process.env.JWT_REFRESH_SECRET ??= 'dev-only-refresh-secret-dev-only-refresh-secret';
  process.env.RAZORPAY_WEBHOOK_SECRET ??= 'dev-webhook-secret';
  process.env.CLIENT_ORIGINS ??= 'http://localhost:3000,http://localhost:3001,http://localhost:3100';
  const { connectDb } = await import('./config/db');
  await connectDb();
  const { seed } = await import('./seed');
  const r = await seed();
  console.log(`[demo] seeded. Password for all demo logins: ${r.password}\n  ${r.logins.join('\n  ')}`);
  const { createApp } = await import('./app');
  const { env } = await import('./config/env');
  createApp().listen(env.PORT, () => console.log(`[api] demo API on http://localhost:${env.PORT}/api (in-memory database)`));
  const stop = async () => { await repl.stop(); process.exit(0); };
  process.on('SIGINT', stop); process.on('SIGTERM', stop);
}
main().catch((e) => { console.error(e); process.exit(1); });
