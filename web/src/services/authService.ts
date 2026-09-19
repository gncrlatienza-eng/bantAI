import { fetchApi, setStoredToken, clearStoredToken } from '../api/apiClient';

export interface RequestOtpResponse {
  message: string;
  devCode?: string;
}

export interface VerifyOtpResponse {
  message: string;
  access_token: string;
}

export interface CurrentUser {
  id: string;
  phone: string;
  email?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  role: 'ADMIN' | 'USER';
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
    body: JSON.stringify({ phone, otp: code }),
  });
  if (result.access_token) {
    setStoredToken(result.access_token);
  }
  return result;
}

export async function getCurrentUser(): Promise<CurrentUser> {
  return fetchApi<CurrentUser>('/auth/me');
}

export function logout() {
  clearStoredToken();
}
