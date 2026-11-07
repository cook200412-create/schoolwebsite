import nodemailer from 'nodemailer';
import { env } from '../config/env';

export const outbox: { to: string; subject: string; text: string }[] = []; // inspected by tests

const transport = env.SMTP_HOST
  ? nodemailer.createTransport({
      host: env.SMTP_HOST,
      port: env.SMTP_PORT,
      secure: env.SMTP_PORT === 465,
      auth: env.SMTP_USER ? { user: env.SMTP_USER, pass: env.SMTP_PASS } : undefined,
    })
  : null;

/** Sends via SMTP when configured; otherwise logs (dev) so flows remain testable. */
export async function sendMail(to: string, subject: string, text: string) {
  if (env.isTest) {
    outbox.push({ to, subject, text });
    return;
  }
  if (!transport) {
    // eslint-disable-next-line no-console
    console.log(`[mail:dev] to=${to} subject="${subject}"\n${text}`);
    return;
  }
  try {
    await transport.sendMail({ from: env.MAIL_FROM, to, subject, text });
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error('[mail] send failed', (e as Error).message);
  }
}
