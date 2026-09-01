import { fetchApi } from '../api';

export interface BlockedNumber {
  id: string;
  sender: string;
  blockedAt: string;
}

export async function getBlockedNumbers(): Promise<BlockedNumber[]> {
  return fetchApi<BlockedNumber[]>('/blocked-numbers', { useApiKey: false });
}

export async function blockNumber(sender: string): Promise<BlockedNumber> {
  return fetchApi<BlockedNumber>('/blocked-numbers', {
    method: 'POST',
    useApiKey: false,
    body: JSON.stringify({ sender }),
  });
}

export async function unblockNumber(
  sender: string,
): Promise<{ success: boolean }> {
  return fetchApi<{ success: boolean }>(
    `/blocked-numbers/${encodeURIComponent(sender)}`,
    {
      method: 'DELETE',
      useApiKey: false,
    },
  );
}
