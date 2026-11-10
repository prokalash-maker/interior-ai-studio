import React, { useState, useEffect } from 'react';
import { Minus, Square, X, Sparkles, User, ShieldCheck, Cpu, Zap, RefreshCw, ExternalLink } from 'lucide-react';
import { authService } from '../../services/authService';
import { AuthState } from '../../types/auth';
import { useI18n } from '../../i18n/i18nContext';
import { LanguageSelector } from '../LanguageSelector';

interface TitleBarProps {
  currentProjectName?: string;
  onOpenSettings: () => void;
  onOpenAuth: () => void;
  onOpenUpscale?: () => void;
}

export const TitleBar: React.FC<TitleBarProps> = ({
  currentProjectName,
  onOpenSettings,
  onOpenAuth,
  onOpenUpscale,
}) => {
  const { t } = useI18n();
  const [authState, setAuthState] = useState<AuthState>(authService.getState());
  const [isMaximized, setIsMaximized] = useState(false);
  const [comfyStatus, setComfyStatus] = useState<'online' | 'offline' | 'starting'>('offline');
  const [isStartingComfy, setIsStartingComfy] = useState(false);
  const [isStoppingComfy, setIsStoppingComfy] = useState(false);

  useEffect(() => {
    const unsubscribe = authService.subscribe(setAuthState);
    return () => unsubscribe();
  }, []);

  // Poll ComfyUI live status every 4 seconds
  useEffect(() => {
    let isMounted = true;
    const checkStatus = async () => {
      if (window.electronAPI?.getComfyUIStatus) {
        try {
          const res = await window.electronAPI.getComfyUIStatus();
          if (isMounted) {
            setComfyStatus(res.online ? 'online' : isStartingComfy ? 'starting' : 'offline');
            if (res.online && isStartingComfy) {
              setIsStartingComfy(false);
            }
          }
        } catch (_) {
          if (isMounted) setComfyStatus('offline');
        }
      }
    };

    checkStatus();
    const interval = setInterval(checkStatus, 4000);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [isStartingComfy]);

  const handleLaunchComfyUI = async () => {
    setIsStartingComfy(true);
    setComfyStatus('starting');
    if (window.electronAPI?.launchComfyUI) {
      await window.electronAPI.launchComfyUI();
    }
  };

  const handleStopComfyUI = async (e?: React.MouseEvent) => {
    e?.stopPropagation();
    setIsStoppingComfy(true);
    if (window.electronAPI?.stopComfyUI) {
      await window.electronAPI.stopComfyUI();
      const res = await window.electronAPI.getComfyUIStatus();
      setComfyStatus(res.online ? 'online' : 'offline');
    }
    setIsStoppingComfy(false);
  };

  const handleOpenComfyUIWeb = () => {
    if (window.electronAPI?.openComfyUIWeb) {
      window.electronAPI.openComfyUIWeb();
    } else {
      window.open('http://127.0.0.1:8188', '_blank');
    }
  };

  const handleMinimize = () => {
    window.electronAPI?.minimizeWindow();
  };

  const handleMaximize = async () => {
    if (window.electronAPI) {
      await window.electronAPI.maximizeWindow();
      const max = await window.electronAPI.isMaximized();
      setIsMaximized(max);
    }
  };

  const handleClose = () => {
    window.electronAPI?.closeWindow();
  };

  return (
    <header className="h-12 bg-studio-surface border-b border-studio-border flex items-center justify-between px-4 select-none z-50 text-xs shadow-sm">
      {/* Left: Branding & App Title */}
      <div className="flex items-center space-x-3 min-w-0" style={{ WebkitAppRegion: 'drag' } as any}>
        <div className="flex items-center space-x-2">
          <div className="w-7 h-7 rounded-lg bg-studio-accent/15 border border-studio-accent/25 flex items-center justify-center">
            <Sparkles className="w-3.5 h-3.5 text-studio-accent" />
          </div>
          <span className="font-semibold tracking-wide text-studio-text text-xs truncate max-w-[260px] max-[1200px]:max-w-[175px] max-[900px]:hidden">
            {t('app.title')}
          </span>
          <span className="text-[10px] bg-studio-surfaceLight text-studio-textMuted border border-studio-border px-2 py-1 rounded-md font-mono">
            {t('app.version')}
          </span>
        </div>

        {/* Current Project Name if loaded */}
        {currentProjectName && (
          <div className="flex items-center space-x-1.5 pl-3 border-l border-studio-border max-[900px]:hidden min-w-0">
            <span className="text-studio-textMuted text-[11px]">{t('app.project')}:</span>
            <span className="text-studio-text font-medium text-[11px] truncate max-w-[200px]">
              {currentProjectName}
            </span>
            <span className="w-1.5 h-1.5 rounded-full bg-studio-success ml-1" title={t('app.autoSaved')} />
          </div>
        )}
      </div>

      {/* Center: Draggable area */}
      <div className="flex-1 h-full" style={{ WebkitAppRegion: 'drag' } as any} />

      {/* Right: ComfyUI Status, Language Selector, Auth Profile & Windows Window Controls */}
      <div className="flex items-center space-x-2.5 max-[1100px]:space-x-1.5">
        {/* ComfyUI Live Status Pill */}
        <div className="flex items-center space-x-1.5 bg-studio-bg border border-studio-border px-2 py-0.5 rounded-lg text-[10px] font-mono max-[700px]:hidden">
          <Cpu className="w-3 h-3 text-studio-cyan" />
          <span>ComfyUI:</span>
          {comfyStatus === 'online' ? (
            <div className="flex items-center space-x-1.5">
              <button
                onClick={handleOpenComfyUIWeb}
                className="flex items-center space-x-1 text-emerald-400 hover:text-emerald-300 font-bold"
                title={`${t('titlebar.openComfy')} (127.0.0.1:8188)`}
              >
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                <span>{t('titlebar.comfyOnline')}</span>
                <ExternalLink className="w-2.5 h-2.5 ml-0.5" />
              </button>
              <button
                onClick={handleStopComfyUI}
                disabled={isStoppingComfy}
                className="px-1.5 py-0.5 bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/40 rounded text-[9px] font-semibold transition-all active:scale-[0.96]"
                title={t('titlebar.stopComfy')}
              >
                {isStoppingComfy ? '…' : t('titlebar.stop')}
              </button>
            </div>
          ) : comfyStatus === 'starting' ? (
              <span className="flex items-center space-x-1 text-amber-400 font-bold">
              <RefreshCw className="w-2.5 h-2.5 animate-spin" />
              <span>{t('titlebar.comfyStarting')}</span>
            </span>
          ) : (
            <button
              onClick={handleLaunchComfyUI}
              className="flex items-center space-x-1 text-studio-textMuted hover:text-studio-cyan transition-colors"
              title={t('titlebar.launchComfy')}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-studio-danger" />
              <span>{t('titlebar.comfyOffline')}</span>
              <span className="text-studio-cyan underline text-[9px] ml-0.5 font-bold">{t('titlebar.start')}</span>
            </button>
          )}
        </div>

        {/* Quick Global AI 4K Upscaler Trigger */}
        {onOpenUpscale && (
          <button
            onClick={onOpenUpscale}
            className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-[11px] font-medium bg-studio-surfaceLight hover:bg-studio-surfaceHover text-studio-text border border-studio-border transition-colors active:scale-[0.98]"
            title={t('titlebar.upscale')}
          >
            <Sparkles className="w-3 h-3 text-studio-cyan" />
            <span className="max-[1100px]:hidden">{t('titlebar.upscale')}</span>
          </button>
        )}

        {/* Language Selector Dropdown */}
        <LanguageSelector />

        {/* User Account Chip */}
        {authState.isAuthenticated && authState.user ? (
          <button
            onClick={onOpenSettings}
            className="flex items-center space-x-1.5 px-2 py-1 rounded bg-studio-surfaceHover hover:bg-studio-border text-studio-text transition-colors"
            title="Google Account Profile"
          >
            {authState.user.picture ? (
              <img
                src={authState.user.picture}
                alt={authState.user.name}
                className="w-4 h-4 rounded-full"
              />
            ) : (
              <User className="w-3.5 h-3.5 text-indigo-400" />
            )}
            <span className="text-[11px] font-medium max-w-[120px] truncate">
              {authState.user.name}
            </span>
            <ShieldCheck className="w-3 h-3 text-studio-success" />
          </button>
        ) : authState.isGuest && authState.user ? (
          <button onClick={onOpenSettings} title={t('settings.localProfileActive')} className="flex items-center gap-1.5 px-2 py-1 rounded bg-studio-surfaceHover hover:bg-studio-border text-studio-textMuted transition-colors">
            <User className="w-3.5 h-3.5" />
            <span className="text-[11px] font-medium max-w-[120px] truncate">{authState.user.name}</span>
          </button>
        ) : (
          <button
            onClick={onOpenAuth}
            className="flex items-center space-x-1 px-2 py-0.5 rounded border border-studio-border hover:border-indigo-500/50 hover:bg-indigo-500/10 text-studio-textMuted hover:text-studio-text transition-colors"
          >
            <User className="w-3 h-3 text-studio-textSubtle" />
            <span className="text-[11px]">{t('settings.accountTitle')}</span>
          </button>
        )}

        {/* Window controls (Only if in Electron) */}
        {window.electronAPI && (
          <div className="flex items-center space-x-1 ml-1">
            <button
              onClick={handleMinimize}
              className="w-7 h-6 flex items-center justify-center text-studio-textMuted hover:text-studio-text hover:bg-studio-surfaceHover rounded"
              title={t('window.minimize')}
            >
              <Minus className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={handleMaximize}
              className="w-7 h-6 flex items-center justify-center text-studio-textMuted hover:text-studio-text hover:bg-studio-surfaceHover rounded"
              title={isMaximized ? t('window.restore') : t('window.maximize')}
            >
              <Square className="w-3 h-3" />
            </button>
            <button
              onClick={handleClose}
              className="w-7 h-6 flex items-center justify-center text-studio-textMuted hover:text-white hover:bg-studio-danger rounded transition-colors"
              title={t('window.close')}
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>
    </header>
  );
};
