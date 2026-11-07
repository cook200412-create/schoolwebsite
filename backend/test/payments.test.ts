import crypto from 'crypto';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Payment, StudentFee } from '../src/models/finance';
import { app, closeTestDb, connectTestDb, login, world } from './helpers';

const a = app();
const SECRET = 'whsec_test_secret';
let w: Awaited<ReturnType<typeof world>>;
let feeId: string;
beforeAll(async () => { await connectTestDb(); w = await world(); });
afterAll(closeTestDb);

const sign = (raw: string, secret = SECRET) => crypto.createHmac('sha256', secret).update(raw).digest('hex');
const webhook = (event: object, opts: { secret?: string; eventId?: string; sig?: string } = {}) => {
  const raw = JSON.stringify(event);
  return request(a).post('/api/payments/webhook/razorpay').set('Content-Type', 'application/json')
    .set('X-Razorpay-Signature', opts.sig ?? sign(raw, opts.secret)).set('X-Razorpay-Event-Id', opts.eventId ?? crypto.randomUUID()).send(raw);
};
const captured = (orderId: string, amount: number, id = 'pay_123') => ({ event: 'payment.captured', payload: { payment: { entity: { id, order_id: orderId, amount } } } });

describe('fee configuration', () => {
  it('accountant configures a structure, assigns it to a class, and applies a discount', async () => {
    const acct = await login(a, w.accountant.email);
    expect((await (await login(a, w.teacherUser.email)).post('/fees/structures').send({})).status).toBe(403);
    const st = await acct.post('/fees/structures').send({ name: 'Class 8', class: String(w.cls._id), academicYear: String(w.year._id), lateFeePerDay: 1000, items: [{ name: 'Tuition', type: 'tuition', amount: 1000000 }, { name: 'Exam', type: 'examination', amount: 200000 }] });
    expect(st.status).toBe(201);
    const as = await acct.post('/fees/assign').send({ structureId: st.body.data._id, discount: 100000 });
    expect(as.body.data.assigned).toBe(3);
    expect((await acct.post('/fees/assign').send({ structureId: st.body.data._id })).body.data.assigned).toBe(0); // idempotent
    const f = await StudentFee.findOne({ student: w.s1._id });
    expect(f!.totalDue).toBe(1100000);
    feeId = String(f!._id);
  });

  it('parents see their own ledger only', async () => {
    const p = await login(a, w.parentUser.email);
    const l = await p.get(`/fees/student/${w.s1._id}`);
    expect(l.body.data.fees[0].balance).toBe(1100000);
    expect((await p.get(`/fees/student/${w.s2._id}`)).status).toBe(404);
  });
});

describe('online payments', () => {
  let orderId: string, paymentId: string;

  it('creates an order for the parent\'s own child, idempotently, never above the balance', async () => {
    const p = await login(a, w.parentUser.email);
    const o = await p.post('/payments/orders').send({ studentFeeId: feeId, amount: 500000, idempotencyKey: 'idem-key-0001' });
    expect(o.status).toBe(201);
    orderId = o.body.data.orderId; paymentId = o.body.data.paymentId;
    const again = await p.post('/payments/orders').send({ studentFeeId: feeId, amount: 500000, idempotencyKey: 'idem-key-0001' });
    expect(again.body.data.paymentId).toBe(paymentId);
    expect(await Payment.countDocuments({ idempotencyKey: 'idem-key-0001' })).toBe(1);
    expect((await p.post('/payments/orders').send({ studentFeeId: feeId, amount: 99999999, idempotencyKey: 'idem-key-0002' })).status).toBe(400);
    const other = await login(a, w.otherParentUser.email);
    expect((await other.post('/payments/orders').send({ studentFeeId: feeId, amount: 100, idempotencyKey: 'idem-key-0003' })).status).toBe(404);
  });

  it('a created order is NOT paid: nothing the client sends can mark it successful', async () => {
    const p = await login(a, w.parentUser.email);
    expect((await Payment.findById(paymentId))!.status).toBe('created');
    expect((await p.get(`/payments/${paymentId}/receipt.pdf`)).status).toBe(400);
    expect((await p.post('/payments/offline').send({ studentFeeId: feeId, amount: 500000, method: 'cash' })).status).toBe(403);
    expect((await StudentFee.findById(feeId))!.paid).toBe(0);
  });

  it('rejects webhooks with a bad or missing signature, and wrong secrets', async () => {
    expect((await webhook(captured(orderId, 500000), { sig: 'deadbeef' })).status).toBe(400);
    expect((await webhook(captured(orderId, 500000), { secret: 'other' })).status).toBe(400);
    const raw = JSON.stringify(captured(orderId, 500000));
    expect((await request(a).post('/api/payments/webhook/razorpay').set('Content-Type', 'application/json').send(raw)).status).toBe(400);
    expect((await Payment.findById(paymentId))!.status).toBe('created');
  });

  it('rejects a signed event whose amount differs from the order', async () => {
    expect((await webhook(captured(orderId, 100))).status).toBe(400);
    expect((await Payment.findById(paymentId))!.status).toBe('created');
  });

  it('a verified webhook credits the ledger once and issues a receipt; replays are idempotent', async () => {
    const eventId = 'evt_001';
    const r1 = await webhook(captured(orderId, 500000), { eventId });
    expect(r1.status).toBe(200);
    const p = (await Payment.findById(paymentId))!;
    expect(p.status).toBe('success');
    expect(p.receiptNumber).toMatch(/^RCT\d{4}\d{6}$/);
    expect((await StudentFee.findById(feeId))!.paid).toBe(500000);
    const r2 = await webhook(captured(orderId, 500000), { eventId });
    expect(r2.body.data.duplicate).toBe(true);
    const r3 = await webhook(captured(orderId, 500000), { eventId: 'evt_002' }); // same payment, new event id
    expect(r3.status).toBe(200);
    expect((await StudentFee.findById(feeId))!.paid).toBe(500000); // still credited once
  });

  it('downloads a PDF receipt (owner only)', async () => {
    const p = await login(a, w.parentUser.email);
    const pdf = await p.get(`/payments/${paymentId}/receipt.pdf`).buffer(true).parse((res, cb) => { const c: Buffer[] = []; res.on('data', (d: Buffer) => c.push(d)); res.on('end', () => cb(null, Buffer.concat(c))); });
    expect(pdf.status).toBe(200);
    expect((pdf.body as Buffer).slice(0, 4).toString()).toBe('%PDF');
    const other = await login(a, w.otherParentUser.email);
    expect((await other.get(`/payments/${paymentId}/receipt.pdf`)).status).toBe(404);
  });

  it('failed-payment events mark the payment failed', async () => {
    const p = await login(a, w.parentUser.email);
    const o = await p.post('/payments/orders').send({ studentFeeId: feeId, amount: 100000, idempotencyKey: 'idem-key-0004' });
    await webhook({ event: 'payment.failed', payload: { payment: { entity: { id: 'pay_x', order_id: o.body.data.orderId, amount: 100000 } } } });
    expect((await Payment.findById(o.body.data.paymentId))!.status).toBe('failed');
  });
});

describe('offline payments, over-payment and refunds', () => {
  it('records offline payments with unique receipts and refuses to exceed the balance', async () => {
    const acct = await login(a, w.accountant.email);
    const ok = await acct.post('/payments/offline').send({ studentFeeId: feeId, amount: 300000, method: 'cash' });
    expect(ok.status).toBe(201);
    expect(ok.body.data.receiptNumber).toBeTruthy();
    const over = await acct.post('/payments/offline').send({ studentFeeId: feeId, amount: 900000, method: 'cash' });
    expect(over.status).toBe(409);
    expect((await StudentFee.findById(feeId))!.paid).toBe(800000);
    expect(await Payment.countDocuments({ status: 'created', method: 'cash' })).toBe(0); // rolled back
    const pending = await acct.get('/fees/pending');
    expect(pending.body.data.length).toBeGreaterThan(0);
  });

  it('refunds need accountant request + admin approval and update the ledger atomically', async () => {
    const acct = await login(a, w.accountant.email);
    const pay = (await Payment.findOne({ method: 'cash', status: 'success' }))!;
    expect((await acct.post(`/payments/${pay._id}/refund-decision`).send({ approve: true })).status).toBe(403);
    expect((await acct.post(`/payments/${pay._id}/refund-request`).send({ amount: 999999999, reason: 'too much' })).status).toBe(400);
    expect((await acct.post(`/payments/${pay._id}/refund-request`).send({ amount: 100000, reason: 'Duplicate payment' })).status).toBe(200);
    const admin = await login(a, w.superAdmin.email);
    expect((await admin.post(`/payments/${pay._id}/refund-decision`).send({ approve: true })).status).toBe(200);
    const fee = (await StudentFee.findById(feeId))!;
    expect(fee.paid).toBe(700000); expect(fee.refunded).toBe(100000);
    expect((await Payment.findById(pay._id))!.status).toBe('partially_refunded');
  });

  it('collection reports export CSV/PDF for finance roles only', async () => {
    const acct = await login(a, w.accountant.email);
    const csv = await acct.get('/reports/fee-collection?format=csv');
    expect(csv.headers['content-type']).toContain('text/csv');
    expect(csv.text).toContain('period,transactions,total');
    expect((await (await login(a, w.teacherUser.email)).get('/reports/fee-collection')).status).toBe(403);
    const dash = await acct.get('/reports/dashboard');
    expect(dash.body.data.feeCollectionThisMonth.total).toBeGreaterThan(0);
  });
});
