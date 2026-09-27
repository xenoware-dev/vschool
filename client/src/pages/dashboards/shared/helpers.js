// Page-level helpers not covered by utils/format.js (which the design system owns)
import { toDateKey } from '../../../utils/format';
import { getDeptName } from '../../../utils/constants';

export const apiError = (err, fallback = 'Something went wrong. Please try again.') =>
  err?.response?.data?.message || err?.message || fallback;

// Pay periods are "YYYY-MM"
export const currentPeriod = () => toDateKey().slice(0, 7);

export const shiftPeriod = (period, months) => {
  const [y, m] = period.split('-').map(Number);
  const d = new Date(y, m - 1 + months, 1);
  return toDateKey(d).slice(0, 7);
};

export const formatPeriod = (period) => {
  const [y, m] = period.split('-').map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
};

export const periodBounds = (period) => {
  const [y, m] = period.split('-').map(Number);
  return { from: toDateKey(new Date(y, m - 1, 1)), to: toDateKey(new Date(y, m, 0)) };
};

// "Deepa Nair (Speech Therapist)" → "Deepa Nair"
export const cleanName = (name = '') => name.replace(/\s*\(.*?\)\s*/g, ' ').trim();

export const deptList = (depts = []) => depts.map(getDeptName).join(', ');

export const plural = (n, word, many = `${word}s`) => `${n} ${n === 1 ? word : many}`;

export const hasNotes = (a) =>
  Boolean(
    a?.soapNotes?.assessment ||
    a?.soapNotes?.subjective ||
    a?.soapNotes?.objective ||
    a?.sessionNotes
  );

// Completed session with nothing written yet — a documentation to-do
export const needsNotes = (a) => a?.status === 'completed' && !hasNotes(a);

export const PAYMENT_METHODS = {
  upi: 'UPI',
  cash: 'Cash',
  card: 'Card',
  bank_transfer: 'Bank transfer',
  cheque: 'Cheque',
};

export const MILESTONE_STATUSES = {
  achieved: { label: 'Achieved', tone: 'green' },
  in_progress: { label: 'In progress', tone: 'blue' },
  emerging: { label: 'Emerging', tone: 'amber' },
  not_started: { label: 'Not started', tone: 'gray' },
};

export const COMMON_DIAGNOSES = [
  'Autism Spectrum Disorder (ASD)',
  'Attention Deficit Hyperactivity Disorder (ADHD)',
  'Speech & Language Delay',
  'Sensory Processing Disorder (SPD)',
  'Cerebral Palsy (CP)',
  'Global Developmental Delay (GDD)',
  'Down Syndrome',
  'Learning Disability (Dyslexia / Dysgraphia)',
  'Fine / Gross Motor Delay',
];
