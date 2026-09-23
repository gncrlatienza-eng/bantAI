import { fetchApi } from '../api/apiClient';
import type { CurrentUser } from './authService';

export interface UpdateMyProfileInput {
  email?: string;
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
