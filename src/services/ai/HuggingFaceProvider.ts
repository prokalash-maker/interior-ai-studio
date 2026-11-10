import { IAIProvider, GenerateImageOptions, GenerationResult, ConnectionTestResult } from '../../types/ai';

export class HuggingFaceProvider implements IAIProvider {
  readonly id = 'huggingface';
  readonly name = 'Hugging Face (Облачный FLUX.1-schnell • Free Tier)';

  private apiKey: string = '';
  private model: string = 'black-forest-labs/FLUX.1-schnell';

  readonly supportedModels: string[] = [
    'black-forest-labs/FLUX.1-schnell',           // Ultra-fast FLUX.1 open weights
    'stabilityai/stable-diffusion-xl-base-1.0',    // SDXL 1.0 Foundation
    'ByteDance/SDXL-Lightning',                    // Lightning 4-step generation
  ];

  constructor() {
    this.loadSavedSettings();
  }

  private loadSavedSettings() {
    if (typeof window !== 'undefined') {
      const savedKey = localStorage.getItem('hf_api_key');
      if (savedKey) this.apiKey = savedKey;

      const savedModel = localStorage.getItem('hf_model');
      if (savedModel) this.model = savedModel;
    }
  }

  get currentModel(): string {
    return this.model;
  }

  setModel(modelId: string) {
    this.model = modelId;
    if (typeof window !== 'undefined') {
      localStorage.setItem('hf_model', modelId);
    }
  }

  setApiKey(key: string) {
    this.apiKey = key.trim();
    if (typeof window !== 'undefined') {
      localStorage.setItem('hf_api_key', this.apiKey);
    }
  }

  getApiKey(): string {
    return this.apiKey;
  }

  hasApiKey(): boolean {
    return Boolean(this.apiKey && this.apiKey.startsWith('hf_'));
  }

  async initialize(credentials: Record<string, string>): Promise<void> {
    if (credentials.apiKey) this.setApiKey(credentials.apiKey);
    if (credentials.model) this.setModel(credentials.model);
  }

  async testConnection(): Promise<ConnectionTestResult> {
    const startTime = performance.now();
    try {
      const res = await fetch(`https://router.huggingface.co/hf-inference/models/${this.model}`, {
        method: 'POST',
        headers: {
          Authorization: this.apiKey ? `Bearer ${this.apiKey}` : '',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ inputs: 'ping' }),
      });

      const latencyMs = Math.round(performance.now() - startTime);

      if (res.ok) {
        return {
          success: true,
          message: `Hugging Face Serverless подключен (${latencyMs}мс). Модель: ${this.model}.`,
          latencyMs,
          modelsFound: this.supportedModels,
        };
      }

      if (res.status === 401) {
        return {
          success: false,
          message: 'Требуется бесплатный токен Hugging Face (hf_...). Создайте его за 1 минуту на huggingface.co/settings/tokens.',
          latencyMs,
        };
      }

      if (res.status === 503) {
        return {
          success: true,
          message: `Модель ${this.model} онлайн, но прогревается (Cold boot). Повторите запрос через 15 секунд.`,
          latencyMs,
        };
      }

      return {
        success: false,
        message: `Hugging Face вернул статус ${res.status}`,
        latencyMs,
      };
    } catch (e: any) {
      return {
        success: false,
        message: `Ошибка подключения к Hugging Face: ${e.message}`,
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
      width = 512;
      height = 512;
    }

    const payload = {
      inputs: `${options.prompt}, architectural render, luxury interior design, photorealistic, 8k`,
      parameters: {
        width,
        height,
      },
    };

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (this.apiKey) {
      headers['Authorization'] = `Bearer ${this.apiKey}`;
    }

    const res = await fetch(`https://router.huggingface.co/hf-inference/models/${this.model}`, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      if (res.status === 401) {
        throw new Error('Для генерации через Hugging Face укажите бесплатный токен hf_... в Настройках (получить: huggingface.co/settings/tokens).');
      }
      throw new Error(`Ошибка Hugging Face (${res.status}): ${errText.substring(0, 150)}`);
    }

    const arrayBuffer = await res.arrayBuffer();
    const base64 = this.arrayBufferToBase64(arrayBuffer);
    const latencyMs = Math.round(performance.now() - startTime);

    return {
      id: 'gen_hf_' + Date.now(),
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
      costUsd: 0.000, // Free tier
      textNotes: `Сгенерировано через бесплатный Hugging Face Serverless (${this.model})`,
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

export const huggingFaceProvider = new HuggingFaceProvider();
