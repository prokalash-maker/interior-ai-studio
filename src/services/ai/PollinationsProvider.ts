import { IAIProvider, GenerateImageOptions, GenerationResult, ConnectionTestResult } from '../../types/ai';

export class PollinationsProvider implements IAIProvider {
  readonly id = 'pollinations_ai';
  readonly name = 'Pollinations AI (Облачный FLUX.1 • Бесплатно)';

  private model: string = 'flux';
  private apiKey: string = ''; // Optional Pollen key for bypassing the 45s cooldown

  readonly supportedModels: string[] = [
    'flux',          // Black Forest Labs FLUX.1 (Photorealistic ArchViz)
    'flux-realism',  // FLUX Realism (Architectural lighting & interior textures)
    'flux-3d',       // FLUX 3D ArchViz (High fidelity CGI render)
    'turbo',         // SDXL Turbo (Ultra-fast draft preview)
  ];

  constructor() {
    this.loadSavedSettings();
  }

  private async loadSavedSettings() {
    if (typeof window !== 'undefined') {
      const savedKey = localStorage.getItem('pollinations_api_key');
      if (savedKey) this.apiKey = savedKey;

      const savedModel = localStorage.getItem('pollinations_model');
      if (savedModel && this.supportedModels.includes(savedModel)) {
        this.model = savedModel;
      }
    }
  }

  get currentModel(): string {
    return this.model;
  }

  setModel(modelId: string) {
    if (this.supportedModels.includes(modelId)) {
      this.model = modelId;
      if (typeof window !== 'undefined') {
        localStorage.setItem('pollinations_model', modelId);
      }
    }
  }

  setApiKey(key: string) {
    this.apiKey = key.trim();
    if (typeof window !== 'undefined') {
      localStorage.setItem('pollinations_api_key', this.apiKey);
    }
  }

  getApiKey(): string {
    return this.apiKey;
  }

  async initialize(credentials: Record<string, string>): Promise<void> {
    if (credentials.model) this.setModel(credentials.model);
    if (credentials.apiKey) this.setApiKey(credentials.apiKey);
  }

  async testConnection(): Promise<ConnectionTestResult> {
    const startTime = performance.now();
    try {
      // Lightweight test query to verify Pollinations cloud gateway
      const testUrl = `https://image.pollinations.ai/prompt/archicad%20test?width=64&height=64&model=turbo&nologo=true`;
      const res = await fetch(testUrl, { method: 'GET' });
      const latencyMs = Math.round(performance.now() - startTime);

      if (res.ok) {
        return {
          success: true,
          message: `Pollinations AI сервер доступен (${latencyMs}мс). 100% Бесплатная генерация FLUX.1 активна.`,
          latencyMs,
          modelsFound: this.supportedModels,
        };
      }

      if (res.status === 402 || res.status === 503) {
        const text = await res.text();
        return {
          success: true,
          message: `Pollinations AI онлайн (${latencyMs}мс). Бесплатный лимит: 1 рендер в 45 сек. Поддерживаются модели FLUX.1 и Turbo.`,
          latencyMs,
          modelsFound: this.supportedModels,
        };
      }

      return {
        success: false,
        message: `Pollinations AI вернул статус ${res.status}`,
        latencyMs,
      };
    } catch (e: any) {
      return {
        success: false,
        message: `Ошибка соединения с Pollinations AI: ${e.message}`,
        latencyMs: Math.round(performance.now() - startTime),
      };
    }
  }

  async generate(options: GenerateImageOptions): Promise<GenerationResult> {
    const startTime = performance.now();
    const resolution = options.resolution || '2k';

    // Dimensions for architectural presentation
    let width = 1920;
    let height = 1080;
    if (resolution === '1k') {
      width = 1024;
      height = 576;
    } else if (resolution === '4k') {
      width = 2560;
      height = 1440;
    }

    // Compose prompt enriched with room type, style, and material specifications
    let prompt = options.prompt;
    if (options.materialReferences && options.materialReferences.length > 0) {
      const mats = options.materialReferences
        .map((m) => `${m.targetSurface}: ${m.name} (${m.notes || ''})`)
        .join(', ');
      prompt += `\nExact Material References: ${mats}`;
    }

    const seed = Math.floor(Math.random() * 9999999);
    const encodedPrompt = encodeURIComponent(prompt.trim());
    
    // Construct Pollinations endpoint
    let url = `https://image.pollinations.ai/prompt/${encodedPrompt}?width=${width}&height=${height}&model=${this.model}&nologo=true&seed=${seed}&enhance=false`;
    if (this.apiKey) {
      url += `&pollen_key=${encodeURIComponent(this.apiKey)}`;
    }

    let response = await fetch(url);

    // If rate-limited on free tier (45s per IP), check if retry delay is indicated
    if (!response.ok && (response.status === 402 || response.status === 503)) {
      const errJson = await response.json().catch(() => null);
      if (errJson?.error?.message?.includes('Retry after')) {
        const match = errJson.error.message.match(/after (\d+)s/i);
        const waitSec = match ? Math.min(parseInt(match[1], 10), 45) : 10;
        
        // Wait and retry once
        await new Promise((resolve) => setTimeout(resolve, (waitSec + 1) * 1000));
        response = await fetch(url);
      }
    }

    if (!response.ok) {
      const errText = await response.text().catch(() => '');
      throw new Error(`Pollinations AI вернул ошибку (${response.status}): ${errText.substring(0, 150)}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    const base64 = this.arrayBufferToBase64(arrayBuffer);
    const latencyMs = Math.round(performance.now() - startTime);

    return {
      id: 'gen_pollinations_' + Date.now(),
      imageBase64: `data:image/jpeg;base64,${base64}`,
      mimeType: 'image/jpeg',
      width,
      height,
      model: this.model,
      provider: this.id,
      promptUsed: options.prompt,
      latencyMs,
      timestamp: Date.now(),
      resolution,
      costUsd: 0.000, // 100% FREE
      textNotes: `Сгенерировано через бесплатный облачный сервер Pollinations AI (${this.model}, FLUX.1)`,
    };
  }

  private arrayBufferToBase64(buffer: ArrayBuffer): string {
    let binary = '';
    const bytes = new Uint8Array(buffer);
    const len = bytes.byteLength;
    for (let i = 0; i < len; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  }

  async refine(previousResult: GenerationResult, refinementInstruction: string): Promise<GenerationResult> {
    return this.generate({
      prompt: `${previousResult.promptUsed}\n\nRefinement: ${refinementInstruction}`,
      sourceImageBase64: previousResult.imageBase64,
      sourceImageMimeType: previousResult.mimeType,
      roomType: 'interior',
      styleName: 'Refined',
      geometryMode: 'strict',
      resolution: previousResult.resolution || '2k',
      parentTurn: {
        prompt: previousResult.promptUsed,
        outputImageBase64: previousResult.imageBase64,
      },
    });
  }
}

export const pollinationsProvider = new PollinationsProvider();
