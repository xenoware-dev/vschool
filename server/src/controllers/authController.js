import prisma from '../config/db.js';
import supabase, { authClient } from '../config/supabase.js';
import { serializeProfile } from '../utils/serialize.js';

const loadProfile = (id) =>
  prisma.profile.findUnique({
    where: { id },
    include: {
      branch: {
        select: { id: true, name: true, code: true, city: true, departments: true, isActive: true },
      },
    },
  });

const sessionTokens = (session) => ({
  token: session.access_token,
  refreshToken: session.refresh_token,
  expiresAt: session.expires_at,
});

// ─── Login ────────────────────────────────────────────────────────────────────
// @route  POST /api/auth/login
// @access Public
export const login = async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ message: 'Please enter your email and password' });
  }

  const { data, error } = await authClient().auth.signInWithPassword({
    email: email.toLowerCase().trim(),
    password,
  });
  if (error || !data.session) {
    return res.status(401).json({ message: 'Invalid email or password' });
  }

  const profile = await loadProfile(data.user.id);
  if (!profile) {
    return res.status(401).json({ message: 'Invalid email or password' });
  }
  if (!profile.isActive) {
    return res
      .status(403)
      .json({ message: 'Your account has been deactivated. Please contact the clinic.' });
  }
  if (profile.branch && !profile.branch.isActive) {
    return res
      .status(403)
      .json({ message: 'Your branch is currently inactive. Please contact the clinic owner.' });
  }

  res.json({ ...serializeProfile(profile), ...sessionTokens(data.session) });
};

// ─── Refresh an expired access token ─────────────────────────────────────────
// @route  POST /api/auth/refresh
// @access Public (needs a valid refresh token)
export const refresh = async (req, res) => {
  const { refreshToken } = req.body;
  if (!refreshToken) return res.status(400).json({ message: 'Refresh token is required' });

  const { data, error } = await authClient().auth.refreshSession({ refresh_token: refreshToken });
  if (error || !data.session) {
    return res.status(401).json({ message: 'Session expired — please sign in again' });
  }
  res.json(sessionTokens(data.session));
};

// ─── Get current user profile ─────────────────────────────────────────────────
// @route  GET /api/auth/me
// @access Private
export const getMe = async (req, res) => {
  res.json(serializeProfile(await loadProfile(req.user.id)));
};

// ─── Change own password ─────────────────────────────────────────────────────
// @route  PUT /api/auth/password
// @access Private
export const changePassword = async (req, res) => {
  const { currentPassword, newPassword } = req.body;

  if (!newPassword || newPassword.length < 6) {
    return res.status(400).json({ message: 'New password must be at least 6 characters' });
  }

  const { error: wrongPassword } = await authClient().auth.signInWithPassword({
    email: req.user.email,
    password: currentPassword || '',
  });
  if (wrongPassword) {
    return res.status(401).json({ message: 'Current password is incorrect' });
  }

  const { error } = await supabase.auth.admin.updateUserById(req.user.id, {
    password: newPassword,
  });
  if (error) return res.status(400).json({ message: error.message });

  res.json({ message: 'Password updated successfully' });
};
