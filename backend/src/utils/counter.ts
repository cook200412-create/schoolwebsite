import type { ClientSession } from 'mongoose';
import { Counter } from '../models/finance';

export async function nextSeq(key: string, session?: ClientSession): Promise<number> {
  const c = await Counter.findOneAndUpdate({ _id: key }, { $inc: { seq: 1 } }, { new: true, upsert: true, session });
  return c.seq;
}

export const pad = (n: number, w = 5) => String(n).padStart(w, '0');
