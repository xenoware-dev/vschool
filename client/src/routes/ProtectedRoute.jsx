import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import BrandMark from '../components/BrandMark';
import { Spinner } from '../components/ui';

/**
 * ProtectedRoute — Blocks unauthenticated users
 * Optionally restricts by role via allowedRoles prop
 */
const ProtectedRoute = ({ allowedRoles }) => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="splash" role="status" aria-label="Loading">
        <BrandMark size={40} />
        <Spinner />
      </div>
    );
  }

  if (!user) return <Navigate to="/login" replace />;

  if (allowedRoles && !allowedRoles.includes(user.role)) {
    return <Navigate to="/dashboard" replace />;
  }

  return <Outlet />;
};

export default ProtectedRoute;
