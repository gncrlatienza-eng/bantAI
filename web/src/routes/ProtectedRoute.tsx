import { Navigate } from 'react-router-dom';
import { useEffect, useState, type ReactNode } from 'react';
import {
  getCurrentUser,
  logout,
  type CurrentUser,
} from '../services/authService';

type Role = 'client' | 'admin';

export function ProtectedRoute({
  role,
  children,
}: {
  role: Role;
  children: ReactNode;
}) {
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    let active = true;
    void getCurrentUser()
      .then((currentUser) => {
        if (active) setUser(currentUser);
      })
      .catch(() => {
        logout();
        if (active) setUser(null);
      })
      .finally(() => {
        if (active) setChecking(false);
      });
    return () => {
      active = false;
    };
  }, []);

  if (checking) return null;
  const actualRole: Role | null =
    user?.role === 'ADMIN' ? 'admin' : user ? 'client' : null;
  if (actualRole !== role) {
    return (
      <Navigate to={role === 'admin' ? '/admin-login' : '/login'} replace />
    );
  }
  return <>{children}</>;
}
