/**
 * Creates the first Super Admin (production bootstrap). Usage:
 *   ADMIN_EMAIL=head@school.org ADMIN_NAME="Head Office" npm run create-admin
 * The password is read from ADMIN_PASSWORD or generated and printed once. Requires MONGODB_URI etc. in .env.
 */
import { randomBytes } from 'crypto';
import { connectDb, disconnectDb } from './config/db';
import { ROLES, ROLE_PERMISSIONS } from './config/permissions';
import { Role, User } from './models/user';
import { hashPassword } from './services/auth.service';

(async () => {
  const email = process.env.ADMIN_EMAIL?.toLowerCase();
  if (!email) throw new Error('Set ADMIN_EMAIL');
  await connectDb();
  for (const name of ROLES) await Role.updateOne({ name }, { $setOnInsert: { name, permissions: ROLE_PERMISSIONS[name] } }, { upsert: true });
  if (await User.exists({ email })) throw new Error(`User ${email} already exists`);
  const password = process.env.ADMIN_PASSWORD ?? `${randomBytes(9).toString('base64url')}aA1!`;
  await User.create({ name: process.env.ADMIN_NAME ?? 'Super Admin', email, role: 'super_admin', passwordHash: await hashPassword(password), mustChangePassword: true });
  console.log(`Super Admin created: ${email}${process.env.ADMIN_PASSWORD ? '' : `\nTemporary password (shown once): ${password}`}`);
  await disconnectDb();
})().catch((e) => { console.error(e.message); process.exit(1); });
