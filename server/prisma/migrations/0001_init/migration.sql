-- CreateEnum
CREATE TYPE "Role" AS ENUM ('owner', 'admin', 'therapist', 'teacher', 'parent');

-- CreateEnum
CREATE TYPE "Department" AS ENUM ('pediatric_ot', 'special_school', 'speech_language', 'physiotherapy', 'special_education', 'behavioral', 'sensory_integration', 'learning_disabilities', 'vision_therapy', 'psychology');

-- CreateEnum
CREATE TYPE "Facility" AS ENUM ('school', 'clinic');

-- CreateEnum
CREATE TYPE "Gender" AS ENUM ('male', 'female', 'other');

-- CreateEnum
CREATE TYPE "PatientStatus" AS ENUM ('active', 'discharged', 'on_hold');

-- CreateEnum
CREATE TYPE "AppointmentStatus" AS ENUM ('scheduled', 'completed', 'cancelled', 'no_show');

-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('upi', 'cash', 'card', 'bank_transfer', 'cheque');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('paid', 'pending');

-- CreateTable
CREATE TABLE "centers" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "centers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "branches" (
    "id" UUID NOT NULL,
    "center_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "address" TEXT NOT NULL DEFAULT '',
    "city" TEXT NOT NULL DEFAULT '',
    "phone" TEXT NOT NULL DEFAULT '',
    "email" TEXT NOT NULL DEFAULT '',
    "facilities" "Facility"[] DEFAULT ARRAY['school', 'clinic']::"Facility"[],
    "departments" "Department"[] DEFAULT ARRAY[]::"Department"[],
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_by" UUID,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "branches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "profiles" (
    "id" UUID NOT NULL,
    "center_id" UUID NOT NULL,
    "branch_id" UUID,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT NOT NULL DEFAULT '',
    "role" "Role" NOT NULL,
    "departments" "Department"[] DEFAULT ARRAY[]::"Department"[],
    "session_rate" DECIMAL(10,2) NOT NULL DEFAULT 650,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_by" UUID,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "patients" (
    "id" UUID NOT NULL,
    "center_id" UUID NOT NULL,
    "branch_id" UUID NOT NULL,
    "student_id" TEXT,
    "name" TEXT NOT NULL,
    "date_of_birth" DATE NOT NULL,
    "gender" "Gender" NOT NULL,
    "categories" "Facility"[] DEFAULT ARRAY['clinic']::"Facility"[],
    "grade" TEXT NOT NULL DEFAULT '',
    "section" TEXT NOT NULL DEFAULT '',
    "roll_no" TEXT NOT NULL DEFAULT '',
    "academic_year" TEXT NOT NULL DEFAULT '',
    "parent_name" TEXT NOT NULL DEFAULT '',
    "parent_phone" TEXT NOT NULL DEFAULT '',
    "parent_email" TEXT NOT NULL DEFAULT '',
    "parent_relationship" TEXT NOT NULL DEFAULT 'Parent',
    "parent_address" TEXT NOT NULL DEFAULT '',
    "parent_id" UUID,
    "enrolled_departments" "Department"[] DEFAULT ARRAY[]::"Department"[],
    "medical_notes" TEXT NOT NULL DEFAULT '',
    "diagnosis" TEXT NOT NULL DEFAULT '',
    "status" "PatientStatus" NOT NULL DEFAULT 'active',
    "registered_by" UUID,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "patients_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "patient_therapists" (
    "patient_id" UUID NOT NULL,
    "therapist_id" UUID NOT NULL,
    "assigned_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "patient_therapists_pkey" PRIMARY KEY ("patient_id","therapist_id")
);

-- CreateTable
CREATE TABLE "appointments" (
    "id" UUID NOT NULL,
    "center_id" UUID NOT NULL,
    "branch_id" UUID NOT NULL,
    "patient_id" UUID NOT NULL,
    "therapist_id" UUID NOT NULL,
    "department" "Department" NOT NULL,
    "date" DATE NOT NULL,
    "time_slot" TEXT NOT NULL,
    "status" "AppointmentStatus" NOT NULL DEFAULT 'scheduled',
    "soap_subjective" TEXT NOT NULL DEFAULT '',
    "soap_objective" TEXT NOT NULL DEFAULT '',
    "soap_assessment" TEXT NOT NULL DEFAULT '',
    "soap_plan" TEXT NOT NULL DEFAULT '',
    "home_activities" TEXT NOT NULL DEFAULT '',
    "milestones" JSONB NOT NULL DEFAULT '[]',
    "session_notes" TEXT NOT NULL DEFAULT '',
    "parent_visible" BOOLEAN NOT NULL DEFAULT false,
    "notes_updated_at" TIMESTAMPTZ,
    "scheduled_by" UUID,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "appointments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payments" (
    "id" UUID NOT NULL,
    "center_id" UUID NOT NULL,
    "branch_id" UUID NOT NULL,
    "receipt_no" TEXT NOT NULL,
    "patient_id" UUID NOT NULL,
    "department" "Department",
    "description" TEXT NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "method" "PaymentMethod" NOT NULL DEFAULT 'upi',
    "status" "PaymentStatus" NOT NULL DEFAULT 'paid',
    "paid_at" TIMESTAMPTZ,
    "due_date" DATE,
    "reference" TEXT NOT NULL DEFAULT '',
    "recorded_by" UUID,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payouts" (
    "id" UUID NOT NULL,
    "center_id" UUID NOT NULL,
    "branch_id" UUID NOT NULL,
    "staff_id" UUID NOT NULL,
    "period" TEXT NOT NULL,
    "sessions" INTEGER NOT NULL DEFAULT 0,
    "rate_per_session" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "bonus" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "deductions" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "amount" DECIMAL(10,2) NOT NULL,
    "method" "PaymentMethod" NOT NULL DEFAULT 'bank_transfer',
    "reference" TEXT NOT NULL DEFAULT '',
    "paid_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "recorded_by" UUID,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "payouts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "centers_slug_key" ON "centers"("slug");

-- CreateIndex
CREATE INDEX "branches_center_id_idx" ON "branches"("center_id");

-- CreateIndex
CREATE UNIQUE INDEX "branches_center_id_code_key" ON "branches"("center_id", "code");

-- CreateIndex
CREATE UNIQUE INDEX "profiles_email_key" ON "profiles"("email");

-- CreateIndex
CREATE INDEX "profiles_center_id_role_idx" ON "profiles"("center_id", "role");

-- CreateIndex
CREATE INDEX "profiles_branch_id_idx" ON "profiles"("branch_id");

-- CreateIndex
CREATE INDEX "patients_center_id_branch_id_status_idx" ON "patients"("center_id", "branch_id", "status");

-- CreateIndex
CREATE INDEX "patients_parent_id_idx" ON "patients"("parent_id");

-- CreateIndex
CREATE UNIQUE INDEX "patients_branch_id_student_id_key" ON "patients"("branch_id", "student_id");

-- CreateIndex
CREATE INDEX "patient_therapists_therapist_id_idx" ON "patient_therapists"("therapist_id");

-- CreateIndex
CREATE INDEX "appointments_center_id_branch_id_date_idx" ON "appointments"("center_id", "branch_id", "date");

-- CreateIndex
CREATE INDEX "appointments_therapist_id_date_idx" ON "appointments"("therapist_id", "date");

-- CreateIndex
CREATE INDEX "appointments_patient_id_date_idx" ON "appointments"("patient_id", "date");

-- CreateIndex
CREATE INDEX "payments_center_id_branch_id_status_created_at_idx" ON "payments"("center_id", "branch_id", "status", "created_at");

-- CreateIndex
CREATE INDEX "payments_patient_id_idx" ON "payments"("patient_id");

-- CreateIndex
CREATE UNIQUE INDEX "payments_branch_id_receipt_no_key" ON "payments"("branch_id", "receipt_no");

-- CreateIndex
CREATE INDEX "payouts_center_id_branch_id_period_idx" ON "payouts"("center_id", "branch_id", "period");

-- CreateIndex
CREATE UNIQUE INDEX "payouts_staff_id_period_key" ON "payouts"("staff_id", "period");

-- AddForeignKey
ALTER TABLE "branches" ADD CONSTRAINT "branches_center_id_fkey" FOREIGN KEY ("center_id") REFERENCES "centers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "branches" ADD CONSTRAINT "branches_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "profiles" ADD CONSTRAINT "profiles_center_id_fkey" FOREIGN KEY ("center_id") REFERENCES "centers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "profiles" ADD CONSTRAINT "profiles_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "profiles" ADD CONSTRAINT "profiles_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "patients" ADD CONSTRAINT "patients_center_id_fkey" FOREIGN KEY ("center_id") REFERENCES "centers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "patients" ADD CONSTRAINT "patients_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "patients" ADD CONSTRAINT "patients_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "patients" ADD CONSTRAINT "patients_registered_by_fkey" FOREIGN KEY ("registered_by") REFERENCES "profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "patient_therapists" ADD CONSTRAINT "patient_therapists_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "patients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "patient_therapists" ADD CONSTRAINT "patient_therapists_therapist_id_fkey" FOREIGN KEY ("therapist_id") REFERENCES "profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_center_id_fkey" FOREIGN KEY ("center_id") REFERENCES "centers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "patients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_therapist_id_fkey" FOREIGN KEY ("therapist_id") REFERENCES "profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_scheduled_by_fkey" FOREIGN KEY ("scheduled_by") REFERENCES "profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_center_id_fkey" FOREIGN KEY ("center_id") REFERENCES "centers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "patients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_recorded_by_fkey" FOREIGN KEY ("recorded_by") REFERENCES "profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payouts" ADD CONSTRAINT "payouts_center_id_fkey" FOREIGN KEY ("center_id") REFERENCES "centers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payouts" ADD CONSTRAINT "payouts_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payouts" ADD CONSTRAINT "payouts_staff_id_fkey" FOREIGN KEY ("staff_id") REFERENCES "profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payouts" ADD CONSTRAINT "payouts_recorded_by_fkey" FOREIGN KEY ("recorded_by") REFERENCES "profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- ─── Supabase Auth link ──────────────────────────────────────────────────────
-- A profile exists only for a real Supabase Auth user and goes with it.
ALTER TABLE "profiles"
  ADD CONSTRAINT "profiles_id_auth_users_fkey"
  FOREIGN KEY ("id") REFERENCES auth.users("id") ON DELETE CASCADE;

-- ─── Double-booking protection ───────────────────────────────────────────────
-- A therapist or child cannot have two scheduled sessions in the same slot.
-- Cancelled / no-show sessions are excluded so the slot can be rebooked.
CREATE UNIQUE INDEX "appointments_therapist_slot_live"
  ON "appointments" ("therapist_id", "date", "time_slot")
  WHERE "status" = 'scheduled';
CREATE UNIQUE INDEX "appointments_patient_slot_live"
  ON "appointments" ("patient_id", "date", "time_slot")
  WHERE "status" = 'scheduled';

-- ─── Row-level security ──────────────────────────────────────────────────────
-- All access goes through the Express API, which connects as the database
-- owner. Enabling RLS with no policies blocks Supabase's public data API
-- (anon / authenticated keys) from reading or writing these tables directly.
ALTER TABLE "centers" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "branches" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "profiles" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "patients" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "patient_therapists" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "appointments" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "payments" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "payouts" ENABLE ROW LEVEL SECURITY;
