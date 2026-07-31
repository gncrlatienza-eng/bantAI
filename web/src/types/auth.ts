export interface UserProfile {
  id: string;
  name: string;
  email: string;
  role: 'client' | 'admin';
  organization: string;
  title: string;
  initials: string;
  createdAt: string;
  lastLogin: string;
  twoFactorEnabled: boolean;
}

export interface AuthState {
  isAuthenticated: boolean;
  user: UserProfile | null;
  requiresTwoFactor: boolean;
}
