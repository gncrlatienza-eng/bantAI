import React, { useEffect, useState, type ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import {
  getCurrentUser,
  logout,
  type CurrentUser,
} from '../services/authService';

export function ClientProtectedRoute({ children }: { children: ReactNode }) {
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
  if (!user) {
    return <Navigate to="/login" replace />;
  }
  return <>{children}</>;
}
