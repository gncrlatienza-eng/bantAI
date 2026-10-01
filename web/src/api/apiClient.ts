const env = import.meta.env as Record<string, string | undefined> | undefined;

const BASE_URL: string =
  (env && env.VITE_API_URL) || 'http://localhost:3000/api';

/*
 * Portal sessions are only the HttpOnly `bantai_*_session` cookie. Earlier
 * builds also kept a bearer JWT in localStorage; nothing issues one to the web
 * any more, so a leftover value is scrubbed and never sent.
 */
const LEGACY_TOKEN_KEY = 'bantai_token';

export function clearLegacyStoredToken() {
  try {
    localStorage.removeItem(LEGACY_TOKEN_KEY);
  } catch {
    // Storage can be unavailable (private mode, blocked site data).
  }
}

/*
 * Safe problem details from a failed response: the server's message and
 * machine-readable code, never a raw body.
 */
async function readApiError(response: Response): Promise<ApiError> {
  let errorMessage = `HTTP ${response.status}: ${response.statusText}`;
  let errorCode: string | undefined;
  try {
    const errorData = (await response.json()) as {
      message?: string | string[];
      code?: string;
    };
    if (errorData && errorData.message) {
      errorMessage = Array.isArray(errorData.message)
        ? errorData.message.join(', ')
        : String(errorData.message);
    }
    if (typeof errorData?.code === 'string') errorCode = errorData.code;
  } catch {
    // Not JSON (a proxy page, an empty body): keep the status line.
  }
  // Licensed data refused because access ended or changed mid-session:
  // let the account-state layer re-resolve and move the user on.
  if (
    response.status === 403 &&
    (errorCode === 'LICENSE_INACTIVE' ||
      errorCode === 'WORKSPACE_ACCESS_DENIED') &&
    typeof window !== 'undefined'
  ) {
    window.dispatchEvent(new Event('bantai:access-changed'));
  }
  return new ApiError(errorMessage, response.status, errorCode);
}

export async function fetchApiBlob(
  endpoint: string,
  options: RequestOptions = {},
): Promise<Blob> {
  const { params, headers: customHeaders, ...restOptions } = options;
  let url = `${BASE_URL}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;
  if (params) {
    const searchParams = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null)
        searchParams.append(key, String(value));
    });
    const query = searchParams.toString();
    if (query) url += `?${query}`;
  }
  const headers: Record<string, string> = {
    ...(customHeaders as Record<string, string>),
  };
  const response = await fetch(url, {
    ...restOptions,
    headers,
    credentials: 'include',
  });
  // Same problem details as JSON calls, so an expired license or a refused
  // download explains itself instead of reading "HTTP 403: Forbidden".
  if (!response.ok) throw await readApiError(response);
  return response.blob();
}

/*
 * Thrown for non-2xx responses. Still an Error (message = server message) so
 * existing callers are unaffected; lifecycle code also reads the HTTP status
 * and the backend's machine-readable code (e.g. LICENSE_INACTIVE).
 */
export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code?: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export interface RequestOptions extends RequestInit {
  params?: Record<string, string | number | undefined>;
}

export async function fetchApi<T>(
  endpoint: string,
  options: RequestOptions = {},
): Promise<T> {
  const { params, headers: customHeaders, ...restOptions } = options;

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

  // Portal sessions live in an HttpOnly `bantai_*_session` cookie set by the
  // backend on successful sign-in. Browsers only send that cookie back when
  // the fetch is made with credentials: 'include' AND the response's
  // Access-Control-Allow-Credentials header is true (both are configured).
  const response = await fetch(url, {
    ...restOptions,
    headers,
    credentials: 'include',
  });

  if (!response.ok) {
    if (response.status === 401) clearLegacyStoredToken();
    throw await readApiError(response);
  }

  if (response.status === 204) {
    return {} as T;
  }

  const data = (await response.json()) as T;
  return data;
}
