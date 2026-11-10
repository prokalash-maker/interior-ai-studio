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

  constructor() {
    this.restoreSession();
  }

  private async restoreSession() {
    try {
      if (window.electronAPI) {
        const savedAuth = await window.electronAPI.getSecureItem('google_user_session');
        if (savedAuth) {
          const parsed = JSON.parse(savedAuth);
          this.state = {
            isAuthenticated: true,
            isGuest: false,
            user: parsed.user,
            accessToken: parsed.accessToken,
            expiresAt: parsed.expiresAt,
          };
          this.notify();
          return;
        }
      }

      const localGuest = localStorage.getItem('interior_ai_guest_mode');
      if (localGuest === 'true') {
        this.setGuestMode();
      }
    } catch (e) {
      console.warn('Failed to restore auth session:', e);
    }
  }

  subscribe(listener: (state: AuthState) => void): () => void {
    this.listeners.push(listener);
    listener(this.state);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }

  private notify() {
    this.listeners.forEach((l) => l({ ...this.state }));
  }

  getState(): AuthState {
    return { ...this.state };
  }

  async loginWithGoogle(clientId?: string): Promise<{ success: boolean; requiresConfig?: boolean; error?: string }> {
    if (window.electronAPI) {
      try {
        const result = await window.electronAPI.startGoogleOAuth(clientId);
        if (result.success && result.user) {
          this.state = {
            isAuthenticated: true,
            isGuest: false,
            user: result.user,
            accessToken: result.accessToken || null,
            expiresAt: Date.now() + 3600 * 1000,
          };
          await window.electronAPI.saveProfile({
            user: result.user,
            accessToken: result.accessToken,
            expiresAt: this.state.expiresAt,
          });
          localStorage.removeItem('interior_ai_guest_mode');
          this.notify();
          return { success: true };
        } else {
          return {
            success: false,
            requiresConfig: result.requiresConfig,
            error: result.error || 'Авторизация отменена',
          };
        }
      } catch (err: any) {
        return { success: false, error: err.message };
      }
    }

    // Web simulation fallback
    const simulatedUser: GoogleUser = {
      id: 'google_web_user',
      name: 'ProKalash',
      email: 'ProKalash@gmail.com',
      picture: '',
    };
    this.state = {
      isAuthenticated: true,
      isGuest: false,
      user: simulatedUser,
      accessToken: 'demo_token',
      expiresAt: Date.now() + 3600 * 1000,
    };
    this.notify();
    return { success: true };
  }

  async setUserProfile(name: string, email: string) {
    const user: GoogleUser = {
      id: 'user_' + Date.now(),
      name: name || 'Дизайнер Интерьеров',
      email: email || 'designer@studio',
    };
    this.state = {
      isAuthenticated: true,
      isGuest: false,
      user,
      accessToken: 'local_token',
      expiresAt: Date.now() + 86400 * 1000 * 30, // 30 days
    };
    if (window.electronAPI) {
      await window.electronAPI.saveProfile({
        user,
        accessToken: 'local_token',
        expiresAt: this.state.expiresAt,
      });
    }
    localStorage.removeItem('interior_ai_guest_mode');
    this.notify();
  }

  setGuestMode() {
    this.state = {
      isAuthenticated: false,
      isGuest: true,
      user: {
        id: 'guest_user',
        name: 'Локальный дизайнер (Офлайн)',
        email: 'local@device',
      },
      accessToken: null,
      expiresAt: null,
    };
    localStorage.setItem('interior_ai_guest_mode', 'true');
    this.notify();
  }

  async logout(): Promise<void> {
    if (window.electronAPI) {
      await window.electronAPI.deleteSecureItem('google_user_session');
      await window.electronAPI.logoutGoogle();
    }
    localStorage.removeItem('interior_ai_guest_mode');
    this.state = {
      isAuthenticated: false,
      isGuest: false,
      user: null,
      accessToken: null,
      expiresAt: null,
    };
    this.notify();
  }
}

export const authService = new AuthService();
