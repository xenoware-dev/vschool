import prisma from '../config/db.js';
import supabase from '../config/supabase.js';
import { inCenter, scopedWhere, userBranchId } from '../utils/scope.js';
import { serializeProfile } from '../utils/serialize.js';

// Roles each manager role may create / manage
const MANAGEABLE = {
  owner: ['admin', 'therapist', 'teacher', 'parent'],
  admin: ['therapist', 'teacher', 'parent'],
};
const BRANCH_ROLES = ['admin', 'therapist', 'teacher'];
const CLINICIANS = ['therapist', 'teacher'];

const PROFILE_INCLUDE = {
  branch: { select: { id: true, name: true, code: true, city: true } },
  children: { select: { id: true, name: true, studentId: true } },
};

const loadProfile = (id) => prisma.profile.findUnique({ where: { id }, include: PROFILE_INCLUDE });

const branchInCenter = (user, branchId) =>
  prisma.branch.findFirst({ where: { id: branchId, ...inCenter(user) }, select: { id: true } });

// Loads the target user and checks the requester may manage them
const loadManageable = async (req, res) => {
  const user = await prisma.profile.findFirst({
    where: { id: req.params.id, ...inCenter(req.user) },
  });
  if (!user) {
    res.status(404).json({ message: 'User not found' });
    return null;
  }
  const outsideBranch = req.user.role !== 'owner' && user.branchId !== req.user.branchId;
  if (!MANAGEABLE[req.user.role]?.includes(user.role) || outsideBranch) {
    res.status(403).json({ message: 'You do not have permission to manage this account' });
    return null;
  }
  return user;
};

// Creates the Supabase Auth login and its profile together; if the profile
// cannot be saved the login is removed again so no orphan account remains.
export const createAccount = async ({ email, password, ...profile }) => {
  const { data, error } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (error) {
    const err = new Error(
      /already been registered|already exists/i.test(error.message)
        ? 'An account with this email already exists'
        : error.message
    );
    err.status = 400;
    throw err;
  }
  try {
    return await prisma.profile.create({ data: { id: data.user.id, email, ...profile } });
  } catch (err) {
    await supabase.auth.admin.deleteUser(data.user.id);
    throw err;
  }
};

// ─── Create user (owner creates admin/therapist/teacher/parent; admin creates therapist/teacher/parent) ─
// @route  POST /api/users
export const createUser = async (req, res) => {
  const { name, password, role, departments, phone, sessionRate } = req.body;
  const email = req.body.email?.toLowerCase().trim();

  if (!MANAGEABLE[req.user.role]?.includes(role)) {
    return res
      .status(403)
      .json({ message: `You cannot create ${role || 'this type of'} accounts` });
  }
  if (!name || !email || !password || password.length < 6) {
    return res
      .status(400)
      .json({ message: 'Name, email and a password of at least 6 characters are required' });
  }

  // Admins always create inside their own branch
  const branchId = req.user.role === 'admin' ? userBranchId(req.user) : req.body.branch || null;

  if (BRANCH_ROLES.includes(role) && !branchId) {
    return res.status(400).json({ message: 'Please choose a branch for this staff member' });
  }
  if (branchId && !(await branchInCenter(req.user, branchId))) {
    return res.status(404).json({ message: 'Branch not found' });
  }

  const user = await createAccount({
    email,
    password,
    centerId: req.user.centerId,
    branchId,
    name,
    role,
    departments: CLINICIANS.includes(role) ? departments || [] : [],
    phone: phone || '',
    ...(sessionRate !== undefined && sessionRate !== '' && { sessionRate: Number(sessionRate) }),
    createdById: req.user.id,
  });

  res.status(201).json(serializeProfile(await loadProfile(user.id)));
};

// ─── Get users ────────────────────────────────────────────────────────────────
// @route  GET /api/users?role=&branch=&department=
// Owner: anyone in the center (filterable). Admin: therapists/teachers/parents of their branch.
export const getUsers = async (req, res) => {
  const { role, branch, department } = req.query;
  const where = scopedWhere(req.user, branch);

  const allowed = req.user.role === 'admin' ? MANAGEABLE.admin : null;
  const requested = role ? role.split(',') : null;
  if (allowed) {
    where.role = { in: requested ? requested.filter((r) => allowed.includes(r)) : allowed };
  } else if (requested) {
    where.role = { in: requested };
  }
  if (department) where.departments = { has: department };

  const users = await prisma.profile.findMany({
    where,
    include: PROFILE_INCLUDE,
    orderBy: { createdAt: 'desc' },
  });
  res.json(users.map(serializeProfile));
};

// ─── Get single user ──────────────────────────────────────────────────────────
// @route  GET /api/users/:id
export const getUser = async (req, res) => {
  const user = await prisma.profile.findFirst({
    where: { id: req.params.id, ...inCenter(req.user) },
    include: PROFILE_INCLUDE,
  });
  if (!user) return res.status(404).json({ message: 'User not found' });

  if (req.user.role !== 'owner' && user.branchId !== req.user.branchId) {
    return res.status(403).json({ message: 'Access denied' });
  }
  res.json(serializeProfile(user));
};

// ─── Update user ──────────────────────────────────────────────────────────────
// @route  PUT /api/users/:id
export const updateUser = async (req, res) => {
  const user = await loadManageable(req, res);
  if (!user) return;

  const { name, phone, departments, sessionRate } = req.body;
  const email = req.body.email?.toLowerCase().trim();
  const data = {};

  if (email && email !== user.email) {
    const { error } = await supabase.auth.admin.updateUserById(user.id, {
      email,
      email_confirm: true,
    });
    if (error) {
      return res.status(400).json({
        message: /already/i.test(error.message)
          ? 'An account with this email already exists'
          : error.message,
      });
    }
    data.email = email;
  }
  if (name !== undefined) data.name = name;
  if (phone !== undefined) data.phone = phone;
  if (departments !== undefined) data.departments = departments;
  if (sessionRate !== undefined && sessionRate !== '') data.sessionRate = Number(sessionRate);

  // Only the owner may move people between branches or change their role
  if (req.user.role === 'owner') {
    if (req.body.role && MANAGEABLE.owner.includes(req.body.role)) data.role = req.body.role;
    if (req.body.branch) {
      if (!(await branchInCenter(req.user, req.body.branch))) {
        return res.status(404).json({ message: 'Branch not found' });
      }
      data.branchId = req.body.branch;
    }
  }

  await prisma.profile.update({ where: { id: user.id }, data });
  res.json(serializeProfile(await loadProfile(user.id)));
};

// ─── Toggle user active/inactive ─────────────────────────────────────────────
// @route  PATCH /api/users/:id/toggle
export const toggleUser = async (req, res) => {
  if (req.params.id === req.user.id) {
    return res.status(400).json({ message: 'You cannot deactivate your own account' });
  }
  const user = await loadManageable(req, res);
  if (!user) return;

  const updated = await prisma.profile.update({
    where: { id: user.id },
    data: { isActive: !user.isActive },
  });
  res.json({
    message: `${updated.name} ${updated.isActive ? 'activated' : 'deactivated'}`,
    isActive: updated.isActive,
  });
};

// ─── Reset a user's password ─────────────────────────────────────────────────
// @route  PATCH /api/users/:id/password
export const resetUserPassword = async (req, res) => {
  const { password } = req.body;
  if (!password || password.length < 6) {
    return res.status(400).json({ message: 'Password must be at least 6 characters' });
  }
  const user = await loadManageable(req, res);
  if (!user) return;

  const { error } = await supabase.auth.admin.updateUserById(user.id, { password });
  if (error) return res.status(400).json({ message: error.message });
  res.json({ message: `Password reset for ${user.name}` });
};

// ─── Get therapists for a branch (used by scheduler) ─────────────────────────
// @route  GET /api/users/therapists
export const getBranchTherapists = async (req, res) => {
  const where = scopedWhere(req.user, req.query.branch);
  if (!where.branchId) return res.status(400).json({ message: 'Branch is required' });

  const therapists = await prisma.profile.findMany({
    where: {
      ...where,
      role: { in: CLINICIANS },
      isActive: true,
      ...(req.query.department && { departments: { has: req.query.department } }),
    },
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      role: true,
      departments: true,
      sessionRate: true,
      branchId: true,
    },
    orderBy: { name: 'asc' },
  });
  res.json(therapists.map(serializeProfile));
};
