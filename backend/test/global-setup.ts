import { MongoMemoryReplSet } from 'mongodb-memory-server';

let repl: MongoMemoryReplSet;

/** One in-memory replica set (needed for transactions) shared by all test files; each file uses its own database. */
export async function setup() {
  repl = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  process.env.TEST_MONGO_URI = repl.getUri();
}
export async function teardown() {
  await repl?.stop();
}
