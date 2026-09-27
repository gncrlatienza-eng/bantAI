import React, { useEffect, useState, type ReactNode } from 'react';
import {
  getCurrentUser,
  getCustomerMetadata,
  type CurrentUser,
  type LicenseTier,
  type WorkspaceMembership,
} from '../services/authService';
import { AccessDenied } from '../components/common/AccessDenied';
import { LoadingState } from '../components/primitives';

interface EntitlementGateProps {
  requiredLicense?: LicenseTier;
  requiredMembership?: WorkspaceMembership;
  denialTitle?: string;
  denialReason?: string;
  children: ReactNode;
}

export function EntitlementGate({
  requiredLicense,
  requiredMembership,
  denialTitle,
  denialReason,
  children,
}: EntitlementGateProps) {
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
        <LoadingState label="Verifying authorization & license entitlements…" />
      </div>
    );
  }

  const metadata = getCustomerMetadata(user);

  // License tier entitlement check
  if (
    requiredLicense &&
    requiredLicense === 'Organization' &&
    metadata.license !== 'Organization'
  ) {
    return (
      <AccessDenied
        title={denialTitle || 'Organization License Required'}
        reason={
          denialReason ||
          'This feature is exclusive to active Organization workspaces. Your workspace is currently on the Research license tier.'
        }
        currentTier={`${metadata.license} Tier`}
        requiredTier={`${requiredLicense} Tier`}
        showUpgrade={true}
      />
    );
  }

  // Workspace membership check (e.g. Owner only actions)
  if (
    requiredMembership &&
    requiredMembership === 'Owner' &&
    metadata.membership !== 'Owner'
  ) {
    return (
      <AccessDenied
        title={denialTitle || 'Workspace Owner Permission Required'}
        reason={
          denialReason ||
          'Only designated Workspace Owners have permission to access this management surface. Contact your workspace owner to request access.'
        }
        currentTier={`Member (${metadata.membership})`}
        requiredTier="Workspace Owner"
        showUpgrade={false}
      />
    );
  }

  return <>{children}</>;
}

export default EntitlementGate;
