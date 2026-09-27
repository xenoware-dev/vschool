import Branch from '../models/Branch.js';
import Patient from '../models/Patient.js';
import User from '../models/User.js';
import Appointment from '../models/Appointment.js';
import Payment from '../models/Payment.js';
import { dayRange } from '../utils/scope.js';

const BRANCH_FIELDS = [
  'name',
  'code',
  'address',
  'city',
  'phone',
  'email',
  'facilities',
  'departments',
];

const countBy = (rows) => Object.fromEntries(rows.map((r) => [r._id?.toString(), r]));

// ─── Create Branch (owner only) ───────────────────────────────────────────────
// @route  POST /api/branches
export const createBranch = async (req, res) => {
  const { name, code, address, city, phone, email, facilities, departments } = req.body;

  const existing = await Branch.findOne({ code: code?.toUpperCase() });
  if (existing) {
    return res.status(400).json({ message: 'A branch with this code already exists' });
  }

  const branch = await Branch.create({
    name,
    code,
    address,
    city,
    phone,
    email,
    ...(facilities?.length && { facilities }),
    departments: departments || [],
    createdBy: req.user._id,
  });

  res.status(201).json(branch);
};

// ─── Get all branches ─────────────────────────────────────────────────────────
// @route  GET /api/branches
// Owner → all branches. Admin/Therapist → their branch only.
export const getBranches = async (req, res) => {
  if (req.user.role === 'owner') {
    const branches = await Branch.find().sort({ createdAt: -1 });
    return res.json(branches);
  }

  if (!req.user.branch) {
    return res.json([]);
  }

  const branch = await Branch.findById(req.user.branch);
  res.json(branch ? [branch] : []);
};

// ─── Get single branch ────────────────────────────────────────────────────────
// @route  GET /api/branches/:id
export const getBranch = async (req, res) => {
  const branch = await Branch.findById(req.params.id);
  if (!branch) return res.status(404).json({ message: 'Branch not found' });

  // Non-owners can only view their own branch
  if (req.user.role !== 'owner' && branch._id.toString() !== req.user.branch?._id?.toString()) {
    return res.status(403).json({ message: 'Access denied' });
  }

  res.json(branch);
};

// ─── Update Branch (owner only) ───────────────────────────────────────────────
// @route  PUT /api/branches/:id
export const updateBranch = async (req, res) => {
  const updates = Object.fromEntries(
    BRANCH_FIELDS.filter((f) => req.body[f] !== undefined).map((f) => [f, req.body[f]])
  );

  if (updates.code) {
    const clash = await Branch.exists({
      code: updates.code.toUpperCase(),
      _id: { $ne: req.params.id },
    });
    if (clash) return res.status(400).json({ message: 'A branch with this code already exists' });
  }

  const branch = await Branch.findByIdAndUpdate(req.params.id, updates, {
    new: true,
    runValidators: true,
  });
  if (!branch) return res.status(404).json({ message: 'Branch not found' });

  // If branch name changed, keep student records synchronized
  if (req.body.name) {
    await Patient.updateMany({ branch: branch._id }, { branchName: branch.name });
  }

  res.json(branch);
};

// ─── Toggle Branch active/inactive (owner only) ───────────────────────────────
// @route  PATCH /api/branches/:id/toggle
export const toggleBranch = async (req, res) => {
  const branch = await Branch.findById(req.params.id);
  if (!branch) return res.status(404).json({ message: 'Branch not found' });

  branch.isActive = !branch.isActive;
  await branch.save();
  res.json({ message: `Branch ${branch.isActive ? 'activated' : 'deactivated'}`, branch });
};

// ─── Network overview (owner dashboard) ──────────────────────────────────────
// @route  GET /api/branches/overview
// Per-branch headline numbers in one round-trip
export const getBranchOverview = async (_req, res) => {
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  const [branches, patients, staff, today, revenue] = await Promise.all([
    Branch.find().sort({ code: 1 }),
    Patient.aggregate([
      {
        $group: {
          _id: '$branch',
          active: { $sum: { $cond: [{ $eq: ['$status', 'active'] }, 1, 0] } },
          total: { $sum: 1 },
        },
      },
    ]),
    User.aggregate([
      { $match: { role: { $in: ['admin', 'therapist', 'teacher'] }, isActive: true } },
      {
        $group: {
          _id: '$branch',
          clinicians: { $sum: { $cond: [{ $in: ['$role', ['therapist', 'teacher']] }, 1, 0] } },
          admins: { $sum: { $cond: [{ $eq: ['$role', 'admin'] }, 1, 0] } },
        },
      },
    ]),
    Appointment.aggregate([
      { $match: { date: dayRange(now) } },
      {
        $group: {
          _id: '$branch',
          total: { $sum: 1 },
          completed: { $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] } },
        },
      },
    ]),
    Payment.aggregate([
      { $match: { status: 'paid', paidAt: { $gte: monthStart } } },
      { $group: { _id: '$branch', total: { $sum: '$amount' } } },
    ]),
  ]);

  const p = countBy(patients);
  const s = countBy(staff);
  const t = countBy(today);
  const r = countBy(revenue);

  res.json(
    branches.map((b) => {
      const id = b._id.toString();
      return {
        branch: b,
        activePatients: p[id]?.active || 0,
        totalPatients: p[id]?.total || 0,
        clinicians: s[id]?.clinicians || 0,
        admins: s[id]?.admins || 0,
        todaySessions: t[id]?.total || 0,
        todayCompleted: t[id]?.completed || 0,
        monthRevenue: r[id]?.total || 0,
      };
    })
  );
};
