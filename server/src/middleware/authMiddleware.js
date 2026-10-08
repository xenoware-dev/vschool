import prisma from '../config/db.js';
import supabase from '../config/supabase.js';

// ─── Protect: verify the Supabase access token and load the user's profile ───
export const protect = async (req, res, next) => {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;

  if (!token) {
    return res.status(401).json({ message: 'Not authorized — no token provided' });
  }

  // getClaims verifies the token signature (locally, using the project's
  // published signing keys) and its expiry
  const { data, error } = await supabase.auth.getClaims(token);
  const userId = data?.claims?.sub;
  if (error || !userId) {
    return res.status(401).json({ message: 'Not authorized — token invalid or expired' });
  }

  const profile = await prisma.profile.findUnique({
    where: { id: userId },
    include: { branch: { select: { id: true, name: true, code: true, city: true, isActive: true } } },
  });
  if (!profile) {
    return res.status(401).json({ message: 'Not authorized — user not found' });
  }
  if (!profile.isActive) {
    return res
      .status(403)
      .json({ message: 'Your account has been deactivated. Contact the clinic owner.' });
  }

  req.user = profile;
  next();
};

// ─── Authorize: role-based access control ────────────────────────────────────
// Usage: authorize('owner', 'admin')
export const authorize =
  (...roles) =>
  (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        message: `Role '${req.user.role}' is not permitted to access this resource`,
      });
    }
    next();
  };
