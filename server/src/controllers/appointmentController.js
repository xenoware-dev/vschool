import prisma from '../config/db.js';
import { TIME_SLOTS } from '../utils/constants.js';
import { addDays, inCenter, outsideScope, scopedWhere, startOfDay, today } from '../utils/scope.js';
import { serializeAppointment } from '../utils/serialize.js';

const CLINICIANS = ['therapist', 'teacher'];
const isClinician = (user) => CLINICIANS.includes(user.role);

// Statuses that occupy a slot (a cancelled / no-show slot can be rebooked)
const OCCUPYING = ['scheduled', 'completed'];

const APPOINTMENT_INCLUDE = {
  patient: { select: { id: true, name: true, dateOfBirth: true, gender: true, studentId: true } },
  therapist: { select: { id: true, name: true, email: true, departments: true } },
  branch: { select: { id: true, name: true, code: true, city: true } },
};

const loadAppointment = (id, include = APPOINTMENT_INCLUDE) =>
  prisma.appointment.findUnique({ where: { id }, include });

const findSlotConflict = async ({ therapistId, patientId, date, timeSlot, excludeId }) => {
  const base = {
    date,
    timeSlot,
    status: { in: OCCUPYING },
    ...(excludeId && { NOT: { id: excludeId } }),
  };
  if (await prisma.appointment.findFirst({ where: { ...base, therapistId } })) {
    return `The therapist is already booked for ${timeSlot} on this date`;
  }
  if (patientId && (await prisma.appointment.findFirst({ where: { ...base, patientId } }))) {
    return `This child already has a session at ${timeSlot} on this date`;
  }
  return null;
};

// Postgres unique-violation on the double-booking indexes (a race between two bookings)
const isSlotRace = (err) => err?.code === 'P2002';

// ─── Create appointment (admin & clinicians) ─────────────────────────────────
// @route  POST /api/appointments
export const createAppointment = async (req, res) => {
  const { patient: patientId, department, date, timeSlot } = req.body;
  let therapistId = req.body.therapist;
  const branchId = req.user.branchId;

  if (!branchId) {
    return res.status(400).json({ message: 'User must be assigned to a branch' });
  }
  if (!patientId || !department || !date || !timeSlot) {
    return res.status(400).json({ message: 'Child, department, date and time slot are required' });
  }
  if (!TIME_SLOTS.includes(timeSlot)) {
    return res.status(400).json({ message: 'Invalid time slot' });
  }

  // Therapists and teachers can only book themselves
  if (isClinician(req.user)) therapistId = req.user.id;

  const [patient, therapist] = await Promise.all([
    prisma.patient.findFirst({
      where: { id: patientId, branchId, ...inCenter(req.user) },
      include: { assignedTherapists: true },
    }),
    therapistId
      ? prisma.profile.findFirst({ where: { id: therapistId, branchId, ...inCenter(req.user) } })
      : null,
  ]);

  if (!patient) return res.status(404).json({ message: 'Child not found in your branch' });
  if (patient.status !== 'active') {
    return res.status(400).json({ message: 'Sessions can only be booked for active children' });
  }
  if (!therapist || !isClinician(therapist)) {
    return res.status(404).json({ message: 'Therapist not found in your branch' });
  }
  if (!therapist.isActive) {
    return res.status(400).json({ message: 'This therapist account is inactive' });
  }
  if (
    isClinician(req.user) &&
    !patient.assignedTherapists.some((a) => a.therapistId === req.user.id)
  ) {
    return res
      .status(403)
      .json({ message: 'You can only book sessions for children assigned to you' });
  }

  const day = startOfDay(date);
  const conflict = await findSlotConflict({ therapistId, patientId, date: day, timeSlot });
  if (conflict) return res.status(409).json({ message: conflict });

  try {
    const appointment = await prisma.appointment.create({
      data: {
        centerId: req.user.centerId,
        branchId,
        patientId,
        therapistId,
        department,
        date: day,
        timeSlot,
        status: 'scheduled',
        scheduledById: req.user.id,
      },
      include: APPOINTMENT_INCLUDE,
    });
    res.status(201).json(serializeAppointment(appointment));
  } catch (err) {
    if (isSlotRace(err)) return res.status(409).json({ message: 'That slot was just taken' });
    throw err;
  }
};

// ─── Get appointments ────────────────────────────────────────────────────────
// @route  GET /api/appointments
// Query: branch, therapist, patient, department, status, date | from & to (YYYY-MM-DD, inclusive)
export const getAppointments = async (req, res) => {
  const { branch, therapist, patient, department, date, from, to, status } = req.query;
  let where;

  if (req.user.role === 'parent') {
    // Parent sees upcoming sessions and completed sessions the therapist chose to share
    where = {
      ...inCenter(req.user),
      patient: { parentId: req.user.id },
      OR: [{ status: 'scheduled' }, { status: 'completed', parentVisible: true }],
      ...(patient && { patientId: patient }),
    };
  } else {
    where = scopedWhere(req.user, branch);

    if (isClinician(req.user)) {
      // Own sessions, unless looking at an assigned child's full history
      if (patient) {
        const assigned = await prisma.patientTherapist.findUnique({
          where: { patientId_therapistId: { patientId: patient, therapistId: req.user.id } },
        });
        if (!assigned) {
          return res.status(403).json({ message: 'This child is not assigned to you' });
        }
        where.patientId = patient;
      } else {
        where.therapistId = req.user.id;
      }
    } else {
      if (therapist) where.therapistId = therapist;
      if (patient) where.patientId = patient;
    }
    if (status) where.status = status;
  }

  if (department) where.department = department;
  if (date) {
    where.date = startOfDay(date);
  } else if (from || to) {
    where.date = {
      ...(from && { gte: startOfDay(from) }),
      ...(to && { lt: addDays(startOfDay(to), 1) }),
    };
  }

  const appointments = await prisma.appointment.findMany({
    where,
    include: APPOINTMENT_INCLUDE,
    orderBy: [{ date: 'asc' }, { timeSlot: 'asc' }],
  });
  res.json(appointments.map(serializeAppointment));
};

// ─── Get single appointment ──────────────────────────────────────────────────
// @route  GET /api/appointments/:id
export const getAppointment = async (req, res) => {
  const appointment = await loadAppointment(req.params.id, {
    patient: {
      select: {
        id: true,
        name: true,
        dateOfBirth: true,
        gender: true,
        parentId: true,
        parentName: true,
        parentPhone: true,
        parentEmail: true,
        parentRelationship: true,
        parentAddress: true,
      },
    },
    therapist: { select: { id: true, name: true, email: true, phone: true, departments: true } },
    branch: { select: { id: true, name: true, code: true, city: true } },
  });

  if (!appointment || appointment.centerId !== req.user.centerId) {
    return res.status(404).json({ message: 'Appointment not found' });
  }
  if (req.user.role === 'parent') {
    if (appointment.patient.parentId !== req.user.id) {
      return res.status(403).json({ message: 'Access denied' });
    }
  } else if (outsideScope(req.user, appointment)) {
    return res.status(403).json({ message: 'Access denied' });
  }

  res.json(serializeAppointment(appointment));
};

// ─── Update appointment (admin — reschedule, reassign, change status) ───────
// @route  PUT /api/appointments/:id
export const updateAppointment = async (req, res) => {
  const appointment = await prisma.appointment.findUnique({ where: { id: req.params.id } });
  if (!appointment || appointment.centerId !== req.user.centerId) {
    return res.status(404).json({ message: 'Appointment not found' });
  }
  if (outsideScope(req.user, appointment)) {
    return res.status(403).json({ message: 'Access denied' });
  }

  const { date, timeSlot, therapist, department, status } = req.body;
  if (timeSlot && !TIME_SLOTS.includes(timeSlot)) {
    return res.status(400).json({ message: 'Invalid time slot' });
  }

  const data = {};
  if (therapist && therapist !== appointment.therapistId) {
    const doc = await prisma.profile.findFirst({
      where: { id: therapist, branchId: appointment.branchId, ...inCenter(req.user) },
    });
    if (!doc || !isClinician(doc)) {
      return res.status(404).json({ message: 'Therapist not found in this branch' });
    }
    data.therapistId = therapist;
  }
  if (date) data.date = startOfDay(date);
  if (timeSlot) data.timeSlot = timeSlot;
  if (department) data.department = department;
  if (status) data.status = status;

  const next = { ...appointment, ...data };
  // Re-check the slot whenever the booking stays live and its time/person changed
  if ((date || timeSlot || therapist || status) && OCCUPYING.includes(next.status)) {
    const conflict = await findSlotConflict({
      therapistId: next.therapistId,
      patientId: next.patientId,
      date: next.date,
      timeSlot: next.timeSlot,
      excludeId: appointment.id,
    });
    if (conflict) return res.status(409).json({ message: conflict });
  }

  try {
    const updated = await prisma.appointment.update({
      where: { id: appointment.id },
      data,
      include: APPOINTMENT_INCLUDE,
    });
    res.json(serializeAppointment(updated));
  } catch (err) {
    if (isSlotRace(err)) return res.status(409).json({ message: 'That slot was just taken' });
    throw err;
  }
};

// ─── Add session notes (therapist only) ─────────────────────────────────────
// @route  PATCH /api/appointments/:id/notes
export const addSessionNotes = async (req, res) => {
  const { sessionNotes, soapNotes, homeActivities, milestones, parentVisible, status } = req.body;

  const appointment = await prisma.appointment.findUnique({ where: { id: req.params.id } });
  if (!appointment || appointment.centerId !== req.user.centerId) {
    return res.status(404).json({ message: 'Appointment not found' });
  }
  // Therapist can only add notes to their own appointments
  if (appointment.therapistId !== req.user.id) {
    return res.status(403).json({ message: 'You can only add notes to your own sessions' });
  }

  const data = {};
  if (soapNotes) {
    data.soapSubjective = soapNotes.subjective ?? appointment.soapSubjective;
    data.soapObjective = soapNotes.objective ?? appointment.soapObjective;
    data.soapAssessment = soapNotes.assessment ?? appointment.soapAssessment;
    data.soapPlan = soapNotes.plan ?? appointment.soapPlan;
  }
  if (homeActivities !== undefined) data.homeActivities = homeActivities;
  if (milestones !== undefined) {
    data.milestones = milestones
      .filter((m) => m?.goal?.trim())
      .map((m) => ({ goal: m.goal.trim(), status: m.status || 'in_progress' }));
  }

  if (sessionNotes !== undefined) {
    data.sessionNotes = sessionNotes;
  } else if (soapNotes) {
    // Plain-text summary kept for older views
    data.sessionNotes = [
      soapNotes.subjective ? `S: ${soapNotes.subjective}` : '',
      soapNotes.objective ? `O: ${soapNotes.objective}` : '',
      soapNotes.assessment ? `A: ${soapNotes.assessment}` : '',
      soapNotes.plan ? `P: ${soapNotes.plan}` : '',
    ]
      .filter(Boolean)
      .join('\n\n');
  }

  if (parentVisible !== undefined) data.parentVisible = parentVisible;
  if (status) data.status = status;
  if (
    soapNotes ||
    homeActivities !== undefined ||
    milestones !== undefined ||
    sessionNotes !== undefined
  ) {
    data.notesUpdatedAt = new Date();
  }

  const updated = await prisma.appointment.update({
    where: { id: appointment.id },
    data,
    include: APPOINTMENT_INCLUDE,
  });
  res.json(serializeAppointment(updated));
};

// ─── Available time slots for a therapist on a date ─────────────────────────
// @route  GET /api/appointments/slots?therapist=X&date=Y[&patient=Z]
export const getAvailableSlots = async (req, res) => {
  const { therapist, date, patient } = req.query;
  if (!therapist || !date) {
    return res.status(400).json({ message: 'therapist and date query params are required' });
  }

  const booked = await prisma.appointment.findMany({
    where: {
      ...inCenter(req.user),
      date: startOfDay(date),
      status: { in: OCCUPYING },
      OR: [{ therapistId: therapist }, ...(patient ? [{ patientId: patient }] : [])],
    },
    select: { timeSlot: true },
  });

  const bookedSlots = [...new Set(booked.map((a) => a.timeSlot))];
  const available = TIME_SLOTS.filter((slot) => !bookedSlots.includes(slot));
  res.json({ available, booked: bookedSlots, all: TIME_SLOTS });
};

// ─── Today's appointments (dashboards) ──────────────────────────────────────
// @route  GET /api/appointments/today
export const getTodayAppointments = async (req, res) => {
  const where = { ...scopedWhere(req.user, req.query.branch), date: today() };
  if (isClinician(req.user)) where.therapistId = req.user.id;

  const appointments = await prisma.appointment.findMany({
    where,
    include: APPOINTMENT_INCLUDE,
    orderBy: { timeSlot: 'asc' },
  });
  res.json(appointments.map(serializeAppointment));
};
