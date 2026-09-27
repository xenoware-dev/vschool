import {
  LayoutDashboard,
  Building2,
  Users,
  Sun,
  CalendarDays,
  Baby,
  BarChart3,
  Wallet,
  ClipboardList,
  House,
  TrendingUp,
} from 'lucide-react';

export const DEPARTMENTS = [
  { key: 'pediatric_ot',          label: 'Pediatric Occupational Therapy', name: 'Occupational Therapy', color: '#6366f1', short: 'OT' },
  { key: 'special_school',        label: 'Special School',                  name: 'Special School',       color: '#8b5cf6', short: 'SS' },
  { key: 'speech_language',       label: 'Speech & Language Therapy',       name: 'Speech Therapy',       color: '#06b6d4', short: 'SLT' },
  { key: 'physiotherapy',         label: 'Paediatric Physiotherapy',        name: 'Physiotherapy',        color: '#10b981', short: 'PT' },
  { key: 'special_education',     label: 'Special Education',               name: 'Special Education',    color: '#f59e0b', short: 'SE' },
  { key: 'behavioral',            label: 'Behavioral Therapy',              name: 'Behavioral Therapy',   color: '#ef4444', short: 'BT' },
  { key: 'sensory_integration',   label: 'Sensory Integration Therapy',     name: 'Sensory Integration',  color: '#ec4899', short: 'SI' },
  { key: 'learning_disabilities', label: 'Learning Disabilities',           name: 'Learning Disabilities', color: '#f97316', short: 'LD' },
  { key: 'vision_therapy',        label: 'Vision Therapy',                  name: 'Vision Therapy',       color: '#84cc16', short: 'VT' },
  { key: 'psychology',            label: 'Psychological Assessment & Counselling', name: 'Psychology',    color: '#a78bfa', short: 'PSY' },
];

export const DEPARTMENT_MAP = Object.fromEntries(DEPARTMENTS.map((d) => [d.key, d]));

export const getDeptLabel = (key) => DEPARTMENT_MAP[key]?.label || key;
export const getDeptName = (key) => DEPARTMENT_MAP[key]?.name || key;
export const getDeptColor = (key) => DEPARTMENT_MAP[key]?.color || '#94a3b8';
export const getDeptShort = (key) => DEPARTMENT_MAP[key]?.short || key;

export const ROLES = {
  owner:     { label: 'Clinic Owner',           color: '#f59e0b', tone: 'amber' },
  admin:     { label: 'Branch Admin',           color: '#06b6d4', tone: 'blue' },
  therapist: { label: 'Therapist',              color: '#10b981', tone: 'green' },
  teacher:   { label: 'Special School Teacher', color: '#8b5cf6', tone: 'violet' },
  parent:    { label: 'Parent',                 color: '#6366f1', tone: 'gray' },
};

export const TIME_SLOTS = [
  '10:30 - 11:15', '11:15 - 12:00', '12:00 - 12:45',
  '12:45 - 13:30', '13:30 - 14:15', '14:15 - 15:00',
  '15:00 - 15:45', '15:45 - 16:30', '16:30 - 17:15',
  '17:15 - 18:00', '18:00 - 18:45', '18:45 - 19:30',
];

export const APPOINTMENT_STATUSES = {
  scheduled:  { label: 'Scheduled',  color: '#6366f1', tone: 'blue' },
  completed:  { label: 'Completed',  color: '#10b981', tone: 'green' },
  cancelled:  { label: 'Cancelled',  color: '#ef4444', tone: 'red' },
  no_show:    { label: 'No show',    color: '#f59e0b', tone: 'amber' },
};

export const PATIENT_STATUSES = {
  active:     { label: 'Active',     color: '#10b981', tone: 'green' },
  on_hold:    { label: 'On hold',    color: '#f59e0b', tone: 'amber' },
  discharged: { label: 'Discharged', color: '#94a3b8', tone: 'gray' },
};

// Navigation per role, grouped into sidebar sections
export const NAV_ITEMS = {
  owner: [
    { section: 'Network', items: [
      { path: '/dashboard',          label: 'Overview',  icon: LayoutDashboard },
      { path: '/dashboard/branches', label: 'Branches',  icon: Building2 },
      { path: '/dashboard/staff',    label: 'Staff',     icon: Users },
      { path: '/dashboard/reports',  label: 'Reports',   icon: BarChart3 },
    ] },
  ],
  admin: [
    { section: 'Operations', items: [
      { path: '/dashboard',          label: 'Today',     icon: Sun },
      { path: '/dashboard/schedule', label: 'Schedule',  icon: CalendarDays },
      { path: '/dashboard/patients', label: 'Patients',  icon: Baby },
    ] },
    { section: 'Management', items: [
      { path: '/dashboard/staff',    label: 'Staff',     icon: Users },
      { path: '/dashboard/billing',  label: 'Billing',   icon: Wallet },
      { path: '/dashboard/reports',  label: 'Reports',   icon: BarChart3 },
    ] },
  ],
  therapist: [
    { section: 'Workspace', items: [
      { path: '/dashboard',          label: 'My day',    icon: ClipboardList },
      { path: '/dashboard/patients', label: 'Patients',  icon: Baby },
    ] },
  ],
  teacher: [
    { section: 'Workspace', items: [
      { path: '/dashboard',          label: 'My day',    icon: ClipboardList },
      { path: '/dashboard/patients', label: 'Students',  icon: Baby },
    ] },
  ],
  parent: [
    { section: 'Family', items: [
      { path: '/dashboard',          label: 'Home',      icon: House },
      { path: '/dashboard/progress', label: 'Progress',  icon: TrendingUp },
    ] },
  ],
};

export const flatNav = (role) => (NAV_ITEMS[role] || []).flatMap((g) => g.items);
