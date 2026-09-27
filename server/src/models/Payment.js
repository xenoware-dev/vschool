import mongoose from 'mongoose';
import { DEPARTMENT_KEYS } from '../utils/constants.js';

export const PAYMENT_METHODS = ['upi', 'cash', 'card', 'bank_transfer', 'cheque'];
export const PAYMENT_STATUSES = ['paid', 'pending'];

// A fee invoice / receipt raised against a child. Pending = invoice, paid = receipt.
const paymentSchema = new mongoose.Schema(
  {
    receiptNo: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
    },
    branch: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Branch',
      required: true,
    },
    patient: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Patient',
      required: [true, 'Child is required'],
    },
    department: {
      type: String,
      enum: DEPARTMENT_KEYS,
      default: undefined,
    },
    description: {
      type: String,
      required: [true, 'Description is required'],
      trim: true,
    },
    amount: {
      type: Number,
      required: [true, 'Amount is required'],
      min: [1, 'Amount must be greater than zero'],
    },
    method: {
      type: String,
      enum: PAYMENT_METHODS,
      default: 'upi',
    },
    status: {
      type: String,
      enum: PAYMENT_STATUSES,
      default: 'paid',
    },
    // Date the money was received (null while pending)
    paidAt: {
      type: Date,
      default: null,
    },
    dueDate: {
      type: Date,
      default: null,
    },
    reference: {
      type: String,
      trim: true,
      default: '',
    },
    recordedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
  },
  { timestamps: true }
);

paymentSchema.index({ branch: 1, receiptNo: 1 }, { unique: true });
paymentSchema.index({ branch: 1, status: 1, createdAt: -1 });
paymentSchema.index({ patient: 1 });

const Payment = mongoose.model('Payment', paymentSchema);
export default Payment;
