import React, { useEffect, useState, type ReactNode } from 'react';
import { getCurrentUser, type CurrentUser } from '../../services/authService';
import { AccessDenied } from './AccessDenied';
import { LoadingState } from '../primitives';

interface StaffPermissionGateProps {
  requiredPermission: string | string[];
  denialTitle?: string;
  denialReason?: string;
  fallback?: ReactNode;
  children: ReactNode;
}

export function StaffPermissionGate({
  requiredPermission,
  denialTitle,
  denialReason,
  fallback,
  children,
}: StaffPermissionGateProps) {
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    let active = true;
    void getCurrentUser()
      .then((currentUser) => {
        if (active) setUser(currentUser);
      })
      .catch(() => {
        if (active) setUser(null);
      })
      .finally(() => {
        if (active) setChecking(false);
      });
    return () => {
      active = false;
    };
  }, []);

  if (checking) {
    return (
      <div
        style={{
          padding: '48px 24px',
          display: 'flex',
          justifyContent: 'center',
        }}
      >
        <LoadingState label="Verifying staff authorization & permissions…" />
      </div>
    );
  }

  const permissions = user?.permissions || [];
  const requiredList = Array.isArray(requiredPermission)
    ? requiredPermission
    : [requiredPermission];

  const hasAccess =
    permissions.includes('*') ||
    requiredList.every((p) => permissions.includes(p));

  if (!hasAccess) {
    if (fallback !== undefined) {
      return <>{fallback}</>;
    }

    return (
      <AccessDenied
        title={denialTitle || 'Staff Permission Required'}
        reason={
          denialReason ||
          `This operational section requires the "${requiredList.join(', ')}" staff permission. Your current staff role (${user?.staffRole || 'Restricted'}) does not possess this privilege.`
        }
        currentTier={user?.staffRole ? `Staff Role: ${user.staffRole}` : 'Staff Role: Restricted'}
        requiredTier={`Required: ${requiredList.join(', ')}`}
        returnPath="/admin/overview"
        returnLabel="Return to Admin Overview"
        showUpgrade={false}
      />
    );
  }

  return <>{children}</>;
}

export function useStaffPermission(permission: string | string[]): boolean {
  const [hasPermission, setHasPermission] = useState<boolean>(false);

  useEffect(() => {
    let active = true;
    void getCurrentUser()
      .then((user) => {
        if (!active) return;
        if (!user || user.role !== 'ADMIN') {
          setHasPermission(false);
          return;
        }
        const perms = user.permissions || [];
        if (perms.includes('*')) {
          setHasPermission(true);
          return;
        }
        const reqs = Array.isArray(permission) ? permission : [permission];
        setHasPermission(reqs.every((p) => perms.includes(p)));
      })
      .catch(() => {
        if (active) setHasPermission(false);
      });
    return () => {
      active = false;
    };
  }, [Array.isArray(permission) ? permission.join(',') : permission]);

  return hasPermission;
}

export default StaffPermissionGate;
