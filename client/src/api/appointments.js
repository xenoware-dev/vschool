import api from './axiosInstance';

export const appointmentsApi = {
  create: (data) => api.post('/appointments', data),
  getAll: (params) => api.get('/appointments', { params }),
  getOne: (id) => api.get(`/appointments/${id}`),
  update: (id, data) => api.put(`/appointments/${id}`, data),
  addNotes: (id, data) => api.patch(`/appointments/${id}/notes`, data),
  getAvailableSlots: (params) => api.get('/appointments/slots', { params }),
  getToday: (params) => api.get('/appointments/today', { params }),
};
