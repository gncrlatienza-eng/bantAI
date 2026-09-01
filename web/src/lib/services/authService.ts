import { fetchApi } from '../api';

export interface UserProfile {
  id: string;
  phoneNumber?: string;
  email?: string;
  fullName?: string;
  role: string;
  createdAt: string;
}

export interface VerifyOtpResponse {
  access_token: string;
  user: UserProfile;
}

export async function register(data: {
  email: string;
  password?: string;
  fullName?: string;
}): Promise<UserProfile> {
  return fetchApi<UserProfile>('/auth/register', {
    method: 'POST',
    useApiKey: false,
    body: JSON.stringify(data),
  });
}

export async function requestOtp(phoneNumber: string): Promise<{
  message: string;
}> {
  return fetchApi<{ message: string }>('/auth/request-otp', {
    method: 'POST',
    useApiKey: false,
    body: JSON.stringify({ phoneNumber }),
  });
}

export async function verifyOtp(
  phoneNumber: string,
  code: string,
): Promise<VerifyOtpResponse> {
  const result = await fetchApi<VerifyOtpResponse>('/auth/verify-otp', {
    method: 'POST',
    useApiKey: false,
    body: JSON.stringify({ phoneNumber, code }),
  });

  if (result.access_token) {
    localStorage.setItem('bantai_token', result.access_token);
    localStorage.setItem('bantai_session', result.user.role || 'client');
  }

  return result;
}

export async function getMe(): Promise<UserProfile> {
  return fetchApi<UserProfile>('/auth/me', { useApiKey: false });
}

export async function updateMe(data: {
  fullName?: string;
  email?: string;
}): Promise<UserProfile> {
  return fetchApi<UserProfile>('/users/me', {
    method: 'PUT',
    useApiKey: false,
    body: JSON.stringify(data),
  });
}
