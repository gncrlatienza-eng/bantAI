import { fetchApi } from '../api/apiClient';

export interface ClassificationResult {
  id: string;
  messageId: string;
  label: string;
  score: number;
  scores?: Record<string, number> | null;
  bucket?: string | null;
  createdAt: string;
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

export async function getMessageIndicators(messageId: string): Promise<{
  indicators: Array<{ tag: string; weight: number }>;
}> {
  return fetchApi<{ indicators: Array<{ tag: string; weight: number }> }>(
    `/sms/${messageId}/indicators`,
  );
}
