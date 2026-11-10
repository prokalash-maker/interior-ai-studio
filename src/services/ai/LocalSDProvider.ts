import { IAIProvider, GenerateImageOptions, GenerationResult, ConnectionTestResult } from '../../types/ai';

export class LocalSDProvider implements IAIProvider {
  readonly id = 'local_sd';
  readonly name = 'Local SD / ComfyUI (Локальный сервер • Бесплатно)';

  private serverUrl: string = 'http://127.0.0.1:7860';
  private model: string = 'sd-webui-img2img';

  readonly supportedModels: string[] = [
    'sd-webui-img2img', // Automatic1111 / SD.Next / WebUI Forge
    'comfyui-api',      // ComfyUI Server (Port 8188)
  ];

  constructor() {
    this.loadSavedSettings();
  }

  private loadSavedSettings() {
    if (typeof window !== 'undefined') {
      const savedUrl = localStorage.getItem('local_sd_url');
      if (savedUrl) this.serverUrl = savedUrl;

      const savedModel = localStorage.getItem('local_sd_model');
      if (savedModel) this.model = savedModel;
    }
  }

  get currentModel(): string {
    return this.model;
  }

  setModel(modelId: string) {
    this.model = modelId;
    if (typeof window !== 'undefined') {
      localStorage.setItem('local_sd_model', modelId);
    }
  }

  setServerUrl(url: string) {
    this.serverUrl = url.trim().replace(/\/+$/, '');
    if (typeof window !== 'undefined') {
      localStorage.setItem('local_sd_url', this.serverUrl);
    }
  }

  getServerUrl(): string {
    return this.serverUrl;
  }

  async initialize(credentials: Record<string, string>): Promise<void> {
    if (credentials.serverUrl) this.setServerUrl(credentials.serverUrl);
    if (credentials.model) this.setModel(credentials.model);
  }

  async testConnection(): Promise<ConnectionTestResult> {
    const startTime = performance.now();
    try {
      // 1. Check Automatic1111 / WebUI Forge API
      const res = await fetch(`${this.serverUrl}/sdapi/v1/options`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      });

      const latencyMs = Math.round(performance.now() - startTime);

      if (res.ok) {
        const data = await res.json();
        const activeCheckpoint = data.sd_model_checkpoint || 'Local Model';
        return {
          success: true,
          message: `Локальный сервер SD WebUI подключен (${latencyMs}мс). Активная модель: ${activeCheckpoint}. Безлимитная бесплатная генерация на GPU.`,
          latencyMs,
          modelsFound: [activeCheckpoint, 'ControlNet', 'SD-WebUI-img2img'],
        };
      }

      return {
        success: false,
        message: `Локальный сервер вернул HTTP статус ${res.status}`,
        latencyMs,
      };
    } catch (e: any) {
      return {
        success: false,
        message: `Локальный сервер не отвечает по адресу ${this.serverUrl}. Запустите Stable Diffusion WebUI / Forge с параметром --api.`,
        latencyMs: Math.round(performance.now() - startTime),
      };
    }
  }

  async generate(options: GenerateImageOptions): Promise<GenerationResult> {
    const startTime = performance.now();
    const resolution = options.resolution || '2k';

    let width = 1024;
    let height = 576;
    if (resolution === '1k') {
      width = 768;
      height = 768;
    } else if (resolution === '4k') {
      width = 1536;
      height = 864;
    }

    const denoising = options.geometryMode === 'strict' ? 0.45 : options.geometryMode === 'balanced' ? 0.60 : 0.75;

    // Direct Img2Img call to local Automatic1111 / Forge
    const payload = {
      init_images: [options.sourceImageBase64],
      prompt: `${options.prompt}, photorealistic architectural interior, masterpiece, 8k, raytracing`,
      negative_prompt: 'blurry, distorted, amateur, painting, cartoon, bad architecture, poor lighting',
      steps: 25,
      cfg_scale: 7.0,
      denoising_strength: denoising,
      width,
      height,
      sampler_name: 'Euler a',
      save_images: false,
    };

    const res = await fetch(`${this.serverUrl}/sdapi/v1/img2img`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      throw new Error(`Ошибка локального сервера (${res.status}): ${errText.substring(0, 150)}`);
    }

    const data = await res.json();
    const outputImage = data.images?.[0];
    if (!outputImage) {
      throw new Error('Локальный сервер не вернул изображение.');
    }

    const latencyMs = Math.round(performance.now() - startTime);

    return {
      id: 'gen_localsd_' + Date.now(),
      imageBase64: outputImage.startsWith('data:') ? outputImage : `data:image/png;base64,${outputImage}`,
      mimeType: 'image/png',
      width,
      height,
      model: this.model,
      provider: this.id,
      promptUsed: options.prompt,
      latencyMs,
      timestamp: Date.now(),
      resolution,
      costUsd: 0.000, // 100% FREE
      textNotes: `Сгенерировано локально на вашем GPU через ${this.serverUrl} (0$ расходов)`,
    };
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

export const localSDProvider = new LocalSDProvider();
