import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor — attach JWT token if present
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor — an expired/invalid session sends the user back to sign in.
// A failed sign-in attempt is also a 401, but must stay on the page to show its message.
api.interceptors.response.use(
  (response) => response,
  (error) => {
    const isLoginAttempt = error.config?.url?.includes('/auth/login');
    if (error.response?.status === 401 && !isLoginAttempt) {
      localStorage.removeItem('token');
      if (window.location.pathname !== '/login') window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export default api;
