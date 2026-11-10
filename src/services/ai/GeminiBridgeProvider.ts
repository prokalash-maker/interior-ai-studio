import { IAIProvider, GenerateImageOptions, GenerationResult, ConnectionTestResult } from '../../types/ai';
import { geminiBridgeService } from './GeminiBridgeService';

export class GeminiBridgeProvider implements IAIProvider {
  readonly id = 'gemini_bridge';
  readonly name = 'Gemini Bridge (Browser Handoff)';
  readonly currentModel = 'gemini-web-personal';
  readonly supportedModels = ['gemini-web-personal', 'gemini-advanced-web'];

  private lastPreparedPrompt: string = '';
  private lastSourceImage: string = '';

  async initialize(_credentials: Record<string, string>): Promise<void> {
    // Gemini Bridge operates without secret API keys, using the user's personal browser session
  }

  async testConnection(): Promise<ConnectionTestResult> {
    return {
      success: true,
      message: 'Gemini Bridge готов открыть сайт Gemini в системном браузере. Вход Google и доступность аккаунта проверяются на сайте.',
      latencyMs: 1,
      modelsFound: this.supportedModels,
    };
  }

  async generate(options: GenerateImageOptions): Promise<GenerationResult> {
    this.lastPreparedPrompt = options.prompt;
    this.lastSourceImage = options.sourceImageBase64;

    // Open Gemini in browser
    const opened = await geminiBridgeService.openGeminiExternal();
    if (!opened) throw new Error('Не удалось открыть Gemini в системном браузере.');

    // Copy prompt to clipboard automatically for instant user convenience
    if (options.prompt) {
      await geminiBridgeService.copyText(options.prompt);
    }

    // Return a placeholder or dispatch event; when user imports the result, it will be finalized
    return {
      id: `bridge_pending_${Date.now()}`,
      imageBase64: options.sourceImageBase64,
      mimeType: options.sourceImageMimeType,
      width: 1024,
      height: 768,
      model: this.currentModel,
      provider: this.id,
      promptUsed: options.prompt,
      latencyMs: 0,
      timestamp: Date.now(),
      resolution: options.resolution || '2k',
      costUsd: 0.0,
      textNotes: 'Перейдите в открывшийся браузер, вставьте изображение и скопированный промпт, затем сохраните результат кнопкой «Импорт».',
    };
  }

  async refine(previousResult: GenerationResult, refinementInstruction: string): Promise<GenerationResult> {
    const updatedPrompt = `${previousResult.promptUsed}\n\nRefinement directive: ${refinementInstruction}`;
    return this.generate({
      prompt: updatedPrompt,
      sourceImageBase64: previousResult.imageBase64,
      sourceImageMimeType: previousResult.mimeType,
      roomType: 'interior',
      styleName: 'Refined',
      geometryMode: 'strict',
      resolution: previousResult.resolution || '2k',
    });
  }

  getLastPrompt(): string {
    return this.lastPreparedPrompt;
  }

  getLastSourceImage(): string {
    return this.lastSourceImage;
  }
}

export const geminiBridgeProvider = new GeminiBridgeProvider();
