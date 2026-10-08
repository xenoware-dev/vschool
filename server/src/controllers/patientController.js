import { Prisma } from '@prisma/client';
import prisma from '../config/db.js';
import { createAccount } from './userController.js';
import { inCenter, outsideScope, scopedBranch, scopedWhere, startOfDay } from '../utils/scope.js';
import { serializePatient } from '../utils/serialize.js';

const CLINICIANS = ['therapist', 'teacher'];

const PATIENT_INCLUDE = {
  branch: { select: { id: true, name: true, code: true, city: true } },
  assignedTherapists: {
    include: {
      therapist: {
        select: { id: true, name: true, email: true, phone: true, role: true, departments: true },
      },
    },
  },
  parent: { select: { id: true, name: true, email: true, phone: true, isActive: true } },
};

class RequestError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

// Request body (client shape) → patient columns
const patientData = (body) => {
  const data = {};
  const copy = [
    'name',
    'gender',
    'categories',
    'enrolledDepartments',
    'medicalNotes',
    'diagnosis',
    'status',
  ];
  copy.forEach((f) => {
    if (body[f] !== undefined) data[f] = body[f];
  });
  if (body.dateOfBirth) data.dateOfBirth = startOfDay(body.dateOfBirth);

  const school = body.schoolDetails;
  if (school) {
    ['grade', 'section', 'rollNo', 'academicYear'].forEach((f) => {
      if (school[f] !== undefined) data[f] = school[f] ?? '';
    });
  }
  const parent = body.parentDetails;
  if (parent) {
    const map = {
      name: 'parentName',
      phone: 'parentPhone',
      email: 'parentEmail',
      relationship: 'parentRelationship',
      address: 'parentAddress',
    };
    Object.entries(map).forEach(([from, to]) => {
      if (parent[from] !== undefined) data[to] = parent[from] ?? '';
    });
  }
  return data;
};

// Works out which parent account (if any) the child should be linked to.
// body.parent          → link an existing parent account from the same branch
// body.parentAccount   → { email, password } create a new parent login from parentDetails
// Returns undefined when the request does not touch the parent link.
const resolveParent = async (req, branchId, parentDetails) => {
  const { parent, parentAccount } = req.body;

  if (parentAccount?.email) {
    const email = parentAccount.email.toLowerCase().trim();
    const existing = await prisma.profile.findUnique({ where: { email } });
    if (existing) {
      if (
        existing.role !== 'parent' ||
        existing.centerId !== req.user.centerId ||
        existing.branchId !== branchId
      ) {
        throw new RequestError(400, 'That email already belongs to another account');
      }
      return existing.id;
    }
    if (!parentAccount.password || parentAccount.password.length < 6) {
      throw new RequestError(400, 'Parent portal password must be at least 6 characters');
    }
    const created = await createAccount({
      email,
      password: parentAccount.password,
      centerId: req.user.centerId,
      branchId,
      name: parentDetails?.name || 'Parent',
      phone: parentDetails?.phone || '',
      role: 'parent',
      createdById: req.user.id,
    });
    return created.id;
  }

  if (parent === null || parent === '') return null;
  if (parent) {
    const doc = await prisma.profile.findFirst({
      where: { id: parent, role: 'parent', branchId, ...inCenter(req.user) },
    });
    if (!doc) throw new RequestError(404, 'Parent account not found in this branch');
    return doc.id;
  }
  return undefined;
};

// Ensures every assigned therapist is a clinician of this branch
const validateTherapists = async (req, ids, branchId) => {
  if (!ids?.length) return;
  const unique = [...new Set(ids.map(String))];
  const count = await prisma.profile.count({
    where: { id: { in: unique }, role: { in: CLINICIANS }, branchId, ...inCenter(req.user) },
  });
  if (count !== unique.length) {
    throw new RequestError(400, 'One or more selected therapists are not part of this branch');
  }
};

const therapistLinks = (ids) => [...new Set(ids.map(String))].map((therapistId) => ({ therapistId }));

const handle = (res, err) => {
  if (err instanceof RequestError || err.status) {
    return res.status(err.status).json({ message: err.message });
  }
  throw err;
};

const loadPatient = (id, extra = {}) =>
  prisma.patient.findUnique({ where: { id }, include: { ...PATIENT_INCLUDE, ...extra } });

// ─── Register a new child (admin only) ───────────────────────────────────────
// @route  POST /api/patients
export const createPatient = async (req, res) => {
  const branchId = req.user.branchId;
  if (!branchId) {
    return res
      .status(400)
      .json({ message: 'Admin must be assigned to a branch to register children' });
  }

  const data = patientData(req.body);
  if (!data.name || !data.dateOfBirth || !data.gender) {
    return res.status(400).json({ message: "Child's name, date of birth and gender are required" });
  }

  const branch = await prisma.branch.findUnique({ where: { id: branchId }, select: { code: true } });
  const { studentId: customStudentId, assignedTherapists = [] } = req.body;

  let parentId;
  try {
    await validateTherapists(req, assignedTherapists, branchId);
    parentId = await resolveParent(req, branchId, req.body.parentDetails);
  } catch (err) {
    return handle(res, err);
  }

  // Generate a readable ID unless one was supplied
  let studentId = customStudentId?.trim()?.toUpperCase();
  const taken = (sid) => prisma.patient.findFirst({ where: { branchId, studentId: sid } });
  if (!studentId) {
    const prefix = branch?.code || 'BR';
    let seq = (await prisma.patient.count({ where: { branchId } })) + 1;
    do {
      studentId = `${prefix}-STU-${String(seq).padStart(4, '0')}`;
      seq += 1;
    } while (await taken(studentId));
  } else if (await taken(studentId)) {
    return res.status(400).json({ message: `Student ID ${studentId} is already in use` });
  }

  const patient = await prisma.patient.create({
    data: {
      ...data,
      studentId,
      categories: data.categories?.length ? data.categories : ['clinic'],
      status: 'active',
      centerId: req.user.centerId,
      branchId,
      parentId: parentId || null,
      registeredById: req.user.id,
      assignedTherapists: { create: therapistLinks(assignedTherapists) },
    },
  });

  res.status(201).json(serializePatient(await loadPatient(patient.id)));
};

// ─── Get children ────────────────────────────────────────────────────────────
// @route  GET /api/patients
// Owner: whole center (filterable by branch). Admin: own branch. Therapist: assigned. Parent: own children.
export const getPatients = async (req, res) => {
  const { branch, department, category, status, search, therapist } = req.query;
  const role = req.user.role;
  let where;

  if (role === 'parent') {
    where = { ...inCenter(req.user), parentId: req.user.id };
  } else {
    where = scopedWhere(req.user, branch);
    const clinician = CLINICIANS.includes(role) ? req.user.id : therapist;
    if (clinician) where.assignedTherapists = { some: { therapistId: clinician } };
  }

  if (category) where.categories = { has: category.toLowerCase() };
  if (department) where.enrolledDepartments = { has: department };
  if (status) where.status = status;
  if (search) {
    const contains = { contains: search, mode: 'insensitive' };
    where.OR = [
      { name: contains },
      { studentId: contains },
      { parentName: contains },
      { parentPhone: contains },
    ];
  }

  const patients = await prisma.patient.findMany({
    where,
    include: PATIENT_INCLUDE,
    orderBy: { createdAt: 'desc' },
  });
  res.json(patients.map(serializePatient));
};

// ─── Get single child ────────────────────────────────────────────────────────
// @route  GET /api/patients/:id
export const getPatient = async (req, res) => {
  const patient = await loadPatient(req.params.id, {
    registeredBy: { select: { id: true, name: true, email: true } },
  });
  if (!patient || patient.centerId !== req.user.centerId) {
    return res.status(404).json({ message: 'Child not found' });
  }

  const role = req.user.role;
  if (role === 'parent') {
    if (patient.parentId !== req.user.id) return res.status(403).json({ message: 'Access denied' });
  } else if (outsideScope(req.user, patient)) {
    return res.status(403).json({ message: 'Access denied' });
  }
  if (
    CLINICIANS.includes(role) &&
    !patient.assignedTherapists.some((a) => a.therapistId === req.user.id)
  ) {
    return res.status(403).json({ message: 'Access denied — this child is not assigned to you' });
  }

  res.json(serializePatient(patient));
};

// ─── Update child ────────────────────────────────────────────────────────────
// @route  PUT /api/patients/:id
export const updatePatient = async (req, res) => {
  const patient = await prisma.patient.findUnique({ where: { id: req.params.id } });
  if (!patient || patient.centerId !== req.user.centerId) {
    return res.status(404).json({ message: 'Child not found' });
  }
  if (outsideScope(req.user, patient)) return res.status(403).json({ message: 'Access denied' });

  const { assignedTherapists } = req.body;
  let parentId;
  try {
    if (assignedTherapists) await validateTherapists(req, assignedTherapists, patient.branchId);
    parentId = await resolveParent(req, patient.branchId, {
      name: req.body.parentDetails?.name ?? patient.parentName,
      phone: req.body.parentDetails?.phone ?? patient.parentPhone,
    });
  } catch (err) {
    return handle(res, err);
  }

  const data = patientData(req.body);
  if (parentId !== undefined) data.parentId = parentId;

  await prisma.$transaction(async (tx) => {
    await tx.patient.update({ where: { id: patient.id }, data });
    if (assignedTherapists) {
      await tx.patientTherapist.deleteMany({ where: { patientId: patient.id } });
      await tx.patientTherapist.createMany({
        data: therapistLinks(assignedTherapists).map((l) => ({ ...l, patientId: patient.id })),
      });
    }
  });

  res.json(serializePatient(await loadPatient(patient.id)));
};

// ─── Discharge child ─────────────────────────────────────────────────────────
// @route  PATCH /api/patients/:id/discharge
export const dischargePatient = async (req, res) => {
  const patient = await prisma.patient.findUnique({ where: { id: req.params.id } });
  if (!patient || patient.centerId !== req.user.centerId) {
    return res.status(404).json({ message: 'Child not found' });
  }
  if (outsideScope(req.user, patient)) return res.status(403).json({ message: 'Access denied' });

  const updated = await prisma.patient.update({
    where: { id: patient.id },
    data: { status: 'discharged' },
  });
  res.json({ message: `${updated.name} discharged`, patient: serializePatient(updated) });
};

// ─── Child stats for dashboards ──────────────────────────────────────────────
// @route  GET /api/patients/stats
export const getPatientStats = async (req, res) => {
  const where = scopedWhere(req.user, req.query.branch);
  const branchId = scopedBranch(req.user, req.query.branch);
  const branchSql = branchId ? Prisma.sql`AND branch_id = ${branchId}::uuid` : Prisma.empty;

  const countBy = (column) => prisma.$queryRaw`
    SELECT value::text AS "_id", COUNT(*)::int AS count
    FROM patients, unnest(${Prisma.raw(column)}) AS value
    WHERE center_id = ${req.user.centerId}::uuid AND status = 'active' ${branchSql}
    GROUP BY value ORDER BY count DESC`;

  const [total, active, onHold, discharged, byDepartment, byCategory] = await Promise.all([
    prisma.patient.count({ where }),
    prisma.patient.count({ where: { ...where, status: 'active' } }),
    prisma.patient.count({ where: { ...where, status: 'on_hold' } }),
    prisma.patient.count({ where: { ...where, status: 'discharged' } }),
    countBy('enrolled_departments'),
    countBy('categories'),
  ]);

  res.json({ total, active, onHold, discharged, byDepartment, byCategory });
};
