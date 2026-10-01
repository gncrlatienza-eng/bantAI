export const ROUTES = {
  HOME: '/',
  HOW_IT_WORKS: '/how-it-works',
  ABOUT: '/about',
  LICENSING: '/request-access',
  LOGIN: '/login',
  // Legacy alias — admin sign-in now uses the unified /login page. Kept so any
  // older link resolves without leaking an admin-specific URL. Prefer LOGIN.
  ADMIN_LOGIN: '/login',
  FORGOT_PASSWORD: '/forgot-password',
  TWO_FACTOR: '/2fa',
  PROFILE: '/profile',
  SETTINGS: '/settings',

  SHIELD: {
    OVERVIEW: '/shield/overview',
    CAMPAIGNS: '/shield/campaigns',
    API: '/shield/api',
    EXPORTS: '/shield/exports',
    NOTIFICATIONS: '/shield/notifications',
    DOCUMENTATION: '/shield/documentation',
    ACCOUNT: '/account',
  },

  ADMIN: {
    OVERVIEW: '/admin/overview',
    REPORTS: '/admin/reports',
    MODEL: '/admin/model',
    CONCEPT_DRIFT: '/admin/concept-drift',
    DATASET: '/admin/dataset',
    CLASSIFICATION: '/admin/classification',
    FPFN: '/admin/fpfn',
    CAMPAIGNS: '/admin/campaigns',
    TIMELINE: '/admin/timeline',
    USERS: '/admin/users',
    EXPORT: '/admin/export',
    SERVER: '/admin/server',
    API_LOGS: '/admin/api-logs',
    DB_STORAGE: '/admin/db-storage',
    TIPS: '/admin/tips',
    SETTINGS: '/admin/settings',
    NOTIFICATIONS: '/admin/notifications',
  },
} as const;
