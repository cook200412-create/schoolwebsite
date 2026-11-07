import { createApp } from './app';
import { connectDb, disconnectDb } from './config/db';
import { env } from './config/env';

async function main() {
  await connectDb();
  const app = createApp();
  const server = app.listen(env.PORT, () => console.log(`[api] listening on http://localhost:${env.PORT}/api`));

  const shutdown = async (signal: string) => {
    console.log(`[api] ${signal} received, shutting down`);
    server.close(async () => {
      await disconnectDb();
      process.exit(0);
    });
  };
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

main().catch((err) => {
  console.error('[api] failed to start:', err.message);
  process.exit(1);
});
