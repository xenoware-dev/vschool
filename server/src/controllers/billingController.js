import mongoose from 'mongoose';
import Payment from '../models/Payment.js';
import Payout from '../models/Payout.js';
import Patient from '../models/Patient.js';
import Appointment from '../models/Appointment.js';
import User from '../models/User.js';
import Branch from '../models/Branch.js';
import {
  addDays,
  monthRange,
  outsideBranch,
  sameId,
  scopedBranch,
  startOfDay,
  userBranchId,
} from '../utils/scope.js';

const populatePayment = (query) =>
  query
    .populate('patient', 'name studentId parentDetails')
    .populate('branch', 'name code city address phone')
    .populate('recordedBy', 'name');

const currentPeriod = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
};

// Next receipt number for a branch, e.g. BR001-2026-0007
const nextReceiptNo = async (branchId) => {
  const branch = await Branch.findById(branchId).select('code');
  const year = new Date().getFullYear();
  const prefix = `${branch?.code || 'BR'}-${year}-`;
  const last = await Payment.findOne({ branch: branchId, receiptNo: { $regex: `^${prefix}` } })
    .sort({ receiptNo: -1 })
    .select('receiptNo');
  const seq = last ? Number(last.receiptNo.slice(prefix.length)) + 1 : 1;
  return `${prefix}${String(seq).padStart(4, '0')}`;
};

// ─── Fee payments ────────────────────────────────────────────────────────────

// @route  GET /api/billing/payments?status=&patient=&from=&to=&branch=
export const getPayments = async (req, res) => {
  const { status, patient, from, to, branch } = req.query;
  const filter = {};

  if (req.user.role === 'parent') {
    filter.patient = { $in: req.user.children || [] };
  } else {
    const scoped = scopedBranch(req.user, branch);
    if (scoped) filter.branch = scoped;
    if (patient) filter.patient = patient;
  }
  if (status) filter.status = status;
  if (from || to) {
    filter.createdAt = {};
    if (from) filter.createdAt.$gte = startOfDay(from);
    if (to) filter.createdAt.$lt = addDays(startOfDay(to), 1);
  }

  const payments = await populatePayment(Payment.find(filter)).sort({ createdAt: -1 });
  res.json(payments);
};

// @route  POST /api/billing/payments
export const createPayment = async (req, res) => {
  const branchId = userBranchId(req.user);
  const { patient, department, description, amount, method, status, dueDate, reference } = req.body;

  const child = await Patient.findById(patient).select('branch');
  if (!child || !sameId(child.branch, branchId)) {
    return res.status(404).json({ message: 'Child not found in your branch' });
  }

  const isPaid = (status || 'paid') === 'paid';
  // Retry once if two receipts race for the same number
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const payment = await Payment.create({
        receiptNo: await nextReceiptNo(branchId),
        branch: branchId,
        patient,
        department: department || undefined,
        description,
        amount,
        method,
        status: isPaid ? 'paid' : 'pending',
        paidAt: isPaid ? new Date() : null,
        dueDate: !isPaid && dueDate ? startOfDay(dueDate) : null,
        reference,
        recordedBy: req.user._id,
      });
      return res.status(201).json(await populatePayment(Payment.findById(payment._id)));
    } catch (err) {
      if (err.code !== 11000 || attempt === 1) throw err;
    }
  }
};

// @route  PATCH /api/billing/payments/:id   (mark paid / edit details)
export const updatePayment = async (req, res) => {
  const payment = await Payment.findById(req.params.id);
  if (!payment) return res.status(404).json({ message: 'Payment not found' });
  if (outsideBranch(req.user, payment.branch))
    return res.status(403).json({ message: 'Access denied' });

  const { description, amount, method, status, reference, dueDate } = req.body;
  if (description !== undefined) payment.description = description;
  if (amount !== undefined) payment.amount = amount;
  if (method !== undefined) payment.method = method;
  if (reference !== undefined) payment.reference = reference;
  if (dueDate !== undefined) payment.dueDate = dueDate ? startOfDay(dueDate) : null;
  if (status && status !== payment.status) {
    payment.status = status;
    payment.paidAt = status === 'paid' ? new Date() : null;
  }

  await payment.save();
  res.json(await populatePayment(Payment.findById(payment._id)));
};

// ─── Staff payroll ───────────────────────────────────────────────────────────

// Completed sessions per clinician for a branch + month
const completedSessionsByStaff = async (branchId, period) => {
  const { start, end } = monthRange(period);
  const match = { status: 'completed', date: { $gte: start, $lt: end } };
  if (branchId) match.branch = new mongoose.Types.ObjectId(String(branchId));
  const rows = await Appointment.aggregate([
    { $match: match },
    { $group: { _id: '$therapist', sessions: { $sum: 1 } } },
  ]);
  return Object.fromEntries(rows.map((r) => [r._id.toString(), r.sessions]));
};

// @route  GET /api/billing/payroll?period=YYYY-MM&branch=
// One row per therapist/teacher: completed sessions, their rate, and any payout already made
export const getPayroll = async (req, res) => {
  const period = req.query.period || currentPeriod();
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(period)) {
    return res.status(400).json({ message: 'period must be YYYY-MM' });
  }
  const branchId = scopedBranch(req.user, req.query.branch);

  const staffFilter = { role: { $in: ['therapist', 'teacher'] } };
  if (branchId) staffFilter.branch = branchId;

  const [staff, sessions, payouts] = await Promise.all([
    User.find(staffFilter)
      .select('name email role departments sessionRate isActive branch')
      .populate('branch', 'name code')
      .sort('name'),
    completedSessionsByStaff(branchId, period),
    Payout.find({ period, ...(branchId && { branch: branchId }) }).populate('recordedBy', 'name'),
  ]);

  const payoutByStaff = Object.fromEntries(payouts.map((p) => [p.staff.toString(), p]));

  const rows = staff
    .map((s) => {
      const completed = sessions[s._id.toString()] || 0;
      const payout = payoutByStaff[s._id.toString()] || null;
      return {
        staff: s,
        completedSessions: completed,
        ratePerSession: s.sessionRate ?? 0,
        estimatedAmount: completed * (s.sessionRate ?? 0),
        payout,
      };
    })
    // Hide inactive staff with nothing to pay for this month
    .filter((r) => r.staff.isActive || r.completedSessions > 0 || r.payout);

  res.json({ period, rows });
};

// @route  POST /api/billing/payouts   (records / updates the payout for a staff member + month)
export const savePayout = async (req, res) => {
  const {
    staff,
    period,
    sessions,
    ratePerSession,
    bonus = 0,
    deductions = 0,
    method,
    reference,
  } = req.body;

  const member = await User.findById(staff).select('role branch');
  if (
    !member ||
    !['therapist', 'teacher'].includes(member.role) ||
    outsideBranch(req.user, member.branch)
  ) {
    return res.status(404).json({ message: 'Staff member not found in your branch' });
  }

  const amount = Math.max(
    0,
    Number(sessions) * Number(ratePerSession) + Number(bonus) - Number(deductions)
  );

  const payout = await Payout.findOneAndUpdate(
    { staff, period },
    {
      branch: member.branch,
      staff,
      period,
      sessions,
      ratePerSession,
      bonus,
      deductions,
      amount,
      method,
      reference,
      paidAt: new Date(),
      recordedBy: req.user._id,
    },
    { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true }
  ).populate('recordedBy', 'name');

  res.status(201).json(payout);
};

// ─── Summary (dashboard tiles) ───────────────────────────────────────────────

// @route  GET /api/billing/summary?period=YYYY-MM&branch=
export const getBillingSummary = async (req, res) => {
  const period = req.query.period || currentPeriod();
  const branchId = scopedBranch(req.user, req.query.branch);
  const { start, end } = monthRange(period);
  const branchMatch = branchId ? { branch: new mongoose.Types.ObjectId(String(branchId)) } : {};

  const [collected, pending, paidOut] = await Promise.all([
    Payment.aggregate([
      { $match: { ...branchMatch, status: 'paid', paidAt: { $gte: start, $lt: end } } },
      { $group: { _id: null, total: { $sum: '$amount' }, count: { $sum: 1 } } },
    ]),
    Payment.aggregate([
      { $match: { ...branchMatch, status: 'pending' } },
      { $group: { _id: null, total: { $sum: '$amount' }, count: { $sum: 1 } } },
    ]),
    Payout.aggregate([
      { $match: { ...branchMatch, period } },
      { $group: { _id: null, total: { $sum: '$amount' }, count: { $sum: 1 } } },
    ]),
  ]);

  const pick = (rows) => ({ total: rows[0]?.total || 0, count: rows[0]?.count || 0 });
  res.json({ period, collected: pick(collected), pending: pick(pending), payouts: pick(paidOut) });
};
