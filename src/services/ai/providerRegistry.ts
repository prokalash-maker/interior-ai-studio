import { IAIProvider } from '../../types/ai';
import { geminiProvider } from './GeminiProvider';
import { geminiBridgeProvider } from './GeminiBridgeProvider';
import { kreaProvider } from './KreaProvider';
import { pollinationsProvider } from './PollinationsProvider';
import { aiHordeProvider } from './AIHordeProvider';
import { localSDProvider } from './LocalSDProvider';
import { comfyuiProvider } from './ComfyUIProvider';
import { huggingFaceProvider } from './HuggingFaceProvider';

export interface ProviderMetadata {
  id: string;
  name: string;
  shortName: string;
  description: string;
  isAvailable: boolean;
  isFree: boolean;
  costBadge: string;
  statusBadge: 'active' | 'free_cloud' | 'local_server';
}

const CORE_PROVIDER_IDS = new Set(['google_gemini', 'gemini_bridge', 'comfyui_local']);

export const PROVIDERS_CATALOG: ProviderMetadata[] = [
  {
    id: 'google_gemini',
    name: 'Google Gemini (Nano Banana Pro)',
    shortName: 'Google Gemini',
    description: 'Официальный облачный сервис Google Multimodal Image Generation. Модели: gemini-3-pro-image, gemini-2.5-flash-image.',
    isAvailable: true,
    isFree: false,
    costBadge: '~$0.134 / рендер',
    statusBadge: 'active',
  },
  {
    id: 'gemini_bridge',
    name: 'Gemini Bridge (Browser Handoff • Личный Google)',
    shortName: 'Gemini Bridge',
    description: 'Прямая передача рендера и промпта в личный аккаунт Google на gemini.google.com. Без API-ключа, без лимитов.',
    isAvailable: true,
    isFree: true,
    costBadge: '100% БЕСПЛАТНО (Личный)',
    statusBadge: 'free_cloud',
  },
  {
    id: 'comfyui_local',
    name: 'ComfyUI (Локальный сервер • RTX 4050)',
    shortName: 'ComfyUI (RTX 4050)',
    description: 'Аппаратное ускорение на NVIDIA RTX 4050 6GB. SDXL (Juggernaut XL) и FLUX.1 Schnell без интернета и затрат.',
    isAvailable: true,
    isFree: true,
    costBadge: '100% БЕСПЛАТНО (GPU)',
    statusBadge: 'local_server',
  },
];

class ProviderRegistry {
  private providers: Map<string, IAIProvider> = new Map();
  private activeProviderId: string = 'comfyui_local';
  private enabledProviderIds: Set<string> = new Set([
    'comfyui_local',
    'gemini_bridge',
    'google_gemini',
  ]);
  private listeners: Set<() => void> = new Set();

  constructor() {
    this.registerProvider(geminiProvider);
    this.registerProvider(geminiBridgeProvider);
    this.registerProvider(kreaProvider);
    this.registerProvider(comfyuiProvider);
    this.registerProvider(pollinationsProvider);
    this.registerProvider(aiHordeProvider);
    this.registerProvider(localSDProvider);
    this.registerProvider(huggingFaceProvider);

    const saved = localStorage.getItem('interior_ai_active_provider');
    if (saved && CORE_PROVIDER_IDS.has(saved) && this.providers.has(saved)) {
      this.activeProviderId = saved;
    }

    const savedEnabled = localStorage.getItem('interior_ai_enabled_providers');
    if (savedEnabled) {
      try {
        const parsed = JSON.parse(savedEnabled);
        if (Array.isArray(parsed)) {
          const retained = parsed.filter((id): id is string => typeof id === 'string' && CORE_PROVIDER_IDS.has(id));
          if (retained.length > 0) this.enabledProviderIds = new Set(retained);
        }
      } catch (_) {}
    }
    this.enabledProviderIds = new Set(Array.from(this.enabledProviderIds).filter((id) => CORE_PROVIDER_IDS.has(id)));
    if (!this.enabledProviderIds.size) this.enabledProviderIds.add('comfyui_local');
    if (!this.enabledProviderIds.has(this.activeProviderId)) {
      this.activeProviderId = this.enabledProviderIds.has('comfyui_local')
        ? 'comfyui_local'
        : Array.from(this.enabledProviderIds)[0];
      localStorage.setItem('interior_ai_active_provider', this.activeProviderId);
    }
    this.saveEnabledProviders();
  }

  registerProvider(provider: IAIProvider) {
    this.providers.set(provider.id, provider);
  }

  getActiveProvider(): IAIProvider {
    const provider = this.providers.get(this.activeProviderId);
    if (!provider) {
      return comfyuiProvider;
    }
    return provider;
  }

  getActiveProviderId(): string {
    return this.activeProviderId;
  }

  setActiveProvider(providerId: string) {
    if (CORE_PROVIDER_IDS.has(providerId) && this.providers.has(providerId) && this.enabledProviderIds.has(providerId)) {
      this.activeProviderId = providerId;
      localStorage.setItem('interior_ai_active_provider', providerId);
      this.notifyListeners();
    }
  }

  getProvider(providerId: string): IAIProvider | undefined {
    return this.providers.get(providerId);
  }

  getAllProviders(): IAIProvider[] {
    return Array.from(this.providers.values());
  }

  isProviderEnabled(providerId: string): boolean {
    return this.enabledProviderIds.has(providerId);
  }

  setProviderEnabled(providerId: string, enabled: boolean) {
    if (!CORE_PROVIDER_IDS.has(providerId)) return;
    if (enabled) {
      this.enabledProviderIds.add(providerId);
    } else {
      if (this.enabledProviderIds.size <= 1 && this.enabledProviderIds.has(providerId)) {
        return; // Always keep at least 1 provider enabled
      }
      this.enabledProviderIds.delete(providerId);
      if (this.activeProviderId === providerId) {
        const fallback = Array.from(this.enabledProviderIds)[0] || 'comfyui_local';
        this.setActiveProvider(fallback);
      }
    }
    this.saveEnabledProviders();
    this.notifyListeners();
  }

  toggleProvider(providerId: string): boolean {
    const nextState = !this.isProviderEnabled(providerId);
    this.setProviderEnabled(providerId, nextState);
    return this.isProviderEnabled(providerId);
  }

  enableAllProviders() {
    this.enabledProviderIds = new Set(CORE_PROVIDER_IDS);
    this.saveEnabledProviders();
    this.notifyListeners();
  }

  setMinimalPreset() {
    this.enabledProviderIds = new Set(CORE_PROVIDER_IDS);
    if (!this.enabledProviderIds.has(this.activeProviderId)) {
      this.setActiveProvider('comfyui_local');
    }
    this.saveEnabledProviders();
    this.notifyListeners();
  }

  setOnlyProvider(providerId: string) {
    if (!CORE_PROVIDER_IDS.has(providerId)) return;
    this.enabledProviderIds = new Set([providerId]);
    this.setActiveProvider(providerId);
    this.saveEnabledProviders();
    this.notifyListeners();
  }

  getEnabledProviderIds(): string[] {
    return Array.from(this.enabledProviderIds);
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private saveEnabledProviders() {
    try {
      localStorage.setItem(
        'interior_ai_enabled_providers',
        JSON.stringify(Array.from(this.enabledProviderIds))
      );
    } catch (_) {}
  }

  private notifyListeners() {
    this.listeners.forEach((l) => {
      try {
        l();
      } catch (_) {}
    });
  }
}

export const providerRegistry = new ProviderRegistry();
