import { fetchApi } from '../api/apiClient';

/*
 * Community "report this number" submissions from the mobile Take Action
 * sheet (POST /verification/sender/report). The backend stores only an HMAC
 * pseudonym of the sender, so staff review corroboration (how many distinct
 * users reported the same pseudonym in the same window), never the number.
 */
export interface PendingSenderReport {
  id: string;
  /** HMAC fingerprint, not a phone number. */
  sender: string;
  reportWindow: string;
  createdAt: string;
}

export interface ConfirmFraudResult {
  reportId: string;
  status: 'fraud';
  reportCount: number;
}

/** Backend MINIMUM_CORROBORATING_REPORTS (verification.service.ts). */
export const MINIMUM_CORROBORATING_REPORTS = 2;

export function getPendingSenderReports(): Promise<PendingSenderReport[]> {
  return fetchApi<PendingSenderReport[]>(
    '/verification/sender/pending-reports',
  );
}

export function confirmSenderFraud(
  reportId: string,
  reason: string,
): Promise<ConfirmFraudResult> {
  return fetchApi<ConfirmFraudResult>('/verification/sender/confirm-fraud', {
    method: 'POST',
    body: JSON.stringify({ reportId, reason }),
  });
}
