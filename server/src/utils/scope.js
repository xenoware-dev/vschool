// ─── Tenant & branch scoping helpers ─────────────────────────────────────────
// Every query is limited to the signed-in user's center. Within a center the
// owner may look at any branch; everyone else is pinned to their own branch.

export const idOf = (ref) => (ref?.id ?? ref?._id ?? ref)?.toString();

export const sameId = (a, b) => Boolean(a && b) && idOf(a) === idOf(b);

export const userBranchId = (user) => user.branchId || null;

// Base filter for any tenant-owned table
export const inCenter = (user) => ({ centerId: user.centerId });

// Branch filter value: owner → requested branch (or all), others → own branch
export const scopedBranch = (user, requested) => {
  if (user.role === 'owner') return requested || undefined;
  return userBranchId(user);
};

// Center + branch filter for list queries
export const scopedWhere = (user, requestedBranch) => {
  const branchId = scopedBranch(user, requestedBranch);
  return { ...inCenter(user), ...(branchId && { branchId }) };
};

// True when a record is outside what the user may touch
export const outsideScope = (user, record) =>
  !record ||
  record.centerId !== user.centerId ||
  (user.role !== 'owner' && record.branchId !== user.branchId);

// ─── Calendar dates ──────────────────────────────────────────────────────────
// Postgres DATE columns are read and written as UTC midnight, so calendar dates
// are handled as UTC midnights and as "YYYY-MM-DD" keys in API responses.

export const CENTER_TIMEZONE = 'Asia/Kolkata';

// "YYYY-MM-DD" (or any Date-able value) → UTC midnight of that calendar date
export const startOfDay = (value) => {
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}/.test(value)) {
    const [y, m, d] = value.slice(0, 10).split('-').map(Number);
    return new Date(Date.UTC(y, m - 1, d));
  }
  const d = new Date(value);
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
};

// Today's calendar date in the center's timezone, as a UTC-midnight Date
export const today = () =>
  startOfDay(new Intl.DateTimeFormat('en-CA', { timeZone: CENTER_TIMEZONE }).format(new Date()));

export const addDays = (date, days) => {
  const d = new Date(date);
  d.setUTCDate(d.getUTCDate() + days);
  return d;
};

export const dateKey = (date) => (date ? new Date(date).toISOString().slice(0, 10) : null);

// "YYYY-MM" → { start, end } covering that calendar month
export const monthRange = (period) => {
  const [y, m] = period.split('-').map(Number);
  return { start: new Date(Date.UTC(y, m - 1, 1)), end: new Date(Date.UTC(y, m, 1)) };
};

export const currentPeriod = () =>
  new Intl.DateTimeFormat('en-CA', { timeZone: CENTER_TIMEZONE }).format(new Date()).slice(0, 7);
