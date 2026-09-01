import { fetchApi } from '../api';

export interface SummarizeResponse {
  summary: string;
  bulletPoints?: string[];
}

export async function summarizeMessages(
  messages: string[],
  maxSentences = 3,
): Promise<SummarizeResponse> {
  return fetchApi<SummarizeResponse>('/ai/summarize', {
    method: 'POST',
    useApiKey: false,
    body: JSON.stringify({ messages, maxSentences }),
  });
}
