export interface GoogleUser {
  id: string;
  email: string;
  name: string;
  givenName?: string;
  familyName?: string;
  picture?: string;
  locale?: string;
}

export interface AuthState {
  isAuthenticated: boolean;
  isGuest: boolean;
  user: GoogleUser | null;
  accessToken: string | null;
  expiresAt: number | null;
  error?: string | null;
}
