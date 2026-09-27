import { createContext, useContext, useState, useEffect } from 'react';
import { authApi } from '../api/auth';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    const loadUser = async () => {
      const token = localStorage.getItem('token');
      if (!token) {
        if (isMounted) setLoading(false);
        return;
      }
      try {
        const { data } = await authApi.getMe();
        if (isMounted) setUser(data);
      } catch {
        localStorage.removeItem('token');
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    loadUser();
    return () => { isMounted = false; };
  }, []);

  const login = async (credentials) => {
    const { data } = await authApi.login(credentials);
    localStorage.setItem('token', data.token);
    setUser(data);
    return data;
  };

  const logout = () => {
    localStorage.removeItem('token');
    setUser(null);
  };

  // Convenience helpers
  const isOwner = user?.role === 'owner';
  const isAdmin = user?.role === 'admin';
  const isTherapist = ['therapist', 'teacher'].includes(user?.role);
  const isTeacher = user?.role === 'teacher';
  const isParent = user?.role === 'parent';

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        login,
        logout,
        isOwner,
        isAdmin,
        isTherapist,
        isTeacher,
        isParent,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
};
