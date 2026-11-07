import mongoose from 'mongoose';
import { env } from './env';

export async function connectDb(): Promise<void> {
  mongoose.set('strictQuery', true);
  await mongoose.connect(env.MONGODB_URI, { serverSelectionTimeoutMS: 8000 });
  // eslint-disable-next-line no-console
  console.log(`[db] connected to ${mongoose.connection.name}`);
}

export async function disconnectDb(): Promise<void> {
  await mongoose.disconnect();
}

const STATES: Record<number, string> = { 0: 'disconnected', 1: 'connected', 2: 'connecting', 3: 'disconnecting' };
export const dbState = () => STATES[mongoose.connection.readyState] ?? 'unknown';
