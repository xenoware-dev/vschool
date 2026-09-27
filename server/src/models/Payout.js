import mongoose from 'mongoose';

// Monthly salary disbursement for a therapist / teacher, based on completed sessions.
const payoutSchema = new mongoose.Schema(
  {
    branch: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Branch',
      required: true,
    },
    staff: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    // Pay period, e.g. "2026-09"
    period: {
      type: String,
      required: true,
      match: [/^\d{4}-(0[1-9]|1[0-2])$/, 'Period must be in YYYY-MM format'],
    },
    sessions: { type: Number, min: 0, default: 0 },
    ratePerSession: { type: Number, min: 0, default: 0 },
    bonus: { type: Number, min: 0, default: 0 },
    deductions: { type: Number, min: 0, default: 0 },
    amount: { type: Number, min: 0, required: true },
    method: {
      type: String,
      enum: ['bank_transfer', 'upi', 'cheque', 'cash'],
      default: 'bank_transfer',
    },
    reference: { type: String, trim: true, default: '' },
    paidAt: { type: Date, default: Date.now },
    recordedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
  },
  { timestamps: true }
);

// One payout per staff member per month
payoutSchema.index({ staff: 1, period: 1 }, { unique: true });
payoutSchema.index({ branch: 1, period: 1 });

const Payout = mongoose.model('Payout', payoutSchema);
export default Payout;
