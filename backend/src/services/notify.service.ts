import { Notification } from '../models/comms';
import { User } from '../models/user';
import { sendMail } from './mail.service';

interface Payload { title: string; body?: string; type?: string; link?: string }

/** In-app notification (always) + optional email. Failures never break the calling workflow. */
export async function notifyUsers(userIds: unknown[], p: Payload, email = false) {
  try {
    const ids = [...new Set(userIds.filter(Boolean).map(String))];
    if (!ids.length) return;
    await Notification.insertMany(ids.map((user) => ({ user, ...p })));
    if (email) {
      const users = await User.find({ _id: { $in: ids } }).select('email').lean();
      await Promise.all(users.map((u) => sendMail(u.email, p.title, p.body ?? p.title)));
    }
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error('[notify] failed', (e as Error).message);
  }
}
