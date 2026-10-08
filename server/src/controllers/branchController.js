import prisma from '../config/db.js';
import { inCenter, today } from '../utils/scope.js';
import { serializeBranch } from '../utils/serialize.js';

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

const pickFields = (body) =>
  Object.fromEntries(BRANCH_FIELDS.filter((f) => body[f] !== undefined).map((f) => [f, body[f]]));

const findOwnBranch = (user, id) => prisma.branch.findFirst({ where: { id, ...inCenter(user) } });

// ─── Create Branch (owner only) ───────────────────────────────────────────────
// @route  POST /api/branches
export const createBranch = async (req, res) => {
  const data = pickFields(req.body);
  if (!data.name || !data.code) {
    return res.status(400).json({ message: 'Branch name and code are required' });
  }
  data.code = data.code.toUpperCase().trim();
  if (!data.facilities?.length) delete data.facilities;

  const clash = await prisma.branch.findFirst({ where: { ...inCenter(req.user), code: data.code } });
  if (clash) return res.status(400).json({ message: 'A branch with this code already exists' });

  const branch = await prisma.branch.create({
    data: { ...data, centerId: req.user.centerId, createdById: req.user.id },
  });
  res.status(201).json(serializeBranch(branch));
};

// ─── Get all branches ─────────────────────────────────────────────────────────
// @route  GET /api/branches
// Owner → all branches of the center. Everyone else → their own branch only.
export const getBranches = async (req, res) => {
  if (req.user.role === 'owner') {
    const branches = await prisma.branch.findMany({
      where: inCenter(req.user),
      orderBy: { createdAt: 'desc' },
    });
    return res.json(branches.map(serializeBranch));
  }

  if (!req.user.branchId) return res.json([]);
  const branch = await findOwnBranch(req.user, req.user.branchId);
  res.json(branch ? [serializeBranch(branch)] : []);
};

// ─── Get single branch ────────────────────────────────────────────────────────
// @route  GET /api/branches/:id
export const getBranch = async (req, res) => {
  const branch = await findOwnBranch(req.user, req.params.id);
  if (!branch) return res.status(404).json({ message: 'Branch not found' });

  if (req.user.role !== 'owner' && branch.id !== req.user.branchId) {
    return res.status(403).json({ message: 'Access denied' });
  }
  res.json(serializeBranch(branch));
};

// ─── Update Branch (owner only) ───────────────────────────────────────────────
// @route  PUT /api/branches/:id
export const updateBranch = async (req, res) => {
  const existing = await findOwnBranch(req.user, req.params.id);
  if (!existing) return res.status(404).json({ message: 'Branch not found' });

  const updates = pickFields(req.body);
  if (updates.code) {
    updates.code = updates.code.toUpperCase().trim();
    const clash = await prisma.branch.findFirst({
      where: { ...inCenter(req.user), code: updates.code, NOT: { id: existing.id } },
    });
    if (clash) return res.status(400).json({ message: 'A branch with this code already exists' });
  }

  const branch = await prisma.branch.update({ where: { id: existing.id }, data: updates });
  res.json(serializeBranch(branch));
};

// ─── Toggle Branch active/inactive (owner only) ───────────────────────────────
// @route  PATCH /api/branches/:id/toggle
export const toggleBranch = async (req, res) => {
  const existing = await findOwnBranch(req.user, req.params.id);
  if (!existing) return res.status(404).json({ message: 'Branch not found' });

  const branch = await prisma.branch.update({
    where: { id: existing.id },
    data: { isActive: !existing.isActive },
  });
  res.json({
    message: `Branch ${branch.isActive ? 'activated' : 'deactivated'}`,
    branch: serializeBranch(branch),
  });
};

// ─── Network overview (owner dashboard) ──────────────────────────────────────
// @route  GET /api/branches/overview
// Per-branch headline numbers in one round-trip
export const getBranchOverview = async (req, res) => {
  const where = inCenter(req.user);
  const now = new Date();
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));

  const [branches, patients, activePatients, staff, todaySessions, todayDone, revenue] =
    await Promise.all([
      prisma.branch.findMany({ where, orderBy: { code: 'asc' } }),
      prisma.patient.groupBy({ by: ['branchId'], where, _count: { _all: true } }),
      prisma.patient.groupBy({
        by: ['branchId'],
        where: { ...where, status: 'active' },
        _count: { _all: true },
      }),
      prisma.profile.groupBy({
        by: ['branchId', 'role'],
        where: { ...where, role: { in: ['admin', 'therapist', 'teacher'] }, isActive: true },
        _count: { _all: true },
      }),
      prisma.appointment.groupBy({
        by: ['branchId'],
        where: { ...where, date: today() },
        _count: { _all: true },
      }),
      prisma.appointment.groupBy({
        by: ['branchId'],
        where: { ...where, date: today(), status: 'completed' },
        _count: { _all: true },
      }),
      prisma.payment.groupBy({
        by: ['branchId'],
        where: { ...where, status: 'paid', paidAt: { gte: monthStart } },
        _sum: { amount: true },
      }),
    ]);

  const countOf = (rows, id) => rows.find((r) => r.branchId === id)?._count._all || 0;
  const staffOf = (id, roles) =>
    staff
      .filter((r) => r.branchId === id && roles.includes(r.role))
      .reduce((sum, r) => sum + r._count._all, 0);

  res.json(
    branches.map((b) => ({
      branch: serializeBranch(b),
      activePatients: countOf(activePatients, b.id),
      totalPatients: countOf(patients, b.id),
      clinicians: staffOf(b.id, ['therapist', 'teacher']),
      admins: staffOf(b.id, ['admin']),
      todaySessions: countOf(todaySessions, b.id),
      todayCompleted: countOf(todayDone, b.id),
      monthRevenue: Number(revenue.find((r) => r.branchId === b.id)?._sum.amount || 0),
    }))
  );
};
