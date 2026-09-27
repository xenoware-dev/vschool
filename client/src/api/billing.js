import api from './axiosInstance';

export const billingApi = {
  getSummary: (params) => api.get('/billing/summary', { params }),
  getPayments: (params) => api.get('/billing/payments', { params }),
  createPayment: (data) => api.post('/billing/payments', data),
  updatePayment: (id, data) => api.patch(`/billing/payments/${id}`, data),
  getPayroll: (params) => api.get('/billing/payroll', { params }),
  savePayout: (data) => api.post('/billing/payouts', data),
};
