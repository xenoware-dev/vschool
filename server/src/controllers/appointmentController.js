import Appointment from '../models/Appointment.js';
import Patient from '../models/Patient.js';
import User from '../models/User.js';
import { TIME_SLOTS } from '../utils/constants.js';
import {
  addDays,
  dayRange,
  outsideBranch,
  sameId,
  scopedBranch,
  startOfDay,
  userBranchId,
} from '../utils/scope.js';

const isClinician = (user) => ['therapist', 'teacher'].includes(user.role);

// Statuses that occupy a slot (a cancelled / no-show slot can be rebooked)
const OCCUPYING = ['scheduled', 'completed'];

const populateFull = (query) =>
  query
    .populate('patient', 'name dateOfBirth gender studentId')
    .populate('therapist', 'name email departments')
    .populate('branch', 'name code');

const findSlotConflict = async ({ therapist, patient, date, timeSlot, excludeId }) => {
  const base = { date, timeSlot, status: { $in: OCCUPYING } };
  if (excludeId) base._id = { $ne: excludeId };

  if (await Appointment.exists({ ...base, therapist })) {
    return `The therapist is already booked for ${timeSlot} on this date`;
  }
  if (patient && (await Appointment.exists({ ...base, patient }))) {
    return `This child already has a session at ${timeSlot} on this date`;
  }
  return null;
};

// ─── Create Appointment (admin & therapist) ──────────────────────────────────
// @route  POST /api/appointments
export const createAppointment = async (req, res) => {
  let { patient, therapist, department, date, timeSlot } = req.body;
  const branchId = userBranchId(req.user);

  if (!branchId) {
    return res.status(400).json({ message: 'User must be assigned to a branch' });
  }
  if (!patient || !department || !date || !timeSlot) {
    return res.status(400).json({ message: 'Child, department, date and time slot are required' });
  }
  if (!TIME_SLOTS.includes(timeSlot)) {
    return res.status(400).json({ message: 'Invalid time slot' });
  }

  // Therapists and teachers can only book themselves
  if (isClinician(req.user)) therapist = req.user._id;

  const [patientDoc, therapistDoc] = await Promise.all([
    Patient.findById(patient).select('branch status assignedTherapists'),
    User.findById(therapist).select('branch role isActive'),
  ]);

  if (!patientDoc || !sameId(patientDoc.branch, branchId)) {
    return res.status(404).json({ message: 'Child not found in your branch' });
  }
  if (patientDoc.status !== 'active') {
    return res.status(400).json({ message: 'Sessions can only be booked for active children' });
  }
  if (!therapistDoc || !isClinician(therapistDoc) || !sameId(therapistDoc.branch, branchId)) {
    return res.status(404).json({ message: 'Therapist not found in your branch' });
  }
  if (!therapistDoc.isActive) {
    return res.status(400).json({ message: 'This therapist account is inactive' });
  }
  if (
    isClinician(req.user) &&
    !patientDoc.assignedTherapists.some((t) => sameId(t, req.user._id))
  ) {
    return res
      .status(403)
      .json({ message: 'You can only book sessions for children assigned to you' });
  }

  const appointmentDate = startOfDay(date);
  const conflict = await findSlotConflict({ therapist, patient, date: appointmentDate, timeSlot });
  if (conflict) return res.status(409).json({ message: conflict });

  const appointment = await Appointment.create({
    patient,
    therapist,
    branch: branchId,
    department,
    date: appointmentDate,
    timeSlot,
    status: 'scheduled',
    scheduledBy: req.user._id,
  });

  res.status(201).json(await populateFull(Appointment.findById(appointment._id)));
};

// ─── Get appointments ─────────────────────────────────────────────────────────
// @route  GET /api/appointments
// Query: branch, therapist, patient, department, status, date | from & to (YYYY-MM-DD, inclusive)
export const getAppointments = async (req, res) => {
  const { branch, therapist, patient, department, date, from, to, status } = req.query;
  const filter = {};
  const role = req.user.role;

  if (role === 'parent') {
    // Parent sees upcoming sessions and completed sessions the therapist chose to share
    filter.patient = { $in: req.user.children || [] };
    filter.$or = [{ status: 'scheduled' }, { status: 'completed', parentVisible: true }];
    if (patient)
      filter.patient = { $in: (req.user.children || []).filter((c) => sameId(c, patient)) };
  } else {
    const scoped = scopedBranch(req.user, branch);
    if (scoped) filter.branch = scoped;

    if (isClinician(req.user)) {
      // Own sessions, unless looking at an assigned child's full history
      if (patient) {
        const assigned = await Patient.exists({ _id: patient, assignedTherapists: req.user._id });
        if (!assigned)
          return res.status(403).json({ message: 'This child is not assigned to you' });
        filter.patient = patient;
      } else {
        filter.therapist = req.user._id;
      }
    } else {
      if (therapist) filter.therapist = therapist;
      if (patient) filter.patient = patient;
    }
    if (status) filter.status = status;
  }

  if (department) filter.department = department;

  if (date) {
    filter.date = dayRange(date);
  } else if (from || to) {
    filter.date = {};
    if (from) filter.date.$gte = startOfDay(from);
    if (to) filter.date.$lt = addDays(startOfDay(to), 1);
  }

  const appointments = await populateFull(Appointment.find(filter)).sort({ date: 1, timeSlot: 1 });
  res.json(appointments);
};

// ─── Get single appointment ───────────────────────────────────────────────────
// @route  GET /api/appointments/:id
export const getAppointment = async (req, res) => {
  const appointment = await Appointment.findById(req.params.id)
    .populate('patient', 'name dateOfBirth gender parentDetails')
    .populate('therapist', 'name email phone departments')
    .populate('branch', 'name code city');

  if (!appointment) return res.status(404).json({ message: 'Appointment not found' });

  if (req.user.role === 'parent') {
    if (!(req.user.children || []).some((c) => sameId(c, appointment.patient))) {
      return res.status(403).json({ message: 'Access denied' });
    }
  } else if (outsideBranch(req.user, appointment.branch)) {
    return res.status(403).json({ message: 'Access denied' });
  }

  res.json(appointment);
};

// ─── Update appointment (admin — reschedule, reassign, change status) ────────
// @route  PUT /api/appointments/:id
export const updateAppointment = async (req, res) => {
  const appointment = await Appointment.findById(req.params.id);
  if (!appointment) return res.status(404).json({ message: 'Appointment not found' });

  if (outsideBranch(req.user, appointment.branch)) {
    return res.status(403).json({ message: 'Access denied' });
  }

  const { date, timeSlot, therapist, department, status } = req.body;

  if (timeSlot && !TIME_SLOTS.includes(timeSlot)) {
    return res.status(400).json({ message: 'Invalid time slot' });
  }

  if (therapist && !sameId(therapist, appointment.therapist)) {
    const therapistDoc = await User.findById(therapist).select('branch role isActive');
    if (
      !therapistDoc ||
      !isClinician(therapistDoc) ||
      !sameId(therapistDoc.branch, appointment.branch)
    ) {
      return res.status(404).json({ message: 'Therapist not found in this branch' });
    }
    appointment.therapist = therapist;
  }
  if (date) appointment.date = startOfDay(date);
  if (timeSlot) appointment.timeSlot = timeSlot;
  if (department) appointment.department = department;
  if (status) appointment.status = status;

  // Re-check the slot whenever the booking stays live and its time/person changed
  if ((date || timeSlot || therapist || status) && OCCUPYING.includes(appointment.status)) {
    const conflict = await findSlotConflict({
      therapist: appointment.therapist,
      patient: appointment.patient,
      date: appointment.date,
      timeSlot: appointment.timeSlot,
      excludeId: appointment._id,
    });
    if (conflict) return res.status(409).json({ message: conflict });
  }

  await appointment.save();
  res.json(await populateFull(Appointment.findById(appointment._id)));
};

// ─── Add session notes (therapist only) ──────────────────────────────────────
// @route  PATCH /api/appointments/:id/notes
export const addSessionNotes = async (req, res) => {
  const { sessionNotes, soapNotes, homeActivities, milestones, parentVisible, status } = req.body;

  const appointment = await Appointment.findById(req.params.id);
  if (!appointment) return res.status(404).json({ message: 'Appointment not found' });

  // Therapist can only add notes to their own appointments
  if (!sameId(appointment.therapist, req.user._id)) {
    return res.status(403).json({ message: 'You can only add notes to your own sessions' });
  }

  if (soapNotes) {
    appointment.soapNotes = {
      subjective: soapNotes.subjective ?? appointment.soapNotes?.subjective ?? '',
      objective: soapNotes.objective ?? appointment.soapNotes?.objective ?? '',
      assessment: soapNotes.assessment ?? appointment.soapNotes?.assessment ?? '',
      plan: soapNotes.plan ?? appointment.soapNotes?.plan ?? '',
    };
  }

  if (homeActivities !== undefined) appointment.homeActivities = homeActivities;
  if (milestones !== undefined) {
    appointment.milestones = milestones.filter((m) => m?.goal?.trim());
  }

  if (sessionNotes !== undefined) {
    appointment.sessionNotes = sessionNotes;
  } else if (soapNotes) {
    // Plain-text summary kept for older views
    const parts = [
      soapNotes.subjective ? `S: ${soapNotes.subjective}` : '',
      soapNotes.objective ? `O: ${soapNotes.objective}` : '',
      soapNotes.assessment ? `A: ${soapNotes.assessment}` : '',
      soapNotes.plan ? `P: ${soapNotes.plan}` : '',
    ].filter(Boolean);
    appointment.sessionNotes = parts.join('\n\n');
  }

  if (parentVisible !== undefined) appointment.parentVisible = parentVisible;
  if (status) appointment.status = status;
  if (
    soapNotes ||
    homeActivities !== undefined ||
    milestones !== undefined ||
    sessionNotes !== undefined
  ) {
    appointment.notesUpdatedAt = new Date();
  }

  await appointment.save();
  res.json(await populateFull(Appointment.findById(appointment._id)));
};

// ─── Get available time slots for a therapist on a date ──────────────────────
// @route  GET /api/appointments/slots?therapist=X&date=Y[&patient=Z]
export const getAvailableSlots = async (req, res) => {
  const { therapist, date, patient } = req.query;
  if (!therapist || !date) {
    return res.status(400).json({ message: 'therapist and date query params are required' });
  }

  const range = dayRange(date);
  const who = patient ? { $or: [{ therapist }, { patient }] } : { therapist };
  const booked = await Appointment.find({
    ...who,
    date: range,
    status: { $in: OCCUPYING },
  }).select('timeSlot');

  const bookedSlots = [...new Set(booked.map((a) => a.timeSlot))];
  const available = TIME_SLOTS.filter((slot) => !bookedSlots.includes(slot));

  res.json({ available, booked: bookedSlots, all: TIME_SLOTS });
};

// ─── Get today's appointments (for dashboards) ───────────────────────────────
// @route  GET /api/appointments/today
export const getTodayAppointments = async (req, res) => {
  const filter = { date: dayRange(new Date()) };

  const scoped = scopedBranch(req.user, req.query.branch);
  if (scoped) filter.branch = scoped;
  if (isClinician(req.user)) filter.therapist = req.user._id;

  const appointments = await populateFull(Appointment.find(filter)).sort({ timeSlot: 1 });
  res.json(appointments);
};
