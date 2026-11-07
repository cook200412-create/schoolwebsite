import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { outbox } from '../src/services/mail.service';
import { User } from '../src/models/user';
import { app, closeTestDb, connectTestDb, login, mkUser, PASSWORD } from './helpers';

const a = app();
/** Cookies a browser would hold after a login/refresh response (refresh + csrf) and the CSRF header value. */
const jar = (res: request.Response) => {
  const set = (res.headers['set-cookie'] as unknown as string[]).map((c) => c.split(';')[0]);
  const rt = set.find((c) => c.startsWith('refresh_token='))!;
  const csrf = set.find((c) => c.startsWith('csrf_token='))!;
  return { cookie: `${rt}; ${csrf}`, csrf: csrf.split('=')[1], rt };
};
const refresh = (j: { cookie: string; csrf: string }) => request(a).post('/api/auth/refresh').set('Cookie', j.cookie).set('X-CSRF-Token', j.csrf);
beforeAll(connectTestDb);
afterAll(closeTestDb);

describe('authentication', () => {
  it('registers a parent only with consent and a strong password', async () => {
    const weak = await request(a).post('/api/auth/register').send({ name: 'Pat', email: 'pat@x.com', password: 'short', consent: true });
    expect(weak.status).toBe(422);
    const noConsent = await request(a).post('/api/auth/register').send({ name: 'Pat', email: 'pat@x.com', password: PASSWORD, consent: false });
    expect(noConsent.status).toBe(422);
    const ok = await request(a).post('/api/auth/register').send({ name: 'Pat', email: 'pat@x.com', password: PASSWORD, consent: true });
    expect(ok.status).toBe(201);
    expect(ok.body.data.user.role).toBe('parent');
    expect(JSON.stringify(ok.body)).not.toContain('passwordHash');
    const dup = await request(a).post('/api/auth/register').send({ name: 'Pat', email: 'PAT@x.com', password: PASSWORD, consent: true });
    expect(dup.status).toBe(409);
  });

  it('cannot self-register as a privileged role', async () => {
    const r = await request(a).post('/api/auth/register').send({ name: 'Eve', email: 'eve@x.com', password: PASSWORD, consent: true, role: 'super_admin' });
    expect(r.status).toBe(201);
    expect(r.body.data.user.role).toBe('parent');
  });

  it('stores only a hash, sets HTTP-only cookies and never returns the hash', async () => {
    await mkUser('teacher', 'tea@x.com');
    const res = await request(a).post('/api/auth/login').send({ email: 'tea@x.com', password: PASSWORD });
    expect(res.status).toBe(200);
    const cookies = (res.headers['set-cookie'] as unknown as string[]).join('\n');
    expect(cookies).toMatch(/access_token=[^;]+; .*HttpOnly/);
    expect(cookies).toMatch(/refresh_token=[^;]+; .*HttpOnly/);
    const u = await User.findOne({ email: 'tea@x.com' }).select('+passwordHash');
    expect(u!.passwordHash).toMatch(/^\$argon2id\$/);
  });

  it('rejects wrong credentials without revealing which part was wrong', async () => {
    const bad = await request(a).post('/api/auth/login').send({ email: 'tea@x.com', password: 'Wrong-pass-123' });
    const unknown = await request(a).post('/api/auth/login').send({ email: 'nobody@x.com', password: 'Wrong-pass-123' });
    expect(bad.status).toBe(401);
    expect(unknown.status).toBe(401);
    expect(bad.body.error.message).toBe(unknown.body.error.message);
  });

  it('locks the account after 5 failed attempts', async () => {
    await mkUser('teacher', 'lock@x.com');
    for (let i = 0; i < 5; i++) await request(a).post('/api/auth/login').send({ email: 'lock@x.com', password: 'Nope-nope-123' });
    const res = await request(a).post('/api/auth/login').send({ email: 'lock@x.com', password: PASSWORD });
    expect(res.status).toBe(423);
  });

  it('protects /me and returns permissions for the session', async () => {
    expect((await request(a).get('/api/auth/me')).status).toBe(401);
    const c = await login(a, 'tea@x.com');
    const me = await c.get('/auth/me');
    expect(me.status).toBe(200);
    expect(me.body.data.user.role).toBe('teacher');
    expect(me.body.data.user.permissions).toContain('attendance:mark');
  });

  it('rotates refresh tokens and revokes the family when an old token is replayed', async () => {
    const first = jar(await request(a).post('/api/auth/login').send({ email: 'tea@x.com', password: PASSWORD }));
    const secondRes = await refresh(first);
    expect(secondRes.status).toBe(200);
    const second = jar(secondRes);
    expect(second.rt).not.toBe(first.rt);
    expect((await refresh(first)).status).toBe(401); // replay of rotated token
    expect((await refresh(second)).status).toBe(401); // whole family revoked
  });

  it('enforces CSRF for cookie-authenticated unsafe requests', async () => {
    const c = await login(a, 'tea@x.com');
    const noToken = await request(a).post('/api/auth/logout').set('Cookie', c.cookies);
    expect(noToken.status).toBe(403);
    const ok = await request(a).post('/api/auth/logout').set('Cookie', c.cookies).set('X-CSRF-Token', c.csrf);
    expect(ok.status).toBe(200);
  });

  it('logout revokes the refresh token', async () => {
    const j = jar(await request(a).post('/api/auth/login').send({ email: 'tea@x.com', password: PASSWORD }));
    expect((await request(a).post('/api/auth/logout').set('Cookie', j.cookie).set('X-CSRF-Token', j.csrf)).status).toBe(200);
    expect((await refresh(j)).status).toBe(401);
  });

  it('disabled accounts cannot log in or use existing tokens', async () => {
    await mkUser('teacher', 'off@x.com');
    const c = await login(a, 'off@x.com');
    await User.updateOne({ email: 'off@x.com' }, { isActive: false });
    expect((await c.get('/auth/me')).status).toBe(401);
    expect((await request(a).post('/api/auth/login').send({ email: 'off@x.com', password: PASSWORD })).status).toBe(403);
  });
});

describe('password reset', () => {
  it('does not reveal whether an email exists', async () => {
    const r1 = await request(a).post('/api/auth/forgot-password').send({ email: 'ghost@x.com' });
    const r2 = await request(a).post('/api/auth/forgot-password').send({ email: 'tea@x.com' });
    expect(r1.status).toBe(200); expect(r2.status).toBe(200);
    expect(r1.body).toEqual(r2.body);
  });

  it('issues a single-use token that changes the password and kills sessions', async () => {
    outbox.length = 0;
    await mkUser('parent', 'reset@x.com');
    const oldJar = jar(await request(a).post('/api/auth/login').send({ email: 'reset@x.com', password: PASSWORD }));
    await request(a).post('/api/auth/forgot-password').send({ email: 'reset@x.com' });
    const mail = outbox.find((m) => m.to === 'reset@x.com')!;
    const token = /token=([a-f0-9]+)/.exec(mail.text)![1];
    expect((await request(a).post('/api/auth/reset-password').send({ token, password: 'weak' })).status).toBe(422);
    const ok = await request(a).post('/api/auth/reset-password').send({ token, password: 'NewStr0ngPass!' });
    expect(ok.status).toBe(200);
    expect((await request(a).post('/api/auth/reset-password').send({ token, password: 'AnotherStr0ng1!' })).status).toBe(400); // single use
    expect((await request(a).post('/api/auth/login').send({ email: 'reset@x.com', password: PASSWORD })).status).toBe(401);
    expect((await request(a).post('/api/auth/login').send({ email: 'reset@x.com', password: 'NewStr0ngPass!' })).status).toBe(200);
    expect((await refresh(oldJar)).status).toBe(401);
  });

  it('rejects expired tokens', async () => {
    outbox.length = 0;
    await mkUser('parent', 'exp@x.com');
    await request(a).post('/api/auth/forgot-password').send({ email: 'exp@x.com' });
    const token = /token=([a-f0-9]+)/.exec(outbox[0].text)![1];
    await User.updateOne({ email: 'exp@x.com' }, { resetTokenExpires: new Date(Date.now() - 1000) });
    expect((await request(a).post('/api/auth/reset-password').send({ token, password: 'NewStr0ngPass!' })).status).toBe(400);
  });
});

describe('change password', () => {
  it('requires the current password', async () => {
    const c = await login(a, 'tea@x.com');
    expect((await c.post('/auth/change-password').send({ currentPassword: 'wrong', newPassword: 'NewStr0ngPass!' })).status).toBe(400);
    expect((await c.post('/auth/change-password').send({ currentPassword: PASSWORD, newPassword: 'NewStr0ngPass!' })).status).toBe(200);
  });
});
