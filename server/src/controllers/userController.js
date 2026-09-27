import User from '../models/User.js';
import Branch from '../models/Branch.js';
import { outsideBranch, sameId, scopedBranch, userBranchId } from '../utils/scope.js';

// Roles each manager role may create / manage
const MANAGEABLE = {
  owner: ['admin', 'therapist', 'teacher', 'parent'],
  admin: ['therapist', 'teacher', 'parent'],
};
const BRANCH_ROLES = ['admin', 'therapist', 'teacher'];

const populateUser = (query) =>
  query
    .populate('branch', 'name code city')
    .populate('children', 'name studentId')
    .select('-password');

// Loads the target user and checks the requester may manage them
const loadManageable = async (req, res) => {
  const user = await User.findById(req.params.id);
  if (!user) {
    res.status(404).json({ message: 'User not found' });
    return null;
  }
  if (!MANAGEABLE[req.user.role]?.includes(user.role) || outsideBranch(req.user, user.branch)) {
    res.status(403).json({ message: 'You do not have permission to manage this account' });
    return null;
  }
  return user;
};

// ─── Create user (owner creates admin/therapist/teacher; admin creates therapist/teacher/parent) ─
// @route  POST /api/users
export const createUser = async (req, res) => {
  const { name, email, password, role, departments, phone, sessionRate } = req.body;

  if (!MANAGEABLE[req.user.role]?.includes(role)) {
    return res
      .status(403)
      .json({ message: `You cannot create ${role || 'this type of'} accounts` });
  }

  // Admins always create inside their own branch
  const branch = req.user.role === 'admin' ? userBranchId(req.user) : req.body.branch || null;

  if (BRANCH_ROLES.includes(role) && !branch) {
    return res.status(400).json({ message: 'Please choose a branch for this staff member' });
  }
  if (branch && !(await Branch.exists({ _id: branch }))) {
    return res.status(404).json({ message: 'Branch not found' });
  }

  if (await User.exists({ email: email?.toLowerCase().trim() })) {
    return res.status(400).json({ message: 'An account with this email already exists' });
  }

  const user = await User.create({
    name,
    email,
    password,
    role,
    branch,
    departments: ['therapist', 'teacher'].includes(role) ? departments || [] : [],
    phone: phone || '',
    ...(sessionRate !== undefined && sessionRate !== '' && { sessionRate }),
    createdBy: req.user._id,
  });

  res.status(201).json(await populateUser(User.findById(user._id)));
};

// ─── Get users ────────────────────────────────────────────────────────────────
// @route  GET /api/users?role=&branch=&department=
// Owner: any user (filterable). Admin: therapists/teachers/parents of their branch.
export const getUsers = async (req, res) => {
  const { role, branch, department } = req.query;
  const filter = {};

  const scoped = scopedBranch(req.user, branch);
  if (scoped) filter.branch = scoped;

  const allowed = req.user.role === 'admin' ? MANAGEABLE.admin : null;
  const requested = role ? role.split(',') : null;
  if (allowed) {
    filter.role = { $in: requested ? requested.filter((r) => allowed.includes(r)) : allowed };
  } else if (requested) {
    filter.role = { $in: requested };
  }

  if (department) filter.departments = { $in: [department] };

  const users = await populateUser(User.find(filter)).sort({ createdAt: -1 });
  res.json(users);
};

// ─── Get single user ──────────────────────────────────────────────────────────
// @route  GET /api/users/:id
export const getUser = async (req, res) => {
  const user = await populateUser(User.findById(req.params.id));
  if (!user) return res.status(404).json({ message: 'User not found' });

  if (outsideBranch(req.user, user.branch)) {
    return res.status(403).json({ message: 'Access denied' });
  }

  res.json(user);
};

// ─── Update user ──────────────────────────────────────────────────────────────
// @route  PUT /api/users/:id
export const updateUser = async (req, res) => {
  const user = await loadManageable(req, res);
  if (!user) return;

  const { name, email, phone, departments, sessionRate } = req.body;

  if (email && email.toLowerCase().trim() !== user.email) {
    if (await User.exists({ email: email.toLowerCase().trim(), _id: { $ne: user._id } })) {
      return res.status(400).json({ message: 'An account with this email already exists' });
    }
    user.email = email;
  }
  if (name !== undefined) user.name = name;
  if (phone !== undefined) user.phone = phone;
  if (departments !== undefined) user.departments = departments;
  if (sessionRate !== undefined && sessionRate !== '') user.sessionRate = sessionRate;

  // Only the owner may move people between branches or change their role
  if (req.user.role === 'owner') {
    if (req.body.role && MANAGEABLE.owner.includes(req.body.role)) user.role = req.body.role;
    if (req.body.branch) {
      if (!(await Branch.exists({ _id: req.body.branch }))) {
        return res.status(404).json({ message: 'Branch not found' });
      }
      user.branch = req.body.branch;
    }
  }

  await user.save();
  res.json(await populateUser(User.findById(user._id)));
};

// ─── Toggle user active/inactive ─────────────────────────────────────────────
// @route  PATCH /api/users/:id/toggle
export const toggleUser = async (req, res) => {
  if (sameId(req.params.id, req.user._id)) {
    return res.status(400).json({ message: 'You cannot deactivate your own account' });
  }
  const user = await loadManageable(req, res);
  if (!user) return;

  user.isActive = !user.isActive;
  await user.save();
  res.json({
    message: `${user.name} ${user.isActive ? 'activated' : 'deactivated'}`,
    isActive: user.isActive,
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

  user.password = password;
  await user.save();
  res.json({ message: `Password reset for ${user.name}` });
};

// ─── Get therapists for a branch (used by scheduler) ─────────────────────────
// @route  GET /api/users/therapists
export const getBranchTherapists = async (req, res) => {
  const branchId = scopedBranch(req.user, req.query.branch);
  const { department } = req.query;

  if (!branchId) return res.status(400).json({ message: 'Branch is required' });

  const filter = { role: { $in: ['therapist', 'teacher'] }, branch: branchId, isActive: true };
  if (department) filter.departments = { $in: [department] };

  const therapists = await User.find(filter)
    .select('name email phone role departments sessionRate')
    .sort('name');
  res.json(therapists);
};
