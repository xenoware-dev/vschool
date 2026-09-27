import api from './axiosInstance';

export const usersApi = {
  create: (data) => api.post('/users', data),
  getAll: (params) => api.get('/users', { params }),
  getOne: (id) => api.get(`/users/${id}`),
  update: (id, data) => api.put(`/users/${id}`, data),
  toggle: (id) => api.patch(`/users/${id}/toggle`),
  resetPassword: (id, password) => api.patch(`/users/${id}/password`, { password }),
  getTherapists: (params) => api.get('/users/therapists', { params }),
};
