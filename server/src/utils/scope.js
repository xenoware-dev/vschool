// ─── Branch scoping helpers ──────────────────────────────────────────────────

export const idOf = (ref) => (ref?._id ?? ref)?.toString();

export const sameId = (a, b) => Boolean(a && b) && idOf(a) === idOf(b);

export const userBranchId = (user) => user.branch?._id || user.branch || null;

// Owner may look at any branch (or all when none requested); everyone else is
// pinned to their own branch regardless of what they ask for.
export const scopedBranch = (user, requested) => {
  if (user.role === 'owner') return requested || undefined;
  return userBranchId(user);
};

// True when a non-owner is trying to touch a record outside their branch
export const outsideBranch = (user, recordBranch) =>
  user.role !== 'owner' && !sameId(userBranchId(user), recordBranch);

// ─── Date helpers (calendar dates are stored as local midnight) ──────────────

// Parse "YYYY-MM-DD" (or any Date-able value) to local midnight
export const startOfDay = (value) => {
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [y, m, d] = value.split('-').map(Number);
    return new Date(y, m - 1, d);
  }
  const d = new Date(value);
  d.setHours(0, 0, 0, 0);
  return d;
};

export const addDays = (date, days) => {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
};

export const dayRange = (value) => {
  const start = startOfDay(value);
  return { $gte: start, $lt: addDays(start, 1) };
};

// "YYYY-MM" → { start, end } covering that calendar month
export const monthRange = (period) => {
  const [y, m] = period.split('-').map(Number);
  return { start: new Date(y, m - 1, 1), end: new Date(y, m, 1) };
};
