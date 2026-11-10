import React, { useState, useEffect } from 'react';
import {
  Key,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  ShieldCheck,
  Cpu,
  Database,
  User,
  LogOut,
  FolderOpen,
  Folder,
  Info,
  RefreshCw,
  Sparkles,
  Lock,
  Globe,
  Check,
  DollarSign,
  Zap,
  Server,
  Play,
  Square,
  RotateCw,
  HardDrive,
  SlidersHorizontal,
} from 'lucide-react';
import { geminiProvider } from '../services/ai/GeminiProvider';
import { kreaProvider } from '../services/ai/KreaProvider';
import { pollinationsProvider } from '../services/ai/PollinationsProvider';
import { aiHordeProvider } from '../services/ai/AIHordeProvider';
import { localSDProvider } from '../services/ai/LocalSDProvider';
import { comfyuiProvider } from '../services/ai/ComfyUIProvider';
import { huggingFaceProvider } from '../services/ai/HuggingFaceProvider';
import { authService } from '../services/authService';
import { AuthState } from '../types/auth';
import { providerRegistry, PROVIDERS_CATALOG } from '../services/ai/providerRegistry';
import { useI18n } from '../i18n/i18nContext';
import { Language, LANGUAGES } from '../i18n/types';
import { costTracker } from '../services/costTracker';
import { CostSummary } from '../types/cost';

export const SettingsView: React.FC = () => {
  const { t, language, setLanguage } = useI18n();
  const [activeTab, setActiveTab] = useState<'ai' | 'budget' | 'language' | 'account' | 'archicad' | 'storage'>('ai');
  const [dataFolderMessage, setDataFolderMessage] = useState('');

  // Google Gemini API Key & Model
  const [apiKey, setApiKey] = useState<string>('');
  const [showKey, setShowKey] = useState<boolean>(false);
  const [selectedModel, setSelectedModel] = useState<string>(geminiProvider.currentModel);
  const [isTesting, setIsTesting] = useState<boolean>(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string; latencyMs?: number } | null>(null);
  const [isSaved, setIsSaved] = useState<boolean>(false);

  // Krea AI API Key & Model
  const [kreaApiKey, setKreaApiKey] = useState<string>('');
  const [showKreaKey, setShowKreaKey] = useState<boolean>(false);
  const [selectedKreaModel, setSelectedKreaModel] = useState<string>(kreaProvider.currentModel);
  const [isTestingKrea, setIsTestingKrea] = useState<boolean>(false);
  const [kreaTestResult, setKreaTestResult] = useState<{ success: boolean; message: string; latencyMs?: number } | null>(null);
  const [isKreaSaved, setIsKreaSaved] = useState<boolean>(false);

  // ComfyUI State (Local RTX 4050 6GB)
  const [comfyuiUrl, setComfyuiUrl] = useState<string>(comfyuiProvider.getServerUrl());
  const [comfyuiModel, setComfyuiModel] = useState<string>(comfyuiProvider.currentModel);
  const [isTestingComfyUI, setIsTestingComfyUI] = useState<boolean>(false);
  const [comfyuiTestResult, setComfyuiTestResult] = useState<{ success: boolean; message: string; latencyMs?: number } | null>(null);
  const [isLaunchingComfyUI, setIsLaunchingComfyUI] = useState<boolean>(false);
  const [isStoppingComfyUI, setIsStoppingComfyUI] = useState<boolean>(false);
  const [comfyStatus, setComfyStatus] = useState<{ online: boolean; port: number; systemStats?: any } | null>(null);

  // ComfyUI Directories & Models Scanner
  const [comfyuiPath, setComfyuiPath] = useState<string>('d:\\AI\\ComfyUI_windows_portable');
  const [modelsPath, setModelsPath] = useState<string>('d:\\AI\\models');
  const [isScanningModels, setIsScanningModels] = useState<boolean>(false);
  const [modelsScanResult, setModelsScanResult] = useState<{
    baseFolder: string;
    checkpoints: any[];
    controlnet: any[];
    loras: any[];
    vae: any[];
    upscale_models?: any[];
    totalCount: number;
    totalBytes: number;
  } | null>(null);
  const [isSavingPaths, setIsSavingPaths] = useState<boolean>(false);
  const [pathsSaveMessage, setPathsSaveMessage] = useState<string | null>(null);
  const [archicadWatchFolder, setArchicadWatchFolder] = useState<string>('');
  const [archicadWatchRunning, setArchicadWatchRunning] = useState<boolean>(false);
  const [archicadWatchMessage, setArchicadWatchMessage] = useState<string | null>(null);

  // Pollinations AI State (100% Free)
  const [pollinationsModel, setPollinationsModel] = useState<string>(pollinationsProvider.currentModel);
  const [pollinationsKey, setPollinationsKey] = useState<string>(pollinationsProvider.getApiKey());
  const [isTestingPollinations, setIsTestingPollinations] = useState<boolean>(false);
  const [pollinationsTestResult, setPollinationsTestResult] = useState<{ success: boolean; message: string; latencyMs?: number } | null>(null);
  const [isPollinationsSaved, setIsPollinationsSaved] = useState<boolean>(false);

  // AI Horde State (Free GPU Grid Img2Img)
  const [aiHordeKey, setAiHordeKey] = useState<string>(aiHordeProvider.getApiKey());
  const [aiHordeModel, setAiHordeModel] = useState<string>(aiHordeProvider.currentModel);
  const [isTestingHorde, setIsTestingHorde] = useState<boolean>(false);
  const [hordeTestResult, setHordeTestResult] = useState<{ success: boolean; message: string; latencyMs?: number } | null>(null);
  const [isHordeSaved, setIsHordeSaved] = useState<boolean>(false);

  // Local SD / ComfyUI State (127.0.0.1)
  const [localSDUrl, setLocalSDUrl] = useState<string>(localSDProvider.getServerUrl());
  const [localSDModel, setLocalSDModel] = useState<string>(localSDProvider.currentModel);
  const [isTestingLocalSD, setIsTestingLocalSD] = useState<boolean>(false);
  const [localSDTestResult, setLocalSDTestResult] = useState<{ success: boolean; message: string; latencyMs?: number } | null>(null);
  const [isLocalSDSaved, setIsLocalSDSaved] = useState<boolean>(false);

  // Hugging Face State
  const [hfKey, setHfKey] = useState<string>(huggingFaceProvider.getApiKey());
  const [hfModel, setHfModel] = useState<string>(huggingFaceProvider.currentModel);
  const [isTestingHF, setIsTestingHF] = useState<boolean>(false);
  const [hfTestResult, setHfTestResult] = useState<{ success: boolean; message: string; latencyMs?: number } | null>(null);
  const [isHFSaved, setIsHFSaved] = useState<boolean>(false);

  // Cost & Budget State
  const [costSummary, setCostSummary] = useState<CostSummary>(costTracker.getSummary());
  const [budgetLimitInput, setBudgetLimitInput] = useState<number>(costSummary.budgetLimit);
  const [warnExpensiveInput, setWarnExpensiveInput] = useState<boolean>(costSummary.warnOnExpensive);

  // Active / Enabled AI Providers in Studio Sidebar
  const [enabledProviderIds, setEnabledProviderIds] = useState<string[]>(
    providerRegistry.getEnabledProviderIds()
  );

  // Auth State
  const [authState, setAuthState] = useState<AuthState>(authService.getState());

  useEffect(() => {
    const unsub = authService.subscribe(setAuthState);
    const unsubCost = costTracker.subscribe(() => {
      setCostSummary(costTracker.getSummary());
    });
    const unsubRegistry = providerRegistry.subscribe(() => {
      setEnabledProviderIds(providerRegistry.getEnabledProviderIds());
    });
    window.electronAPI?.getArchicadWatchStatus().then((status) => {
      setArchicadWatchFolder(status.folderPath);
      setArchicadWatchRunning(status.running);
    }).catch(() => {});

    // Load saved API keys from secure storage
    if (window.electronAPI) {
      window.electronAPI.getSecureItem('gemini_api_key').then((savedKey) => {
        if (savedKey) {
          setApiKey(savedKey);
          geminiProvider.setApiKey(savedKey);
        }
      });
      window.electronAPI.getSecureItem('krea_api_key').then((savedKrea) => {
        if (savedKrea) {
          setKreaApiKey(savedKrea);
          kreaProvider.setApiKey(savedKrea);
        }
      });
    } else {
      const savedKey = localStorage.getItem('gemini_api_key');
      if (savedKey) {
        setApiKey(savedKey);
        geminiProvider.setApiKey(savedKey);
      }
      const savedKrea = localStorage.getItem('krea_api_key');
      if (savedKrea) {
        setKreaApiKey(savedKrea);
        kreaProvider.setApiKey(savedKrea);
      }
    }

    if (window.electronAPI?.getCustomPaths) {
      window.electronAPI.getCustomPaths().then((paths) => {
        if (paths.comfyuiPath) setComfyuiPath(paths.comfyuiPath);
        if (paths.modelsPath) {
          setModelsPath(paths.modelsPath);
          window.electronAPI?.scanModelsFolder(paths.modelsPath).then((res) => {
            if (res) setModelsScanResult(res);
          }).catch(() => {});
        }
      }).catch(() => {});
    }

    const checkComfy = () => {
      if (window.electronAPI?.getComfyUIStatus) {
        window.electronAPI.getComfyUIStatus().then((st) => setComfyStatus(st)).catch(() => {});
      }
    };
    checkComfy();
    const interval = setInterval(checkComfy, 4000);

    return () => {
      unsub();
      unsubCost();
      unsubRegistry();
      clearInterval(interval);
    };
  }, []);

  const handleToggleProvider = (id: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    providerRegistry.toggleProvider(id);
    setEnabledProviderIds(providerRegistry.getEnabledProviderIds());
  };

  const handleEnableAllProviders = () => {
    providerRegistry.enableAllProviders();
    setEnabledProviderIds(providerRegistry.getEnabledProviderIds());
  };

  const handleSetMinimalPreset = () => {
    providerRegistry.setMinimalPreset();
    setEnabledProviderIds(providerRegistry.getEnabledProviderIds());
  };

  const handleSetComfyOnlyPreset = () => {
    providerRegistry.setOnlyProvider('comfyui_local');
    setEnabledProviderIds(providerRegistry.getEnabledProviderIds());
  };

  const handleSaveApiKey = async () => {
    const trimmed = apiKey.trim();
    geminiProvider.setApiKey(trimmed);
    geminiProvider.setModel(selectedModel);

    if (window.electronAPI) {
      await window.electronAPI.saveSecureItem('gemini_api_key', trimmed);
    } else {
      localStorage.setItem('gemini_api_key', trimmed);
    }

    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 2500);
  };

  const handleTestConnection = async () => {
    setIsTesting(true);
    setTestResult(null);
    try {
      geminiProvider.setApiKey(apiKey.trim());
      const res = await geminiProvider.testConnection();
      setTestResult(res);
    } catch (e: any) {
      setTestResult({ success: false, message: e.message || 'Error' });
    } finally {
      setIsTesting(false);
    }
  };

  const handleSaveKreaApiKey = async () => {
    const trimmed = kreaApiKey.trim();
    kreaProvider.setApiKey(trimmed);
    kreaProvider.setModel(selectedKreaModel);

    if (window.electronAPI) {
      await window.electronAPI.saveSecureItem('krea_api_key', trimmed);
    } else {
      localStorage.setItem('krea_api_key', trimmed);
    }

    setIsKreaSaved(true);
    setTimeout(() => setIsKreaSaved(false), 2500);
  };

  const handleTestKreaConnection = async () => {
    setIsTestingKrea(true);
    setKreaTestResult(null);
    try {
      kreaProvider.setApiKey(kreaApiKey.trim());
      const res = await kreaProvider.testConnection();
      setKreaTestResult(res);
    } catch (e: any) {
      setKreaTestResult({ success: false, message: e.message || 'Error' });
    } finally {
      setIsTestingKrea(false);
    }
  };

  // Pollinations Handlers
  const handleSavePollinations = () => {
    pollinationsProvider.setModel(pollinationsModel);
    pollinationsProvider.setApiKey(pollinationsKey.trim());
    setIsPollinationsSaved(true);
    setTimeout(() => setIsPollinationsSaved(false), 2500);
  };

  const handleTestPollinations = async () => {
    setIsTestingPollinations(true);
    setPollinationsTestResult(null);
    try {
      pollinationsProvider.setModel(pollinationsModel);
      pollinationsProvider.setApiKey(pollinationsKey.trim());
      const res = await pollinationsProvider.testConnection();
      setPollinationsTestResult(res);
    } catch (e: any) {
      setPollinationsTestResult({ success: false, message: e.message || 'Error' });
    } finally {
      setIsTestingPollinations(false);
    }
  };

  // AI Horde Handlers
  const handleSaveHorde = () => {
    aiHordeProvider.setModel(aiHordeModel);
    aiHordeProvider.setApiKey(aiHordeKey.trim());
    setIsHordeSaved(true);
    setTimeout(() => setIsHordeSaved(false), 2500);
  };

  const handleTestHorde = async () => {
    setIsTestingHorde(true);
    setHordeTestResult(null);
    try {
      aiHordeProvider.setModel(aiHordeModel);
      aiHordeProvider.setApiKey(aiHordeKey.trim());
      const res = await aiHordeProvider.testConnection();
      setHordeTestResult(res);
    } catch (e: any) {
      setHordeTestResult({ success: false, message: e.message || 'Error' });
    } finally {
      setIsTestingHorde(false);
    }
  };

  // ComfyUI Handlers (Local RTX 4050 6GB)
  const [isComfyuiSaved, setIsComfyuiSaved] = useState<boolean>(false);

  const handleSaveComfyUI = () => {
    comfyuiProvider.setModel(comfyuiModel);
    comfyuiProvider.setServerUrl(comfyuiUrl.trim());
    setIsComfyuiSaved(true);
    setTimeout(() => setIsComfyuiSaved(false), 2500);
  };

  const handleTestComfyUI = async () => {
    setIsTestingComfyUI(true);
    setComfyuiTestResult(null);
    try {
      comfyuiProvider.setModel(comfyuiModel);
      comfyuiProvider.setServerUrl(comfyuiUrl.trim());
      const res = await comfyuiProvider.testConnection();
      setComfyuiTestResult(res);
    } catch (e: any) {
      setComfyuiTestResult({ success: false, message: e.message || 'Ошибка подключения к ComfyUI' });
    } finally {
      setIsTestingComfyUI(false);
    }
  };

  const handleLaunchComfyUI = async () => {
    if (window.electronAPI?.launchComfyUI) {
      setIsLaunchingComfyUI(true);
      try {
        const result = await window.electronAPI.launchComfyUI();
        if (result?.success) {
          setComfyuiTestResult({
            success: !!result.ready,
            message: result.message || (result.ready ? 'ComfyUI готов.' : 'ComfyUI запускается.'),
          });
        } else {
          setComfyuiTestResult({
            success: false,
            message: result?.error || 'Не удалось запустить ComfyUI. Проверьте путь и Python-окружение в настройках.',
          });
        }
      } catch (e: any) {
        setComfyuiTestResult({ success: false, message: e.message });
      } finally {
        setTimeout(() => setIsLaunchingComfyUI(false), 3000);
      }
    } else {
      alert('Запустите scripts/start-comfyui.bat из корня проекта для старта локального сервера ComfyUI.');
    }
  };

  const handleOpenModelsFolder = async () => {
    if (window.electronAPI?.openModelsFolder) {
      await window.electronAPI.openModelsFolder();
    }
  };

  const handleSelectComfyUIDir = async () => {
    if (window.electronAPI?.selectDirectoryDialog) {
      const res = await window.electronAPI.selectDirectoryDialog(comfyuiPath);
      if (!res.canceled && res.path) {
        setComfyuiPath(res.path);
      }
    }
  };

  const handleSelectModelsDir = async () => {
    if (window.electronAPI?.selectDirectoryDialog) {
      const res = await window.electronAPI.selectDirectoryDialog(modelsPath);
      if (!res.canceled && res.path) {
        setModelsPath(res.path);
      }
    }
  };

  const handleSelectArchicadWatchFolder = async () => {
    if (!window.electronAPI?.selectDirectoryDialog) return;
    const result = await window.electronAPI.selectDirectoryDialog(archicadWatchFolder || undefined);
    if (!result.canceled && result.path) setArchicadWatchFolder(result.path);
  };

  const handleToggleArchicadWatch = async () => {
    if (!window.electronAPI) return;
    setArchicadWatchMessage(null);
    if (archicadWatchRunning) {
      const result = await window.electronAPI.stopArchicadWatch();
      setArchicadWatchRunning(false);
      setArchicadWatchFolder(result.folderPath || archicadWatchFolder);
      setArchicadWatchMessage(t('settings.archicadWatchStopped'));
      return;
    }
    if (!archicadWatchFolder) {
      setArchicadWatchMessage(t('settings.archicadWatchChooseFolder'));
      return;
    }
    const result = await window.electronAPI.startArchicadWatch(archicadWatchFolder);
    setArchicadWatchRunning(result.success);
    if (result.success) {
      setArchicadWatchFolder(result.folderPath || archicadWatchFolder);
      setArchicadWatchMessage(t('settings.archicadWatchStarted'));
    } else {
      setArchicadWatchMessage(result.error || t('settings.archicadWatchFailed'));
    }
  };

  const handleSaveCustomPaths = async () => {
    if (window.electronAPI?.saveCustomPaths) {
      setIsSavingPaths(true);
      setPathsSaveMessage(null);
      const res = await window.electronAPI.saveCustomPaths({
        comfyuiPath,
        modelsPath,
        autoStartComfyUI: false,
      });
      setIsSavingPaths(false);
      if (res.success) {
        setPathsSaveMessage('✓ Пути сохранены! extra_model_paths.yaml синхронизирован с ComfyUI.');
        handleScanModels();
      } else {
        setPathsSaveMessage(`Ошибка: ${res.error || 'Не удалось сохранить пути'}`);
      }
      setTimeout(() => setPathsSaveMessage(null), 4000);
    }
  };

  const handleScanModels = async () => {
    if (window.electronAPI?.scanModelsFolder) {
      setIsScanningModels(true);
      try {
        const scan = await window.electronAPI.scanModelsFolder(modelsPath);
        setModelsScanResult(scan);
      } catch (err: any) {
        console.error('Scan models error:', err);
      } finally {
        setIsScanningModels(false);
      }
    }
  };

  const handleStopComfyUI = async () => {
    if (window.electronAPI?.stopComfyUI) {
      setIsStoppingComfyUI(true);
      await window.electronAPI.stopComfyUI();
      setIsStoppingComfyUI(false);
      const st = await window.electronAPI.getComfyUIStatus();
      setComfyStatus(st);
    }
  };

  const handleOpenComfyUIWeb = async () => {
    if (window.electronAPI?.openComfyUIWeb) {
      await window.electronAPI.openComfyUIWeb();
    } else {
      window.open('http://127.0.0.1:8188', '_blank');
    }
  };

  // Local SD Handlers
  const handleSaveLocalSD = () => {
    localSDProvider.setModel(localSDModel);
    localSDProvider.setServerUrl(localSDUrl.trim());
    setIsLocalSDSaved(true);
    setTimeout(() => setIsLocalSDSaved(false), 2500);
  };

  const handleTestLocalSD = async () => {
    setIsTestingLocalSD(true);
    setLocalSDTestResult(null);
    try {
      localSDProvider.setModel(localSDModel);
      localSDProvider.setServerUrl(localSDUrl.trim());
      const res = await localSDProvider.testConnection();
      setLocalSDTestResult(res);
    } catch (e: any) {
      setLocalSDTestResult({ success: false, message: e.message || 'Error' });
    } finally {
      setIsTestingLocalSD(false);
    }
  };

  // Hugging Face Handlers
  const handleSaveHF = () => {
    huggingFaceProvider.setModel(hfModel);
    huggingFaceProvider.setApiKey(hfKey.trim());
    setIsHFSaved(true);
    setTimeout(() => setIsHFSaved(false), 2500);
  };

  const handleTestHF = async () => {
    setIsTestingHF(true);
    setHfTestResult(null);
    try {
      huggingFaceProvider.setModel(hfModel);
      huggingFaceProvider.setApiKey(hfKey.trim());
      const res = await huggingFaceProvider.testConnection();
      setHfTestResult(res);
    } catch (e: any) {
      setHfTestResult({ success: false, message: e.message || 'Error' });
    } finally {
      setIsTestingHF(false);
    }
  };

  const handleGoogleLogout = async () => {
    await authService.logout();
  };

  const handleSaveBudgetLimit = (limit: number) => {
    setBudgetLimitInput(limit);
    costTracker.setBudgetLimit(limit);
  };

  const handleToggleWarnExpensive = (warn: boolean) => {
    setWarnExpensiveInput(warn);
    costTracker.setWarnOnExpensive(warn);
  };

  const handleOpenDataFolder = async () => {
    try {
      const result = await window.electronAPI?.openDataFolder();
      setDataFolderMessage(result?.success ? t('settings.dataFolderOpened') : (result?.error || ''));
    } catch (error) {
      setDataFolderMessage(error instanceof Error ? error.message : String(error));
    }
  };

  return (
    <div className="flex-1 flex overflow-hidden bg-studio-bg text-studio-text select-none">
      {/* Settings Sub-Sidebar */}
      <div className="w-60 max-[1000px]:w-48 shrink-0 bg-studio-surface border-r border-studio-border p-4 max-[1000px]:p-3 space-y-2">
        <h2 className="text-xs font-semibold text-studio-textMuted uppercase tracking-wider mb-3">
          {t('settings.title')}
        </h2>
        <button
          onClick={() => setActiveTab('ai')}
          className={`w-full flex items-center space-x-2.5 px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
            activeTab === 'ai'
              ? 'bg-indigo-600/20 text-indigo-300 border border-indigo-500/30'
              : 'text-studio-textMuted hover:bg-studio-surfaceHover hover:text-studio-text'
          }`}
        >
          <Cpu className="w-4 h-4 text-indigo-400" />
          <span>{t('settings.tabAi')}</span>
        </button>
        <button
          onClick={() => setActiveTab('budget')}
          className={`w-full flex items-center space-x-2.5 px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
            activeTab === 'budget'
              ? 'bg-indigo-600/20 text-indigo-300 border border-indigo-500/30'
              : 'text-studio-textMuted hover:bg-studio-surfaceHover hover:text-studio-text'
          }`}
        >
          <DollarSign className="w-4 h-4 text-emerald-400" />
          <span>{t('settings.tabBudget') || 'Расходы и Бюджет'}</span>
        </button>
        <button
          onClick={() => setActiveTab('language')}
          className={`w-full flex items-center space-x-2.5 px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
            activeTab === 'language'
              ? 'bg-indigo-600/20 text-indigo-300 border border-indigo-500/30'
              : 'text-studio-textMuted hover:bg-studio-surfaceHover hover:text-studio-text'
          }`}
        >
          <Globe className="w-4 h-4 text-indigo-400" />
          <span>{t('settings.tabLanguage')}</span>
        </button>
        <button
          onClick={() => setActiveTab('account')}
          className={`w-full flex items-center space-x-2.5 px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
            activeTab === 'account'
              ? 'bg-indigo-600/20 text-indigo-300 border border-indigo-500/30'
              : 'text-studio-textMuted hover:bg-studio-surfaceHover hover:text-studio-text'
          }`}
        >
          <User className="w-4 h-4 text-indigo-400" />
          <span>{t('settings.tabAccount')}</span>
        </button>
        <button
          onClick={() => setActiveTab('archicad')}
          className={`w-full flex items-center space-x-2.5 px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
            activeTab === 'archicad'
              ? 'bg-indigo-600/20 text-indigo-300 border border-indigo-500/30'
              : 'text-studio-textMuted hover:bg-studio-surfaceHover hover:text-studio-text'
          }`}
        >
          <FolderOpen className="w-4 h-4 text-indigo-400" />
          <span>{t('settings.tabArchicad')}</span>
        </button>
        <button
          onClick={() => setActiveTab('storage')}
          className={`w-full flex items-center space-x-2.5 px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
            activeTab === 'storage'
              ? 'bg-indigo-600/20 text-indigo-300 border border-indigo-500/30'
              : 'text-studio-textMuted hover:bg-studio-surfaceHover hover:text-studio-text'
          }`}
        >
          <Database className="w-4 h-4 text-indigo-400" />
          <span>{t('settings.tabStorage')}</span>
        </button>
      </div>

      {/* Main Content Pane */}
      <div className="flex-1 min-w-0 overflow-y-auto p-8 max-[1000px]:p-4 max-w-4xl">
        {/* TAB 1: AI PROVIDERS */}
        {activeTab === 'ai' && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h1 className="text-xl font-bold text-white mb-1">AI-провайдеры и Модели</h1>
                <p className="text-xs text-studio-textMuted">
                  Включайте или выключайте определенные сервисы, чтобы облегчить и освободить боковую панель визуализации.
                </p>
              </div>

              {/* Quick Presets for Cleaner Studio */}
              <div className="flex items-center space-x-2 shrink-0">
                <button
                  onClick={handleSetComfyOnlyPreset}
                  className="px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-400 border border-emerald-500/30 transition-all flex items-center space-x-1 shadow-sm active:scale-[0.98]"
                  title="Оставить только локальный ComfyUI (максимально разгрузить меню)"
                >
                  <Cpu className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Только ComfyUI</span>
                </button>

                <button
                  onClick={handleSetMinimalPreset}
                  className="px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-studio-cyan/15 hover:bg-studio-cyan/25 text-studio-cyan border border-studio-cyan/30 transition-all flex items-center space-x-1 shadow-sm active:scale-[0.98]"
                  title={t('settings.coreEnginesHint')}
                >
                  <Sparkles className="w-3.5 h-3.5 text-studio-cyan" />
                  <span>{t('settings.coreEngines')}</span>
                </button>

                <button
                  onClick={handleEnableAllProviders}
                  className="px-2.5 py-1.5 rounded-lg text-xs font-medium bg-studio-surfaceHover hover:bg-studio-border text-studio-text hover:text-white border border-studio-border transition-all flex items-center space-x-1 active:scale-[0.98]"
                  title={t('settings.showAllCoreEnginesHint')}
                >
                  <span>{t('settings.showAllCoreEngines')}</span>
                </button>
              </div>
            </div>

            {/* Core provider selection */}
            <div className="bg-studio-bg/60 border border-studio-border rounded-xl p-4 space-y-3">
              <div className="flex items-center justify-between text-xs pb-1 border-b border-studio-border/50">
                <span className="font-semibold text-white flex items-center space-x-1.5">
                  <SlidersHorizontal className="w-3.5 h-3.5 text-studio-cyan" />
                  <span>Движки генерации:</span>
                </span>
                <span className="font-mono text-[11px] text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                  Выбрано: {enabledProviderIds.filter((id) => PROVIDERS_CATALOG.some((provider) => provider.id === id)).length} из {PROVIDERS_CATALOG.length}
                </span>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
                {PROVIDERS_CATALOG.map((p) => {
                  const isEnabled = enabledProviderIds.includes(p.id);
                  return (
                    <div
                      key={p.id}
                      onClick={(e) => handleToggleProvider(p.id, e)}
                      className={`p-3 rounded-xl border cursor-pointer transition-all select-none flex flex-col justify-between ${
                        isEnabled
                          ? 'bg-studio-surface border-emerald-500/60 shadow-md shadow-emerald-500/5 ring-1 ring-emerald-500/20 hover:border-emerald-400'
                          : 'bg-studio-surface/30 border-studio-border/60 opacity-60 hover:opacity-90 hover:border-studio-border'
                      }`}
                    >
                      <div>
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="font-bold text-xs text-white truncate max-w-[125px]">
                            {p.shortName || p.name.split('(')[0]}
                          </span>

                          {/* Toggle Switch with Status Badge */}
                          <div className="flex items-center space-x-1.5">
                            <span className={`text-[10px] font-bold font-mono ${isEnabled ? 'text-emerald-400' : 'text-zinc-500'}`}>
                              {isEnabled ? 'ВКЛ' : 'ВЫКЛ'}
                            </span>
                            <div
                              className={`w-8 h-4.5 rounded-full p-0.5 transition-colors flex items-center ${
                                isEnabled ? 'bg-emerald-500 justify-end' : 'bg-zinc-700 justify-start'
                              }`}
                            >
                              <div className="w-3.5 h-3.5 rounded-full bg-white shadow-sm" />
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center space-x-1 text-[10px] font-mono mb-2">
                          <span
                            className={`px-1.5 py-0.5 rounded ${
                              p.isFree
                                ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/20 font-bold'
                                : 'bg-indigo-500/15 text-indigo-300 border border-indigo-500/20'
                            }`}
                          >
                            {p.isFree ? 'Бесплатно' : p.costBadge.split('/')[0]}
                          </span>
                        </div>

                        <p className="text-[10px] text-zinc-400 leading-snug line-clamp-2">
                          {p.description}
                        </p>
                      </div>

                      <div className="pt-2 mt-2 border-t border-studio-border/40 flex items-center justify-between text-[10px]">
                        <span className={isEnabled ? 'text-emerald-400 font-semibold' : 'text-zinc-500'}>
                          {isEnabled ? '✓ Включен в меню' : '✕ Скрыт в меню'}
                        </span>
                        <span className="text-zinc-500 text-[9px]">нажмите перекл.</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Provider 1: Google Gemini (Nano Banana Pro) */}
            <div className="bg-studio-surface border border-studio-border rounded-xl p-5 space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-studio-border">
                <div className="flex items-center space-x-2">
                  <Sparkles className="w-4 h-4 text-indigo-400" />
                  <span className="font-semibold text-sm text-white">
                    Google Gemini (Nano Banana Pro)
                  </span>
                </div>
                <div className="flex items-center space-x-2">
                  <span className="text-xs text-studio-textMuted">Endpoint:</span>
                  <span className="font-mono text-xs bg-indigo-500/10 text-indigo-400 px-2 py-0.5 rounded border border-indigo-500/20">
                    generativelanguage.googleapis.com
                  </span>
                </div>
              </div>

              {/* Model Selector */}
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-studio-textMuted">
                  {t('settings.modelLabel')}
                </label>
                <select
                  value={selectedModel}
                  onChange={(e) => {
                    setSelectedModel(e.target.value);
                    geminiProvider.setModel(e.target.value);
                  }}
                  className="w-full bg-studio-bg border border-studio-border focus:border-indigo-500 rounded-lg px-3 py-2 text-xs text-studio-text focus:outline-none"
                >
                  <option value="gemini-3-pro-image">
                    gemini-3-pro-image (Nano Banana Pro — Рекомендуется для фотореализма Archicad)
                  </option>
                  <option value="gemini-2.5-flash-image">
                    gemini-2.5-flash-image (Быстрый черновой рендер)
                  </option>
                  <option value="imagen-3.0-generate-002">
                    imagen-3.0-generate-002 (Imagen 3 High-Fidelity)
                  </option>
                </select>
              </div>

              {/* API Key Input */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-medium text-studio-textMuted flex items-center space-x-1.5">
                    <Key className="w-3.5 h-3.5 text-indigo-400" />
                    <span>{t('settings.apiKeyLabel')}</span>
                  </label>
                  <button
                    onClick={() => setShowKey(!showKey)}
                    className="text-[11px] text-indigo-400 hover:text-indigo-300"
                  >
                    {showKey ? t('action.hide') : t('action.show')}
                  </button>
                </div>
                <div className="flex items-center space-x-2">
                  <input
                    type={showKey ? 'text' : 'password'}
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    placeholder="AIzaSy..."
                    className="flex-1 bg-studio-bg border border-studio-border focus:border-indigo-500 rounded-lg px-3 py-2 text-xs font-mono text-studio-text focus:outline-none"
                  />
                  <button
                    onClick={handleSaveApiKey}
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-medium shadow-md transition-colors"
                  >
                    {isSaved ? t('action.saved') : t('action.save')}
                  </button>
                  <button
                    onClick={handleTestConnection}
                    disabled={isTesting || !apiKey}
                    className="px-4 py-2 bg-studio-surfaceHover hover:bg-studio-border border border-studio-border text-studio-text rounded-lg text-xs font-medium transition-colors flex items-center space-x-1.5"
                  >
                    {isTesting ? (
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <CheckCircle2 className="w-3.5 h-3.5 text-studio-success" />
                    )}
                    <span>{isTesting ? t('action.testing') : t('action.testConnection')}</span>
                  </button>
                </div>
                <div className="flex items-center space-x-1.5 text-[11px] text-studio-textSubtle pt-1">
                  <Lock className="w-3 h-3 text-studio-success" />
                  <span>{t('settings.keySecurityNotice')}</span>
                </div>
              </div>

              {/* Connection Test Output */}
              {testResult && (
                <div
                  className={`p-3 rounded-lg text-xs border flex items-start space-x-2.5 ${
                    testResult.success
                      ? 'bg-studio-success/10 border-studio-success/30 text-studio-success'
                      : 'bg-studio-danger/10 border-studio-danger/30 text-studio-danger'
                  }`}
                >
                  {testResult.success ? (
                    <CheckCircle2 className="w-4 h-4 flex-shrink-0 mt-0.5" />
                  ) : (
                    <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                  )}
                  <div className="flex-1">
                    <p className="font-medium">{testResult.message}</p>
                    {testResult.latencyMs && (
                      <p className="text-[11px] opacity-80 mt-0.5">
                        Пинг до Google Cloud: {testResult.latencyMs} мс
                      </p>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Provider 2: KREA AI */}
            <div className="hidden bg-studio-surface border border-studio-border rounded-xl p-5 space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-studio-border">
                <div className="flex items-center space-x-2">
                  <Zap className="w-4 h-4 text-amber-400" />
                  <span className="font-semibold text-sm text-white">
                    Krea AI (Flux / Realtime / Topaz 4K)
                  </span>
                </div>
                <div className="flex items-center space-x-2">
                  <span className="text-xs text-studio-textMuted">Endpoint:</span>
                  <span className="font-mono text-xs bg-amber-500/10 text-amber-400 px-2 py-0.5 rounded border border-amber-500/20">
                    api.krea.ai
                  </span>
                </div>
              </div>

              {/* Krea Model Selector */}
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-studio-textMuted">
                  Выбор модели Krea AI
                </label>
                <select
                  value={selectedKreaModel}
                  onChange={(e) => {
                    setSelectedKreaModel(e.target.value);
                    kreaProvider.setModel(e.target.value);
                  }}
                  className="w-full bg-studio-bg border border-studio-border focus:border-indigo-500 rounded-lg px-3 py-2 text-xs text-studio-text focus:outline-none"
                >
                  <option value="krea-3">
                    krea-3 (Krea 3 Ultra — Новейшая флагманская модель, Img2Img ArchViz)
                  </option>
                  <option value="krea-2-large">
                    krea-2-large (Krea 2 Large — Фотореализм и высокая детализация текстур)
                  </option>
                  <option value="krea-2-medium">
                    krea-2-medium (Krea 2 Medium — Быстрый & стабильный фоторендер интерьеров)
                  </option>
                </select>
              </div>

              {/* Krea API Key Input */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-medium text-studio-textMuted flex items-center space-x-1.5">
                    <Key className="w-3.5 h-3.5 text-amber-400" />
                    <span>{t('settings.kreaApiKeyLabel')}</span>
                  </label>
                  <button
                    onClick={() => setShowKreaKey(!showKreaKey)}
                    className="text-[11px] text-amber-400 hover:text-amber-300"
                  >
                    {showKreaKey ? t('action.hide') : t('action.show')}
                  </button>
                </div>
                <div className="flex items-center space-x-2">
                  <input
                    type={showKreaKey ? 'text' : 'password'}
                    value={kreaApiKey}
                    onChange={(e) => setKreaApiKey(e.target.value)}
                    placeholder="krea_api_..."
                    className="flex-1 bg-studio-bg border border-studio-border focus:border-indigo-500 rounded-lg px-3 py-2 text-xs font-mono text-studio-text focus:outline-none"
                  />
                  <button
                    onClick={handleSaveKreaApiKey}
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-medium shadow-md transition-colors"
                  >
                    {isKreaSaved ? t('action.saved') : t('action.save')}
                  </button>
                  <button
                    onClick={handleTestKreaConnection}
                    disabled={isTestingKrea || !kreaApiKey}
                    className="px-4 py-2 bg-studio-surfaceHover hover:bg-studio-border border border-studio-border text-studio-text rounded-lg text-xs font-medium transition-colors flex items-center space-x-1.5"
                  >
                    {isTestingKrea ? (
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <CheckCircle2 className="w-3.5 h-3.5 text-studio-success" />
                    )}
                    <span>{isTestingKrea ? t('action.testing') : t('action.testConnection')}</span>
                  </button>
                </div>
                <div className="flex items-center justify-between text-[11px] text-studio-textSubtle pt-1">
                  <span>{t('settings.kreaKeyNotice')}</span>
                  <a
                    href="https://www.krea.ai/api"
                    target="_blank"
                    rel="noreferrer"
                    className="text-amber-400 hover:underline flex items-center space-x-1"
                  >
                    <span>krea.ai/api</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              </div>

              {/* Krea Test Output */}
              {kreaTestResult && (
                <div
                  className={`p-3 rounded-lg text-xs border flex items-start space-x-2.5 ${
                    kreaTestResult.success
                      ? 'bg-studio-success/10 border-studio-success/30 text-studio-success'
                      : 'bg-studio-danger/10 border-studio-danger/30 text-studio-danger'
                  }`}
                >
                  {kreaTestResult.success ? (
                    <CheckCircle2 className="w-4 h-4 flex-shrink-0 mt-0.5" />
                  ) : (
                    <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                  )}
                  <div className="flex-1">
                    <p className="font-medium">{kreaTestResult.message}</p>
                    {kreaTestResult.latencyMs && (
                      <p className="text-[11px] opacity-80 mt-0.5">
                        Пинг до api.krea.ai: {kreaTestResult.latencyMs} мс
                      </p>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Provider 3: POLLINATIONS AI (100% FREE CLOUD) */}
            <div className="hidden bg-studio-surface border border-emerald-500/30 rounded-xl p-5 space-y-4 relative overflow-hidden">
              <div className="absolute top-0 right-0 bg-emerald-500/20 text-emerald-300 font-mono text-[10px] font-bold px-3 py-1 rounded-bl-lg border-b border-l border-emerald-500/30">
                100% БЕСПЛАТНО • БЕЗ КЛЮЧА
              </div>

              <div className="flex items-center justify-between pb-3 border-b border-studio-border">
                <div className="flex items-center space-x-2">
                  <Globe className="w-4 h-4 text-emerald-400" />
                  <span className="font-semibold text-sm text-white">
                    Pollinations AI (Облачный FLUX.1)
                  </span>
                </div>
                <div className="flex items-center space-x-2 pr-32">
                  <span className="text-xs text-studio-textMuted">Сервер:</span>
                  <span className="font-mono text-xs bg-emerald-500/10 text-emerald-400 px-2 py-0.5 rounded border border-emerald-500/20">
                    image.pollinations.ai
                  </span>
                </div>
              </div>

              <p className="text-xs text-studio-textMuted leading-relaxed">
                Генерация напрямую на облачных серверах Pollinations с архитектурными открытыми моделями FLUX.1.
                Работает сразу без регистрации, без привязки карт и без API-ключей (0.00$ за рендер).
              </p>

              {/* Model Selector */}
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-studio-textMuted">
                  Модель Pollinations AI
                </label>
                <select
                  value={pollinationsModel}
                  onChange={(e) => {
                    setPollinationsModel(e.target.value);
                    pollinationsProvider.setModel(e.target.value);
                  }}
                  className="w-full bg-studio-bg border border-studio-border focus:border-emerald-500 rounded-lg px-3 py-2 text-xs text-studio-text focus:outline-none"
                >
                  <option value="flux">flux (BFL FLUX.1 — Максимальный фотореализм интерьеров)</option>
                  <option value="flux-realism">flux-realism (Улучшенные архитектурные материалы и дневной свет)</option>
                  <option value="flux-3d">flux-3d (3D CGI ArchViz детализация)</option>
                  <option value="turbo">turbo (SDXL Turbo — Сверхбыстрый драфт)</option>
                </select>
              </div>

              {/* Optional Pollen Key Input */}
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-studio-textMuted flex items-center justify-between">
                  <span>Опциональный Pollen Key (для снятия 45с кулдауна):</span>
                  <span className="text-[10px] text-emerald-400 font-mono">Необязательно</span>
                </label>
                <div className="flex items-center space-x-2">
                  <input
                    type="text"
                    value={pollinationsKey}
                    onChange={(e) => setPollinationsKey(e.target.value)}
                    placeholder="Оставьте пустым для бесплатной работы или укажите pollen_..."
                    className="flex-1 bg-studio-bg border border-studio-border focus:border-emerald-500 rounded-lg px-3 py-2 text-xs font-mono text-studio-text focus:outline-none"
                  />
                  <button
                    onClick={handleSavePollinations}
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-medium transition-colors"
                  >
                    {isPollinationsSaved ? t('action.saved') : t('action.save')}
                  </button>
                  <button
                    onClick={handleTestPollinations}
                    disabled={isTestingPollinations}
                    className="px-4 py-2 bg-studio-surfaceHover hover:bg-studio-border border border-studio-border text-studio-text rounded-lg text-xs font-medium transition-colors flex items-center space-x-1.5"
                  >
                    {isTestingPollinations ? (
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                    )}
                    <span>{isTestingPollinations ? t('action.testing') : 'Проверить сервер'}</span>
                  </button>
                </div>
              </div>

              {/* Pollinations Test Result */}
              {pollinationsTestResult && (
                <div
                  className={`p-3 rounded-lg text-xs border flex items-start space-x-2.5 ${
                    pollinationsTestResult.success
                      ? 'bg-studio-success/10 border-studio-success/30 text-studio-success'
                      : 'bg-studio-danger/10 border-studio-danger/30 text-studio-danger'
                  }`}
                >
                  {pollinationsTestResult.success ? (
                    <CheckCircle2 className="w-4 h-4 flex-shrink-0 mt-0.5" />
                  ) : (
                    <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                  )}
                  <div className="flex-1">
                    <p className="font-medium">{pollinationsTestResult.message}</p>
                    {pollinationsTestResult.latencyMs && (
                      <p className="text-[11px] opacity-80 mt-0.5">
                        Пинг до image.pollinations.ai: {pollinationsTestResult.latencyMs} мс
                      </p>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Provider 4: AI HORDE (FREE GPU GRID IMG2IMG) */}
            <div className="hidden bg-studio-surface border border-indigo-500/30 rounded-xl p-5 space-y-4 relative overflow-hidden">
              <div className="absolute top-0 right-0 bg-indigo-500/20 text-indigo-300 font-mono text-[10px] font-bold px-3 py-1 rounded-bl-lg border-b border-l border-indigo-500/30">
                БЕСПЛАТНО • ОБЛАЧНЫЙ IMG2IMG
              </div>

              <div className="flex items-center justify-between pb-3 border-b border-studio-border">
                <div className="flex items-center space-x-2">
                  <Server className="w-4 h-4 text-indigo-400" />
                  <span className="font-semibold text-sm text-white">
                    AI Horde (Децентрализованная облачная сеть GPU)
                  </span>
                </div>
                <div className="flex items-center space-x-2 pr-32">
                  <span className="text-xs text-studio-textMuted">Сеть:</span>
                  <span className="font-mono text-xs bg-indigo-500/10 text-indigo-400 px-2 py-0.5 rounded border border-indigo-500/20">
                    aihorde.net
                  </span>
                </div>
              </div>

              <p className="text-xs text-studio-textMuted leading-relaxed">
                Децентрализованная сеть сотен волонтерских GPU серверов. Поддерживает полноценный Img2Img — 
                накладывает фотореалистичные материалы прямо поверх 3D геометрии стен белого рендера Archicad.
              </p>

              {/* Model Selector */}
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-studio-textMuted">
                  Модель AI Horde
                </label>
                <select
                  value={aiHordeModel}
                  onChange={(e) => {
                    setAiHordeModel(e.target.value);
                    aiHordeProvider.setModel(e.target.value);
                  }}
                  className="w-full bg-studio-bg border border-studio-border focus:border-indigo-500 rounded-lg px-3 py-2 text-xs text-studio-text focus:outline-none"
                >
                  <option value="stable_diffusion">stable_diffusion (Архитектурный фоторендер SD 1.5)</option>
                  <option value="ICBINP - I Can't Believe It's Not Photography">ICBINP (Ультра-фотореализм поверх геометрии)</option>
                  <option value="Deliberate">Deliberate (Сбалансированный современный интерьер)</option>
                  <option value="DreamShaper">DreamShaper (Художественное освещение)</option>
                  <option value="SDXL 1.0">SDXL 1.0 (Высокое разрешение)</option>
                </select>
              </div>

              {/* API Key */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-medium text-studio-textMuted">
                    API-ключ AI Horde (по умолчанию 0000000000 анонимный):
                  </label>
                  <a
                    href="https://aihorde.net/register"
                    target="_blank"
                    rel="noreferrer"
                    className="text-[11px] text-indigo-400 hover:underline flex items-center space-x-1"
                  >
                    <span>Бесплатная регистрация (приоритет в очереди)</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
                <div className="flex items-center space-x-2">
                  <input
                    type="text"
                    value={aiHordeKey}
                    onChange={(e) => setAiHordeKey(e.target.value)}
                    placeholder="0000000000"
                    className="flex-1 bg-studio-bg border border-studio-border focus:border-indigo-500 rounded-lg px-3 py-2 text-xs font-mono text-studio-text focus:outline-none"
                  />
                  <button
                    onClick={handleSaveHorde}
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-medium transition-colors"
                  >
                    {isHordeSaved ? t('action.saved') : t('action.save')}
                  </button>
                  <button
                    onClick={handleTestHorde}
                    disabled={isTestingHorde}
                    className="px-4 py-2 bg-studio-surfaceHover hover:bg-studio-border border border-studio-border text-studio-text rounded-lg text-xs font-medium transition-colors flex items-center space-x-1.5"
                  >
                    {isTestingHorde ? (
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <CheckCircle2 className="w-3.5 h-3.5 text-indigo-400" />
                    )}
                    <span>{isTestingHorde ? t('action.testing') : 'Проверить GPU сеть'}</span>
                  </button>
                </div>
              </div>

              {/* AI Horde Test Result */}
              {hordeTestResult && (
                <div
                  className={`p-3 rounded-lg text-xs border flex items-start space-x-2.5 ${
                    hordeTestResult.success
                      ? 'bg-studio-success/10 border-studio-success/30 text-studio-success'
                      : 'bg-studio-danger/10 border-studio-danger/30 text-studio-danger'
                  }`}
                >
                  {hordeTestResult.success ? (
                    <CheckCircle2 className="w-4 h-4 flex-shrink-0 mt-0.5" />
                  ) : (
                    <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                  )}
                  <div className="flex-1">
                    <p className="font-medium">{hordeTestResult.message}</p>
                    {hordeTestResult.latencyMs && (
                      <p className="text-[11px] opacity-80 mt-0.5">
                        Пинг до aihorde.net: {hordeTestResult.latencyMs} мс
                      </p>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Provider 5: COMFYUI LOCAL SERVER (NVIDIA RTX 4050 6GB) */}
            <div className="bg-studio-surface border border-studio-cyan/40 rounded-xl p-5 space-y-5 relative overflow-hidden shadow-lg shadow-studio-cyan/5">
              <div className="absolute top-0 right-0 bg-studio-cyan/20 text-studio-cyan font-mono text-[10px] font-bold px-3 py-1 rounded-bl-lg border-b border-l border-studio-cyan/30 flex items-center space-x-1">
                <Zap className="w-3 h-3 text-studio-cyan" />
                <span>100% БЕСПЛАТНО • NVIDIA RTX 4050 6GB</span>
              </div>

              <div className="flex items-center justify-between pb-3 border-b border-studio-border">
                <div className="flex items-center space-x-2.5">
                  <Cpu className="w-5 h-5 text-studio-cyan" />
                  <div>
                    <div className="flex items-center space-x-2">
                      <span className="font-semibold text-sm text-white">
                        ComfyUI (Локальный сервер • RTX 4050 Laptop)
                      </span>
                      {comfyStatus?.online ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse mr-1" />
                          Онлайн: 8188
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-zinc-800 text-zinc-400 border border-zinc-700">
                          <span className="w-1.5 h-1.5 rounded-full bg-zinc-500 mr-1" />
                          Выключен
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-studio-textMuted mt-0.5">
                      Прямая интеграция с локальным сервером для неограниченного рендеринга без интернета
                    </p>
                  </div>
                </div>
              </div>

              {/* Server Control Center */}
              <div className="bg-studio-bg/60 border border-studio-border/70 rounded-xl p-3.5 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-white flex items-center space-x-1.5">
                    <Server className="w-3.5 h-3.5 text-studio-cyan" />
                    <span>Управление локальной службой ComfyUI</span>
                  </span>
                  <button
                    onClick={handleOpenComfyUIWeb}
                    className="text-[11px] text-studio-cyan hover:underline flex items-center space-x-1 font-mono"
                  >
                    <span>Открыть ComfyUI в браузере (127.0.0.1:8188)</span>
                    <ExternalLink className="w-3 h-3" />
                  </button>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  <button
                    onClick={handleLaunchComfyUI}
                    disabled={isLaunchingComfyUI || comfyStatus?.online}
                    className={`py-2 px-3 rounded-lg text-xs font-medium border flex items-center justify-center space-x-1.5 transition-all ${
                      comfyStatus?.online
                        ? 'bg-zinc-900/50 text-zinc-600 border-zinc-800 cursor-not-allowed'
                        : 'bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border-emerald-500/40 active:scale-[0.98]'
                    }`}
                  >
                    {isLaunchingComfyUI ? (
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Play className="w-3.5 h-3.5 text-emerald-400 fill-emerald-400/30" />
                    )}
                    <span>{isLaunchingComfyUI ? 'Запуск...' : 'Старт'}</span>
                  </button>

                  <button
                    onClick={handleStopComfyUI}
                    disabled={isStoppingComfyUI || !comfyStatus?.online}
                    className={`py-2 px-3 rounded-lg text-xs font-medium border flex items-center justify-center space-x-1.5 transition-all ${
                      !comfyStatus?.online
                        ? 'bg-zinc-900/50 text-zinc-600 border-zinc-800 cursor-not-allowed'
                        : 'bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border-rose-500/40 active:scale-[0.98]'
                    }`}
                  >
                    {isStoppingComfyUI ? (
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Square className="w-3.5 h-3.5 text-rose-400 fill-rose-400/30" />
                    )}
                    <span>{isStoppingComfyUI ? 'Остановка...' : 'Стоп'}</span>
                  </button>

                  <button
                    onClick={async () => {
                      await handleStopComfyUI();
                      setTimeout(() => handleLaunchComfyUI(), 1000);
                    }}
                    className="py-2 px-3 rounded-lg text-xs font-medium border border-studio-border bg-studio-surfaceHover hover:bg-studio-border text-white flex items-center justify-center space-x-1.5 transition-all active:scale-[0.98]"
                  >
                    <RotateCw className="w-3.5 h-3.5 text-amber-400" />
                    <span>Перезапуск</span>
                  </button>

                  <button
                    onClick={handleTestComfyUI}
                    disabled={isTestingComfyUI}
                    className="py-2 px-3 rounded-lg text-xs font-medium border border-studio-cyan/40 bg-studio-cyan/15 hover:bg-studio-cyan/25 text-studio-cyan flex items-center justify-center space-x-1.5 transition-all active:scale-[0.98]"
                  >
                    {isTestingComfyUI ? (
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <CheckCircle2 className="w-3.5 h-3.5" />
                    )}
                    <span>Пинг 8188</span>
                  </button>
                </div>
              </div>

              {/* Custom Directories & Models Path Settings */}
              <div className="bg-studio-bg/60 border border-studio-border/70 rounded-xl p-3.5 space-y-3.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <HardDrive className="w-4 h-4 text-studio-cyan" />
                    <span className="text-xs font-semibold text-white">
                      Пути к ComfyUI и моделям нейросетей
                    </span>
                  </div>
                  <span className="text-[10px] text-studio-textMuted font-mono">
                    extra_model_paths.yaml
                  </span>
                </div>

                {/* ComfyUI Install Folder */}
                <div className="space-y-1">
                  <label className="text-[11px] font-medium text-studio-textMuted flex items-center justify-between">
                    <span>Папка установки ComfyUI:</span>
                    <span className="text-[10px] text-zinc-500">где main.py или run_nvidia_gpu.bat</span>
                  </label>
                  <div className="flex items-center space-x-2">
                    <input
                      type="text"
                      value={comfyuiPath}
                      onChange={(e) => setComfyuiPath(e.target.value)}
                      placeholder="D:\AI\ComfyUI_windows_portable"
                      className="flex-1 bg-studio-bg border border-studio-border focus:border-studio-cyan rounded-lg px-3 py-1.5 text-xs font-mono text-studio-text focus:outline-none"
                    />
                    <button
                      onClick={handleSelectComfyUIDir}
                      className="px-3 py-1.5 bg-studio-surfaceHover hover:bg-studio-border border border-studio-border text-white rounded-lg text-xs font-medium transition-colors flex items-center space-x-1.5"
                    >
                      <Folder className="w-3.5 h-3.5 text-studio-cyan" />
                      <span>Обзор...</span>
                    </button>
                  </div>
                </div>

                {/* Models Folder */}
                <div className="space-y-1">
                  <label className="text-[11px] font-medium text-studio-textMuted flex items-center justify-between">
                    <span>Папка с моделями нейросетей (Checkpoints, ControlNet, LoRA):</span>
                    <span className="text-[10px] text-zinc-500">например D:\AI\models</span>
                  </label>
                  <div className="flex items-center space-x-2">
                    <input
                      type="text"
                      value={modelsPath}
                      onChange={(e) => setModelsPath(e.target.value)}
                      placeholder="D:\AI\models"
                      className="flex-1 bg-studio-bg border border-studio-border focus:border-studio-cyan rounded-lg px-3 py-1.5 text-xs font-mono text-studio-text focus:outline-none"
                    />
                    <button
                      onClick={handleSelectModelsDir}
                      className="px-3 py-1.5 bg-studio-surfaceHover hover:bg-studio-border border border-studio-border text-white rounded-lg text-xs font-medium transition-colors flex items-center space-x-1.5"
                    >
                      <Folder className="w-3.5 h-3.5 text-studio-cyan" />
                      <span>Обзор...</span>
                    </button>
                  </div>
                </div>

                {/* Save Paths & Sync Button */}
                <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={handleSaveCustomPaths}
                      disabled={isSavingPaths}
                      className="px-4 py-2 bg-studio-cyan/20 hover:bg-studio-cyan/30 text-studio-cyan border border-studio-cyan/40 rounded-lg text-xs font-semibold transition-all flex items-center space-x-1.5 active:scale-[0.98]"
                    >
                      {isSavingPaths ? (
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Check className="w-3.5 h-3.5" />
                      )}
                      <span>Сохранить пути и обновить ComfyUI</span>
                    </button>

                    <button
                      onClick={handleScanModels}
                      disabled={isScanningModels}
                      className="px-3 py-2 bg-studio-surfaceHover hover:bg-studio-border border border-studio-border text-studio-text rounded-lg text-xs font-medium transition-colors flex items-center space-x-1.5"
                    >
                      {isScanningModels ? (
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <RefreshCw className="w-3.5 h-3.5 text-studio-cyan" />
                      )}
                      <span>Просканировать модели</span>
                    </button>
                  </div>

                  <button
                    onClick={handleOpenModelsFolder}
                    className="text-xs text-studio-cyan hover:underline flex items-center space-x-1"
                  >
                    <FolderOpen className="w-3.5 h-3.5" />
                    <span>Открыть папку в Explorer</span>
                  </button>
                </div>

                {pathsSaveMessage && (
                  <p className="text-xs text-emerald-400 font-medium bg-emerald-500/10 border border-emerald-500/20 px-3 py-1.5 rounded-lg">
                    {pathsSaveMessage}
                  </p>
                )}

                {/* Models Scan Inventory Badge Results */}
                {modelsScanResult && (
                  <div className="mt-2 bg-studio-bg/80 border border-studio-border/50 rounded-lg p-3 space-y-2">
                    <div className="flex items-center justify-between text-xs font-medium text-white pb-1.5 border-b border-studio-border/40">
                      <span>Найдено моделей: {modelsScanResult.totalCount} шт.</span>
                      <span className="font-mono text-studio-cyan text-[11px]">
                        {(modelsScanResult.totalBytes / (1024 * 1024 * 1024)).toFixed(1)} GB данных
                      </span>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-center">
                      <div className="bg-studio-surface p-2 rounded-lg border border-studio-border">
                        <div className="text-[10px] text-studio-textMuted uppercase">Checkpoints</div>
                        <div className="text-sm font-bold text-studio-cyan mt-0.5">
                          {modelsScanResult.checkpoints.length}
                        </div>
                      </div>
                      <div className="bg-studio-surface p-2 rounded-lg border border-studio-border">
                        <div className="text-[10px] text-studio-textMuted uppercase">ControlNet</div>
                        <div className="text-sm font-bold text-amber-400 mt-0.5">
                          {modelsScanResult.controlnet.length}
                        </div>
                      </div>
                      <div className="bg-studio-surface p-2 rounded-lg border border-studio-border">
                        <div className="text-[10px] text-studio-textMuted uppercase">LoRA</div>
                        <div className="text-sm font-bold text-indigo-400 mt-0.5">
                          {modelsScanResult.loras.length}
                        </div>
                      </div>
                      <div className="bg-studio-surface p-2 rounded-lg border border-studio-border">
                        <div className="text-[10px] text-studio-textMuted uppercase">VAE</div>
                        <div className="text-sm font-bold text-emerald-400 mt-0.5">
                          {modelsScanResult.vae.length}
                        </div>
                      </div>
                      <div className="bg-studio-surface p-2 rounded-lg border border-studio-border">
                        <div className="text-[10px] text-studio-cyan uppercase font-bold">Upscale AI</div>
                        <div className="text-sm font-bold text-studio-cyan mt-0.5">
                          {(modelsScanResult.upscale_models || []).length}
                        </div>
                      </div>
                    </div>

                    {(modelsScanResult.upscale_models && modelsScanResult.upscale_models.length > 0) && (
                      <div className="pt-1 text-[11px] text-zinc-400 space-y-1">
                        <span className="font-semibold text-studio-cyan">AI Апскейлеры 4K:</span>
                        <ul className="list-disc list-inside space-y-0.5 text-[10px] font-mono text-zinc-300">
                          {modelsScanResult.upscale_models.map((m: any, idx: number) => (
                            <li key={idx} className="truncate">
                              {m.name} <span className="text-studio-cyan">({m.sizeGb})</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {modelsScanResult.checkpoints.length > 0 && (
                      <div className="pt-1 text-[11px] text-zinc-400 space-y-1">
                        <span className="font-semibold text-zinc-300">Обнаруженные чекпоинты:</span>
                        <ul className="list-disc list-inside space-y-0.5 text-[10px] font-mono text-zinc-400">
                          {modelsScanResult.checkpoints.slice(0, 4).map((m, idx) => (
                            <li key={idx} className="truncate">
                              {m.name} <span className="text-studio-cyan">({m.sizeGb})</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Model Selector */}
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-studio-textMuted">
                  Активная локальная модель ComfyUI:
                </label>
                <select
                  value={comfyuiModel}
                  onChange={(e) => {
                    setComfyuiModel(e.target.value);
                    comfyuiProvider.setModel(e.target.value);
                  }}
                  className="w-full bg-studio-bg border border-studio-border focus:border-studio-cyan rounded-lg px-3 py-2 text-xs text-studio-text focus:outline-none"
                >
                  <option value="comfyui-sdxl">
                    ComfyUI + SDXL (Juggernaut XL v9 — Основной фотореалистичный движок, 25-45 шагов)
                  </option>
                  <option value="comfyui-z-image-turbo">
                    Z-Image Turbo 8-Steps (Официальный шаблон ComfyUI.org — Молниеносный скетч-в-рендер, 8 шагов)
                  </option>
                  <option value="comfyui-flux-schnell">
                    ComfyUI + FLUX Schnell FP8 (Эксперименты со сложным светом, 4-8 шагов, квантован под 6GB)
                  </option>
                </select>
              </div>

              {/* Server URL and Test */}
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-studio-textMuted">
                  URL локального ComfyUI API:
                </label>
                <div className="flex items-center space-x-2">
                  <input
                    type="text"
                    value={comfyuiUrl}
                    onChange={(e) => setComfyuiUrl(e.target.value)}
                    placeholder="http://127.0.0.1:8188"
                    className="flex-1 bg-studio-bg border border-studio-border focus:border-studio-cyan rounded-lg px-3 py-2 text-xs font-mono text-studio-text focus:outline-none"
                  />
                  <button
                    onClick={handleSaveComfyUI}
                    className="px-4 py-2 bg-studio-cyan/20 hover:bg-studio-cyan/30 text-studio-cyan border border-studio-cyan/40 rounded-lg text-xs font-medium transition-colors"
                  >
                    {isComfyuiSaved ? t('action.saved') : t('action.save')}
                  </button>
                  <button
                    onClick={handleTestComfyUI}
                    disabled={isTestingComfyUI}
                    className="px-4 py-2 bg-studio-surfaceHover hover:bg-studio-border border border-studio-border text-studio-text rounded-lg text-xs font-medium transition-colors flex items-center space-x-1.5"
                  >
                    {isTestingComfyUI ? (
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <CheckCircle2 className="w-3.5 h-3.5 text-studio-cyan" />
                    )}
                    <span>{isTestingComfyUI ? t('action.testing') : 'Проверить 127.0.0.1:8188'}</span>
                  </button>
                </div>
              </div>

              {/* ComfyUI Test Result */}
              {comfyuiTestResult && (
                <div
                  className={`p-3 rounded-lg text-xs border flex items-start space-x-2.5 ${
                    comfyuiTestResult.success
                      ? 'bg-studio-success/10 border-studio-success/30 text-studio-success'
                      : 'bg-studio-danger/10 border-studio-danger/30 text-studio-danger'
                  }`}
                >
                  {comfyuiTestResult.success ? (
                    <CheckCircle2 className="w-4 h-4 flex-shrink-0 mt-0.5" />
                  ) : (
                    <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                  )}
                  <div className="flex-1">
                    <p className="font-medium">{comfyuiTestResult.message}</p>
                    {comfyuiTestResult.latencyMs && (
                      <p className="text-[11px] opacity-80 mt-0.5">
                        Пинг до ComfyUI: {comfyuiTestResult.latencyMs} мс
                      </p>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Provider 6: LOCAL SD / AUTOMATIC1111 / FORGE (7860) */}
            <div className="hidden bg-studio-surface border border-studio-cyan/30 rounded-xl p-5 space-y-4 relative overflow-hidden">
              <div className="absolute top-0 right-0 bg-studio-cyan/20 text-studio-cyan font-mono text-[10px] font-bold px-3 py-1 rounded-bl-lg border-b border-l border-studio-cyan/30">
                БЕСПЛАТНО • ЛОКАЛЬНЫЙ GPU
              </div>

              <div className="flex items-center justify-between pb-3 border-b border-studio-border">
                <div className="flex items-center space-x-2">
                  <Cpu className="w-4 h-4 text-studio-cyan" />
                  <span className="font-semibold text-sm text-white">
                    Local SD WebUI / ComfyUI Server
                  </span>
                </div>
                <div className="flex items-center space-x-2 pr-32">
                  <span className="text-xs text-studio-textMuted">Адрес:</span>
                  <span className="font-mono text-xs bg-studio-cyan/10 text-studio-cyan px-2 py-0.5 rounded border border-studio-cyan/20">
                    127.0.0.1:7860
                  </span>
                </div>
              </div>

              <p className="text-xs text-studio-textMuted leading-relaxed">
                Подключение к локальному серверу Stable Diffusion (Automatic1111, WebUI Forge, ComfyUI). 
                Генерирует на вашей видеокарте без интернета, без задержек и без ограничений на количество рендеров.
              </p>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-studio-textMuted">
                  URL локального API:
                </label>
                <div className="flex items-center space-x-2">
                  <input
                    type="text"
                    value={localSDUrl}
                    onChange={(e) => setLocalSDUrl(e.target.value)}
                    placeholder="http://127.0.0.1:7860"
                    className="flex-1 bg-studio-bg border border-studio-border focus:border-studio-cyan rounded-lg px-3 py-2 text-xs font-mono text-studio-text focus:outline-none"
                  />
                  <button
                    onClick={handleSaveLocalSD}
                    className="px-4 py-2 bg-studio-cyan/20 hover:bg-studio-cyan/30 text-studio-cyan border border-studio-cyan/40 rounded-lg text-xs font-medium transition-colors"
                  >
                    {isLocalSDSaved ? t('action.saved') : t('action.save')}
                  </button>
                  <button
                    onClick={handleTestLocalSD}
                    disabled={isTestingLocalSD}
                    className="px-4 py-2 bg-studio-surfaceHover hover:bg-studio-border border border-studio-border text-studio-text rounded-lg text-xs font-medium transition-colors flex items-center space-x-1.5"
                  >
                    {isTestingLocalSD ? (
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <CheckCircle2 className="w-3.5 h-3.5 text-studio-cyan" />
                    )}
                    <span>{isTestingLocalSD ? t('action.testing') : 'Проверить 127.0.0.1'}</span>
                  </button>
                </div>
              </div>

              {localSDTestResult && (
                <div
                  className={`p-3 rounded-lg text-xs border flex items-start space-x-2.5 ${
                    localSDTestResult.success
                      ? 'bg-studio-success/10 border-studio-success/30 text-studio-success'
                      : 'bg-studio-danger/10 border-studio-danger/30 text-studio-danger'
                  }`}
                >
                  {localSDTestResult.success ? (
                    <CheckCircle2 className="w-4 h-4 flex-shrink-0 mt-0.5" />
                  ) : (
                    <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                  )}
                  <div className="flex-1">
                    <p className="font-medium">{localSDTestResult.message}</p>
                  </div>
                </div>
              )}
            </div>

            {/* Provider 6: HUGGING FACE INFERENCE (FREE TIER) */}
            <div className="hidden bg-studio-surface border border-studio-border rounded-xl p-5 space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-studio-border">
                <div className="flex items-center space-x-2">
                  <span className="text-base">🤗</span>
                  <span className="font-semibold text-sm text-white">
                    Hugging Face Serverless (Free Tier)
                  </span>
                </div>
                <div className="flex items-center space-x-2">
                  <span className="text-xs text-studio-textMuted">Endpoint:</span>
                  <span className="font-mono text-xs bg-amber-500/10 text-amber-400 px-2 py-0.5 rounded border border-amber-500/20">
                    router.huggingface.co
                  </span>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-studio-textMuted">
                  Модель Hugging Face
                </label>
                <select
                  value={hfModel}
                  onChange={(e) => {
                    setHfModel(e.target.value);
                    huggingFaceProvider.setModel(e.target.value);
                  }}
                  className="w-full bg-studio-bg border border-studio-border focus:border-indigo-500 rounded-lg px-3 py-2 text-xs text-studio-text focus:outline-none"
                >
                  <option value="black-forest-labs/FLUX.1-schnell">black-forest-labs/FLUX.1-schnell (Быстрый 4-step FLUX)</option>
                  <option value="stabilityai/stable-diffusion-xl-base-1.0">stabilityai/stable-diffusion-xl-base-1.0 (SDXL)</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-medium text-studio-textMuted">
                    Бесплатный токен Hugging Face (hf_...):
                  </label>
                  <a
                    href="https://huggingface.co/settings/tokens"
                    target="_blank"
                    rel="noreferrer"
                    className="text-[11px] text-amber-400 hover:underline flex items-center space-x-1"
                  >
                    <span>huggingface.co/settings/tokens</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
                <div className="flex items-center space-x-2">
                  <input
                    type="password"
                    value={hfKey}
                    onChange={(e) => setHfKey(e.target.value)}
                    placeholder="hf_..."
                    className="flex-1 bg-studio-bg border border-studio-border focus:border-indigo-500 rounded-lg px-3 py-2 text-xs font-mono text-studio-text focus:outline-none"
                  />
                  <button
                    onClick={handleSaveHF}
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-medium transition-colors"
                  >
                    {isHFSaved ? t('action.saved') : t('action.save')}
                  </button>
                  <button
                    onClick={handleTestHF}
                    disabled={isTestingHF}
                    className="px-4 py-2 bg-studio-surfaceHover hover:bg-studio-border border border-studio-border text-studio-text rounded-lg text-xs font-medium transition-colors flex items-center space-x-1.5"
                  >
                    {isTestingHF ? (
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <CheckCircle2 className="w-3.5 h-3.5 text-studio-success" />
                    )}
                    <span>{isTestingHF ? t('action.testing') : t('action.testConnection')}</span>
                  </button>
                </div>
              </div>

              {hfTestResult && (
                <div
                  className={`p-3 rounded-lg text-xs border flex items-start space-x-2.5 ${
                    hfTestResult.success
                      ? 'bg-studio-success/10 border-studio-success/30 text-studio-success'
                      : 'bg-studio-danger/10 border-studio-danger/30 text-studio-danger'
                  }`}
                >
                  {hfTestResult.success ? (
                    <CheckCircle2 className="w-4 h-4 flex-shrink-0 mt-0.5" />
                  ) : (
                    <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                  )}
                  <div className="flex-1">
                    <p className="font-medium">{hfTestResult.message}</p>
                    {hfTestResult.latencyMs && (
                      <p className="text-[11px] opacity-80 mt-0.5">
                        Пинг: {hfTestResult.latencyMs} мс
                      </p>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 2: BUDGET & COST CONTROL */}
        {activeTab === 'budget' && (
          <div className="space-y-6">
            <div>
              <h1 className="text-xl font-bold text-white mb-1">{t('settings.budgetTitle')}</h1>
              <p className="text-xs text-studio-textMuted">
                {t('settings.budgetDesc')}
              </p>
            </div>

            {/* Live Metrics Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="bg-studio-surface border border-studio-border rounded-xl p-4">
                <span className="text-[11px] text-studio-textMuted block">Израсходовано за сессию:</span>
                <span className="text-xl font-mono font-bold text-emerald-400 mt-1 block">
                  ${costSummary.sessionSpend.toFixed(3)}
                </span>
                <span className="text-[10px] text-studio-textSubtle font-mono">
                  Лимит: {costSummary.budgetLimit > 0 ? `$${costSummary.budgetLimit.toFixed(2)}` : '∞ без лимита'}
                </span>
              </div>

              <div className="bg-studio-surface border border-studio-border rounded-xl p-4">
                <span className="text-[11px] text-studio-textMuted block">Рендеров в этой сессии:</span>
                <span className="text-xl font-mono font-bold text-white mt-1 block">
                  {costSummary.sessionGenerations}
                </span>
                <span className="text-[10px] text-studio-textSubtle">Активная сессия</span>
              </div>

              <div className="bg-studio-surface border border-studio-border rounded-xl p-4">
                <span className="text-[11px] text-studio-textMuted block">Всего расходов (All-Time):</span>
                <span className="text-xl font-mono font-bold text-indigo-400 mt-1 block">
                  ${costSummary.totalSpend.toFixed(3)}
                </span>
                <span className="text-[10px] text-studio-textSubtle">За весь период</span>
              </div>

              <div className="bg-studio-surface border border-studio-border rounded-xl p-4">
                <span className="text-[11px] text-studio-textMuted block">Всего генераций:</span>
                <span className="text-xl font-mono font-bold text-white mt-1 block">
                  {costSummary.totalGenerations}
                </span>
                <span className="text-[10px] text-studio-textSubtle">В базе SQLite</span>
              </div>
            </div>

            {/* Verified Exact Pricing Matrix */}
            <div className="bg-studio-surface border border-studio-border rounded-xl p-5 space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-studio-border">
                <div className="flex items-center space-x-2">
                  <DollarSign className="w-4 h-4 text-emerald-400" />
                  <span className="font-semibold text-sm text-white">
                    Сравнительная сетка официальных тарифов API
                  </span>
                </div>
                <span className="text-[11px] font-mono text-studio-textMuted">
                  USD за 1 сгенерированное изображение
                </span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left">
                  <thead>
                    <tr className="border-b border-studio-border text-studio-textMuted font-mono text-[11px]">
                      <th className="py-2 px-3">Разрешение</th>
                      <th className="py-2 px-3">Пиксели / Назначение</th>
                      <th className="py-2 px-3">Pollinations FLUX / AI Horde</th>
                      <th className="py-2 px-3">Krea AI (Flux / Topaz)</th>
                      <th className="py-2 px-3">Google Gemini 3 Pro (Nano Banana)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-studio-border/60 font-mono">
                    <tr className="hover:bg-studio-surfaceLight/50">
                      <td className="py-2.5 px-3 font-semibold text-white">1K (Draft)</td>
                      <td className="py-2.5 px-3 text-studio-textSubtle">1024 × 1024 (Быстрый драфт)</td>
                      <td className="py-2.5 px-3 text-emerald-400 font-bold">$0.000 (БЕСПЛАТНО)</td>
                      <td className="py-2.5 px-3 text-amber-300 font-bold">$0.025</td>
                      <td className="py-2.5 px-3 text-studio-text">$0.134</td>
                    </tr>
                    <tr className="hover:bg-studio-surfaceLight/50">
                      <td className="py-2.5 px-3 font-semibold text-white">2K (Standard HD)</td>
                      <td className="py-2.5 px-3 text-studio-textSubtle">2048 × 1152 (Основная визуализация)</td>
                      <td className="py-2.5 px-3 text-emerald-400 font-bold">$0.000 (БЕСПЛАТНО)</td>
                      <td className="py-2.5 px-3 text-amber-300">$0.045</td>
                      <td className="py-2.5 px-3 text-studio-text">$0.139</td>
                    </tr>
                    <tr className="hover:bg-studio-surfaceLight/50">
                      <td className="py-2.5 px-3 font-semibold text-white">4K (Ultra ArchViz)</td>
                      <td className="py-2.5 px-3 text-studio-textSubtle">3840 × 2160 (Буклеты / Печать)</td>
                      <td className="py-2.5 px-3 text-emerald-400 font-bold">$0.000 (БЕСПЛАТНО)</td>
                      <td className="py-2.5 px-3 text-amber-300">$0.090 (Topaz Enhance)</td>
                      <td className="py-2.5 px-3 text-amber-400 font-bold">$0.240 (2520 tokens)</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            {/* Session Budget Controls */}
            <div className="bg-studio-surface border border-studio-border rounded-xl p-5 space-y-4">
              <h3 className="text-sm font-semibold text-white">
                Параметры безопасности и контроль сессии
              </h3>

              <div className="space-y-2">
                <label className="text-xs font-medium text-studio-textMuted block">
                  {t('settings.sessionBudgetSetting')}
                </label>
                <div className="flex items-center space-x-2">
                  {[1, 2, 5, 10, 0].map((val) => (
                    <button
                      key={val}
                      onClick={() => handleSaveBudgetLimit(val)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-mono font-medium border transition-colors ${
                        costSummary.budgetLimit === val
                          ? 'bg-emerald-600/20 border-emerald-500 text-emerald-300'
                          : 'bg-studio-bg border-studio-border text-studio-textMuted hover:text-white'
                      }`}
                    >
                      {val === 0 ? 'Без лимита' : `$${val}.00`}
                    </button>
                  ))}
                  <div className="flex items-center space-x-1 pl-2">
                    <span className="text-xs text-studio-textMuted">$</span>
                    <input
                      type="number"
                      step="0.5"
                      min="0"
                      value={budgetLimitInput}
                      onChange={(e) => handleSaveBudgetLimit(parseFloat(e.target.value) || 0)}
                      className="w-20 bg-studio-bg border border-studio-border rounded p-1 text-xs font-mono text-white"
                    />
                  </div>
                </div>
                <p className="text-[11px] text-studio-textSubtle leading-relaxed">
                  {t('settings.sessionBudgetDesc')}
                </p>
              </div>

              {/* Warning Toggle */}
              <div className="pt-2 border-t border-studio-border">
                <label className="flex items-center space-x-2.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={costSummary.warnOnExpensive}
                    onChange={(e) => handleToggleWarnExpensive(e.target.checked)}
                    className="rounded border-studio-border bg-studio-bg text-indigo-600 focus:ring-0"
                  />
                  <span className="text-xs text-studio-text">
                    {t('settings.warnExpensiveSetting')}
                  </span>
                </label>
              </div>

              {/* Reset Session Spend */}
              <div className="pt-3 border-t border-studio-border flex justify-end">
                <button
                  onClick={() => costTracker.resetSession()}
                  className="px-3 py-1.5 bg-studio-surfaceHover hover:bg-studio-border border border-studio-border rounded-lg text-xs text-studio-text font-medium transition-colors"
                >
                  {t('settings.resetSessionBtn')}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: LANGUAGE SELECTION */}
        {activeTab === 'language' && (
          <div className="space-y-6">
            <div>
              <h1 className="text-xl font-bold text-white mb-1">{t('settings.languageTitle')}</h1>
              <p className="text-xs text-studio-textMuted">
                {t('settings.languageDesc')}
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {LANGUAGES.map((lang) => {
                const isSelected = language === lang.code;
                return (
                  <button
                    key={lang.code}
                    onClick={() => setLanguage(lang.code as Language)}
                    className={`p-4 rounded-xl border text-left transition-all relative ${
                      isSelected
                        ? 'bg-indigo-600/15 border-indigo-500 text-white shadow-md shadow-indigo-500/10'
                        : 'bg-studio-surface border-studio-border hover:border-studio-borderHover text-studio-textMuted hover:text-white'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-2xl">{lang.flag}</span>
                      {isSelected && (
                        <span className="w-5 h-5 rounded-full bg-indigo-600 flex items-center justify-center text-white">
                          <Check className="w-3 h-3" />
                        </span>
                      )}
                    </div>
                    <div className="font-semibold text-sm text-white">{lang.label}</div>
                    <div className="text-[11px] text-studio-textSubtle mt-0.5">
                      {lang.code === 'ru' && 'Русский интерфейс (Archicad / AI Studio)'}
                      {lang.code === 'uk' && 'Український інтерфейс (Archicad / AI Studio)'}
                      {lang.code === 'en' && 'English studio interface (Archicad / AI Studio)'}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* TAB 4: GOOGLE ACCOUNT */}
        {activeTab === 'account' && (
          <div className="space-y-6">
            <div>
              <h1 className="text-xl font-bold text-white mb-1">{t('settings.accountTitle')}</h1>
              <p className="text-xs text-studio-textMuted">
                {t('settings.accountDesc')}
              </p>
            </div>

            <div className="bg-studio-surface border border-studio-border rounded-xl p-5 space-y-4">
              {authState.isAuthenticated && authState.user ? (
                <div className="space-y-4">
                  <div className="flex items-center space-x-4">
                    <div className="w-12 h-12 rounded-full bg-indigo-600/20 border border-indigo-500/40 flex items-center justify-center text-indigo-300 font-bold text-lg">
                      {authState.user.picture ? (
                        <img
                          src={authState.user.picture}
                          alt={authState.user.name}
                          className="w-full h-full rounded-full"
                        />
                      ) : (
                        authState.user.name.charAt(0)
                      )}
                    </div>
                    <div>
                      <h3 className="font-semibold text-white text-sm">{authState.user.name}</h3>
                      <p className="text-xs text-studio-textMuted">{authState.user.email}</p>
                      <span className="inline-flex items-center space-x-1 text-[10px] text-studio-success mt-1">
                        <ShieldCheck className="w-3 h-3" />
                        <span>{t('settings.authorizedInStudio')}</span>
                      </span>
                    </div>
                  </div>

                  <div className="pt-3 border-t border-studio-border flex justify-end">
                    <button
                      onClick={handleGoogleLogout}
                      className="px-3 py-1.5 bg-studio-surfaceHover hover:bg-studio-danger/20 text-studio-danger border border-studio-border hover:border-studio-danger/30 rounded-lg text-xs font-medium transition-colors flex items-center space-x-1.5"
                    >
                      <LogOut className="w-3.5 h-3.5" />
                      <span>{t('settings.logout')}</span>
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="text-center py-2 space-y-2">
                    <div className="w-12 h-12 rounded-full bg-studio-surfaceHover mx-auto flex items-center justify-center text-studio-textMuted">
                      <User className="w-6 h-6" />
                    </div>
                    <h3 className="text-sm font-semibold text-white">{t('settings.profileSelection')}</h3>
                    <p className="text-xs text-studio-textMuted max-w-sm mx-auto">
                      {t('settings.profileSelectionDesc')}
                    </p>
                  </div>

                  {/* 1-Click Profile Login */}
                  <div className="bg-studio-bg rounded-xl p-4 border border-studio-border space-y-3">
                    <span className="text-xs font-semibold text-white block">
                      {t('settings.quickProfileTitle')}
                    </span>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div>
                        <label className="text-[10px] text-studio-textMuted block mb-1">{t('settings.designerName')}</label>
                        <input
                          type="text"
                          defaultValue="ProKalash"
                          id="settings_profile_name"
                          className="w-full bg-studio-surface border border-studio-border rounded p-1.5 text-xs text-white"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] text-studio-textMuted block mb-1">{t('settings.designerEmail')}</label>
                        <input
                          type="text"
                          defaultValue="ProKalash@gmail.com"
                          id="settings_profile_email"
                          className="w-full bg-studio-surface border border-studio-border rounded p-1.5 text-xs text-white"
                        />
                      </div>
                    </div>
                    <button
                      onClick={() => {
                        const name = (document.getElementById('settings_profile_name') as HTMLInputElement)?.value || 'ProKalash';
                        const email = (document.getElementById('settings_profile_email') as HTMLInputElement)?.value || 'ProKalash@gmail.com';
                        authService.setUserProfile(name, email);
                      }}
                      className="w-full py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-semibold shadow-md transition-colors"
                    >
                      {t('settings.quickLoginBtn')}
                    </button>
                  </div>

                  {/* Google OAuth 2.0 PKCE */}
                  <div className="bg-studio-bg rounded-xl p-4 border border-studio-border space-y-2 text-xs">
                    <span className="text-xs font-semibold text-white block">
                      {t('settings.oauthDesktopTitle')}
                    </span>
                    <p className="text-[11px] text-studio-textMuted leading-relaxed">
                      {t('settings.oauthDesktopDesc')}
                    </p>
                    <div className="space-y-1 pt-1">
                      <label className="text-[10px] text-studio-textMuted block">OAuth Client ID:</label>
                      <input
                        type="text"
                        placeholder="123456789-abc.apps.googleusercontent.com"
                        id="google_client_id_input"
                        className="w-full bg-studio-surface border border-studio-border focus:border-indigo-500 rounded p-1.5 font-mono text-[11px] text-white"
                      />
                    </div>
                    <button
                      onClick={async () => {
                        const clientId = (document.getElementById('google_client_id_input') as HTMLInputElement)?.value.trim();
                        if (clientId) {
                          if (window.electronAPI) {
                            await window.electronAPI.saveSecureItem('google_oauth_client_id', clientId);
                          }
                          await authService.loginWithGoogle(clientId);
                        } else {
                          alert('Please enter a Google OAuth Client ID');
                        }
                      }}
                      className="px-3 py-1.5 bg-studio-surfaceHover hover:bg-studio-border border border-studio-border text-studio-text rounded text-xs font-medium transition-colors"
                    >
                      {t('settings.saveAndLoginBrowser')}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 5: ARCHICAD INTEGRATION */}
        {activeTab === 'archicad' && (
          <div className="space-y-6">
            <div>
              <h1 className="text-xl font-bold text-white mb-1">{t('settings.archicadTitle')}</h1>
              <p className="text-xs text-studio-textMuted">
                {t('settings.archicadDesc')}
              </p>
            </div>

            <div className="bg-studio-surface border border-studio-border rounded-xl p-5 space-y-3">
              <div>
                <h3 className="text-sm font-semibold text-white">{t('settings.archicadWatchTitle')}</h3>
                <p className="text-[11px] text-studio-textMuted mt-1">{t('settings.archicadWatchDesc')}</p>
              </div>
              <div className="flex gap-2">
                <div className="flex-1 min-w-0 bg-studio-bg border border-studio-border rounded-lg px-3 py-2 text-xs text-studio-textMuted truncate">
                  {archicadWatchFolder || t('settings.archicadWatchNoFolder')}
                </div>
                <button onClick={handleSelectArchicadWatchFolder} className="px-3 py-2 rounded-lg border border-studio-border bg-studio-surfaceLight text-xs text-white hover:bg-studio-surfaceHover">
                  {t('settings.archicadWatchBrowse')}
                </button>
              </div>
              <div className="flex items-center gap-3">
                <button onClick={handleToggleArchicadWatch} className={`px-3 py-2 rounded-lg text-xs font-semibold ${archicadWatchRunning ? 'bg-rose-600/20 text-rose-300 border border-rose-500/40' : 'bg-indigo-600 hover:bg-indigo-500 text-white'}`}>
                  {archicadWatchRunning ? t('settings.archicadWatchStop') : t('settings.archicadWatchStart')}
                </button>
                <span className={`text-[11px] ${archicadWatchRunning ? 'text-emerald-400' : 'text-studio-textMuted'}`}>
                  {archicadWatchRunning ? t('settings.archicadWatchActive') : t('settings.archicadWatchInactive')}
                </span>
              </div>
              {archicadWatchMessage && <p className="text-[11px] text-studio-cyan">{archicadWatchMessage}</p>}
            </div>

            <div className="bg-studio-surface border border-studio-border rounded-xl p-5 space-y-4">
              <h3 className="text-sm font-semibold text-white">
                {t('settings.archicadWorkflowTitle')}
              </h3>
              <ol className="list-decimal list-inside text-xs text-studio-textMuted space-y-2 leading-relaxed">
                <li>{t('settings.archicadStep1')}</li>
                <li>{t('settings.archicadStep2')}</li>
                <li>{t('settings.archicadStep3')}</li>
                <li>{t('settings.archicadStep4')}</li>
                <li>{t('settings.archicadStep5')}</li>
              </ol>

              <div className="pt-3 border-t border-studio-border">
                <span className="text-xs font-medium text-studio-cyan">
                  {t('settings.archicadAddonTitle')}
                </span>
                <p className="text-[11px] text-studio-textSubtle mt-1 leading-relaxed">
                  {t('settings.archicadAddonDesc')}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* TAB 6: DATABASE & STORAGE */}
        {activeTab === 'storage' && (
          <div className="space-y-6">
            <div>
              <h1 className="text-xl font-bold text-white mb-1">{t('settings.storageTitle')}</h1>
              <p className="text-xs text-studio-textMuted">
                {t('settings.storageDesc')}
              </p>
            </div>

            <div className="bg-studio-surface border border-studio-border rounded-xl p-5 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-semibold text-white">{t('settings.dbFileLabel')}</h4>
                  <p className="text-[11px] font-mono text-studio-textMuted mt-0.5">
                    %APPDATA%/Interior AI Studio/InteriorAIStudio/studio.sqlite
                  </p>
                </div>
                <span className="text-[10px] text-studio-success bg-studio-success/10 px-2 py-0.5 rounded font-mono">
                  {t('settings.dbActiveBadge')}
                </span>
              </div>
              <p className="text-xs text-studio-textSubtle leading-relaxed">
                {t('settings.dbDesc')}
              </p>
              <button
                type="button"
                onClick={() => { void handleOpenDataFolder(); }}
                className="inline-flex items-center gap-2 rounded-lg border border-studio-border bg-studio-surfaceLight px-3 py-2 text-xs text-studio-text hover:bg-studio-surfaceHover transition-colors"
              >
                <FolderOpen className="w-3.5 h-3.5" />
                {t('settings.openDataFolder')}
              </button>
              {dataFolderMessage && <p role="status" className="text-[11px] text-studio-textMuted">{dataFolderMessage}</p>}
            </div>

            <div className="bg-studio-surface border border-studio-border rounded-xl p-5 flex items-center justify-between gap-4">
              <div className="min-w-0">
                <h2 className="text-sm font-semibold text-studio-text">{t('settings.aboutTitle')} · {t('app.title')}</h2>
                <p className="text-xs text-studio-textMuted mt-1">{t('settings.aboutDesc')}</p>
              </div>
              <span className="shrink-0 rounded-md border border-studio-border bg-studio-bg px-2.5 py-1.5 font-mono text-[11px] text-studio-textMuted">{t('app.version')}</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
