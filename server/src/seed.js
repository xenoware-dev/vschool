/**
 * Seed Script — 5-Branch Multi-Tenant Special School & Therapy Care
 * -----------------------------------------------------------------
 * Branches:
 *  1. BR001 - Guduvancherry
 *  2. BR002 - Vandalur
 *  3. BR003 - Singaperumal Koil
 *  4. BR004 - Kelambakkam
 *  5. BR005 - Nanganallur
 *
 * Run: npm run seed  (from /server directory)
 */

import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, '../.env') });

import User from './models/User.js';
import Branch from './models/Branch.js';
import Patient from './models/Patient.js';
import Appointment from './models/Appointment.js';
import Payment from './models/Payment.js';
import Payout from './models/Payout.js';

const ALL_DEPARTMENTS = [
  'pediatric_ot',
  'special_school',
  'speech_language',
  'physiotherapy',
  'special_education',
  'behavioral',
  'sensory_integration',
  'learning_disabilities',
  'vision_therapy',
  'psychology',
];

export const seed = async () => {
  try {
    if (mongoose.connection.readyState !== 1) {
      await mongoose.connect(process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/vschool');
      console.log('✅ Connected to MongoDB');
    }

    // ─── Wipe existing seed data ────────────────────────────────────────────
    await Promise.all([
      User.deleteMany({}),
      Branch.deleteMany({}),
      Patient.deleteMany({}),
      Appointment.deleteMany({}),
      Payment.deleteMany({}),
      Payout.deleteMany({}),
    ]);
    console.log('🗑  Cleared existing data');

    // ─── Create Owner (Super Admin) ─────────────────────────────────────────
    const owner = await User.create({
      name: 'Sasikumar (Founder & Director)',
      email: 'owner@vschool.com',
      password: 'password123',
      role: 'owner',
      phone: '+91 98765 00001',
      isActive: true,
    });

    // ─── Create 5 Branches ──────────────────────────────────────────────────
    const branchesData = [
      {
        name: 'Guduvancherry Branch',
        code: 'BR001',
        city: 'Chennai',
        address: 'GST Road, Guduvancherry',
        phone: '+91 44 2746 5001',
        email: 'guduvancherry@vschool.com',
        facilities: ['school', 'clinic'],
        departments: ALL_DEPARTMENTS,
        createdBy: owner._id,
      },
      {
        name: 'Vandalur Branch',
        code: 'BR002',
        city: 'Chennai',
        address: 'Near Zoo Road, Vandalur',
        phone: '+91 44 2746 5002',
        email: 'vandalur@vschool.com',
        facilities: ['school', 'clinic'],
        departments: ALL_DEPARTMENTS,
        createdBy: owner._id,
      },
      {
        name: 'Singaperumal Koil Branch',
        code: 'BR003',
        city: 'Chengalpattu',
        address: 'Main Bazaar, Singaperumal Koil',
        phone: '+91 44 2746 5003',
        email: 'spkoil@vschool.com',
        facilities: ['school', 'clinic'],
        departments: ALL_DEPARTMENTS,
        createdBy: owner._id,
      },
      {
        name: 'Kelambakkam Branch',
        code: 'BR004',
        city: 'Chennai',
        address: 'OMR Junction, Kelambakkam',
        phone: '+91 44 2746 5004',
        email: 'kelambakkam@vschool.com',
        facilities: ['school', 'clinic'],
        departments: ALL_DEPARTMENTS,
        createdBy: owner._id,
      },
      {
        name: 'Nanganallur Branch',
        code: 'BR005',
        city: 'Chennai',
        address: '4th Main Road, Nanganallur',
        phone: '+91 44 2746 5005',
        email: 'nanganallur@vschool.com',
        facilities: ['school', 'clinic'],
        departments: ALL_DEPARTMENTS,
        createdBy: owner._id,
      },
    ];

    const branches = await Branch.insertMany(branchesData);
    const [brGuduvancherry, brVandalur, brSPKoil, brKelambakkam, brNanganallur] = branches;

    // ─── Create Branch Admins for All 5 Branches ────────────────────────────
    const adminGdv = await User.create({
      name: 'Kavitha S. (Admin - Guduvancherry)',
      email: 'admin.guduvancherry@vschool.com',
      password: 'password123',
      role: 'admin',
      branch: brGuduvancherry._id,
      phone: '+91 98765 10001',
      createdBy: owner._id,
    });

    const adminVdl = await User.create({
      name: 'Ramesh K. (Admin - Vandalur)',
      email: 'admin.vandalur@vschool.com',
      password: 'password123',
      role: 'admin',
      branch: brVandalur._id,
      phone: '+91 98765 10002',
      createdBy: owner._id,
    });

    const adminSpk = await User.create({
      name: 'Priya M. (Admin - Singaperumal Koil)',
      email: 'admin.spkoil@vschool.com',
      password: 'password123',
      role: 'admin',
      branch: brSPKoil._id,
      phone: '+91 98765 10003',
      createdBy: owner._id,
    });

    const adminKlb = await User.create({
      name: 'Suresh R. (Admin - Kelambakkam)',
      email: 'admin.kelambakkam@vschool.com',
      password: 'password123',
      role: 'admin',
      branch: brKelambakkam._id,
      phone: '+91 98765 10004',
      createdBy: owner._id,
    });

    const adminNgl = await User.create({
      name: 'Anitha V. (Admin - Nanganallur)',
      email: 'admin.nanganallur@vschool.com',
      password: 'password123',
      role: 'admin',
      branch: brNanganallur._id,
      phone: '+91 98765 10005',
      createdBy: owner._id,
    });

    // ─── Create Therapists & Teachers ───────────────────────────────────────
    const therapistGdvSpeech = await User.create({
      name: 'Deepa Nair (Speech Therapist)',
      email: 'speech.gdv@vschool.com',
      password: 'password123',
      role: 'therapist',
      branch: brGuduvancherry._id,
      departments: ['speech_language'],
      phone: '+91 98765 20001',
      createdBy: adminGdv._id,
    });

    const therapistGdvOT = await User.create({
      name: 'Karthik Raja (OT Specialist)',
      email: 'ot.gdv@vschool.com',
      password: 'password123',
      role: 'therapist',
      branch: brGuduvancherry._id,
      departments: ['pediatric_ot', 'sensory_integration'],
      phone: '+91 98765 20002',
      createdBy: adminGdv._id,
    });

    const teacherGdvSpecial = await User.create({
      name: 'Radhika Sundaram (Special Educator)',
      email: 'teacher.gdv@vschool.com',
      password: 'password123',
      role: 'teacher',
      branch: brGuduvancherry._id,
      departments: ['special_school', 'special_education'],
      phone: '+91 98765 20003',
      createdBy: adminGdv._id,
    });

    const therapistVdlPhysio = await User.create({
      name: 'Arun Pillai (Physiotherapist)',
      email: 'physio.vdl@vschool.com',
      password: 'password123',
      role: 'therapist',
      branch: brVandalur._id,
      departments: ['physiotherapy'],
      phone: '+91 98765 20004',
      createdBy: adminVdl._id,
    });

    // ─── Create Parents ─────────────────────────────────────────────────────
    const parentGdv = await User.create({
      name: 'Venkatesh Babu',
      email: 'parent.gdv@example.com',
      password: 'password123',
      role: 'parent',
      phone: '+91 98765 30001',
      createdBy: adminGdv._id,
    });

    const parentVdl = await User.create({
      name: 'Lakshmi Narayanan',
      email: 'parent.vdl@example.com',
      password: 'password123',
      role: 'parent',
      phone: '+91 98765 30002',
      createdBy: adminVdl._id,
    });

    // ─── Create Students / Patients with Dual Facility & Human-Readable IDs ─
    // Student 1: In Guduvancherry — Dual Enrolled (School + Clinic)
    const student1 = await Patient.create({
      studentId: 'BR001-STU-0001',
      name: 'Arun Venkatesh',
      dateOfBirth: new Date('2018-05-12'),
      gender: 'male',
      categories: ['school', 'clinic'],
      schoolDetails: {
        grade: 'Primary Level 1',
        section: 'A',
        rollNo: '04',
        academicYear: '2025-2026',
      },
      parentDetails: {
        name: 'Venkatesh Babu',
        phone: '+91 98765 30001',
        email: 'parent.gdv@example.com',
        relationship: 'Father',
        address: '24, Vallalar Street, Guduvancherry',
      },
      parent: parentGdv._id,
      branch: brGuduvancherry._id,
      branchName: brGuduvancherry.name,
      enrolledDepartments: ['special_school', 'speech_language', 'pediatric_ot'],
      assignedTherapists: [therapistGdvSpeech._id, therapistGdvOT._id, teacherGdvSpecial._id],
      diagnosis: 'Autism Spectrum Disorder (ASD)',
      medicalNotes: 'Attends morning school and afternoon therapy twice a week.',
      status: 'active',
      registeredBy: adminGdv._id,
    });

    // Student 2: In Guduvancherry — Clinic Only
    const student2 = await Patient.create({
      studentId: 'BR001-STU-0002',
      name: 'Diya Venkatesh',
      dateOfBirth: new Date('2020-08-20'),
      gender: 'female',
      categories: ['clinic'],
      schoolDetails: {},
      parentDetails: {
        name: 'Venkatesh Babu',
        phone: '+91 98765 30001',
        email: 'parent.gdv@example.com',
        relationship: 'Father',
        address: '24, Vallalar Street, Guduvancherry',
      },
      parent: parentGdv._id,
      branch: brGuduvancherry._id,
      branchName: brGuduvancherry.name,
      enrolledDepartments: ['speech_language'],
      assignedTherapists: [therapistGdvSpeech._id],
      diagnosis: 'Speech Sound Delay',
      medicalNotes: 'Speech articulation exercises weekly.',
      status: 'active',
      registeredBy: adminGdv._id,
    });

    // Student 3: In Vandalur — School Only
    const student3 = await Patient.create({
      studentId: 'BR002-STU-0001',
      name: 'Devan Lakshmi',
      dateOfBirth: new Date('2017-10-10'),
      gender: 'male',
      categories: ['school'],
      schoolDetails: {
        grade: 'Special Secondary 1',
        section: 'B',
        rollNo: '08',
        academicYear: '2025-2026',
      },
      parentDetails: {
        name: 'Lakshmi Narayanan',
        phone: '+91 98765 30002',
        email: 'parent.vdl@example.com',
        relationship: 'Mother',
        address: '15, GST Main Road, Vandalur',
      },
      parent: parentVdl._id,
      branch: brVandalur._id,
      branchName: brVandalur.name,
      enrolledDepartments: ['special_school', 'special_education'],
      assignedTherapists: [therapistVdlPhysio._id],
      diagnosis: 'Learning Disability & Dyslexia',
      medicalNotes: 'Enrolled in full-time special school program.',
      status: 'active',
      registeredBy: adminVdl._id,
    });

    // Update parent linked children
    await User.findByIdAndUpdate(parentGdv._id, { children: [student1._id, student2._id] });
    await User.findByIdAndUpdate(parentVdl._id, { children: [student3._id] });

    // ─── Create Sample Appointments ─────────────────────────────────────────
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const dayOffset = (n) => {
      const d = new Date(today);
      d.setDate(d.getDate() + n);
      return d;
    };

    const session = (fields) => ({
      branch: brGuduvancherry._id,
      status: 'scheduled',
      scheduledBy: adminGdv._id,
      ...fields,
    });

    const completedNotes = (extra) => ({
      status: 'completed',
      parentVisible: true,
      notesUpdatedAt: new Date(),
      ...extra,
    });

    await Appointment.insertMany([
      // Past sessions — documented and shared with the parent
      session({
        patient: student1._id,
        therapist: therapistGdvSpeech._id,
        department: 'speech_language',
        date: dayOffset(-9),
        timeSlot: '10:30 - 11:15',
        ...completedNotes({
          soapNotes: {
            subjective: 'Arrived calm and alert. Father reports better sleep this week.',
            objective:
              'Picture-card requesting (20 trials), two-step directions with visual prompts.',
            assessment:
              'Used 2-word requests in 14/20 trials, up from 9/20 last week. Needs one prompt for two-step directions.',
            plan: 'Fade visual prompts for two-step directions; introduce "I want ___" carrier phrase.',
          },
          milestones: [
            {
              goal: 'Uses 2-3 word phrases to express spontaneous requests',
              status: 'in_progress',
            },
            { goal: 'Follows two-step directions without visual prompts', status: 'emerging' },
          ],
          homeActivities:
            'During snack time, hold the snack and wait for Arun to ask with two words ("want biscuit") before giving it. 5 minutes daily.',
        }),
      }),
      session({
        patient: student1._id,
        therapist: therapistGdvOT._id,
        department: 'pediatric_ot',
        date: dayOffset(-8),
        timeSlot: '11:15 - 12:00',
        ...completedNotes({
          soapNotes: {
            subjective: 'Slightly restless on arrival; settled after 5 minutes on the swing.',
            objective: 'Linear swing 10 min, weighted crayon tripod-grasp drill, bead threading.',
            assessment:
              'Maintained tripod grasp for 3 minutes (previously 1 minute). Threads 8 large beads independently.',
            plan: 'Progress to smaller beads; add midline-crossing activities.',
          },
          milestones: [
            { goal: 'Maintains tripod grasp on writing utensil', status: 'achieved' },
            {
              goal: 'Crosses physical midline during bilateral motor tasks',
              status: 'in_progress',
            },
          ],
          homeActivities:
            'Play-dough rolling and pinching for 10 minutes each evening. Let him tear paper strips for a collage.',
        }),
      }),
      session({
        patient: student1._id,
        therapist: therapistGdvSpeech._id,
        department: 'speech_language',
        date: dayOffset(-2),
        timeSlot: '10:30 - 11:15',
        ...completedNotes({
          soapNotes: {
            subjective: 'Cheerful, engaged quickly.',
            objective: 'Carrier-phrase practice, turn-taking game with ball.',
            assessment: 'Used "I want ___" spontaneously 3 times. Turn-taking held for 6 rounds.',
            plan: 'Generalise carrier phrase to play contexts.',
          },
          milestones: [
            { goal: 'Uses 2-3 word phrases to express spontaneous requests', status: 'achieved' },
            {
              goal: 'Maintains eye contact during conversational turn-taking',
              status: 'in_progress',
            },
          ],
          homeActivities:
            'Roll a ball back and forth and say "my turn / your turn" each time. Praise every request he makes with words.',
        }),
      }),
      session({
        patient: student2._id,
        therapist: therapistGdvSpeech._id,
        department: 'speech_language',
        date: dayOffset(-3),
        timeSlot: '12:00 - 12:45',
        ...completedNotes({
          soapNotes: {
            subjective: 'Shy at first, warmed up with bubbles.',
            objective: '/s/ sound in isolation and initial position, mirror work.',
            assessment: 'Produces /s/ in isolation 80% accuracy; initial position 50%.',
            plan: 'Move to /s/ in initial position words with picture cues.',
          },
          milestones: [
            {
              goal: 'Imitates target phonemes /s/, /r/, /th/ with 70% accuracy',
              status: 'emerging',
            },
          ],
          homeActivities:
            'Play "snake sounds" — make a long ssss sound together in front of a mirror, 5 times a day.',
        }),
      }),
      // Completed but not yet documented — shows up as a to-do for the therapist
      session({
        patient: student2._id,
        therapist: therapistGdvSpeech._id,
        department: 'speech_language',
        date: dayOffset(-1),
        timeSlot: '12:00 - 12:45',
        status: 'completed',
      }),
      session({
        patient: student1._id,
        therapist: therapistGdvOT._id,
        department: 'sensory_integration',
        date: dayOffset(-4),
        timeSlot: '15:00 - 15:45',
        status: 'no_show',
      }),
      // Today
      session({
        patient: student1._id,
        therapist: therapistGdvSpeech._id,
        department: 'speech_language',
        date: today,
        timeSlot: '10:30 - 11:15',
      }),
      session({
        patient: student1._id,
        therapist: therapistGdvOT._id,
        department: 'pediatric_ot',
        date: today,
        timeSlot: '11:15 - 12:00',
      }),
      session({
        patient: student2._id,
        therapist: therapistGdvSpeech._id,
        department: 'speech_language',
        date: today,
        timeSlot: '15:00 - 15:45',
      }),
      session({
        patient: student1._id,
        therapist: teacherGdvSpecial._id,
        department: 'special_education',
        date: today,
        timeSlot: '13:30 - 14:15',
      }),
      // Upcoming
      session({
        patient: student2._id,
        therapist: therapistGdvSpeech._id,
        department: 'speech_language',
        date: dayOffset(1),
        timeSlot: '10:30 - 11:15',
      }),
      session({
        patient: student1._id,
        therapist: therapistGdvOT._id,
        department: 'sensory_integration',
        date: dayOffset(2),
        timeSlot: '16:30 - 17:15',
      }),
      // Vandalur
      {
        patient: student3._id,
        therapist: therapistVdlPhysio._id,
        branch: brVandalur._id,
        department: 'physiotherapy',
        date: today,
        timeSlot: '12:00 - 12:45',
        status: 'scheduled',
        scheduledBy: adminVdl._id,
      },
    ]);

    // ─── Fee payments ───────────────────────────────────────────────────────
    const year = today.getFullYear();
    await Payment.insertMany([
      {
        receiptNo: `BR001-${year}-0001`,
        branch: brGuduvancherry._id,
        patient: student1._id,
        department: 'speech_language',
        description: 'Speech therapy — monthly package (8 sessions)',
        amount: 8000,
        method: 'upi',
        status: 'paid',
        paidAt: dayOffset(-10),
        recordedBy: adminGdv._id,
      },
      {
        receiptNo: `BR001-${year}-0002`,
        branch: brGuduvancherry._id,
        patient: student1._id,
        department: 'special_school',
        description: 'Special school — term fee',
        amount: 15000,
        method: 'bank_transfer',
        status: 'paid',
        paidAt: dayOffset(-6),
        recordedBy: adminGdv._id,
      },
      {
        receiptNo: `BR001-${year}-0003`,
        branch: brGuduvancherry._id,
        patient: student2._id,
        department: 'speech_language',
        description: 'Speech therapy — monthly package (4 sessions)',
        amount: 4500,
        method: 'cash',
        status: 'pending',
        dueDate: dayOffset(5),
        recordedBy: adminGdv._id,
      },
      {
        receiptNo: `BR002-${year}-0001`,
        branch: brVandalur._id,
        patient: student3._id,
        department: 'special_school',
        description: 'Special school — term fee',
        amount: 15000,
        method: 'upi',
        status: 'paid',
        paidAt: dayOffset(-3),
        recordedBy: adminVdl._id,
      },
    ]);

    console.log('\n======================================================');
    console.log('✅ SEED COMPLETED: 5 BRANCHES & MULTI-TENANT ARCHITECTURE');
    console.log('======================================================');
    console.log('Branches Created:');
    branches.forEach((b) => {
      console.log(` • [${b.code}] ${b.name} (${b.city}) — Facilities: ${b.facilities.join(', ')}`);
    });

    console.log('\nLogin Credentials:');
    console.log('------------------------------------------------------');
    console.log('Owner (All Branches)  : owner@vschool.com / password123');
    console.log('Admin Guduvancherry   : admin.guduvancherry@vschool.com / password123');
    console.log('Admin Vandalur        : admin.vandalur@vschool.com / password123');
    console.log('Admin SP Koil         : admin.spkoil@vschool.com / password123');
    console.log('Admin Kelambakkam     : admin.kelambakkam@vschool.com / password123');
    console.log('Admin Nanganallur     : admin.nanganallur@vschool.com / password123');
    console.log('Therapist Speech (GDV): speech.gdv@vschool.com / password123');
    console.log('Teacher Special (GDV) : teacher.gdv@vschool.com / password123');
    console.log('Parent Guduvancherry  : parent.gdv@example.com / password123');
    console.log('======================================================\n');
  } catch (err) {
    console.error('❌ Seed error:', err);
    throw err;
  }
};

const isDirectRun = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (isDirectRun) {
  seed()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}

export default seed;
