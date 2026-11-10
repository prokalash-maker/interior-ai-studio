import React, { useEffect, useState } from 'react';
import { Sparkles, ShieldCheck, HardDrive, CheckCircle, AlertCircle, Info } from 'lucide-react';
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
  const [showConfig, setShowConfig] = useState(false);
  const [clientIdInput, setClientIdInput] = useState('');
  const [customName] = useState('ProKalash');
  const [customEmail] = useState('');

  useEffect(() => {
    if (isOpen) window.electronAPI?.getSecureItem('google_oauth_client_id').then((saved) => {
      if (saved) setClientIdInput(saved);
    });
  }, [isOpen]);

  if (!isOpen) return null;

  const handleQuickProfileLogin = async () => {
    await authService.setUserProfile(customName, customEmail);
    onClose();
  };

  const handleGoogleOAuthLogin = async () => {
    const trimmedId = clientIdInput.trim();
    if (trimmedId && !/^\d+-[a-z0-9-]+\.apps\.googleusercontent\.com$/i.test(trimmedId)) {
      setError(t('auth.oauthClientInvalid'));
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await authService.loginWithGoogle(trimmedId || undefined);
      if (res.success) {
        onClose();
      } else if (res.requiresConfig) {
        setShowConfig(true);
        setError(res.error || t('auth.oauthClientInvalid'));
      } else {
        setError(res.error || t('settings.oauthFailed'));
      }
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleGuestContinue = () => {
    authService.setGuestMode();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4 select-none">
      <div className="max-w-md w-full bg-studio-surface border border-studio-border rounded-2xl p-7 shadow-2xl space-y-5 relative overflow-hidden">
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
            <span>{t('auth.feature3')}</span>
          </div>
          <div className="flex items-center space-x-2">
            <CheckCircle className="w-3.5 h-3.5 text-indigo-400 flex-shrink-0" />
            <span>{t('auth.feature2')}</span>
          </div>
          <div className="flex items-center space-x-2">
            <CheckCircle className="w-3.5 h-3.5 text-studio-cyan flex-shrink-0" />
            <span>{t('auth.feature1')}</span>
          </div>
        </div>

        {error && (
          <div className="p-3 rounded-xl bg-studio-danger/10 border border-studio-danger/30 text-studio-danger text-xs space-y-2">
            <div className="flex items-start space-x-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <span className="leading-relaxed">{error}</span>
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="space-y-3 pt-1">
          {/* Local profile */}
          <div className="space-y-1">
            <button
              onClick={handleQuickProfileLogin}
              className="w-full py-3 px-4 bg-white hover:bg-slate-100 text-slate-900 rounded-xl font-bold text-xs shadow-lg transition-all flex items-center justify-center space-x-2.5 active:scale-[0.99] border border-white/90"
            >
              <HardDrive className="w-4 h-4" />
              <span>{t('auth.localProfileButton')}</span>
            </button>
            <p className="text-[10px] text-center text-studio-textSubtle">
              {t('auth.localProfileDesc')}
            </p>
          </div>

          {/* Browser OAuth Toggle */}
          {showConfig ? (
            <div className="p-3 bg-studio-bg rounded-xl border border-studio-border space-y-2 text-xs">
              <div className="flex items-start space-x-1.5 text-[11px] text-studio-textMuted">
                <Info className="w-3.5 h-3.5 text-indigo-400 flex-shrink-0 mt-0.5" />
                <span>
                  {t('settings.oauthDesktopDesc')}
                </span>
              </div>
              <input
                type="text"
                value={clientIdInput}
                onChange={(e) => setClientIdInput(e.target.value)}
                placeholder="123456789-xxx.apps.googleusercontent.com"
                className="w-full bg-studio-surface border border-studio-border focus:border-indigo-500 rounded p-2 font-mono text-[11px] text-white focus:outline-none"
              />
              <button type="button" onClick={() => window.electronAPI?.openExternal('https://console.cloud.google.com/apis/credentials')} className="text-[11px] text-indigo-300 hover:underline">
                {t('settings.openGoogleCredentials')}
              </button>
              <button
                onClick={handleGoogleOAuthLogin}
                disabled={loading}
                className="w-full py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded font-medium text-xs shadow-sm transition-colors"
              >
                {loading ? t('settings.oauthWaiting') : t('auth.openGoogleBrowser')}
              </button>
            </div>
          ) : (
            <button
              onClick={() => setShowConfig(true)}
              className="w-full py-1.5 px-3 text-[11px] text-studio-textSubtle hover:text-indigo-300 transition-colors text-center"
            >
              {t('auth.setupCustomOAuth')}
            </button>
          )}

          {/* Local Offline Mode Button */}
          <button
            onClick={handleGuestContinue}
            className="w-full py-2 px-4 bg-studio-surfaceHover hover:bg-studio-border border border-studio-border text-studio-textMuted hover:text-white rounded-xl font-medium text-xs transition-colors flex items-center justify-center space-x-2"
          >
            <HardDrive className="w-3.5 h-3.5 text-studio-textSubtle" />
            <span>{t('auth.continueOffline')}</span>
          </button>
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
