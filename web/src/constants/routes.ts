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
    NOTIFICATIONS: '/shield/notifications',
    DOCUMENTATION: '/shield/documentation',
    ACCOUNT: '/shield/account',
  },

  // Canonical admin paths; the full map (with hub tabs and permissions) is
  // src/navigation/portalNav.tsx.
  ADMIN: {
    OVERVIEW: '/admin/overview',
    REVIEW: '/admin/review',
    CAMPAIGNS: '/admin/campaigns',
    MESSAGES: '/admin/messages',
    MODEL: '/admin/model',
    CUSTOMERS: '/admin/customers',
    TIPS: '/admin/tips',
    SYSTEM: '/admin/system',
    SETTINGS: '/admin/settings/profile',
    NOTIFICATIONS: '/admin/notifications',
  },
} as const;
