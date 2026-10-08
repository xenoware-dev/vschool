import prisma from '../config/db.js';
import {
  addDays,
  currentPeriod,
  inCenter,
  monthRange,
  outsideScope,
  scopedWhere,
  startOfDay,
} from '../utils/scope.js';
import { serializePayment, serializePayout, serializeProfile } from '../utils/serialize.js';

const CLINICIANS = ['therapist', 'teacher'];

const PAYMENT_INCLUDE = {
  patient: {
    select: {
      id: true,
      name: true,
      studentId: true,
      parentName: true,
      parentPhone: true,
      parentEmail: true,
      parentRelationship: true,
      parentAddress: true,
    },
  },
  branch: { select: { id: true, name: true, code: true, city: true, address: true, phone: true } },
  recordedBy: { select: { id: true, name: true } },
};

// Next receipt number for a branch, e.g. BR001-2026-0007
const nextReceiptNo = async (branchId) => {
  const branch = await prisma.branch.findUnique({ where: { id: branchId }, select: { code: true } });
  const prefix = `${branch?.code || 'BR'}-${new Date().getFullYear()}-`;
  const last = await prisma.payment.findFirst({
    where: { branchId, receiptNo: { startsWith: prefix } },
    orderBy: { receiptNo: 'desc' },
    select: { receiptNo: true },
  });
  const seq = last ? Number(last.receiptNo.slice(prefix.length)) + 1 : 1;
  return `${prefix}${String(seq).padStart(4, '0')}`;
};

// ─── Fee payments ────────────────────────────────────────────────────────────

// @route  GET /api/billing/payments?status=&patient=&from=&to=&branch=
export const getPayments = async (req, res) => {
  const { status, patient, from, to, branch } = req.query;
  let where;

  if (req.user.role === 'parent') {
    where = { ...inCenter(req.user), patient: { parentId: req.user.id } };
  } else {
    where = scopedWhere(req.user, branch);
    if (patient) where.patientId = patient;
  }
  if (status) where.status = status;
  if (from || to) {
    where.createdAt = {
      ...(from && { gte: startOfDay(from) }),
      ...(to && { lt: addDays(startOfDay(to), 1) }),
    };
  }

  const payments = await prisma.payment.findMany({
    where,
    include: PAYMENT_INCLUDE,
    orderBy: { createdAt: 'desc' },
  });
  res.json(payments.map(serializePayment));
};

// @route  POST /api/billing/payments
export const createPayment = async (req, res) => {
  const branchId = req.user.branchId;
  const { patient, department, description, amount, method, status, dueDate, reference } = req.body;

  const child = await prisma.patient.findFirst({
    where: { id: patient, branchId, ...inCenter(req.user) },
    select: { id: true },
  });
  if (!child) return res.status(404).json({ message: 'Child not found in your branch' });
  if (!description || !(Number(amount) > 0)) {
    return res.status(400).json({ message: 'Description and an amount above zero are required' });
  }

  const isPaid = (status || 'paid') === 'paid';
  // Retry once if two receipts race for the same number
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const payment = await prisma.payment.create({
        data: {
          centerId: req.user.centerId,
          branchId,
          receiptNo: await nextReceiptNo(branchId),
          patientId: child.id,
          department: department || null,
          description,
          amount: Number(amount),
          ...(method && { method }),
          status: isPaid ? 'paid' : 'pending',
          paidAt: isPaid ? new Date() : null,
          dueDate: !isPaid && dueDate ? startOfDay(dueDate) : null,
          reference: reference || '',
          recordedById: req.user.id,
        },
        include: PAYMENT_INCLUDE,
      });
      return res.status(201).json(serializePayment(payment));
    } catch (err) {
      if (err.code !== 'P2002' || attempt === 1) throw err;
    }
  }
};

// @route  PATCH /api/billing/payments/:id   (mark paid / edit details)
export const updatePayment = async (req, res) => {
  const payment = await prisma.payment.findUnique({ where: { id: req.params.id } });
  if (!payment || payment.centerId !== req.user.centerId) {
    return res.status(404).json({ message: 'Payment not found' });
  }
  if (outsideScope(req.user, payment)) return res.status(403).json({ message: 'Access denied' });

  const { description, amount, method, status, reference, dueDate } = req.body;
  const data = {};
  if (description !== undefined) data.description = description;
  if (amount !== undefined) data.amount = Number(amount);
  if (method !== undefined) data.method = method;
  if (reference !== undefined) data.reference = reference;
  if (dueDate !== undefined) data.dueDate = dueDate ? startOfDay(dueDate) : null;
  if (status && status !== payment.status) {
    data.status = status;
    data.paidAt = status === 'paid' ? new Date() : null;
  }

  const updated = await prisma.payment.update({
    where: { id: payment.id },
    data,
    include: PAYMENT_INCLUDE,
  });
  res.json(serializePayment(updated));
};

// ─── Staff payroll ───────────────────────────────────────────────────────────

// @route  GET /api/billing/payroll?period=YYYY-MM&branch=
// One row per therapist/teacher: completed sessions, their rate, and any payout already made
export const getPayroll = async (req, res) => {
  const period = req.query.period || currentPeriod();
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(period)) {
    return res.status(400).json({ message: 'period must be YYYY-MM' });
  }
  const where = scopedWhere(req.user, req.query.branch);
  const { start, end } = monthRange(period);

  const [staff, sessions, payouts] = await Promise.all([
    prisma.profile.findMany({
      where: { ...where, role: { in: CLINICIANS } },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        departments: true,
        sessionRate: true,
        isActive: true,
        branchId: true,
        branch: { select: { id: true, name: true, code: true } },
      },
      orderBy: { name: 'asc' },
    }),
    prisma.appointment.groupBy({
      by: ['therapistId'],
      where: { ...where, status: 'completed', date: { gte: start, lt: end } },
      _count: { _all: true },
    }),
    prisma.payout.findMany({
      where: { ...where, period },
      include: { recordedBy: { select: { id: true, name: true } } },
    }),
  ]);

  const rows = staff
    .map((s) => {
      const completed = sessions.find((r) => r.therapistId === s.id)?._count._all || 0;
      const rate = Number(s.sessionRate ?? 0);
      const payout = payouts.find((p) => p.staffId === s.id);
      return {
        staff: serializeProfile(s),
        completedSessions: completed,
        ratePerSession: rate,
        estimatedAmount: completed * rate,
        payout: payout ? serializePayout(payout) : null,
      };
    })
    // Hide inactive staff with nothing to pay for this month
    .filter((r) => r.staff.isActive || r.completedSessions > 0 || r.payout);

  res.json({ period, rows });
};

// @route  POST /api/billing/payouts   (records / updates the payout for a staff member + month)
export const savePayout = async (req, res) => {
  const { staff, period, method, reference } = req.body;
  const sessions = Number(req.body.sessions) || 0;
  const ratePerSession = Number(req.body.ratePerSession) || 0;
  const bonus = Number(req.body.bonus) || 0;
  const deductions = Number(req.body.deductions) || 0;

  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(period || '')) {
    return res.status(400).json({ message: 'period must be YYYY-MM' });
  }

  const member = await prisma.profile.findFirst({
    where: { id: staff, role: { in: CLINICIANS }, ...inCenter(req.user) },
  });
  if (!member || outsideScope(req.user, member)) {
    return res.status(404).json({ message: 'Staff member not found in your branch' });
  }

  const amount = Math.max(0, sessions * ratePerSession + bonus - deductions);
  const values = {
    sessions,
    ratePerSession,
    bonus,
    deductions,
    amount,
    ...(method && { method }),
    reference: reference || '',
    paidAt: new Date(),
    recordedById: req.user.id,
  };

  const payout = await prisma.payout.upsert({
    where: { staffId_period: { staffId: member.id, period } },
    create: {
      ...values,
      centerId: req.user.centerId,
      branchId: member.branchId,
      staffId: member.id,
      period,
    },
    update: values,
    include: { recordedBy: { select: { id: true, name: true } } },
  });

  res.status(201).json(serializePayout(payout));
};

// ─── Summary (dashboard tiles) ───────────────────────────────────────────────

// @route  GET /api/billing/summary?period=YYYY-MM&branch=
export const getBillingSummary = async (req, res) => {
  const period = req.query.period || currentPeriod();
  const where = scopedWhere(req.user, req.query.branch);
  const { start, end } = monthRange(period);

  const [collected, pending, paidOut] = await Promise.all([
    prisma.payment.aggregate({
      where: { ...where, status: 'paid', paidAt: { gte: start, lt: end } },
      _sum: { amount: true },
      _count: { _all: true },
    }),
    prisma.payment.aggregate({
      where: { ...where, status: 'pending' },
      _sum: { amount: true },
      _count: { _all: true },
    }),
    prisma.payout.aggregate({
      where: { ...where, period },
      _sum: { amount: true },
      _count: { _all: true },
    }),
  ]);

  const pick = (r) => ({ total: Number(r._sum.amount || 0), count: r._count._all });
  res.json({ period, collected: pick(collected), pending: pick(pending), payouts: pick(paidOut) });
};
