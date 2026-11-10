import { IAIProvider, GenerateImageOptions, GenerationResult, ConnectionTestResult } from '../../types/ai';

export class GeminiProvider implements IAIProvider {
  readonly id = 'google_gemini';
  readonly name = 'Google Gemini (Nano Banana Pro)';
  private apiKey: string = '';
  public currentModel: string = 'gemini-3-pro-image';
  readonly supportedModels: string[] = [
    'gemini-3-pro-image',       // Nano Banana Pro (Official Core ID)
    'gemini-2.5-flash-image',   // Fast iteration
    'imagen-3.0-generate-002',  // Imagen 3
  ];

  constructor(apiKey?: string, model?: string) {
    if (apiKey) this.apiKey = apiKey;
    if (model) this.currentModel = model;
  }

  async initialize(credentials: Record<string, string>): Promise<void> {
    if (credentials.apiKey) {
      this.apiKey = credentials.apiKey.trim();
    }
    if (credentials.model && this.supportedModels.includes(credentials.model)) {
      this.currentModel = credentials.model;
    }
  }

  getApiKey(): string {
    return this.apiKey;
  }

  setApiKey(key: string) {
    this.apiKey = key.trim();
  }

  setModel(model: string) {
    if (this.supportedModels.includes(model)) {
      this.currentModel = model;
    }
  }

  async testConnection(): Promise<ConnectionTestResult> {
    if (!this.apiKey) {
      return {
        success: false,
        message: 'API-ключ не указан. Введите ключ, полученный в Google AI Studio (aistudio.google.com).',
      };
    }

    const startTime = performance.now();
    try {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models?key=${this.apiKey}`,
        {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          },
        }
      );

      const latencyMs = Math.round(performance.now() - startTime);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const errorMsg = errorData.error?.message || `HTTP ${response.status} ${response.statusText}`;
        if (response.status === 402) {
          return {
            success: false,
            latencyMs,
            message: `API-ключ действителен, но баланс кредитов в Google AI Studio исчерпан (402). Пополните Prepay-баланс на https://ai.studio/projects`,
          };
        }
        if (response.status === 400 || response.status === 403) {
          return {
            success: false,
            latencyMs,
            message: `Ошибка проверки ключа Google API (${response.status}): ${errorMsg}. Убедитесь, что ключ активен в Google AI Studio.`,
          };
        }
        return {
          success: false,
          latencyMs,
          message: `Ошибка сервера Google (${response.status}): ${errorMsg}`,
        };
      }

      const data = await response.json();
      const modelsList: string[] = (data.models || [])
        .map((m: any) => m.name.replace('models/', ''))
        .filter((name: string) => name.includes('gemini') || name.includes('image'));

      return {
        success: true,
        latencyMs,
        message: `Соединение с Google Gemini API успешно установлено! Задержка: ${latencyMs} мс.`,
        modelsFound: modelsList,
      };
    } catch (err: any) {
      const latencyMs = Math.round(performance.now() - startTime);
      return {
        success: false,
        latencyMs,
        message: `Не удалось связаться с серверами Google: ${err.message || 'Проверьте подключение к интернету'}.`,
      };
    }
  }

  async generate(options: GenerateImageOptions): Promise<GenerationResult> {
    if (!this.apiKey) {
      throw new Error('API-ключ Google Gemini не настроен. Откройте Настройки → AI-провайдеры и сохраните ваш ключ из Google AI Studio.');
    }

    const startTime = performance.now();
    const cleanBase64 = options.sourceImageBase64.replace(/^data:image\/\w+;base64,/, '');

    const contents: any[] = [];

    // Check if this is a follow-up refinement turn
    if (options.parentTurn && options.parentTurn.outputImageBase64) {
      const parentImgBase64 = options.parentTurn.outputImageBase64.replace(/^data:image\/\w+;base64,/, '');
      contents.push(
        {
          role: 'user',
          parts: [
            { text: options.parentTurn.prompt },
            {
              inlineData: {
                mimeType: options.sourceImageMimeType || 'image/png',
                data: cleanBase64,
              },
            },
          ],
        },
        {
          role: 'model',
          parts: [
            {
              inlineData: {
                mimeType: 'image/png',
                data: parentImgBase64,
              },
            },
          ],
        },
        {
          role: 'user',
          parts: [
            { text: options.prompt },
          ],
        }
      );
    } else {
      const userParts: any[] = [
        { text: options.prompt },
        {
          inlineData: {
            mimeType: options.sourceImageMimeType || 'image/png',
            data: cleanBase64,
          },
        },
      ];

      // Attach visual material reference swatches if provided
      if (options.materialReferences && options.materialReferences.length > 0) {
        options.materialReferences.forEach((ref) => {
          if (ref.imageBase64) {
            const swatchBase64 = ref.imageBase64.replace(/^data:image\/\w+;base64,/, '');
            userParts.push({
              text: `[Visual Material Reference for ${ref.targetSurface.toUpperCase()}: "${ref.name}" ${ref.notes ? `(${ref.notes})` : ''}]`,
            });
            userParts.push({
              inlineData: {
                mimeType: ref.imageMimeType || 'image/jpeg',
                data: swatchBase64,
              },
            });
          }
        });
      }

      contents.push({
        role: 'user',
        parts: userParts,
      });
    }

    const requestBody = {
      contents,
      generationConfig: {
        responseModalities: ['TEXT', 'IMAGE'],
        temperature: options.temperature ?? 0.4,
      },
    };

    let response: Response;
    try {
      response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${this.currentModel}:generateContent?key=${this.apiKey}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(requestBody),
        }
      );
    } catch (networkErr: any) {
      throw new Error(`Сетевая ошибка при обращении к Nano Banana Pro: ${networkErr.message}. Проверьте соединение.`);
    }

    const latencyMs = Math.round(performance.now() - startTime);

    if (!response.ok) {
      const errorJson = await response.json().catch(() => ({}));
      const code = response.status;
      const apiMessage = errorJson.error?.message || response.statusText;

      const isDepleted = code === 402 || 
        apiMessage.toLowerCase().includes('prepayment') || 
        apiMessage.toLowerCase().includes('credit') ||
        apiMessage.includes('402');

      if (isDepleted) {
        const err: any = new Error(
          `Ваш баланс предоплаченных кредитов в Google AI Studio исчерпан (Ошибка 402).\n\n` +
          `Для генерации через модель gemini-3-pro-image требуется активный баланс в Google AI Studio (https://ai.studio/projects).\n` +
          `Пополните баланс в AI Studio либо переключитесь на Krea AI / Демо-режим.`
        );
        err.code = 402;
        err.isPrepaymentDepleted = true;
        err.billingUrl = 'https://ai.studio/projects';
        throw err;
      } else if (code === 429) {
        throw new Error(
          `Лимит запросов Google API исчерпан (429 Resource Exhausted). Подождите несколько секунд или проверьте квоты в Google Cloud Console.`
        );
      } else if (code === 403 || code === 401) {
        throw new Error(`Ошибка авторизации API Google (${code}): ${apiMessage}. Проверьте правильность API-ключа в Настройках.`);
      } else if (code === 400) {
        throw new Error(`Некорректный запрос к модели (${code}): ${apiMessage}. Возможно, формат исходного изображения не поддерживается.`);
      } else {
        throw new Error(`Google API вернул ошибку (${code}): ${apiMessage}`);
      }
    }

    const data = await response.json();
    const candidate = data.candidates?.[0];

    if (!candidate) {
      const blockReason = data.promptFeedback?.blockReason || 'Неизвестная причина';
      throw new Error(`Генерация отклонена фильтрами безопасности Google: ${blockReason}`);
    }

    let resultImageBase64 = '';
    let resultMimeType = 'image/png';
    let textNotes = '';

    const parts = candidate.content?.parts || [];
    for (const part of parts) {
      if (part.inlineData && part.inlineData.data) {
        resultImageBase64 = part.inlineData.data;
        resultMimeType = part.inlineData.mimeType || 'image/png';
      } else if (part.text) {
        textNotes += part.text + ' ';
      }
    }

    if (!resultImageBase64) {
      throw new Error(
        `Модель ${this.currentModel} вернула текстовый ответ без изображения. Текст ответа: "${textNotes.trim() || 'Пустой ответ'}". Попробуйте уточнить промпт или выбрать режим максимальной точности.`
      );
    }

    return {
      id: 'gen_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
      imageBase64: resultImageBase64,
      mimeType: resultMimeType,
      width: 1920,
      height: 1080,
      model: this.currentModel,
      provider: this.name,
      promptUsed: options.prompt,
      latencyMs,
      timestamp: Date.now(),
      textNotes: textNotes.trim() || undefined,
    };
  }

  async refine(previousResult: GenerationResult, refinementInstruction: string): Promise<GenerationResult> {
    const refinedPrompt = `Refine and modify the previous interior visualization according to this specific architect instruction: "${refinementInstruction}". Retain all other materials, camera angles, and furniture geometry exactly as they are.`;

    return this.generate({
      prompt: refinedPrompt,
      sourceImageBase64: previousResult.imageBase64,
      sourceImageMimeType: previousResult.mimeType,
      roomType: 'interior',
      styleName: 'custom',
      geometryMode: 'strict',
      parentTurn: {
        prompt: previousResult.promptUsed,
        outputImageBase64: previousResult.imageBase64,
      },
    });
  }
}

export const geminiProvider = new GeminiProvider();
