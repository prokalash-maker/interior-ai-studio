import React, { useEffect, useState } from 'react';
import { Sparkles, ShieldCheck, HardDrive, CheckCircle, AlertCircle, Info, ChevronDown, ChevronUp, Loader2 } from 'lucide-react';
import { authService } from '../services/authService';
import { useI18n } from '../i18n/i18nContext';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({ isOpen, onClose }) => {
  const { t } = useI18n();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showDevSection, setShowDevSection] = useState(false);
  const [devClientId, setDevClientId] = useState('');
  const [devClientSecret, setDevClientSecret] = useState('');
  const [configStatus, setConfigStatus] = useState<{ isConfigured: boolean; source: string; maskedClientId: string; hasClientSecret: boolean } | null>(null);
  const [customName] = useState('Дизайнер');
  const [customEmail] = useState('');

  useEffect(() => {
    if (isOpen && window.electronAPI) {
      window.electronAPI.getOAuthConfigStatus?.().then((status) => {
        if (status) setConfigStatus(status);
      }).catch(() => {});

      window.electronAPI.getSecureItem('google_oauth_client_id').then((saved) => {
        if (saved) setDevClientId(saved);
      }).catch(() => {});

      window.electronAPI.getSecureItem('google_oauth_client_secret').then((saved) => {
        if (saved) setDevClientSecret(saved);
      }).catch(() => {});
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleStandardGoogleLogin = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await authService.loginWithGoogle();
      if (res.success) {
        onClose();
      } else {
        setError(res.error || t('settings.oauthFailed'));
      }
    } catch (e: any) {
      setError(e.message || t('settings.oauthFailed'));
    } finally {
      setLoading(false);
    }
  };

  const handleDevGoogleLogin = async () => {
    const trimmedId = devClientId.trim();
    if (trimmedId && !/^\d+-[a-z0-9-]+\.apps\.googleusercontent\.com$/i.test(trimmedId)) {
      setError(t('auth.oauthClientInvalid'));
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await authService.loginWithGoogle({
        clientId: trimmedId || undefined,
        clientSecret: devClientSecret.trim(),
        saveAsDefault: true,
      });
      if (res.success) {
        onClose();
      } else {
        setError(res.error || t('settings.oauthFailed'));
      }
    } catch (e: any) {
      setError(e.message || t('settings.oauthFailed'));
    } finally {
      setLoading(false);
    }
  };

  const handleQuickProfileLogin = async () => {
    await authService.setUserProfile(customName, customEmail);
    onClose();
  };

  const handleGuestContinue = () => {
    authService.setGuestMode();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4 select-none">
      <div className="max-w-md w-full bg-studio-surface border border-studio-border rounded-2xl p-7 shadow-2xl space-y-5 relative overflow-hidden max-h-[92vh] overflow-y-auto">
        {/* Glow decoration */}
        <div className="absolute -top-16 -right-16 w-36 h-36 rounded-full bg-indigo-500/15 blur-3xl pointer-events-none" />
        <div className="absolute -bottom-16 -left-16 w-36 h-36 rounded-full bg-studio-cyan/15 blur-3xl pointer-events-none" />

        {/* Branding & Logo */}
        <div className="text-center space-y-2">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-indigo-600 to-studio-cyan mx-auto flex items-center justify-center shadow-lg shadow-indigo-500/30">
            <Sparkles className="w-7 h-7 text-white" />
          </div>
          <h2 className="text-lg font-bold text-white tracking-wide uppercase">
            {t('auth.welcomeTitle')}
          </h2>
          <p className="text-xs text-studio-textMuted leading-relaxed max-w-xs mx-auto">
            {t('auth.welcomeDesc')}
          </p>
        </div>

        {/* Feature Highlights */}
        <div className="space-y-1.5 bg-studio-bg/60 border border-studio-border/60 rounded-xl p-3 text-xs text-studio-textMuted">
          <div className="flex items-center space-x-2">
            <CheckCircle className="w-3.5 h-3.5 text-studio-success flex-shrink-0" />
            <span>{t('auth.feature1')}</span>
          </div>
          <div className="flex items-center space-x-2">
            <CheckCircle className="w-3.5 h-3.5 text-indigo-400 flex-shrink-0" />
            <span>{t('auth.feature2')}</span>
          </div>
          <div className="flex items-center space-x-2">
            <CheckCircle className="w-3.5 h-3.5 text-studio-cyan flex-shrink-0" />
            <span>{t('auth.feature3')}</span>
          </div>
        </div>

        {error && (
          <div className="p-3 rounded-xl bg-studio-danger/10 border border-studio-danger/30 text-studio-danger text-xs space-y-1">
            <div className="flex items-start space-x-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <span className="leading-relaxed">{error}</span>
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="space-y-3 pt-1">
          {/* PRIMARY BUTTON: 1-Click Google OAuth */}
          <div className="space-y-1">
            <button
              onClick={handleStandardGoogleLogin}
              disabled={loading}
              className="w-full py-3 px-4 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-xl font-bold text-xs shadow-lg shadow-indigo-600/30 transition-all flex items-center justify-center space-x-2.5 active:scale-[0.99] border border-indigo-400/30"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>{t('settings.oauthWaiting')}</span>
                </>
              ) : (
                <>
                  <svg className="w-4 h-4 flex-shrink-0" viewBox="0 0 24 24">
                    <path
                      fill="#EA4335"
                      d="M12 5c1.6 0 3 .6 4.1 1.6l3.1-3.1C17.3 1.7 14.8 1 12 1 7.5 1 3.7 3.6 1.9 7.3l3.7 2.9C6.5 7.4 9 5 12 5z"
                    />
                    <path
                      fill="#4285F4"
                      d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.5h6.5c-.3 1.5-1.1 2.8-2.4 3.7l3.7 2.9c2.2-2 3.7-5 3.7-8.8z"
                    />
                    <path
                      fill="#FBBC05"
                      d="M5.6 14.8c-.2-.7-.4-1.5-.4-2.3s.2-1.6.4-2.3L1.9 7.3C.7 9.7 0 10.8 0 12s.7 2.3 1.9 4.7l3.7-1.9z"
                    />
                    <path
                      fill="#34A853"
                      d="M12 23c3.2 0 6-1.1 8-3l-3.7-2.9c-1.1.7-2.5 1.2-4.3 1.2-3 0-5.5-2.4-6.4-5.2L1.9 16c1.8 3.7 5.6 7 10.1 7z"
                    />
                  </svg>
                  <span>{t('auth.googleLoginBtn')}</span>
                </>
              )}
            </button>
            <p className="text-[10px] text-center text-studio-textSubtle">
              {t('auth.googleLoginDesc')}
            </p>
          </div>

          {/* SECONDARY: Local profile */}
          <div className="space-y-1">
            <button
              onClick={handleQuickProfileLogin}
              disabled={loading}
              className="w-full py-2.5 px-4 bg-studio-surfaceHover hover:bg-studio-border text-white rounded-xl font-medium text-xs transition-colors flex items-center justify-center space-x-2 border border-studio-border"
            >
              <HardDrive className="w-3.5 h-3.5 text-studio-textMuted" />
              <span>{t('auth.localProfileButton')}</span>
            </button>
            <p className="text-[10px] text-center text-studio-textSubtle">
              {t('auth.localProfileDesc')}
            </p>
          </div>

          {/* TERTIARY: Offline Mode */}
          <button
            onClick={handleGuestContinue}
            disabled={loading}
            className="w-full py-2 px-3 text-studio-textSubtle hover:text-white rounded-lg text-xs transition-colors flex items-center justify-center space-x-1.5"
          >
            <span>{t('auth.continueOffline')}</span>
          </button>

          {/* ADVANCED DEVELOPER SECTION (COLLAPSIBLE) */}
          <div className="pt-2 border-t border-studio-border/50">
            <button
              type="button"
              onClick={() => setShowDevSection(!showDevSection)}
              className="w-full py-1 text-[11px] text-studio-textSubtle hover:text-indigo-300 transition-colors flex items-center justify-center space-x-1"
            >
              <span>{t('auth.devOAuthSettings')}</span>
              {showDevSection ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            </button>

            {showDevSection && (
              <div className="mt-2 p-3 bg-studio-bg rounded-xl border border-studio-border space-y-2 text-xs">
                <div className="flex items-start space-x-1.5 text-[11px] text-studio-textMuted">
                  <Info className="w-3.5 h-3.5 text-indigo-400 flex-shrink-0 mt-0.5" />
                  <span>{t('auth.devOAuthDesc')}</span>
                </div>
                {configStatus && (
                  <p className="text-[10px] text-studio-textSubtle">
                    Статус: {configStatus.isConfigured ? `Настроен (${configStatus.source})` : 'Не настроен'}
                    {configStatus.maskedClientId ? ` • ${configStatus.maskedClientId}` : ''}
                  </p>
                )}
                <div>
                  <label className="text-[10px] text-studio-textMuted block mb-0.5">OAuth Client ID (Desktop):</label>
                  <input
                    type="text"
                    value={devClientId}
                    onChange={(e) => setDevClientId(e.target.value)}
                    placeholder="123456789-xxx.apps.googleusercontent.com"
                    className="w-full bg-studio-surface border border-studio-border focus:border-indigo-500 rounded p-1.5 font-mono text-[11px] text-white focus:outline-none"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-studio-textMuted block mb-0.5">{t('settings.oauthClientSecretLabel')}</label>
                  <input
                    type="password"
                    autoComplete="off"
                    value={devClientSecret}
                    onChange={(e) => setDevClientSecret(e.target.value)}
                    placeholder={t('settings.oauthClientSecretPlaceholder')}
                    className="w-full bg-studio-surface border border-studio-border focus:border-indigo-500 rounded p-1.5 font-mono text-[11px] text-white focus:outline-none"
                  />
                </div>
                <div className="flex items-center justify-between pt-1">
                  <button
                    type="button"
                    onClick={() => window.electronAPI?.openExternal('https://console.cloud.google.com/apis/credentials')}
                    className="text-[11px] text-indigo-300 hover:underline"
                  >
                    {t('settings.openGoogleCredentials')}
                  </button>
                  <button
                    type="button"
                    onClick={handleDevGoogleLogin}
                    disabled={loading}
                    className="py-1 px-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded text-[11px] font-medium transition-colors"
                  >
                    {loading ? t('settings.oauthWaiting') : t('auth.saveAndLoginDev')}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Security badge */}
        <div className="pt-2 border-t border-studio-border/50 flex items-center justify-center space-x-1.5 text-[10px] text-studio-textSubtle">
          <ShieldCheck className="w-3.5 h-3.5 text-studio-success" />
          <span>{t('auth.securityNotice')}</span>
        </div>
      </div>
    </div>
  );
};
