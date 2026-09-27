import api from './axiosInstance';

export const branchApi = {
  create: (data) => api.post('/branches', data),
  getAll: () => api.get('/branches'),
  getOverview: () => api.get('/branches/overview'),
  getOne: (id) => api.get(`/branches/${id}`),
  update: (id, data) => api.put(`/branches/${id}`, data),
  toggle: (id) => api.patch(`/branches/${id}/toggle`),
};
