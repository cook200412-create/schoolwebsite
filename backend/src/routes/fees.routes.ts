import crypto from 'crypto';
import { Router } from 'express';
import mongoose from 'mongoose';
import { z } from 'zod';
import { env } from '../config/env';
import { authenticate, authorize, can, validate } from '../middleware/auth';
import { FEE_TYPES, FeeStructure, Payment, StudentFee } from '../models/finance';
import { Student } from '../models/people';
import { TransportRoute } from '../models/operations';
import { SchoolSettings } from '../models/SchoolSettings';
import { assertStudentAccess } from '../services/access.service';
import { notifyUsers } from '../services/notify.service';
import { kv, startPdf, table } from '../services/pdf.service';
import { nextSeq, pad } from '../utils/counter';
import { ApiError, asyncHandler, ok } from '../utils/http';
import { audit, mustId, objectId, paginate, rupees, toCsv } from '../utils/helpers';
import { safeEqual } from '../utils/security';
import { crudRouter } from '../utils/crud';

export const feesRouter = Router();

const itemSchema = z.object({ name: z.string().min(1), type: z.enum(FEE_TYPES), amount: z.number().int().min(0), dueDate: z.coerce.date().optional() });
feesRouter.use('/structures', crudRouter({
  name: 'FeeStructure', model: FeeStructure, read: ['fees:read', 'fees:own'], write: ['fees:configure'], populate: 'class', filters: ['class', 'academicYear'],
  schema: z.object({ name: z.string().min(2), class: objectId.optional(), academicYear: objectId, items: z.array(itemSchema).min(1), installments: z.number().int().min(1).max(12).optional(), lateFeePerDay: z.number().int().min(0).optional() }),
}));

feesRouter.use(authenticate);
const total = (f: { items: { amount: number }[]; discount: number; scholarship: number; lateFee: number }) =>
  Math.max(0, f.items.reduce((a, i) => a + i.amount, 0) - f.discount - f.scholarship + f.lateFee);

/** Assign a structure to one student, a list, or a whole class. Transport fee is added from the student's route. */
feesRouter.post('/assign', authorize('fees:configure'), validate(z.object({ structureId: objectId, studentIds: z.array(objectId).optional(), discount: z.number().int().min(0).optional(), scholarship: z.number().int().min(0).optional() })), asyncHandler(async (req, res) => {
  const st = await FeeStructure.findOne({ _id: req.body.structureId, deletedAt: null }).lean();
  if (!st) throw ApiError.notFound('Fee structure not found');
  const filter: any = { status: 'active', deletedAt: null };
  if (req.body.studentIds?.length) filter._id = { $in: req.body.studentIds }; else if (st.class) filter.class = st.class; else throw ApiError.badRequest('Provide studentIds or a class-bound structure');
  const students = await Student.find(filter).lean();
  let created = 0;
  for (const s of students) {
    const items: any[] = st.items.map((i: any) => ({ name: i.name, type: i.type, amount: i.amount, dueDate: i.dueDate }));
    if (s.transportRoute) { const r = await TransportRoute.findById(s.transportRoute).lean(); if (r?.monthlyFee) items.push({ name: `Transport – ${r.name}`, type: 'transport', amount: r.monthlyFee * 12 }); }
    const base = { items, discount: req.body.discount ?? 0, scholarship: req.body.scholarship ?? 0, lateFee: 0 };
    const r = await StudentFee.updateOne({ student: s._id, academicYear: st.academicYear, structure: st._id }, { $setOnInsert: { ...base, totalDue: total(base), paid: 0 } }, { upsert: true });
    if (r.upsertedCount) created++;
  }
  await audit(req, 'Fee.assign', 'FeeStructure', st._id, { created });
  ok(res, { assigned: created, skippedExisting: students.length - created }, undefined, 201);
}));

feesRouter.patch('/student-fee/:id', authorize('fees:configure'), validate(z.object({ discount: z.number().int().min(0).optional(), scholarship: z.number().int().min(0).optional(), note: z.string().optional() })), asyncHandler(async (req, res) => {
  const f = await StudentFee.findById(mustId(req.params.id));
  if (!f) throw ApiError.notFound();
  Object.assign(f, req.body); f.totalDue = total(f as any);
  if (f.totalDue < f.paid) throw ApiError.badRequest('Discount would make total due less than the amount already paid');
  await f.save(); await audit(req, 'Fee.adjust', 'StudentFee', f._id, req.body); ok(res, f);
}));

feesRouter.post('/apply-late-fees', authorize('fees:configure'), asyncHandler(async (req, res) => {
  const now = Date.now(); let updated = 0;
  const fees = await StudentFee.find({ $expr: { $lt: ['$paid', '$totalDue'] } }).populate('structure', 'lateFeePerDay');
  for (const f of fees) {
    const perDay = (f.structure as any)?.lateFeePerDay ?? 0; if (!perDay) continue;
    const days = Math.max(0, ...f.items.map((i: any) => (i.dueDate ? Math.floor((now - new Date(i.dueDate).getTime()) / 86400000) : 0)));
    const late = days * perDay;
    if (late !== f.lateFee) { f.lateFee = late; f.totalDue = total(f as any); await f.save(); updated++; }
  }
  await audit(req, 'Fee.late_fees', 'StudentFee', undefined, { updated }); ok(res, { updated });
}));

feesRouter.get('/student/:studentId', authorize('fees:read', 'fees:own'), asyncHandler(async (req, res) => {
  const s = await assertStudentAccess(req, mustId(req.params.studentId));
  const [fees, payments] = await Promise.all([StudentFee.find({ student: s._id }).populate('academicYear', 'name').lean(), Payment.find({ student: s._id }).sort({ createdAt: -1 }).select('-processedEvents').lean()]);
  ok(res, { fees: fees.map((f) => ({ ...f, balance: f.totalDue - f.paid })), payments });
}));

feesRouter.get('/pending', authorize('fees:read'), asyncHandler(async (req, res) => {
  const { page, limit, skip } = paginate(req);
  const q = { $expr: { $lt: ['$paid', '$totalDue'] } };
  const [items, count] = await Promise.all([StudentFee.find(q).populate('student', 'firstName lastName studentId class section').sort({ createdAt: -1 }).skip(skip).limit(limit).lean(), StudentFee.countDocuments(q)]);
  const rows = items.map((f: any) => ({ student: `${f.student?.firstName ?? ''} ${f.student?.lastName ?? ''}`.trim(), studentId: f.student?.studentId, totalDue: f.totalDue, paid: f.paid, balance: f.totalDue - f.paid }));
  if (req.query.format === 'csv') { res.setHeader('Content-Type', 'text/csv'); return res.send(toCsv(rows)); }
  ok(res, items.map((f: any) => ({ ...f, balance: f.totalDue - f.paid })), { page, limit, total: count });
}));

// ================= PAYMENTS =================
export const paymentsRouter = Router();

async function creditPayment(paymentId: unknown, gatewayPaymentId: string | undefined, session: mongoose.ClientSession) {
  const p = await Payment.findById(paymentId).session(session);
  if (!p) throw ApiError.notFound('Payment not found');
  if (p.status === 'success') return { payment: p, already: true };
  const fee = await StudentFee.findById(p.studentFee).session(session);
  if (!fee) throw ApiError.notFound('Fee record not found');
  if (p.amount > fee.totalDue - fee.paid) { p.status = 'failed'; await p.save({ session }); throw ApiError.conflict('Amount exceeds outstanding balance'); }
  const seq = await nextSeq(`receipt-${new Date().getFullYear()}`, session);
  p.status = 'success'; p.paidAt = new Date(); p.receiptNumber = `RCT${new Date().getFullYear()}${pad(seq, 6)}`;
  if (gatewayPaymentId) p.gateway = { ...(p.gateway as any), paymentId: gatewayPaymentId };
  await p.save({ session });
  fee.paid += p.amount; await fee.save({ session });
  return { payment: p, already: false };
}

/** Razorpay webhook: raw body, HMAC-SHA256 signature, event-id idempotency, transactional ledger update. */
paymentsRouter.post('/webhook/razorpay', asyncHandler(async (req, res) => {
  const secret = env.RAZORPAY_WEBHOOK_SECRET;
  if (!secret) throw new ApiError(503, 'NOT_CONFIGURED', 'Webhook secret not configured');
  const raw: Buffer = Buffer.isBuffer(req.body) ? req.body : Buffer.from(JSON.stringify(req.body ?? {}));
  const sig = String(req.headers['x-razorpay-signature'] ?? '');
  const expected = crypto.createHmac('sha256', secret).update(raw).digest('hex');
  if (!sig || !safeEqual(sig, expected)) throw new ApiError(400, 'BAD_SIGNATURE', 'Invalid signature');
  const event = JSON.parse(raw.toString('utf8'));
  const eventId = String(req.headers['x-razorpay-event-id'] ?? event.id ?? '');
  const entity = event?.payload?.payment?.entity;
  const orderId: string | undefined = entity?.order_id ?? event?.payload?.order?.entity?.id;
  if (!orderId) return ok(res, { ignored: true });
  const payment = await Payment.findOne({ 'gateway.orderId': orderId });
  if (!payment) return ok(res, { ignored: true });
  if (eventId && payment.processedEvents.includes(eventId)) return ok(res, { duplicate: true });

  if (['payment.captured', 'order.paid'].includes(event.event)) {
    if (entity?.amount !== undefined && entity.amount !== payment.amount) throw new ApiError(400, 'AMOUNT_MISMATCH', 'Paid amount does not match order');
    const session = await mongoose.startSession();
    try {
      await session.withTransaction(async () => {
        const r = await creditPayment(payment._id, entity?.id, session);
        if (eventId) await Payment.updateOne({ _id: payment._id }, { $addToSet: { processedEvents: eventId } }, { session });
        return r;
      });
    } finally { await session.endSession(); }
    const stu = await Student.findById(payment.student).populate('parents', 'user').lean();
    await notifyUsers(((stu as any)?.parents ?? []).map((p: any) => p.user), { title: 'Payment received', body: `We received your payment of ${rupees(payment.amount)}.`, type: 'payment' }, true);
  } else if (event.event === 'payment.failed') {
    if (payment.status === 'created') await Payment.updateOne({ _id: payment._id }, { status: 'failed', $addToSet: { processedEvents: eventId } });
  }
  ok(res, { processed: true });
}));

paymentsRouter.use(authenticate);

paymentsRouter.post('/orders', authorize('payments:own', 'payments:record'),
  validate(z.object({ studentFeeId: objectId, amount: z.number().int().positive().optional(), idempotencyKey: z.string().min(8).max(100) })),
  asyncHandler(async (req, res) => {
    const fee = await StudentFee.findById(req.body.studentFeeId);
    if (!fee) throw ApiError.notFound();
    await assertStudentAccess(req, String(fee.student));
    const balance = fee.totalDue - fee.paid;
    const amount = req.body.amount ?? balance;
    if (amount > balance || balance <= 0) throw ApiError.badRequest('Amount exceeds outstanding balance');
    const dup = await Payment.findOne({ idempotencyKey: req.body.idempotencyKey });
    if (dup) return ok(res, { paymentId: dup._id, orderId: dup.gateway?.orderId, amount: dup.amount, keyId: env.RAZORPAY_KEY_ID, reused: true });
    let orderId: string;
    if (env.RAZORPAY_KEY_ID && env.RAZORPAY_KEY_SECRET) {
      const r = await fetch('https://api.razorpay.com/v1/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Basic ${Buffer.from(`${env.RAZORPAY_KEY_ID}:${env.RAZORPAY_KEY_SECRET}`).toString('base64')}` },
        body: JSON.stringify({ amount, currency: 'INR', receipt: req.body.idempotencyKey.slice(0, 40) }),
      });
      if (!r.ok) throw new ApiError(502, 'GATEWAY_ERROR', 'Payment gateway rejected the order');
      orderId = ((await r.json()) as any).id;
    } else if (env.isTest) orderId = `order_test_${crypto.randomBytes(6).toString('hex')}`;
    else throw new ApiError(503, 'NOT_CONFIGURED', 'Online payments are not configured. Set RAZORPAY_KEY_ID / RAZORPAY_KEY_SECRET.');
    const p = await Payment.create({ transactionId: `TXN${Date.now()}${crypto.randomBytes(3).toString('hex').toUpperCase()}`, idempotencyKey: req.body.idempotencyKey, student: fee.student, studentFee: fee._id, amount, method: 'online', gateway: { orderId }, initiatedBy: req.user!.id });
    await audit(req, 'Payment.order', 'Payment', p._id);
    ok(res, { paymentId: p._id, orderId, amount, keyId: env.RAZORPAY_KEY_ID }, undefined, 201);
  }));

paymentsRouter.post('/offline', authorize('payments:record'),
  validate(z.object({ studentFeeId: objectId, amount: z.number().int().positive(), method: z.enum(['cash', 'cheque', 'bank_transfer', 'upi']), reference: z.string().max(100).optional() })),
  asyncHandler(async (req, res) => {
    const fee = await StudentFee.findById(req.body.studentFeeId);
    if (!fee) throw ApiError.notFound();
    const session = await mongoose.startSession();
    let payment: any;
    try {
      await session.withTransaction(async () => {
        const [p] = await Payment.create([{ transactionId: `TXN${Date.now()}${crypto.randomBytes(3).toString('hex').toUpperCase()}`, student: fee.student, studentFee: fee._id, amount: req.body.amount, method: req.body.method, receivedBy: req.user!.id, gateway: { paymentId: req.body.reference } }], { session });
        payment = (await creditPayment(p._id, undefined, session)).payment;
      });
    } finally { await session.endSession(); }
    await audit(req, 'Payment.offline', 'Payment', payment._id, { amount: req.body.amount });
    ok(res, payment, undefined, 201);
  }));

paymentsRouter.get('/', authorize('payments:read', 'payments:own'), asyncHandler(async (req, res) => {
  const { page, limit, skip } = paginate(req);
  const q: any = {};
  if (!can(req, 'payments:read')) {
    const { parentChildIds } = await import('../services/access.service');
    q.student = { $in: await parentChildIds(req.user!.id) };
  }
  for (const f of ['status', 'method', 'student']) if (typeof req.query[f] === 'string' && req.query[f]) q[f] = req.query[f];
  const [items, count] = await Promise.all([Payment.find(q).populate('student', 'firstName lastName studentId').select('-processedEvents').sort({ createdAt: -1 }).skip(skip).limit(limit).lean(), Payment.countDocuments(q)]);
  ok(res, items, { page, limit, total: count });
}));

paymentsRouter.get('/:id/receipt.pdf', asyncHandler(async (req, res) => {
  const p = await Payment.findById(mustId(req.params.id)).lean();
  if (!p) throw ApiError.notFound();
  const s = await assertStudentAccess(req, String(p.student));
  if (p.status !== 'success' && p.status !== 'partially_refunded' && p.status !== 'refunded') throw ApiError.badRequest('Receipt is available only for successful payments');
  const school = await SchoolSettings.findOne({ key: 'default' }).lean();
  const doc = startPdf(res, `${p.receiptNumber}.pdf`, school?.schoolName ?? 'School', 'Fee receipt');
  kv(doc, [['Receipt No', p.receiptNumber ?? ''], ['Transaction ID', p.transactionId], ['Date', p.paidAt?.toISOString().slice(0, 10) ?? ''], ['Student', `${s.firstName} ${s.lastName}`.trim()], ['Student ID', s.studentId], ['Method', p.method], ['Amount paid', rupees(p.amount)]]);
  doc.end();
}));

paymentsRouter.post('/:id/refund-request', authorize('refunds:request', 'refunds:approve'), validate(z.object({ amount: z.number().int().positive(), reason: z.string().min(3).max(500) })), asyncHandler(async (req, res) => {
  const p = await Payment.findById(mustId(req.params.id));
  if (!p) throw ApiError.notFound();
  if (p.status !== 'success' && p.status !== 'partially_refunded') throw ApiError.badRequest('Only successful payments can be refunded');
  if (req.body.amount > p.amount - (p.refund?.status === 'approved' ? p.refund.amount ?? 0 : 0)) throw ApiError.badRequest('Refund exceeds paid amount');
  p.refund = { amount: req.body.amount, reason: req.body.reason, status: 'requested', requestedBy: req.user!.id as any } as any;
  await p.save(); await audit(req, 'Payment.refund_request', 'Payment', p._id, req.body); ok(res, p.refund);
}));

paymentsRouter.post('/:id/refund-decision', authorize('refunds:approve'), validate(z.object({ approve: z.boolean() })), asyncHandler(async (req, res) => {
  const session = await mongoose.startSession(); let out: any;
  try {
    await session.withTransaction(async () => {
      const p = await Payment.findById(mustId(req.params.id)).session(session);
      if (!p || p.refund?.status !== 'requested') throw ApiError.conflict('No pending refund request');
      p.refund!.status = req.body.approve ? 'approved' : 'rejected'; p.refund!.approvedBy = req.user!.id as any;
      if (req.body.approve) {
        p.status = p.refund!.amount === p.amount ? 'refunded' : 'partially_refunded';
        await StudentFee.updateOne({ _id: p.studentFee }, { $inc: { paid: -p.refund!.amount!, refunded: p.refund!.amount! } }, { session });
      }
      await p.save({ session }); out = p;
    });
  } finally { await session.endSession(); }
  await audit(req, 'Payment.refund_decision', 'Payment', out._id, req.body); ok(res, out);
}));
