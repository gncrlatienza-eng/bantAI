import { fetchApi } from '../api/apiClient';
import type { CurrentUser } from './authService';

// Display names only — the backend rejects login-email changes here.
export interface UpdateMyProfileInput {
  firstName?: string;
  lastName?: string;
}

export async function updateMyProfile(
  input: UpdateMyProfileInput,
): Promise<CurrentUser> {
  return fetchApi<CurrentUser>('/users/me', {
    method: 'PUT',
    body: JSON.stringify(input),
  });
}
