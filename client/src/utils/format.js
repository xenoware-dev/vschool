// Local-date helpers. Using toISOString() here would shift the date by the
// UTC offset (e.g. before 05:30 IST it returns yesterday).
export const toDateKey = (date = new Date()) => {
  const d = new Date(date);
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
};

export const parseDateKey = (key) => {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d);
};

export const addDays = (key, days) => {
  const d = parseDateKey(key);
  d.setDate(d.getDate() + days);
  return toDateKey(d);
};

export const isTodayKey = (key) => key === toDateKey();

export const formatDate = (value, opts = { day: 'numeric', month: 'short', year: 'numeric' }) => {
  if (!value) return '—';
  const d = typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) ? parseDateKey(value) : new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-IN', opts);
};

export const formatLongDate = (value) =>
  formatDate(value, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

export const formatShortDate = (value) => formatDate(value, { day: 'numeric', month: 'short' });

export const formatRelativeDay = (value) => {
  const key = toDateKey(value);
  const today = toDateKey();
  if (key === today) return 'Today';
  if (key === addDays(today, 1)) return 'Tomorrow';
  if (key === addDays(today, -1)) return 'Yesterday';
  return formatDate(value, { weekday: 'short', day: 'numeric', month: 'short' });
};

export const formatCurrency = (amount) =>
  `₹${Number(amount || 0).toLocaleString('en-IN')}`;

export const greeting = (date = new Date()) => {
  const h = date.getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
};

export const firstName = (name = '') => name.replace(/^(Dr\.?|Mr\.?|Mrs\.?|Ms\.?)\s+/i, '').split(' ')[0];

export const initials = (name = '') =>
  name
    .replace(/\(.*?\)/g, '')
    .replace(/^(Dr\.?|Mr\.?|Mrs\.?|Ms\.?)\s+/i, '')
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join('') || '?';

export const hueFromString = (str = '') => {
  let hash = 0;
  for (let i = 0; i < str.length; i++) hash = (hash * 31 + str.charCodeAt(i)) % 360;
  return hash;
};

// Time slots are strings like "10:30 - 11:15"
export const slotStart = (slot = '') => slot.split('-')[0]?.trim() || '';
export const slotEnd = (slot = '') => slot.split('-')[1]?.trim() || '';

const toMinutes = (hhmm) => {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + (m || 0);
};

export const formatClock = (hhmm) => {
  if (!hhmm) return '';
  const [h, m] = hhmm.split(':').map(Number);
  const suffix = h >= 12 ? 'pm' : 'am';
  const h12 = h % 12 || 12;
  return `${h12}:${String(m).padStart(2, '0')} ${suffix}`;
};

export const isSlotNow = (slot, now = new Date()) => {
  const mins = now.getHours() * 60 + now.getMinutes();
  return mins >= toMinutes(slotStart(slot)) && mins < toMinutes(slotEnd(slot));
};

export const isSlotPast = (slot, now = new Date()) => {
  const mins = now.getHours() * 60 + now.getMinutes();
  return mins >= toMinutes(slotEnd(slot));
};

export const sortBySlot = (a, b) => toMinutes(slotStart(a.timeSlot)) - toMinutes(slotStart(b.timeSlot));

export const pct = (part, total) => (total > 0 ? Math.round((part / total) * 100) : 0);

export const idOf = (ref) => (ref?._id || ref)?.toString();
