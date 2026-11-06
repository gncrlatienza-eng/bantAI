import { fetchApi } from '../api/apiClient';

export interface NotificationPreferences {
  inAppEnabled: boolean;
  campaignChangesEnabled: boolean;
  subscriptionUpdatesEnabled: boolean;
  apiUsageAlertsEnabled: boolean;
  systemHealthAlertsEnabled: boolean;
  updatedAt: string;
}

export interface PortalNotification {
  id: string;
  type: string;
  title: string;
  body: string;
  link: string | null;
  readAt: string | null;
  createdAt: string;
}

export interface NotificationInbox {
  unreadCount: number;
  items: PortalNotification[];
}

type Area = 'shield' | 'admin';
const base = (area: Area) => `/${area}/notifications`;

export const getNotificationPreferences = (area: Area) =>
  fetchApi<NotificationPreferences>(`${base(area)}/preferences`);
export const updateNotificationPreferences = (
  area: Area,
  updates: Partial<Omit<NotificationPreferences, 'updatedAt'>>,
) =>
  fetchApi<NotificationPreferences>(`${base(area)}/preferences`, {
    method: 'PATCH',
    body: JSON.stringify(updates),
  });
export const getNotificationInbox = (area: Area) =>
  fetchApi<NotificationInbox>(base(area));
export const markNotificationRead = (area: Area, id: string) =>
  fetchApi<PortalNotification>(`${base(area)}/${encodeURIComponent(id)}/read`, {
    method: 'PATCH',
  });
export const markAllNotificationsRead = (area: Area) =>
  fetchApi<{ updated: true }>(`${base(area)}/read-all`, { method: 'POST' });

export interface ShieldDocEndpoint {
  method: 'GET';
  path: string;
  scope: string;
  description: string;
}

export interface ShieldDocError {
  status: number;
  message: string;
  action: string;
}

export interface ShieldDocSection {
  id: string;
  title: string;
  summary: string;
  paragraphs?: string[];
  list?: string[];
  code?: string;
  endpoints?: ShieldDocEndpoint[];
  errors?: ShieldDocError[];
}

export interface ShieldDocumentation {
  updatedAt: string;
  api: { released: boolean; basePath: string };
  sections: ShieldDocSection[];
}
export const getShieldDocumentation = () =>
  fetchApi<ShieldDocumentation>('/shield/documentation');
