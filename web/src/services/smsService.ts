import { fetchApi } from '../api/apiClient';

export type CloudVerificationStatus =
  'pending' | 'processing' | 'verified' | 'retryable_failure' | 'failed';

/** A device classification is not evidence of a completed cloud check. */
export function cloudVerificationLabel(
  status?: CloudVerificationStatus | null,
): string {
  switch (status) {
    case 'pending':
      return 'Cloud check queued';
    case 'processing':
      return 'Cloud check in progress';
    case 'verified':
      return 'Cloud check complete';
    case 'retryable_failure':
      return 'Cloud check waiting to retry';
    case 'failed':
      return 'Cloud check unavailable';
    default:
      return 'Cloud check not recorded';
  }
}

export interface ClassificationResult {
  id: string;
  messageId: string;
  label: string;
  score: number;
  scores?: Record<string, number> | null;
  bucket?: string | null;
  createdAt: string;
}

/**
 * Classification metadata exposed to administrators. Raw SMS content and
 * sender identities intentionally remain out of the portal contract.
 */
export interface AdminClassificationItem {
  verificationStatus?: CloudVerificationStatus | null;
  id: string;
  messageId: string;
  receivedAt: string;
  label: string;
  score: number;
  bucket: string | null;
  createdAt: string;
  alertStatus: string | null;
}

export interface AdminMobileSyncSummary {
  totalMessages: number;
  syncedAccounts: number;
  classifiedMessages: number;
  scamCount: number;
  spamCount: number;
  hamCount: number;
  latestSyncAt: string | null;
  recent: AdminClassificationItem[];
}

export type ClassificationHistoryFilter =
  'threats' | 'all' | 'Scam' | 'Spam' | 'Ham';

export interface AdminClassificationHistory {
  items: AdminClassificationItem[];
  nextCursor: string | null;
}

export interface SmsAlertItem {
  id: string;
  status: string;
  createdAt: string;
  message: {
    id: string;
    sourceId: string;
    receivedAt: string;
    clusterId?: string | null;
    classification?: Pick<
      ClassificationResult,
      'label' | 'score' | 'bucket'
    > | null;
  };
}

export async function getSmsAlerts(): Promise<SmsAlertItem[]> {
  return fetchApi<SmsAlertItem[]>('/sms/alerts');
}

export async function getAdminClassifications(): Promise<
  AdminClassificationItem[]
> {
  return fetchApi<AdminClassificationItem[]>('/admin/classifications');
}

export async function getAdminMobileSync(): Promise<AdminMobileSyncSummary> {
  return fetchApi<AdminMobileSyncSummary>('/admin/classifications/mobile-sync');
}

export async function getAdminClassificationHistory(
  options: {
    label?: ClassificationHistoryFilter;
    cursor?: string;
    limit?: number;
  } = {},
): Promise<AdminClassificationHistory> {
  const params = new URLSearchParams();
  params.set('label', options.label ?? 'threats');
  if (options.cursor) params.set('cursor', options.cursor);
  if (options.limit) params.set('limit', String(options.limit));
  return fetchApi<AdminClassificationHistory>(
    `/admin/classifications/history?${params.toString()}`,
  );
}

export async function getMessageIndicators(messageId: string): Promise<{
  indicators: Array<{ tag: string; weight: number }>;
}> {
  return fetchApi<{ indicators: Array<{ tag: string; weight: number }> }>(
    `/sms/${messageId}/indicators`,
  );
}
