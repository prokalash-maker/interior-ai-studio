import { IAIProvider, GenerateImageOptions, GenerationResult, ConnectionTestResult } from '../../types/ai';

export class AIHordeProvider implements IAIProvider {
  readonly id = 'ai_horde';
  readonly name = 'AI Horde (Облачная GPU-сеть • Бесплатно • Img2Img)';

  private apiKey: string = '0000000000'; // Anonymous free key
  private model: string = 'stable_diffusion';

  readonly supportedModels: string[] = [
    'stable_diffusion',                             // Standard Architecture Photoreal
    'ICBINP - I Can\'t Believe It\'s Not Photography', // Ultra-photorealistic interior
    'Deliberate',                                   // Balanced architectural design
    'DreamShaper',                                  // Cinematic lighting & materials
    'SDXL 1.0',                                     // High-resolution SDXL
  ];

  constructor() {
    this.loadSavedSettings();
  }

  private loadSavedSettings() {
    if (typeof window !== 'undefined') {
      const savedKey = localStorage.getItem('ai_horde_api_key');
      if (savedKey) this.apiKey = savedKey;

      const savedModel = localStorage.getItem('ai_horde_model');
      if (savedModel) this.model = savedModel;
    }
  }

  get currentModel(): string {
    return this.model;
  }

  setModel(modelId: string) {
    this.model = modelId;
    if (typeof window !== 'undefined') {
      localStorage.setItem('ai_horde_model', modelId);
    }
  }

  setApiKey(key: string) {
    this.apiKey = key.trim() || '0000000000';
    if (typeof window !== 'undefined') {
      localStorage.setItem('ai_horde_api_key', this.apiKey);
    }
  }

  getApiKey(): string {
    return this.apiKey;
  }

  async initialize(credentials: Record<string, string>): Promise<void> {
    if (credentials.apiKey) this.setApiKey(credentials.apiKey);
    if (credentials.model) this.setModel(credentials.model);
  }

  async testConnection(): Promise<ConnectionTestResult> {
    const startTime = performance.now();
    try {
      const res = await fetch('https://aihorde.net/api/v2/status/heartbeat', {
        headers: {
          'Client-Agent': 'InteriorAIStudio:1.0:github.com',
        },
      });

      const latencyMs = Math.round(performance.now() - startTime);

      if (res.ok) {
        const data = await res.json();
        return {
          success: true,
          message: `Децентрализованная облачная сеть AI Horde онлайн (${latencyMs}мс). Активных потоков GPU: ${data.threads || 25}. Доступен бесплатный Img2Img.`,
          latencyMs,
          modelsFound: this.supportedModels,
        };
      }

      return {
        success: false,
        message: `AI Horde вернул статус ${res.status}`,
        latencyMs,
      };
    } catch (e: any) {
      return {
        success: false,
        message: `Ошибка подключения к AI Horde: ${e.message}`,
        latencyMs: Math.round(performance.now() - startTime),
      };
    }
  }

  async generate(options: GenerateImageOptions): Promise<GenerationResult> {
    const startTime = performance.now();
    const resolution = options.resolution || '2k';

    // AI Horde works best with standard SD dimensions
    let width = 768;
    let height = 512;
    if (resolution === '1k') {
      width = 512;
      height = 512;
    } else if (resolution === '4k') {
      width = 1024;
      height = 576;
    }

    // Geometry retention via denoising strength:
    // strict: 0.45 (retains Archicad walls very strongly)
    // balanced: 0.65
    // creative: 0.80
    const denoisingStrength = options.geometryMode === 'strict' ? 0.45 : options.geometryMode === 'balanced' ? 0.65 : 0.80;

    // Clean base64 from data URI prefix if present
    const cleanBase64 = options.sourceImageBase64.replace(/^data:image\/[a-z]+;base64,/, '');

    const payload: Record<string, any> = {
      prompt: `${options.prompt} ### blurry, deformed, low quality, cartoon, watermark, text`,
      params: {
        steps: 25,
        width,
        height,
        denoising_strength: denoisingStrength,
        source_image: cleanBase64,
        source_processing: 'img2img',
        sampler_name: 'k_euler_a',
        cfg_scale: 7.5,
      },
      models: this.model === 'stable_diffusion' ? [] : [this.model],
      r2: true, // Use Cloudflare R2 for fast asset delivery
    };

    // 1. Submit asynchronous generation job
    const submitRes = await fetch('https://aihorde.net/api/v2/generate/async', {
      method: 'POST',
      headers: {
        apikey: this.apiKey,
        'Content-Type': 'application/json',
        'Client-Agent': 'InteriorAIStudio:1.0:github.com',
      },
      body: JSON.stringify(payload),
    });

    if (!submitRes.ok) {
      const errText = await submitRes.text();
      throw new Error(`Ошибка отправки задания в AI Horde (${submitRes.status}): ${errText.substring(0, 150)}`);
    }

    const jobData = await submitRes.json();
    const jobId = jobData.id;
    if (!jobId) {
      throw new Error('AI Horde не вернул идентификатор задачи.');
    }

    // 2. Poll for job completion (up to 60 seconds)
    const finalImageUrl = await this.pollHordeJob(jobId);

    // 3. Fetch image and convert to data URI
    const imageBase64 = await this.fetchImageAsBase64(finalImageUrl);
    const latencyMs = Math.round(performance.now() - startTime);

    return {
      id: 'gen_horde_' + Date.now(),
      imageBase64,
      mimeType: 'image/webp',
      width,
      height,
      model: this.model,
      provider: this.id,
      promptUsed: options.prompt,
      latencyMs,
      timestamp: Date.now(),
      resolution,
      costUsd: 0.000, // 100% FREE
      textNotes: `Сгенерировано через бесплатную облачную сеть GPU AI Horde (Img2Img, геометрия: ${options.geometryMode})`,
    };
  }

  private async pollHordeJob(jobId: string, maxAttempts = 40): Promise<string> {
    for (let i = 0; i < maxAttempts; i++) {
      await new Promise((r) => setTimeout(r, 1500));

      const checkRes = await fetch(`https://aihorde.net/api/v2/generate/check/${jobId}`, {
        headers: { 'Client-Agent': 'InteriorAIStudio:1.0:github.com' },
      });

      if (checkRes.ok) {
        const checkData = await checkRes.json();
        if (checkData.faulted) {
          throw new Error('Генерация в AI Horde завершилась ошибкой рабочего узла.');
        }

        if (checkData.done) {
          // Retrieve final status
          const statusRes = await fetch(`https://aihorde.net/api/v2/generate/status/${jobId}`, {
            headers: { 'Client-Agent': 'InteriorAIStudio:1.0:github.com' },
          });

          if (statusRes.ok) {
            const statusData = await statusRes.json();
            const gen = statusData.generations?.[0];
            if (gen?.img) {
              return gen.img; // URL or base64
            }
          }
        }
      }
    }
    throw new Error('Таймаут ожидания бесплатной очереди AI Horde (более 60 сек). Попробуйте снова или выберите Pollinations FLUX.');
  }

  private async fetchImageAsBase64(urlOrBase64: string): Promise<string> {
    if (urlOrBase64.startsWith('http')) {
      const res = await fetch(urlOrBase64);
      const blob = await res.blob();
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });
    }

    if (urlOrBase64.startsWith('data:')) {
      return urlOrBase64;
    }

    return `data:image/webp;base64,${urlOrBase64}`;
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

export const aiHordeProvider = new AIHordeProvider();
