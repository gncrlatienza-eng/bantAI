export const STAFF_PERMISSIONS = {
  OVERVIEW_READ: 'overview:read',
  REPORTS_READ: 'reports:read',
  REPORTS_MANAGE: 'reports:manage',
  VERIFICATION_READ: 'verification:read',
  VERIFICATION_MANAGE: 'verification:manage',
  CAMPAIGNS_READ: 'campaigns:read',
  CAMPAIGNS_MANAGE: 'campaigns:manage',
  ANALYTICS_READ: 'analytics:read',
  MODELS_READ: 'models:read',
  MODELS_DEPLOY: 'models:deploy',
  RETRAINING_TRIGGER: 'retraining:trigger',
  SYSTEM_READ: 'system:read',
  PRIVACY_READ: 'privacy:read',
  PRIVACY_MANAGE: 'privacy:manage',
  ACCESS_REQUESTS_MANAGE: 'access_requests:manage',
} as const;

export type StaffPermission =
  (typeof STAFF_PERMISSIONS)[keyof typeof STAFF_PERMISSIONS];

export type StaffRole =
  'SUPERADMIN' | 'SUPPORT' | 'ANALYST' | 'OPERATIONS' | 'PRIVACY';

export const STAFF_ROLE_PERMISSIONS: Record<StaffRole, StaffPermission[]> = {
  SUPERADMIN: Object.values(STAFF_PERMISSIONS),
  SUPPORT: [
    STAFF_PERMISSIONS.OVERVIEW_READ,
    STAFF_PERMISSIONS.REPORTS_READ,
    STAFF_PERMISSIONS.REPORTS_MANAGE,
    STAFF_PERMISSIONS.VERIFICATION_READ,
    STAFF_PERMISSIONS.VERIFICATION_MANAGE,
  ],
  ANALYST: [
    STAFF_PERMISSIONS.OVERVIEW_READ,
    STAFF_PERMISSIONS.CAMPAIGNS_READ,
    STAFF_PERMISSIONS.CAMPAIGNS_MANAGE,
    STAFF_PERMISSIONS.ANALYTICS_READ,
    STAFF_PERMISSIONS.MODELS_READ,
  ],
  OPERATIONS: [
    STAFF_PERMISSIONS.OVERVIEW_READ,
    STAFF_PERMISSIONS.MODELS_DEPLOY,
    STAFF_PERMISSIONS.RETRAINING_TRIGGER,
    STAFF_PERMISSIONS.SYSTEM_READ,
  ],
  PRIVACY: [
    STAFF_PERMISSIONS.OVERVIEW_READ,
    STAFF_PERMISSIONS.PRIVACY_READ,
    STAFF_PERMISSIONS.PRIVACY_MANAGE,
  ],
};

export function resolveStaffPermissions(
  role: string,
  staffRole?: StaffRole | null,
): string[] {
  if (role !== 'ADMIN') {
    return [];
  }
  if (!staffRole || staffRole === 'SUPERADMIN') {
    return ['*'];
  }
  return STAFF_ROLE_PERMISSIONS[staffRole] || [];
}
