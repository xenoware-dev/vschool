import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
  headers: {
    'Content-Type': 'application/json',
  },
});

// ─── Session storage ─────────────────────────────────────────────────────────
// Access tokens are short-lived (1 hour); the refresh token gets a new one.
export const session = {
  get token() {
    return localStorage.getItem('token');
  },
  get refreshToken() {
    return localStorage.getItem('refreshToken');
  },
  save({ token, refreshToken }) {
    if (token) localStorage.setItem('token', token);
    if (refreshToken) localStorage.setItem('refreshToken', refreshToken);
  },
  clear() {
    localStorage.removeItem('token');
    localStorage.removeItem('refreshToken');
  },
};

// Request interceptor — attach the access token if present
api.interceptors.request.use(
  (config) => {
    const token = session.token;
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// One refresh at a time, shared by every request that hit an expired token
let refreshing = null;
const refreshSession = () => {
  refreshing ??= axios
    .post('/api/auth/refresh', { refreshToken: session.refreshToken })
    .then(({ data }) => session.save(data))
    .finally(() => {
      refreshing = null;
    });
  return refreshing;
};

const signOut = () => {
  session.clear();
  if (window.location.pathname !== '/login') window.location.href = '/login';
};

// Response interceptor — an expired token is refreshed once and the request
// retried; if that fails the user goes back to sign in. A failed sign-in
// attempt is also a 401, but must stay on the page to show its message.
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const { config, response } = error;
    const isAuthCall = /\/auth\/(login|refresh)/.test(config?.url || '');

    if (response?.status !== 401 || isAuthCall) return Promise.reject(error);

    if (!config._retried && session.refreshToken) {
      try {
        await refreshSession();
        config._retried = true;
        config.headers.Authorization = `Bearer ${session.token}`;
        return api(config);
      } catch {
        // fall through to sign-out
      }
    }
    signOut();
    return Promise.reject(error);
  }
);

export default api;
