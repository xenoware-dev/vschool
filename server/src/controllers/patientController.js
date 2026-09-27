import mongoose from 'mongoose';
import Patient from '../models/Patient.js';
import User from '../models/User.js';
import Branch from '../models/Branch.js';
import { outsideBranch, sameId, scopedBranch, userBranchId } from '../utils/scope.js';

const EDITABLE_FIELDS = [
  'name',
  'dateOfBirth',
  'gender',
  'categories',
  'schoolDetails',
  'parentDetails',
  'enrolledDepartments',
  'assignedTherapists',
  'medicalNotes',
  'diagnosis',
  'status',
];

const populatePatient = (query) =>
  query
    .populate('branch', 'name code city')
    .populate('assignedTherapists', 'name email phone role departments')
    .populate('parent', 'name email phone isActive');

class RequestError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

// Works out which parent account (if any) the child should be linked to.
// body.parent          → link an existing parent account from the same branch
// body.parentAccount   → { email, password } create a new parent login from parentDetails
// Returns undefined when the request does not touch the parent link.
const resolveParent = async (req, branchId, parentDetails) => {
  const { parent, parentAccount } = req.body;

  if (parentAccount?.email) {
    const email = parentAccount.email.toLowerCase().trim();
    const existing = await User.findOne({ email });
    if (existing) {
      if (existing.role !== 'parent' || !sameId(existing.branch, branchId)) {
        throw new RequestError(400, 'That email already belongs to another account');
      }
      return existing._id;
    }
    if (!parentAccount.password || parentAccount.password.length < 6) {
      throw new RequestError(400, 'Parent portal password must be at least 6 characters');
    }
    const created = await User.create({
      name: parentDetails?.name || 'Parent',
      email,
      password: parentAccount.password,
      phone: parentDetails?.phone || '',
      role: 'parent',
      branch: branchId,
      createdBy: req.user._id,
    });
    return created._id;
  }

  if (parent === null || parent === '') return null;
  if (parent) {
    const doc = await User.findById(parent).select('role branch');
    if (!doc || doc.role !== 'parent' || !sameId(doc.branch, branchId)) {
      throw new RequestError(404, 'Parent account not found in this branch');
    }
    return doc._id;
  }
  return undefined;
};

// Ensures every assigned therapist is an active clinician of this branch
const validateTherapists = async (ids, branchId) => {
  if (!ids?.length) return;
  const count = await User.countDocuments({
    _id: { $in: ids },
    role: { $in: ['therapist', 'teacher'] },
    branch: branchId,
  });
  if (count !== new Set(ids.map(String)).size) {
    throw new RequestError(400, 'One or more selected therapists are not part of this branch');
  }
};

const syncParentChildren = async (patientId, oldParent, newParent) => {
  if (sameId(oldParent, newParent)) return;
  if (oldParent) await User.findByIdAndUpdate(oldParent, { $pull: { children: patientId } });
  if (newParent) await User.findByIdAndUpdate(newParent, { $addToSet: { children: patientId } });
};

const sendError = (res, err) => {
  if (err instanceof RequestError) return res.status(err.status).json({ message: err.message });
  throw err;
};

// ─── Register a new patient/student (admin only) ─────────────────────────────
// @route  POST /api/patients
export const createPatient = async (req, res) => {
  const branchId = userBranchId(req.user);
  if (!branchId) {
    return res
      .status(400)
      .json({ message: 'Admin must be assigned to a branch to register children' });
  }

  const branchDoc = await Branch.findById(branchId);
  const { studentId: customStudentId, parentDetails = {}, assignedTherapists = [] } = req.body;

  let parentId;
  try {
    await validateTherapists(assignedTherapists, branchId);
    parentId = await resolveParent(req, branchId, parentDetails);
  } catch (err) {
    return sendError(res, err);
  }

  // Generate a readable ID unless one was supplied
  let studentId = customStudentId?.trim()?.toUpperCase();
  if (!studentId) {
    const branchCode = branchDoc?.code || 'BR';
    let seq = (await Patient.countDocuments({ branch: branchId })) + 1;
    do {
      studentId = `${branchCode}-STU-${String(seq).padStart(4, '0')}`;
      seq += 1;
    } while (await Patient.exists({ branch: branchId, studentId }));
  } else if (await Patient.exists({ branch: branchId, studentId })) {
    return res.status(400).json({ message: `Student ID ${studentId} is already in use` });
  }

  const data = Object.fromEntries(
    EDITABLE_FIELDS.map((f) => [f, req.body[f]]).filter(([, v]) => v !== undefined)
  );

  const patient = await Patient.create({
    ...data,
    studentId,
    categories: data.categories?.length ? data.categories : ['clinic'],
    parent: parentId || null,
    branch: branchId,
    branchName: branchDoc?.name || '',
    status: 'active',
    registeredBy: req.user._id,
  });

  await syncParentChildren(patient._id, null, parentId);

  res.status(201).json(await populatePatient(Patient.findById(patient._id)));
};

// ─── Get patients/students ───────────────────────────────────────────────────
// @route  GET /api/patients
// Owner: all (filterable by branch). Admin: own branch. Therapist: assigned. Parent: own children.
export const getPatients = async (req, res) => {
  const { branch, department, category, status, search, therapist } = req.query;
  const filter = {};
  const role = req.user.role;

  if (role === 'parent') {
    filter.parent = req.user._id;
  } else {
    const scoped = scopedBranch(req.user, branch);
    if (scoped) filter.branch = scoped;
    if (['therapist', 'teacher'].includes(role)) filter.assignedTherapists = req.user._id;
    else if (therapist) filter.assignedTherapists = therapist;
  }

  if (category) filter.categories = category.toLowerCase();
  if (department) filter.enrolledDepartments = department;
  if (status) filter.status = status;
  if (search) {
    const rx = { $regex: search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), $options: 'i' };
    filter.$or = [
      { name: rx },
      { studentId: rx },
      { 'parentDetails.name': rx },
      { 'parentDetails.phone': rx },
    ];
  }

  const patients = await populatePatient(Patient.find(filter)).sort({ createdAt: -1 });
  res.json(patients);
};

// ─── Get single patient ───────────────────────────────────────────────────────
// @route  GET /api/patients/:id
export const getPatient = async (req, res) => {
  const patient = await populatePatient(Patient.findById(req.params.id)).populate(
    'registeredBy',
    'name email'
  );

  if (!patient) return res.status(404).json({ message: 'Child not found' });

  const role = req.user.role;
  if (role === 'parent') {
    if (!sameId(patient.parent, req.user._id))
      return res.status(403).json({ message: 'Access denied' });
  } else if (outsideBranch(req.user, patient.branch)) {
    return res.status(403).json({ message: 'Access denied' });
  }
  if (
    ['therapist', 'teacher'].includes(role) &&
    !patient.assignedTherapists.some((t) => sameId(t, req.user._id))
  ) {
    return res.status(403).json({ message: 'Access denied — this child is not assigned to you' });
  }

  res.json(patient);
};

// ─── Update patient ───────────────────────────────────────────────────────────
// @route  PUT /api/patients/:id
export const updatePatient = async (req, res) => {
  const patient = await Patient.findById(req.params.id);
  if (!patient) return res.status(404).json({ message: 'Child not found' });
  if (outsideBranch(req.user, patient.branch)) {
    return res.status(403).json({ message: 'Access denied' });
  }

  let parentId;
  try {
    if (req.body.assignedTherapists)
      await validateTherapists(req.body.assignedTherapists, patient.branch);
    parentId = await resolveParent(
      req,
      patient.branch,
      req.body.parentDetails || patient.parentDetails
    );
  } catch (err) {
    return sendError(res, err);
  }

  EDITABLE_FIELDS.forEach((field) => {
    if (req.body[field] !== undefined) patient[field] = req.body[field];
  });

  const oldParent = patient.parent;
  if (parentId !== undefined) patient.parent = parentId;

  await patient.save();
  if (parentId !== undefined) await syncParentChildren(patient._id, oldParent, parentId);

  res.json(await populatePatient(Patient.findById(patient._id)));
};

// ─── Discharge patient ────────────────────────────────────────────────────────
// @route  PATCH /api/patients/:id/discharge
export const dischargePatient = async (req, res) => {
  const patient = await Patient.findById(req.params.id);
  if (!patient) return res.status(404).json({ message: 'Child not found' });
  if (outsideBranch(req.user, patient.branch)) {
    return res.status(403).json({ message: 'Access denied' });
  }
  patient.status = 'discharged';
  await patient.save();
  res.json({ message: `${patient.name} discharged`, patient });
};

// ─── Get patient stats for a branch (used by dashboards) ─────────────────────
// @route  GET /api/patients/stats
export const getPatientStats = async (req, res) => {
  const branchId = scopedBranch(req.user, req.query.branch);
  const filter = branchId ? { branch: branchId } : {};
  // Aggregation pipelines do not auto-cast ids
  const match = branchId ? { branch: new mongoose.Types.ObjectId(String(branchId)) } : {};

  const [total, active, onHold, discharged, byDept, byCat] = await Promise.all([
    Patient.countDocuments(filter),
    Patient.countDocuments({ ...filter, status: 'active' }),
    Patient.countDocuments({ ...filter, status: 'on_hold' }),
    Patient.countDocuments({ ...filter, status: 'discharged' }),
    Patient.aggregate([
      { $match: { ...match, status: 'active' } },
      { $unwind: '$enrolledDepartments' },
      { $group: { _id: '$enrolledDepartments', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ]),
    Patient.aggregate([
      { $match: { ...match, status: 'active' } },
      { $unwind: '$categories' },
      { $group: { _id: '$categories', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ]),
  ]);

  res.json({ total, active, onHold, discharged, byDepartment: byDept, byCategory: byCat });
};
