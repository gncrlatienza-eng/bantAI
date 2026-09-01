import { fetchApi } from '../api';

export interface IngestSmsDto {
  sender: string;
  body: string;
  receivedAt: string;
}

export interface IngestResult {
  action: 'BLOCKED' | 'ALERT' | 'INBOX' | string;
  label: string;
  score: number;
  suppressed?: boolean;
  messageId?: string;
  senderStatus?: string;
  suppressedLinks?: string[];
}

export interface AlertSummary {
  id: string;
  status: string;
  createdAt: string;
  messageId: string;
  sender: string;
  body: string;
  receivedAt: string;
  label?: string;
  score?: number;
  bucket?: string;
}

export interface IndicatorTag {
  tag: string;
  weight: number;
}

export async function ingestSms(dto: IngestSmsDto): Promise<IngestResult> {
  return fetchApi<IngestResult>('/sms/ingest', {
    method: 'POST',
    useApiKey: false,
    body: JSON.stringify(dto),
  });
}

export async function getAlerts(): Promise<AlertSummary[]> {
  return fetchApi<AlertSummary[]>('/sms/alerts', { useApiKey: false });
}

export async function getIndicators(
  messageId: string,
): Promise<{ indicators: IndicatorTag[] }> {
  return fetchApi<{ indicators: IndicatorTag[] }>(
    `/sms/${encodeURIComponent(messageId)}/indicators`,
    { useApiKey: false },
  );
}
