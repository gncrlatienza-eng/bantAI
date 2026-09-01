/**
 * Central API client for interacting with the NestJS backend.
 * Strict Scope: Web Folder Only.
 */

const DEFAULT_API_KEY = 'bnt_live_99481a82f3c091d7e2';

export interface ApiOptions extends RequestInit {
  useApiKey?: boolean;
}

interface ApiErrorResponse {
  message?: string | string[];
}

export async function fetchApi<T>(
  endpoint: string,
  options: ApiOptions = {},
): Promise<T> {
  const { useApiKey = true, headers: customHeaders, ...restOptions } = options;

  const baseUrl: string = (import.meta.env.VITE_API_URL as string) || 'http://localhost:3000/api';
  const url = endpoint.startsWith('http')
    ? endpoint
    : `${baseUrl}${endpoint.startsWith('/') ? '' : '/'}${endpoint}`;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(customHeaders as Record<string, string>),
  };

  const token =
    localStorage.getItem('bantai_token') ||
    sessionStorage.getItem('bantai_token');
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  if (useApiKey) {
    const apiKey =
      localStorage.getItem('bantai_api_key') || DEFAULT_API_KEY;
    headers['X-API-Key'] = apiKey;
  }

  const response = await fetch(url, {
    ...restOptions,
    headers,
  });

  if (!response.ok) {
    let errorMessage = `HTTP ${response.status}: ${response.statusText}`;
    try {
      const errorData = (await response.json()) as ApiErrorResponse;
      if (errorData.message) {
        errorMessage = Array.isArray(errorData.message)
          ? errorData.message.join(', ')
          : errorData.message;
      }
    } catch {
      // Ignore JSON parse errors
    }
    throw new Error(errorMessage);
  }

  const text = await response.text();
  if (!text) {
    return {} as T;
  }

  return JSON.parse(text) as T;
}
