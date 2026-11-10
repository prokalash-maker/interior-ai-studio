import React, { useState } from 'react';
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
  const [customEmail] = useState('ProKalash@gmail.com');

  if (!isOpen) return null;

  const handleQuickProfileLogin = async () => {
    await authService.setUserProfile(customName, customEmail);
    onClose();
  };

  const handleGoogleOAuthLogin = async () => {
    const trimmedId = clientIdInput.trim();
    if (!trimmedId || !trimmedId.includes('.apps.googleusercontent.com') || trimmedId.includes('demo')) {
      setError(
        'Для авторизации через внешний браузер Google требуется настоящий OAuth Desktop Client ID, созданный в Google Cloud Console (console.cloud.google.com). Для быстрого входа без настройки используйте зелёную кнопку "Войти в 1 клик" выше.'
      );
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await authService.loginWithGoogle(trimmedId);
      if (res.success) {
        onClose();
      } else if (res.requiresConfig) {
        setShowConfig(true);
        setError(res.error || 'Требуется валидный Google Cloud Client ID');
      } else {
        setError(res.error || 'Ошибка входа через Google OAuth');
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
            <span>Локальное хранение проектов и рендеров в SQLite</span>
          </div>
          <div className="flex items-center space-x-2">
            <CheckCircle className="w-3.5 h-3.5 text-indigo-400 flex-shrink-0" />
            <span>Поддержка бесплатных облачных и локальных GPU (RTX 4050)</span>
          </div>
          <div className="flex items-center space-x-2">
            <CheckCircle className="w-3.5 h-3.5 text-studio-cyan flex-shrink-0" />
            <span>Точный контроль расходов и геометрии Archicad</span>
          </div>
        </div>

        {error && (
          <div className="p-3 rounded-xl bg-studio-danger/10 border border-studio-danger/30 text-studio-danger text-xs space-y-2">
            <div className="flex items-start space-x-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <span className="leading-relaxed">{error}</span>
            </div>
            <button
              onClick={handleQuickProfileLogin}
              className="w-full py-1.5 bg-studio-danger/20 hover:bg-studio-danger/30 text-white rounded-lg font-medium text-[11px] transition-colors"
            >
              Войти в 1 клик с профилем {customEmail}
            </button>
          </div>
        )}

        {/* Action Buttons */}
        <div className="space-y-3 pt-1">
          {/* Quick 1-Click Profile Login (ProKalash@gmail.com) */}
          <div className="space-y-1">
            <button
              onClick={handleQuickProfileLogin}
              className="w-full py-3 px-4 bg-white hover:bg-slate-100 text-slate-900 rounded-xl font-bold text-xs shadow-lg transition-all flex items-center justify-center space-x-2.5 active:scale-[0.99] border border-white/90"
            >
              {/* Google SVG Icon */}
              <svg className="w-4 h-4" viewBox="0 0 24 24">
                <path
                  fill="#4285F4"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="#34A853"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                />
                <path
                  fill="#EA4335"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                />
              </svg>
              <span>Войти как {customName} ({customEmail})</span>
              <span className="text-[10px] bg-emerald-500/20 text-emerald-800 px-1.5 py-0.5 rounded font-mono font-bold">1-Клик</span>
            </button>
            <p className="text-[10px] text-center text-studio-textSubtle">
              Мгновенный вход в рабочую студию без необходимости настройки Google Cloud Console
            </p>
          </div>

          {/* Browser OAuth Toggle */}
          {showConfig ? (
            <div className="p-3 bg-studio-bg rounded-xl border border-studio-border space-y-2 text-xs">
              <div className="flex items-start space-x-1.5 text-[11px] text-studio-textMuted">
                <Info className="w-3.5 h-3.5 text-indigo-400 flex-shrink-0 mt-0.5" />
                <span>
                  Для входа через браузер требуется Client ID (Desktop App) из консоли Google Cloud.
                </span>
              </div>
              <input
                type="text"
                value={clientIdInput}
                onChange={(e) => setClientIdInput(e.target.value)}
                placeholder="123456789-xxx.apps.googleusercontent.com"
                className="w-full bg-studio-surface border border-studio-border focus:border-indigo-500 rounded p-2 font-mono text-[11px] text-white focus:outline-none"
              />
              <button
                onClick={handleGoogleOAuthLogin}
                disabled={loading}
                className="w-full py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded font-medium text-xs shadow-sm transition-colors"
              >
                {loading ? t('action.testing') : 'Открыть Google OAuth в браузере'}
              </button>
            </div>
          ) : (
            <button
              onClick={() => setShowConfig(true)}
              className="w-full py-1.5 px-3 text-[11px] text-studio-textSubtle hover:text-indigo-300 transition-colors text-center"
            >
              Настроить собственный Google Cloud OAuth Client ID (опционально)
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
          <span>Локальная сессия • Все ключи и проекты шифруются на вашем ПК</span>
        </div>
      </div>
    </div>
  );
};
