import { useSearchParams } from 'react-router-dom';
import { useApi } from '../../../hooks/useApi';
import { patientsApi } from '../../../api/patients';
import { appointmentsApi } from '../../../api/appointments';
import { billingApi } from '../../../api/billing';

// Children, sessions and fees for the signed-in parent, plus the selected child (?child=id)
export const useParentData = () => {
  const [params, setParams] = useSearchParams();
  const { data, loading, error, reload } = useApi(async () => {
    const [children, sessions, payments] = await Promise.all([
      patientsApi.getAll(),
      appointmentsApi.getAll(),
      billingApi.getPayments(),
    ]);
    return { children: children.data, sessions: sessions.data, payments: payments.data };
  });

  const children = data?.children || [];
  const child = children.find((c) => c._id === params.get('child')) || children[0] || null;
  const selectChild = (id) => {
    const next = new URLSearchParams(params);
    next.set('child', id);
    setParams(next, { replace: true });
  };

  const forChild = (list) =>
    child ? (list || []).filter((x) => x.patient?._id === child._id) : [];

  return {
    loading,
    error,
    reload,
    children,
    child,
    selectChild,
    sessions: forChild(data?.sessions),
    payments: forChild(data?.payments),
  };
};
