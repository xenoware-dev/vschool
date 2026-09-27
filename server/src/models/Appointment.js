import mongoose from 'mongoose';
import { DEPARTMENT_KEYS, APPOINTMENT_STATUSES, TIME_SLOTS } from '../utils/constants.js';

const appointmentSchema = new mongoose.Schema(
  {
    patient: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Patient',
      required: [true, 'Patient is required'],
    },
    therapist: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Therapist is required'],
    },
    branch: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Branch',
      required: [true, 'Branch is required'],
    },
    department: {
      type: String,
      enum: DEPARTMENT_KEYS,
      required: [true, 'Department is required'],
    },
    // Appointment date (date only, time is in timeSlot)
    date: {
      type: Date,
      required: [true, 'Appointment date is required'],
    },
    // 45-minute time slot (e.g., "10:30 - 11:15")
    timeSlot: {
      type: String,
      enum: TIME_SLOTS,
      required: [true, 'Time slot is required'],
    },
    status: {
      type: String,
      enum: APPOINTMENT_STATUSES,
      default: 'scheduled',
    },

    // ─── Clinical Documentation ───────────────────────────────────────────
    // Pediatric Clinical SOAP Notes
    soapNotes: {
      subjective: { type: String, default: '' }, // Mood, energy, readiness, parent feedback
      objective: { type: String, default: '' }, // Specific exercises, sensory tasks, duration
      assessment: { type: String, default: '' }, // Performance, behavioral compliance, milestones
      plan: { type: String, default: '' }, // Next steps, adjustments, homework recommendations
    },
    // Home recommendations / exercises specifically for parents
    homeActivities: {
      type: String,
      default: '',
    },
    // Targeted clinical milestones/goals addressed in this session
    milestones: [
      {
        goal: { type: String, trim: true },
        status: {
          type: String,
          enum: ['achieved', 'in_progress', 'emerging', 'not_started'],
          default: 'in_progress',
        },
      },
    ],
    // General summary note (kept for backwards compatibility)
    sessionNotes: {
      type: String,
      default: '',
    },
    // Whether notes are visible to parent
    parentVisible: {
      type: Boolean,
      default: false,
    },
    // Timestamp when notes were last updated
    notesUpdatedAt: {
      type: Date,
      default: null,
    },

    // Admin who created this appointment
    scheduledBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
  },
  { timestamps: true }
);

// ─── Compound index: prevent double-booking ───────────────────────────────────
// A therapist cannot have two live appointments on the same date + time slot.
// Cancelled / no-show sessions are excluded so the slot can be rebooked.
const liveSession = { partialFilterExpression: { status: 'scheduled' } };
appointmentSchema.index(
  { therapist: 1, date: 1, timeSlot: 1 },
  { unique: true, name: 'therapist_slot_live', ...liveSession }
);

// Also prevent same patient booked in same slot on same date
appointmentSchema.index(
  { patient: 1, date: 1, timeSlot: 1 },
  { unique: true, name: 'patient_slot_live', ...liveSession }
);
appointmentSchema.index({ branch: 1, date: 1 });

const Appointment = mongoose.model('Appointment', appointmentSchema);
export default Appointment;
