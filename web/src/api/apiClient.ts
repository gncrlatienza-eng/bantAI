const BASE_URL =
  (import.meta.env && import.meta.env.VITE_API_URL) ||
  'http://localhost:3000/api';

const DEFAULT_API_KEY =
  (import.meta.env && import.meta.env.VITE_INTERNAL_API_KEY) ||
  'change-me-shared-secret-for-ai-service-calls';

export function getStoredToken(): string | null {
  return localStorage.getItem('bantai_token');
}

export function setStoredToken(token: string) {
  localStorage.setItem('bantai_token', token);
}

export function clearStoredToken() {
  localStorage.removeItem('bantai_token');
}

export function getStoredApiKey(): string {
  return localStorage.getItem('bantai_api_key') || DEFAULT_API_KEY;
}

export function setStoredApiKey(apiKey: string) {
  localStorage.setItem('bantai_api_key', apiKey);
}

export interface RequestOptions extends RequestInit {
  useApiKey?: boolean;
  params?: Record<string, string | number | undefined>;
}

export async function fetchApi<T>(
  endpoint: string,
  options: RequestOptions = {},
): Promise<T> {
  const { useApiKey, params, headers: customHeaders, ...restOptions } = options;

  let url = `${BASE_URL}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;

  if (params) {
    const searchParams = new URLSearchParams();
    Object.entries(params).forEach(([key, val]) => {
      if (val !== undefined && val !== null) {
        searchParams.append(key, String(val));
      }
    });
    const queryString = searchParams.toString();
    if (queryString) {
      url += `?${queryString}`;
    }
  }

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(customHeaders as Record<string, string>),
  };

  const token = getStoredToken();
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  if (useApiKey || !token) {
    headers['x-api-key'] = getStoredApiKey();
  }

  const response = await fetch(url, {
    ...restOptions,
    headers,
  });

  if (!response.ok) {
    let errorMessage = `HTTP ${response.status}: ${response.statusText}`;
    try {
      const errorData = await response.json();
      if (errorData && errorData.message) {
        errorMessage = Array.isArray(errorData.message)
          ? errorData.message.join(', ')
          : errorData.message;
      }
    } catch {
      // Ignore JSON parse errors for error responses
    }
    throw new Error(errorMessage);
  }

  if (response.status === 204) {
    return {} as T;
  }

  return response.json();
}
