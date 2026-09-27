import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import { ROLES, DEPARTMENT_KEYS } from '../utils/constants.js';

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Name is required'],
      trim: true,
    },
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^\S+@\S+\.\S+$/, 'Please provide a valid email'],
    },
    password: {
      type: String,
      required: [true, 'Password is required'],
      minlength: [6, 'Password must be at least 6 characters'],
      select: false,
    },
    role: {
      type: String,
      enum: ROLES,
      required: [true, 'Role is required'],
    },
    // Branch the user belongs to (required for admin, therapist)
    branch: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Branch',
      default: null,
    },
    // Departments assigned (only for therapists — one or more)
    departments: {
      type: [String],
      enum: DEPARTMENT_KEYS,
      default: [],
    },
    phone: {
      type: String,
      trim: true,
      default: '',
    },
    // Pay per completed session (therapists & teachers) — drives monthly payroll
    sessionRate: {
      type: Number,
      min: 0,
      default: 650,
    },
    // Used for parent role — linked children (patients)
    children: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Patient',
      },
    ],
    isActive: {
      type: Boolean,
      default: true,
    },
    // For parent role — who created this parent account (which admin)
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
  },
  { timestamps: true }
);

// ─── Hash password before saving ──────────────────────────────────────────────
userSchema.pre('save', async function () {
  if (!this.isModified('password')) return;
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
});

// ─── Method to compare passwords ──────────────────────────────────────────────
userSchema.methods.matchPassword = async function (enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

const User = mongoose.model('User', userSchema);
export default User;
