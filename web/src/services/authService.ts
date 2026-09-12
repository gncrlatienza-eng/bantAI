import { fetchApi, setStoredToken, clearStoredToken } from '../api/apiClient';

export interface RequestOtpResponse {
  message: string;
  devCode?: string;
}

export interface VerifyOtpResponse {
  accessToken: string;
  user: {
    id: string;
    phone: string;
    email?: string | null;
    firstName?: string | null;
    lastName?: string | null;
  };
}

export async function requestOtp(phone: string): Promise<RequestOtpResponse> {
  return fetchApi<RequestOtpResponse>('/auth/request-otp', {
    method: 'POST',
    body: JSON.stringify({ phone }),
  });
}

export async function verifyOtp(
  phone: string,
  code: string,
): Promise<VerifyOtpResponse> {
  const result = await fetchApi<VerifyOtpResponse>('/auth/verify-otp', {
    method: 'POST',
    body: JSON.stringify({ phone, code }),
  });
  if (result.accessToken) {
    setStoredToken(result.accessToken);
  }
  return result;
}

export async function getCurrentUser() {
  return fetchApi<{
    id: string;
    phone: string;
    email?: string | null;
    firstName?: string | null;
    lastName?: string | null;
  }>('/auth/me');
}

export function logout() {
  clearStoredToken();
}
