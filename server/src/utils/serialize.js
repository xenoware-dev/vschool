// ─── API response shapes ─────────────────────────────────────────────────────
// Turn Prisma rows into the JSON the client expects. `_id` mirrors `id` while
// the client still uses Mongo-style ids; drop it once the client uses `id`.
// Relations are serialized only when the query included them.

import { dateKey } from './scope.js';

const num = (v) => (v === null || v === undefined ? v : Number(v));
const withId = (row) => ({ _id: row.id, ...row });
const maybe = (value, fn) => (value === undefined ? undefined : value && fn(value));

const ageFrom = (dob) => {
  if (!dob) return null;
  const birth = new Date(dob);
  const now = new Date();
  let age = now.getUTCFullYear() - birth.getUTCFullYear();
  const m = now.getUTCMonth() - birth.getUTCMonth();
  if (m < 0 || (m === 0 && now.getUTCDate() < birth.getUTCDate())) age -= 1;
  return age;
};

export const serializeBranch = (b) => b && withId(b);

export const serializeProfile = (p) => {
  if (!p) return p;
  const { branch, children, ...rest } = p;
  return withId({
    ...rest,
    ...(rest.sessionRate !== undefined && { sessionRate: num(rest.sessionRate) }),
    branch: branch === undefined ? rest.branchId : serializeBranch(branch),
    ...(children !== undefined && { children: children.map(withId) }),
  });
};

export const serializePatient = (p) => {
  if (!p) return p;
  const {
    grade,
    section,
    rollNo,
    academicYear,
    parentName,
    parentPhone,
    parentEmail,
    parentRelationship,
    parentAddress,
    branch,
    parent,
    assignedTherapists,
    registeredBy,
    ...rest
  } = p;
  const out = {
    ...rest,
    dateOfBirth: maybe(rest.dateOfBirth, dateKey),
    age: ageFrom(rest.dateOfBirth),
    branch: branch === undefined ? rest.branchId : serializeBranch(branch),
    branchName: branch?.name ?? '',
    parent: parent === undefined ? rest.parentId : maybe(parent, serializeProfile),
    registeredBy:
      registeredBy === undefined ? rest.registeredById : maybe(registeredBy, serializeProfile),
  };
  if (grade !== undefined) out.schoolDetails = { grade, section, rollNo, academicYear };
  if (parentName !== undefined) {
    out.parentDetails = {
      name: parentName,
      phone: parentPhone,
      email: parentEmail,
      relationship: parentRelationship,
      address: parentAddress,
    };
  }
  if (assignedTherapists !== undefined) {
    out.assignedTherapists = assignedTherapists.map((a) =>
      a.therapist ? serializeProfile(a.therapist) : a.therapistId
    );
  }
  return withId(out);
};

export const serializeAppointment = (a) => {
  if (!a) return a;
  const {
    soapSubjective,
    soapObjective,
    soapAssessment,
    soapPlan,
    patient,
    therapist,
    branch,
    ...rest
  } = a;
  return withId({
    ...rest,
    date: dateKey(rest.date),
    soapNotes: {
      subjective: soapSubjective ?? '',
      objective: soapObjective ?? '',
      assessment: soapAssessment ?? '',
      plan: soapPlan ?? '',
    },
    patient: patient === undefined ? rest.patientId : serializePatient(patient),
    therapist: therapist === undefined ? rest.therapistId : serializeProfile(therapist),
    branch: branch === undefined ? rest.branchId : serializeBranch(branch),
    scheduledBy: rest.scheduledById,
  });
};

export const serializePayment = (p) => {
  if (!p) return p;
  const { patient, branch, recordedBy, ...rest } = p;
  return withId({
    ...rest,
    amount: num(rest.amount),
    dueDate: rest.dueDate ? dateKey(rest.dueDate) : null,
    patient: patient === undefined ? rest.patientId : serializePatient(patient),
    branch: branch === undefined ? rest.branchId : serializeBranch(branch),
    recordedBy: recordedBy === undefined ? rest.recordedById : maybe(recordedBy, serializeProfile),
  });
};

export const serializePayout = (p) => {
  if (!p) return p;
  const { recordedBy, ...rest } = p;
  return withId({
    ...rest,
    branch: rest.branchId,
    staff: rest.staffId,
    ratePerSession: num(rest.ratePerSession),
    bonus: num(rest.bonus),
    deductions: num(rest.deductions),
    amount: num(rest.amount),
    recordedBy: recordedBy === undefined ? rest.recordedById : maybe(recordedBy, serializeProfile),
  });
};
