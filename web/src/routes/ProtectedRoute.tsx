import type { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { getSession, type Role } from "../lib/auth";

export function ProtectedRoute({ role, children }: { role: Role; children: ReactNode }) {
  const session = getSession();
  if (session !== role) {
    return <Navigate to={role === "admin" ? "/admin-login" : "/login"} replace />;
  }
  return <>{children}</>;
}
