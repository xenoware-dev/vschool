/**
 * Seed Script — demo center with 5 branches (development only)
 * ------------------------------------------------------------
 * Center: Absolute Special School & Therapy Care
 * Branches: BR001 Guduvancherry, BR002 Vandalur, BR003 Singaperumal Koil,
 *           BR004 Kelambakkam, BR005 Nanganallur
 *
 * Wipes ALL app data and the demo logins, then recreates them.
 * Run: npm run seed  (from /server directory)
 */

import 'dotenv/config';
import { fileURLToPath } from 'url';
import prisma from './config/db.js';
import supabase from './config/supabase.js';
import { createAccount } from './controllers/userController.js';
import { addDays, today } from './utils/scope.js';

const PASSWORD = 'password123';

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

// Removes demo logins left from a previous run (profiles go with them)
const removeAuthUsers = async (emails) => {
  const wanted = new Set(emails);
  for (let page = 1; ; page += 1) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw error;
    for (const user of data.users) {
      if (wanted.has(user.email)) await supabase.auth.admin.deleteUser(user.id);
    }
    if (data.users.length < 1000) break;
  }
};

export const seed = async () => {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('Refusing to seed: NODE_ENV is production');
  }

  const accounts = [];
  const account = (fields) => {
    accounts.push(fields.email);
    return createAccount({ password: PASSWORD, ...fields });
  };

  // ─── Wipe existing data ───────────────────────────────────────────────────
  await prisma.$executeRawUnsafe('TRUNCATE TABLE centers CASCADE');
  console.log('🗑  Cleared existing data');

  // ─── Center ───────────────────────────────────────────────────────────────
  const center = await prisma.center.create({
    data: { name: 'Absolute Special School & Therapy Care', slug: 'absolute' },
  });
  const centerId = center.id;

  // Demo logins are recreated, so remove any left from an earlier run first
  await removeAuthUsers([
    'owner@vschool.com',
    'admin.guduvancherry@vschool.com',
    'admin.vandalur@vschool.com',
    'admin.spkoil@vschool.com',
    'admin.kelambakkam@vschool.com',
    'admin.nanganallur@vschool.com',
    'speech.gdv@vschool.com',
    'ot.gdv@vschool.com',
    'teacher.gdv@vschool.com',
    'physio.vdl@vschool.com',
    'parent.gdv@example.com',
    'parent.vdl@example.com',
  ]);

  // ─── Owner ────────────────────────────────────────────────────────────────
  const owner = await account({
    centerId,
    name: 'Sasikumar (Founder & Director)',
    email: 'owner@vschool.com',
    role: 'owner',
    phone: '+91 98765 00001',
  });

  // ─── Branches ─────────────────────────────────────────────────────────────
  const branchRows = [
    ['Guduvancherry Branch', 'BR001', 'Chennai', 'GST Road, Guduvancherry', 'guduvancherry'],
    ['Vandalur Branch', 'BR002', 'Chennai', 'Near Zoo Road, Vandalur', 'vandalur'],
    ['Singaperumal Koil Branch', 'BR003', 'Chengalpattu', 'Main Bazaar, Singaperumal Koil', 'spkoil'],
    ['Kelambakkam Branch', 'BR004', 'Chennai', 'OMR Junction, Kelambakkam', 'kelambakkam'],
    ['Nanganallur Branch', 'BR005', 'Chennai', '4th Main Road, Nanganallur', 'nanganallur'],
  ];
  const branches = [];
  for (const [i, [name, code, city, address, mail]] of branchRows.entries()) {
    branches.push(
      await prisma.branch.create({
        data: {
          centerId,
          name,
          code,
          city,
          address,
          phone: `+91 44 2746 500${i + 1}`,
          email: `${mail}@vschool.com`,
          facilities: ['school', 'clinic'],
          departments: ALL_DEPARTMENTS,
          createdById: owner.id,
        },
      })
    );
  }
  const [brGdv, brVdl, brSpk, brKlb, brNgl] = branches;

  // ─── Branch admins ────────────────────────────────────────────────────────
  const admin = (branch, name, email, phone) =>
    account({ centerId, branchId: branch.id, name, email, phone, role: 'admin', createdById: owner.id });

  const adminGdv = await admin(brGdv, 'Kavitha S. (Admin - Guduvancherry)', 'admin.guduvancherry@vschool.com', '+91 98765 10001');
  const adminVdl = await admin(brVdl, 'Ramesh K. (Admin - Vandalur)', 'admin.vandalur@vschool.com', '+91 98765 10002');
  await admin(brSpk, 'Priya M. (Admin - Singaperumal Koil)', 'admin.spkoil@vschool.com', '+91 98765 10003');
  await admin(brKlb, 'Suresh R. (Admin - Kelambakkam)', 'admin.kelambakkam@vschool.com', '+91 98765 10004');
  await admin(brNgl, 'Anitha V. (Admin - Nanganallur)', 'admin.nanganallur@vschool.com', '+91 98765 10005');

  // ─── Therapists & teachers ────────────────────────────────────────────────
  const clinician = (branch, createdBy, fields) =>
    account({ centerId, branchId: branch.id, createdById: createdBy.id, role: 'therapist', ...fields });

  const speechGdv = await clinician(brGdv, adminGdv, {
    name: 'Deepa Nair (Speech Therapist)',
    email: 'speech.gdv@vschool.com',
    departments: ['speech_language'],
    phone: '+91 98765 20001',
  });
  const otGdv = await clinician(brGdv, adminGdv, {
    name: 'Karthik Raja (OT Specialist)',
    email: 'ot.gdv@vschool.com',
    departments: ['pediatric_ot', 'sensory_integration'],
    phone: '+91 98765 20002',
  });
  const teacherGdv = await clinician(brGdv, adminGdv, {
    name: 'Radhika Sundaram (Special Educator)',
    email: 'teacher.gdv@vschool.com',
    role: 'teacher',
    departments: ['special_school', 'special_education'],
    phone: '+91 98765 20003',
  });
  const physioVdl = await clinician(brVdl, adminVdl, {
    name: 'Arun Pillai (Physiotherapist)',
    email: 'physio.vdl@vschool.com',
    departments: ['physiotherapy'],
    phone: '+91 98765 20004',
  });

  // ─── Parents ──────────────────────────────────────────────────────────────
  const parentGdv = await account({
    centerId,
    branchId: brGdv.id,
    name: 'Venkatesh Babu',
    email: 'parent.gdv@example.com',
    role: 'parent',
    phone: '+91 98765 30001',
    createdById: adminGdv.id,
  });
  const parentVdl = await account({
    centerId,
    branchId: brVdl.id,
    name: 'Lakshmi Narayanan',
    email: 'parent.vdl@example.com',
    role: 'parent',
    phone: '+91 98765 30002',
    createdById: adminVdl.id,
  });

  // ─── Children ─────────────────────────────────────────────────────────────
  const child = ({ therapists, ...data }) =>
    prisma.patient.create({
      data: {
        centerId,
        status: 'active',
        ...data,
        assignedTherapists: { create: therapists.map((t) => ({ therapistId: t.id })) },
      },
    });

  const gdvParent = {
    parentName: 'Venkatesh Babu',
    parentPhone: '+91 98765 30001',
    parentEmail: 'parent.gdv@example.com',
    parentRelationship: 'Father',
    parentAddress: '24, Vallalar Street, Guduvancherry',
    parentId: parentGdv.id,
  };

  // Dual enrolled (school + clinic)
  const arun = await child({
    branchId: brGdv.id,
    studentId: 'BR001-STU-0001',
    name: 'Arun Venkatesh',
    dateOfBirth: new Date('2018-05-12'),
    gender: 'male',
    categories: ['school', 'clinic'],
    grade: 'Primary Level 1',
    section: 'A',
    rollNo: '04',
    academicYear: '2025-2026',
    ...gdvParent,
    enrolledDepartments: ['special_school', 'speech_language', 'pediatric_ot'],
    therapists: [speechGdv, otGdv, teacherGdv],
    diagnosis: 'Autism Spectrum Disorder (ASD)',
    medicalNotes: 'Attends morning school and afternoon therapy twice a week.',
    registeredById: adminGdv.id,
  });

  // Clinic only
  const diya = await child({
    branchId: brGdv.id,
    studentId: 'BR001-STU-0002',
    name: 'Diya Venkatesh',
    dateOfBirth: new Date('2020-08-20'),
    gender: 'female',
    categories: ['clinic'],
    ...gdvParent,
    enrolledDepartments: ['speech_language'],
    therapists: [speechGdv],
    diagnosis: 'Speech Sound Delay',
    medicalNotes: 'Speech articulation exercises weekly.',
    registeredById: adminGdv.id,
  });

  // School only
  const devan = await child({
    branchId: brVdl.id,
    studentId: 'BR002-STU-0001',
    name: 'Devan Lakshmi',
    dateOfBirth: new Date('2017-10-10'),
    gender: 'male',
    categories: ['school'],
    grade: 'Special Secondary 1',
    section: 'B',
    rollNo: '08',
    academicYear: '2025-2026',
    parentName: 'Lakshmi Narayanan',
    parentPhone: '+91 98765 30002',
    parentEmail: 'parent.vdl@example.com',
    parentRelationship: 'Mother',
    parentAddress: '15, GST Main Road, Vandalur',
    parentId: parentVdl.id,
    enrolledDepartments: ['special_school', 'special_education'],
    therapists: [physioVdl],
    diagnosis: 'Learning Disability & Dyslexia',
    medicalNotes: 'Enrolled in full-time special school program.',
    registeredById: adminVdl.id,
  });

  // ─── Sessions ─────────────────────────────────────────────────────────────
  const day0 = today();
  const day = (n) => addDays(day0, n);

  const session = (fields) => ({
    centerId,
    branchId: brGdv.id,
    status: 'scheduled',
    scheduledById: adminGdv.id,
    ...fields,
  });

  const notes = ({ soap, milestones, homeActivities }) => ({
    status: 'completed',
    parentVisible: true,
    notesUpdatedAt: new Date(),
    soapSubjective: soap[0],
    soapObjective: soap[1],
    soapAssessment: soap[2],
    soapPlan: soap[3],
    sessionNotes: ['S', 'O', 'A', 'P'].map((k, i) => `${k}: ${soap[i]}`).join('\n\n'),
    milestones,
    homeActivities,
  });

  await prisma.appointment.createMany({
    data: [
      // Past sessions — documented and shared with the parent
      session({
        patientId: arun.id,
        therapistId: speechGdv.id,
        department: 'speech_language',
        date: day(-9),
        timeSlot: '10:30 - 11:15',
        ...notes({
          soap: [
            'Arrived calm and alert. Father reports better sleep this week.',
            'Picture-card requesting (20 trials), two-step directions with visual prompts.',
            'Used 2-word requests in 14/20 trials, up from 9/20 last week. Needs one prompt for two-step directions.',
            'Fade visual prompts for two-step directions; introduce "I want ___" carrier phrase.',
          ],
          milestones: [
            { goal: 'Uses 2-3 word phrases to express spontaneous requests', status: 'in_progress' },
            { goal: 'Follows two-step directions without visual prompts', status: 'emerging' },
          ],
          homeActivities:
            'During snack time, hold the snack and wait for Arun to ask with two words ("want biscuit") before giving it. 5 minutes daily.',
        }),
      }),
      session({
        patientId: arun.id,
        therapistId: otGdv.id,
        department: 'pediatric_ot',
        date: day(-8),
        timeSlot: '11:15 - 12:00',
        ...notes({
          soap: [
            'Slightly restless on arrival; settled after 5 minutes on the swing.',
            'Linear swing 10 min, weighted crayon tripod-grasp drill, bead threading.',
            'Maintained tripod grasp for 3 minutes (previously 1 minute). Threads 8 large beads independently.',
            'Progress to smaller beads; add midline-crossing activities.',
          ],
          milestones: [
            { goal: 'Maintains tripod grasp on writing utensil', status: 'achieved' },
            { goal: 'Crosses physical midline during bilateral motor tasks', status: 'in_progress' },
          ],
          homeActivities:
            'Play-dough rolling and pinching for 10 minutes each evening. Let him tear paper strips for a collage.',
        }),
      }),
      session({
        patientId: arun.id,
        therapistId: speechGdv.id,
        department: 'speech_language',
        date: day(-2),
        timeSlot: '10:30 - 11:15',
        ...notes({
          soap: [
            'Cheerful, engaged quickly.',
            'Carrier-phrase practice, turn-taking game with ball.',
            'Used "I want ___" spontaneously 3 times. Turn-taking held for 6 rounds.',
            'Generalise carrier phrase to play contexts.',
          ],
          milestones: [
            { goal: 'Uses 2-3 word phrases to express spontaneous requests', status: 'achieved' },
            { goal: 'Maintains eye contact during conversational turn-taking', status: 'in_progress' },
          ],
          homeActivities:
            'Roll a ball back and forth and say "my turn / your turn" each time. Praise every request he makes with words.',
        }),
      }),
      session({
        patientId: diya.id,
        therapistId: speechGdv.id,
        department: 'speech_language',
        date: day(-3),
        timeSlot: '12:00 - 12:45',
        ...notes({
          soap: [
            'Shy at first, warmed up with bubbles.',
            '/s/ sound in isolation and initial position, mirror work.',
            'Produces /s/ in isolation 80% accuracy; initial position 50%.',
            'Move to /s/ in initial position words with picture cues.',
          ],
          milestones: [
            { goal: 'Imitates target phonemes /s/, /r/, /th/ with 70% accuracy', status: 'emerging' },
          ],
          homeActivities:
            'Play "snake sounds" — make a long ssss sound together in front of a mirror, 5 times a day.',
        }),
      }),
      // Completed but not yet documented — shows up as a to-do for the therapist
      session({
        patientId: diya.id,
        therapistId: speechGdv.id,
        department: 'speech_language',
        date: day(-1),
        timeSlot: '12:00 - 12:45',
        status: 'completed',
      }),
      session({
        patientId: arun.id,
        therapistId: otGdv.id,
        department: 'sensory_integration',
        date: day(-4),
        timeSlot: '15:00 - 15:45',
        status: 'no_show',
      }),
      // Today
      session({ patientId: arun.id, therapistId: speechGdv.id, department: 'speech_language', date: day0, timeSlot: '10:30 - 11:15' }),
      session({ patientId: arun.id, therapistId: otGdv.id, department: 'pediatric_ot', date: day0, timeSlot: '11:15 - 12:00' }),
      session({ patientId: diya.id, therapistId: speechGdv.id, department: 'speech_language', date: day0, timeSlot: '15:00 - 15:45' }),
      session({ patientId: arun.id, therapistId: teacherGdv.id, department: 'special_education', date: day0, timeSlot: '13:30 - 14:15' }),
      // Upcoming
      session({ patientId: diya.id, therapistId: speechGdv.id, department: 'speech_language', date: day(1), timeSlot: '10:30 - 11:15' }),
      session({ patientId: arun.id, therapistId: otGdv.id, department: 'sensory_integration', date: day(2), timeSlot: '16:30 - 17:15' }),
      // Vandalur
      session({
        branchId: brVdl.id,
        patientId: devan.id,
        therapistId: physioVdl.id,
        department: 'physiotherapy',
        date: day0,
        timeSlot: '12:00 - 12:45',
        scheduledById: adminVdl.id,
      }),
    ],
  });

  // ─── Fee payments ─────────────────────────────────────────────────────────
  const year = new Date().getFullYear();
  await prisma.payment.createMany({
    data: [
      {
        centerId,
        branchId: brGdv.id,
        receiptNo: `BR001-${year}-0001`,
        patientId: arun.id,
        department: 'speech_language',
        description: 'Speech therapy — monthly package (8 sessions)',
        amount: 8000,
        method: 'upi',
        status: 'paid',
        paidAt: day(-10),
        recordedById: adminGdv.id,
      },
      {
        centerId,
        branchId: brGdv.id,
        receiptNo: `BR001-${year}-0002`,
        patientId: arun.id,
        department: 'special_school',
        description: 'Special school — term fee',
        amount: 15000,
        method: 'bank_transfer',
        status: 'paid',
        paidAt: day(-6),
        recordedById: adminGdv.id,
      },
      {
        centerId,
        branchId: brGdv.id,
        receiptNo: `BR001-${year}-0003`,
        patientId: diya.id,
        department: 'speech_language',
        description: 'Speech therapy — monthly package (4 sessions)',
        amount: 4500,
        method: 'cash',
        status: 'pending',
        dueDate: day(5),
        recordedById: adminGdv.id,
      },
      {
        centerId,
        branchId: brVdl.id,
        receiptNo: `BR002-${year}-0001`,
        patientId: devan.id,
        department: 'special_school',
        description: 'Special school — term fee',
        amount: 15000,
        method: 'upi',
        status: 'paid',
        paidAt: day(-3),
        recordedById: adminVdl.id,
      },
    ],
  });

  console.log('\n======================================================');
  console.log(`✅ SEED COMPLETED: ${center.name}`);
  console.log('======================================================');
  branches.forEach((b) => console.log(` • [${b.code}] ${b.name} (${b.city})`));
  console.log(`\nLogins (password: ${PASSWORD}):`);
  accounts.forEach((email) => console.log(` • ${email}`));
  console.log('======================================================\n');
};

const isDirectRun = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (isDirectRun) {
  seed()
    .then(() => prisma.$disconnect())
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('❌ Seed error:', err);
      process.exit(1);
    });
}

export default seed;
