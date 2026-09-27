import mongoose from 'mongoose';
import { DEPARTMENT_KEYS, PATIENT_STATUSES } from '../utils/constants.js';

const patientSchema = new mongoose.Schema(
  {
    // Unique human-readable Student / Patient ID (e.g. BR001-STU-0001)
    studentId: {
      type: String,
      trim: true,
      uppercase: true,
    },

    // Child's details (filled by parent, entered by admin)
    name: {
      type: String,
      required: [true, "Child's name is required"],
      trim: true,
    },
    dateOfBirth: {
      type: Date,
      required: [true, "Child's date of birth is required"],
    },
    gender: {
      type: String,
      enum: ['male', 'female', 'other'],
      required: [true, 'Gender is required'],
    },

    // ─── Dual Facility Enrollment (School / Clinic) ─────────────────────────
    // Child can be enrolled in School, Clinic, or Both
    categories: {
      type: [String],
      enum: ['school', 'clinic'],
      default: ['clinic'],
    },

    // ─── School Details (applicable when categories includes 'school') ──────
    schoolDetails: {
      grade: { type: String, trim: true, default: '' },
      section: { type: String, trim: true, default: '' },
      rollNo: { type: String, trim: true, default: '' },
      academicYear: { type: String, trim: true, default: '' },
    },

    // ─── Parent Details (embedded for quick access) ─────────────────────────
    parentDetails: {
      name: { type: String, trim: true, default: '' },
      phone: { type: String, trim: true, default: '' },
      email: { type: String, trim: true, lowercase: true, default: '' },
      relationship: { type: String, trim: true, default: 'Parent' }, // Mother / Father / Guardian
      address: { type: String, trim: true, default: '' },
    },

    // ─── Linked system parent account (created by admin) ───────────────────
    parent: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },

    // ─── Clinic / Branch Reference ──────────────────────────────────────────
    branch: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Branch',
      required: [true, 'Branch is required'],
    },
    branchName: {
      type: String,
      trim: true,
      default: '',
    },

    // Departments child is enrolled in (can be multiple)
    enrolledDepartments: {
      type: [String],
      enum: DEPARTMENT_KEYS,
      default: [],
    },

    // Therapists actively working with this child
    assignedTherapists: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
      },
    ],

    // ─── Clinical Notes ─────────────────────────────────────────────────────
    // Initial notes entered by admin at registration
    medicalNotes: {
      type: String,
      default: '',
    },
    // Diagnosis / presenting concerns
    diagnosis: {
      type: String,
      default: '',
    },

    // ─── Status ─────────────────────────────────────────────────────────────
    status: {
      type: String,
      enum: PATIENT_STATUSES,
      default: 'active',
    },

    // Admin who registered this patient
    registeredBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
  },
  { timestamps: true }
);

// ─── Compound Indexes for High Performance Multi-Tenancy ────────────────────
patientSchema.index({ branch: 1, studentId: 1 }, { unique: true, sparse: true });
patientSchema.index({ branch: 1, categories: 1 });
patientSchema.index({ branch: 1, status: 1 });

// Virtual: age in years
patientSchema.virtual('age').get(function () {
  if (!this.dateOfBirth) return null;
  const today = new Date();
  const birth = new Date(this.dateOfBirth);
  let age = today.getFullYear() - birth.getFullYear();
  const m = today.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
  return age;
});

patientSchema.set('toJSON', { virtuals: true });
patientSchema.set('toObject', { virtuals: true });

const Patient = mongoose.model('Patient', patientSchema);
export const Student = Patient;
export default Patient;
