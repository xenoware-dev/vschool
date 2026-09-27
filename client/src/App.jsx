import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import ProtectedRoute from './routes/ProtectedRoute';
import DashboardLayout from './components/DashboardLayout';
import { PageSkeleton } from './components/ui';
import Login from './pages/Login';

// Pages load on demand so each role only downloads what it uses
const OwnerDashboard = lazy(() => import('./pages/dashboards/OwnerDashboard'));
const OwnerBranches = lazy(() => import('./pages/dashboards/owner/OwnerBranches'));
const OwnerStaff = lazy(() => import('./pages/dashboards/owner/OwnerStaff'));
const AdminDashboard = lazy(() => import('./pages/dashboards/AdminDashboard'));
const AdminPatients = lazy(() => import('./pages/dashboards/admin/AdminPatients'));
const AdminSchedule = lazy(() => import('./pages/dashboards/admin/AdminSchedule'));
const AdminStaff = lazy(() => import('./pages/dashboards/admin/AdminStaff'));
const AdminBilling = lazy(() => import('./pages/dashboards/admin/AdminBilling'));
const Reports = lazy(() => import('./pages/dashboards/shared/Reports'));
const TherapistDashboard = lazy(() => import('./pages/dashboards/TherapistDashboard'));
const TherapistPatients = lazy(() => import('./pages/dashboards/therapist/TherapistPatients'));
const ParentDashboard = lazy(() => import('./pages/dashboards/ParentDashboard'));
const ParentProgress = lazy(() => import('./pages/dashboards/parent/ParentProgress'));

// Some URLs are shared between roles; pick the right page for whoever is signed in
const byRole = (pages) =>
  function RoleSwitch() {
    const { user } = useAuth();
    const Page = pages[user?.role];
    return Page ? <Page /> : <Navigate to="/dashboard" replace />;
  };

const Home = byRole({
  owner: OwnerDashboard,
  admin: AdminDashboard,
  therapist: TherapistDashboard,
  teacher: TherapistDashboard,
  parent: ParentDashboard,
});
const Patients = byRole({
  admin: AdminPatients,
  therapist: TherapistPatients,
  teacher: TherapistPatients,
});
const Staff = byRole({ owner: OwnerStaff, admin: AdminStaff });

// Skeleton while a page's code downloads
const Lazy = () => (
  <Suspense fallback={<PageSkeleton />}>
    <Outlet />
  </Suspense>
);

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<Login />} />
          {/* Accounts are created by the clinic, not self-registered */}
          <Route path="/register" element={<Navigate to="/login" replace />} />

          <Route element={<ProtectedRoute />}>
            <Route element={<DashboardLayout />}>
              <Route element={<Lazy />}>
                <Route path="/dashboard" element={<Home />} />
                <Route element={<ProtectedRoute allowedRoles={['owner']} />}>
                  <Route path="/dashboard/branches" element={<OwnerBranches />} />
                </Route>
                <Route element={<ProtectedRoute allowedRoles={['owner', 'admin']} />}>
                  <Route path="/dashboard/staff" element={<Staff />} />
                  <Route path="/dashboard/reports" element={<Reports />} />
                </Route>
                <Route element={<ProtectedRoute allowedRoles={['admin']} />}>
                  <Route path="/dashboard/schedule" element={<AdminSchedule />} />
                  <Route path="/dashboard/billing" element={<AdminBilling />} />
                </Route>
                <Route
                  element={<ProtectedRoute allowedRoles={['admin', 'therapist', 'teacher']} />}
                >
                  <Route path="/dashboard/patients" element={<Patients />} />
                </Route>
                <Route element={<ProtectedRoute allowedRoles={['parent']} />}>
                  <Route path="/dashboard/progress" element={<ParentProgress />} />
                </Route>
              </Route>
            </Route>
          </Route>

          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
