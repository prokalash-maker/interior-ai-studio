import { GoogleUser, AuthState } from '../types/auth';

class AuthService {
  private state: AuthState = {
    isAuthenticated: false,
    isGuest: false,
    user: null,
    accessToken: null,
    expiresAt: null,
  };
  private listeners: Array<(state: AuthState) => void> = [];
  private restorePromise: Promise<void>;

  constructor() {
    this.restorePromise = this.restoreSession();
  }

  async whenReady(): Promise<void> {
    await this.restorePromise;
  }

  private async restoreSession(): Promise<void> {
    try {
      if (window.electronAPI) {
        const google = await window.electronAPI.getGoogleSession();
        if (google.success && google.user) {
          this.state = { isAuthenticated: true, isGuest: false, user: google.user, accessToken: null, expiresAt: null };
          this.notify();
          return;
        }

        const local = await window.electronAPI.getSecureItem('local_user_profile');
        if (local) {
          const parsed = JSON.parse(local);
          if (parsed.user?.name) {
            this.state = { isAuthenticated: false, isGuest: true, user: parsed.user, accessToken: null, expiresAt: null };
            this.notify();
            return;
          }
        }
      }
      if (localStorage.getItem('interior_ai_guest_mode') === 'true') this.setGuestMode();
    } catch (error) {
      console.warn('Failed to restore account profile:', error);
    }
  }

  subscribe(listener: (state: AuthState) => void): () => void {
    this.listeners.push(listener);
    listener({ ...this.state });
    return () => { this.listeners = this.listeners.filter((item) => item !== listener); };
  }

  private notify(): void {
    this.listeners.forEach((listener) => listener({ ...this.state }));
  }

  getState(): AuthState {
    return { ...this.state };
  }

  async loginWithGoogle(credentials?: { clientId?: string; clientSecret?: string; saveAsDefault?: boolean }): Promise<{ success: boolean; notConfigured?: boolean; requiresConfig?: boolean; error?: string }> {
    await this.whenReady();
    if (!window.electronAPI) return { success: false, error: 'Вход Google доступен только в настольном приложении.' };
    try {
      const result = await window.electronAPI.startGoogleOAuth(credentials);
      if (!result.success || !result.user) {
        return {
          success: false,
          notConfigured: result.notConfigured,
          requiresConfig: result.requiresConfig,
          error: result.error || 'Вход Google не завершён.',
        };
      }
      this.state = { isAuthenticated: true, isGuest: false, user: result.user, accessToken: null, expiresAt: null };
      await window.electronAPI.deleteSecureItem('local_user_profile');
      localStorage.removeItem('interior_ai_guest_mode');
      this.notify();
      return { success: true };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Не удалось войти в Google.' };
    }
  }

  async setUserProfile(name: string, email: string): Promise<void> {
    await this.whenReady();
    const user: GoogleUser = {
      id: 'local_profile',
      name: name.trim() || 'Дизайнер',
      email: email.trim(),
    };
    if (window.electronAPI) await window.electronAPI.saveProfile({ user });
    this.state = { isAuthenticated: false, isGuest: true, user, accessToken: null, expiresAt: null };
    localStorage.setItem('interior_ai_guest_mode', 'true');
    this.notify();
  }

  setGuestMode(): void {
    this.state = {
      isAuthenticated: false,
      isGuest: true,
      user: { id: 'guest_user', name: 'Локальный дизайнер (Офлайн)', email: '' },
      accessToken: null,
      expiresAt: null,
    };
    localStorage.setItem('interior_ai_guest_mode', 'true');
    this.notify();
  }

  async logout(): Promise<void> {
    if (window.electronAPI) await window.electronAPI.logoutGoogle();
    localStorage.removeItem('interior_ai_guest_mode');
    this.state = { isAuthenticated: false, isGuest: false, user: null, accessToken: null, expiresAt: null };
    this.notify();
  }
}

export const authService = new AuthService();
