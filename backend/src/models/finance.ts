import { Schema, model } from 'mongoose';
const ref = (to: string, extra: object = {}) => ({ type: Schema.Types.ObjectId, ref: to, ...extra });

export const FEE_TYPES = ['admission', 'tuition', 'examination', 'transport', 'library', 'other'] as const;

export const FeeStructure = model(
  'FeeStructure',
  new Schema(
    {
      name: { type: String, required: true },
      class: ref('Class', { index: true }),
      academicYear: ref('AcademicYear', { required: true }),
      items: [
        {
          name: { type: String, required: true },
          type: { type: String, enum: FEE_TYPES, required: true },
          amount: { type: Number, required: true, min: 0 }, // paise
          dueDate: Date,
        },
      ],
      installments: { type: Number, default: 1, min: 1 },
      lateFeePerDay: { type: Number, default: 0 },
      deletedAt: { type: Date, default: null },
    },
    { timestamps: true },
  ),
);

const StudentFeeSchema = new Schema(
  {
    student: ref('Student', { required: true, index: true }),
    structure: ref('FeeStructure'),
    academicYear: ref('AcademicYear', { required: true }),
    items: [{ name: String, type: { type: String, enum: FEE_TYPES }, amount: Number, dueDate: Date }],
    discount: { type: Number, default: 0 },
    scholarship: { type: Number, default: 0 },
    lateFee: { type: Number, default: 0 },
    totalDue: { type: Number, required: true },
    paid: { type: Number, default: 0 },
    refunded: { type: Number, default: 0 },
    note: String,
  },
  { timestamps: true },
);
StudentFeeSchema.index({ student: 1, academicYear: 1, structure: 1 }, { unique: true });
export const StudentFee = model('StudentFee', StudentFeeSchema);

export const Payment = model(
  'Payment',
  new Schema(
    {
      transactionId: { type: String, required: true, unique: true },
      idempotencyKey: { type: String, unique: true, sparse: true },
      student: ref('Student', { required: true, index: true }),
      studentFee: ref('StudentFee', { required: true }),
      amount: { type: Number, required: true, min: 1 },
      method: { type: String, enum: ['online', 'cash', 'cheque', 'bank_transfer', 'upi'], required: true },
      status: { type: String, enum: ['created', 'success', 'failed', 'refunded', 'partially_refunded'], default: 'created', index: true },
      gateway: { orderId: { type: String, index: true, sparse: true }, paymentId: String },
      receiptNumber: { type: String, unique: true, sparse: true },
      paidAt: Date,
      receivedBy: ref('User'),
      initiatedBy: ref('User'),
      processedEvents: [String],
      refund: {
        amount: Number,
        reason: String,
        status: { type: String, enum: ['requested', 'approved', 'rejected'] },
        requestedBy: ref('User'),
        approvedBy: ref('User'),
      },
    },
    { timestamps: true },
  ),
);

export const Counter = model('Counter', new Schema({ _id: String, seq: { type: Number, default: 0 } }));
