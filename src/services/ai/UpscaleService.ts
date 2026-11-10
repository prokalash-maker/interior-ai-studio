/**
 * UpscaleService.ts
 * True AI Super-Resolution & Diffusion Detail Synthesis for Interior AI Studio.
 *
 * Engines:
 * 1. comfyui_ultrasharp: Local Neural Super-Resolution via 4x-UltraSharp / RealESRGAN (RTX 4050)
 *    - Reconstructs crisp architectural edges, removes compression noise & blur
 *    - 100% strict preservation of room geometry (walls, cabinets, windows, furniture)
 * 2. comfyui_refiner: Local AI Micro-Texture Synthesis (4x-UltraSharp + SDXL Latent Refiner)
 *    - Synthesizes tactile wood pores, stone veins, realistic specular reflections
 *    - Checkpoint: juggernautXL_v9_photo.safetensors with controlled denoise (0.15 - 0.28)
 * 3. aihorde: Free Distributed Cloud GPU Network (RealESRGAN_x4plus)
 * 4. browser: Instant High-Precision Bicubic / Convolutional Unsharp Mask
 */

import { comfyuiProvider } from './ComfyUIProvider';
import { aiHordeProvider } from './AIHordeProvider';

export type UpscaleFactor = 2 | 4;
export type UpscaleProviderType = 'comfyui_ultrasharp' | 'comfyui_refiner' | 'aihorde' | 'browser';

export interface UpscaleOptions {
  imageBase64: string;
  mimeType?: string;
  sourceWidth: number;
  sourceHeight: number;
  scaleFactor: UpscaleFactor; // 2x or 4x
  provider: UpscaleProviderType;
  denoise?: number; // 0.15 - 0.30 (for comfyui_refiner)
  sharpness?: number; // 0 - 100 (for browser)
  prompt?: string;
  modelName?: string; // '4x-UltraSharp.pth' | 'RealESRGAN_x4plus.pth'
  allowFallback?: boolean;
}

export interface UpscaleResult {
  id: string;
  imageBase64: string;
  mimeType: string;
  width: number;
  height: number;
  scaleFactor: UpscaleFactor;
  provider: UpscaleProviderType;
  latencyMs: number;
  timestamp: number;
  notes: string;
}

class UpscaleService {
  /**
   * Main entry point to upscale an image
   */
  async upscaleImage(options: UpscaleOptions): Promise<UpscaleResult> {
    const startTime = performance.now();
    const rawTargetWidth = Math.round(options.sourceWidth * options.scaleFactor);
    const rawTargetHeight = Math.round(options.sourceHeight * options.scaleFactor);
    // Align to 64px grid for 100% stable SDXL VAE / KSampler tensor dimensions
    const targetWidth = Math.max(512, Math.round(rawTargetWidth / 64) * 64);
    const targetHeight = Math.max(512, Math.round(rawTargetHeight / 64) * 64);

    // 1. Local AI ComfyUI (Neural Super-Resolution: 4x-UltraSharp)
    if (options.provider === 'comfyui_ultrasharp') {
      try {
        return await this.upscaleComfyUINeural(options, targetWidth, targetHeight, startTime);
      } catch (err: any) {
        if (options.allowFallback) {
          console.warn('ComfyUI UltraSharp failed, falling back to browser upscale:', err.message);
          return await this.upscaleBrowser(options, targetWidth, targetHeight, startTime, `Fallback (ComfyUI: ${err.message})`);
        }
        throw new Error(`Ошибка локального нейро-апскейла ComfyUI: ${err.message}`);
      }
    }

    // 2. Local AI ComfyUI (Super-Resolution + SDXL Micro-PBR Refiner)
    if (options.provider === 'comfyui_refiner') {
      try {
        return await this.upscaleComfyUIRefiner(options, targetWidth, targetHeight, startTime);
      } catch (err: any) {
        if (options.allowFallback) {
          console.warn('ComfyUI Refiner failed, falling back to browser upscale:', err.message);
          return await this.upscaleBrowser(options, targetWidth, targetHeight, startTime, `Fallback (ComfyUI: ${err.message})`);
        }
        throw new Error(`Ошибка SDXL диффузионного рефайнера: ${err.message}`);
      }
    }

    // 3. Free Cloud AI Horde (RealESRGAN_x4plus)
    if (options.provider === 'aihorde') {
      try {
        return await this.upscaleAIHorde(options, targetWidth, targetHeight, startTime);
      } catch (err: any) {
        if (options.allowFallback) {
          console.warn('AI Horde upscaler failed, falling back to browser upscale:', err.message);
          return await this.upscaleBrowser(options, targetWidth, targetHeight, startTime, `Fallback (Horde: ${err.message})`);
        }
        throw new Error(`Ошибка облачного апскейла AI Horde: ${err.message}`);
      }
    }

    // 4. Default: Browser high-precision bicubic + unsharp mask
    return await this.upscaleBrowser(options, targetWidth, targetHeight, startTime);
  }

  /**
   * Local Neural Super-Resolution via ComfyUI (4x-UltraSharp / RealESRGAN)
   * Pure convolutional network: reconstructs micro-textures and sharp lines without geometry drift
   */
  private async upscaleComfyUINeural(
    options: UpscaleOptions,
    targetWidth: number,
    targetHeight: number,
    startTime: number
  ): Promise<UpscaleResult> {
    const isOnline = (await comfyuiProvider.testConnection()).success;
    if (!isOnline) {
      throw new Error('ComfyUI сервер выключен (порт 8188 не отвечает). Нажмите «Старт» в верхней панели.');
    }

    const cleanB64 = options.imageBase64.replace(/^data:image\/\w+;base64,/, '');
    const filename = `upscale_raw_${Date.now()}.png`;

    const uploadRes = await (comfyuiProvider as any).request('/upload/image', {
      method: 'POST',
      uploadBase64: cleanB64,
      uploadFilename: filename,
      mimeType: options.mimeType || 'image/png',
    });

    const uploadedName = uploadRes?.name || filename;
    const clientId = 'upscale_sharp_' + Math.random().toString(36).substring(2, 8);
    const upscaleModelName = options.modelName || '4x-UltraSharp.pth';

    // ComfyUI Graph:
    // 1. LoadImage
    // 2. UpscaleModelLoader (4x-UltraSharp.pth)
    // 3. ImageUpscaleWithModel (High-detail neural super-resolution)
    // 4. ImageScale (Rescales to exact targetWidth x targetHeight)
    // 5. SaveImage
    const workflow: Record<string, any> = {
      '1': {
        inputs: { image: uploadedName, upload: 'image' },
        class_type: 'LoadImage',
      },
      '2': {
        inputs: { model_name: upscaleModelName },
        class_type: 'UpscaleModelLoader',
      },
      '3': {
        inputs: {
          upscale_model: ['2', 0],
          image: ['1', 0],
        },
        class_type: 'ImageUpscaleWithModel',
      },
      '4': {
        inputs: {
          upscale_method: 'area',
          width: targetWidth,
          height: targetHeight,
          crop: 'disabled',
          image: ['3', 0],
        },
        class_type: 'ImageScale',
      },
      '5': {
        inputs: {
          filename_prefix: `InteriorAI_UltraSharp_${options.scaleFactor}x`,
          images: ['4', 0],
        },
        class_type: 'SaveImage',
      },
    };

    const promptData = await (comfyuiProvider as any).request('/prompt', {
      method: 'POST',
      body: { prompt: workflow, client_id: clientId },
    });

    const promptId = promptData?.prompt_id;
    if (!promptId) throw new Error('ComfyUI не принял задачу нейро-апскейла');

    const { filename: outName, subfolder } = await (comfyuiProvider as any).pollComfyUIHistory(promptId, 300);
    const outBase64 = await (comfyuiProvider as any).fetchComfyUIImage(outName, subfolder);
    const latencyMs = Math.round(performance.now() - startTime);

    return {
      id: 'upscale_ultrasharp_' + Date.now(),
      imageBase64: outBase64,
      mimeType: 'image/png',
      width: targetWidth,
      height: targetHeight,
      scaleFactor: options.scaleFactor,
      provider: 'comfyui_ultrasharp',
      latencyMs,
      timestamp: Date.now(),
      notes: `Нейросетевой AI-апскейл 4x-UltraSharp (${options.scaleFactor}x) • Разрешение: ${targetWidth}×${targetHeight} • RTX 4050 (${(latencyMs / 1000).toFixed(1)}с)`,
    };
  }

  /**
   * Local Diffusion Micro-Detail Refiner (4x-UltraSharp + SDXL Juggernaut Latent Pass)
   * Chains super-resolution with latent diffusion to synthesize ultra-photorealistic PBR nuances
   */
  private async upscaleComfyUIRefiner(
    options: UpscaleOptions,
    targetWidth: number,
    targetHeight: number,
    startTime: number
  ): Promise<UpscaleResult> {
    const isOnline = (await comfyuiProvider.testConnection()).success;
    if (!isOnline) {
      throw new Error('ComfyUI сервер выключен (порт 8188 не отвечает). Нажмите «Старт» в верхней панели.');
    }

    const cleanB64 = options.imageBase64.replace(/^data:image\/\w+;base64,/, '');
    const filename = `upscale_refine_${Date.now()}.png`;

    const uploadRes = await (comfyuiProvider as any).request('/upload/image', {
      method: 'POST',
      uploadBase64: cleanB64,
      uploadFilename: filename,
      mimeType: options.mimeType || 'image/png',
    });

    const uploadedName = uploadRes?.name || filename;
    const denoise = typeof options.denoise === 'number' ? options.denoise : 0.22;
    const clientId = 'upscale_refine_' + Math.random().toString(36).substring(2, 8);
    const upscaleModelName = options.modelName || '4x-UltraSharp.pth';
    const ckptName = 'juggernautXL_v9_photo.safetensors';

    // Graph:
    // 1. LoadImage
    // 2. UpscaleModelLoader (4x-UltraSharp)
    // 3. ImageUpscaleWithModel
    // 4. ImageScale to targetWidth x targetHeight
    // 5. CheckpointLoaderSimple (juggernautXL_v9_photo.safetensors)
    // 6. VAEEncode (scaled image)
    // 7. CLIPTextEncode (Positive Prompt: high architectural detail, wood pores, marble grain)
    // 8. CLIPTextEncode (Negative Prompt: blur, noise, altered structure)
    // 9. KSampler (denoise 0.18-0.28, DPM++ 2M Karras, 20 steps)
    // 10. VAEDecode
    // 11. SaveImage
    const promptText = options.prompt
      ? `${options.prompt}, 8k uhd architectural photography, sharp tactile wood texture, polished stone veins, clean edge bevels, physically accurate interior lighting`
      : 'high-end architectural interior photography, masterwork 8k resolution, razor sharp details, tactile wood grain, natural stone reflections, architectural digest';

    const workflow: Record<string, any> = {
      '1': {
        inputs: { image: uploadedName, upload: 'image' },
        class_type: 'LoadImage',
      },
      '2': {
        inputs: { model_name: upscaleModelName },
        class_type: 'UpscaleModelLoader',
      },
      '3': {
        inputs: {
          upscale_model: ['2', 0],
          image: ['1', 0],
        },
        class_type: 'ImageUpscaleWithModel',
      },
      '4': {
        inputs: {
          upscale_method: 'area',
          width: targetWidth,
          height: targetHeight,
          crop: 'disabled',
          image: ['3', 0],
        },
        class_type: 'ImageScale',
      },
      '5': {
        inputs: {
          ckpt_name: ckptName,
        },
        class_type: 'CheckpointLoaderSimple',
      },
      '6': {
        inputs: {
          pixels: ['4', 0],
          vae: ['5', 2],
        },
        class_type: 'VAEEncode',
      },
      '7': {
        inputs: {
          text: promptText,
          clip: ['5', 1],
        },
        class_type: 'CLIPTextEncode',
      },
      '8': {
        inputs: {
          text: 'blurry, out of focus, distorted architecture, displaced walls, floating elements, deformed furniture, noise, jpeg compression artifacts, cartoon, low quality',
          clip: ['5', 1],
        },
        class_type: 'CLIPTextEncode',
      },
      '9': {
        inputs: {
          seed: Math.floor(Math.random() * 999999999),
          steps: 20,
          cfg: 3.5,
          sampler_name: 'dpmpp_2m',
          scheduler: 'karras',
          denoise,
          model: ['5', 0],
          positive: ['7', 0],
          negative: ['8', 0],
          latent_image: ['6', 0],
        },
        class_type: 'KSampler',
      },
      '10': {
        inputs: {
          samples: ['9', 0],
          vae: ['5', 2],
        },
        class_type: 'VAEDecode',
      },
      '11': {
        inputs: {
          filename_prefix: `InteriorAI_Refine_${options.scaleFactor}x`,
          images: ['10', 0],
        },
        class_type: 'SaveImage',
      },
    };

    const promptData = await (comfyuiProvider as any).request('/prompt', {
      method: 'POST',
      body: { prompt: workflow, client_id: clientId },
    });

    const promptId = promptData?.prompt_id;
    if (!promptId) throw new Error('ComfyUI не принял задачу SDXL Refiner');

    const { filename: outName, subfolder } = await (comfyuiProvider as any).pollComfyUIHistory(promptId, 450);
    const outBase64 = await (comfyuiProvider as any).fetchComfyUIImage(outName, subfolder);
    const latencyMs = Math.round(performance.now() - startTime);

    return {
      id: 'upscale_refine_' + Date.now(),
      imageBase64: outBase64,
      mimeType: 'image/png',
      width: targetWidth,
      height: targetHeight,
      scaleFactor: options.scaleFactor,
      provider: 'comfyui_refiner',
      latencyMs,
      timestamp: Date.now(),
      notes: `AI Диффузионный рефайнер PBR (4x-UltraSharp + SDXL Juggernaut) • ${targetWidth}×${targetHeight} • Denoise: ${denoise} (${(latencyMs / 1000).toFixed(1)}с)`,
    };
  }

  /**
   * Free Cloud GPU Upscale via AI Horde (RealESRGAN_x4plus)
   */
  private async upscaleAIHorde(
    options: UpscaleOptions,
    targetWidth: number,
    targetHeight: number,
    startTime: number
  ): Promise<UpscaleResult> {
    const cleanB64 = options.imageBase64.replace(/^data:image\/\w+;base64,/, '');

    const postProcessing = ['RealESRGAN_x4plus'];

    const payload = {
      prompt: options.prompt || 'high-end architectural interior photography, masterwork, 8k',
      params: {
        steps: 1,
        cfg_scale: 1,
        denoising_strength: 0.1,
        width: Math.min(1024, options.sourceWidth),
        height: Math.min(1024, options.sourceHeight),
        post_processing: postProcessing,
        karras: true,
      },
      source_image: cleanB64,
      source_processing: 'img2img',
      models: ['stable_diffusion'],
      r2: true,
    };

    const submitRes = await fetch('https://aihorde.net/api/v2/generate/async', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: aiHordeProvider.getApiKey(),
        'Client-Agent': 'InteriorAIStudio:1.0:github.com',
      },
      body: JSON.stringify(payload),
    });

    if (!submitRes.ok) {
      throw new Error(`AI Horde ошибка: ${submitRes.statusText}`);
    }

    const { id: jobId } = await submitRes.json();
    if (!jobId) throw new Error('AI Horde не вернул ID задачи апскейла');

    // Poll for status
    let imgUrl: string | null = null;
    for (let i = 0; i < 90; i++) {
      await new Promise((r) => setTimeout(r, 2000));
      const checkRes = await fetch(`https://aihorde.net/api/v2/generate/check/${jobId}`);
      if (checkRes.ok) {
        const checkData = await checkRes.json();
        if (checkData.done) {
          const statusRes = await fetch(`https://aihorde.net/api/v2/generate/status/${jobId}`);
          if (statusRes.ok) {
            const statusData = await statusRes.json();
            if (statusData.generations && statusData.generations.length > 0) {
              imgUrl = statusData.generations[0].img;
              break;
            }
          }
        }
      }
    }

    if (!imgUrl) throw new Error('Таймаут апскейла в облаке AI Horde');

    // Download image from Horde
    const dl = await fetch(imgUrl);
    const blob = await dl.blob();
    const arrayBuffer = await blob.arrayBuffer();
    const b64 = Buffer.from(arrayBuffer).toString('base64');
    const latencyMs = Math.round(performance.now() - startTime);

    return {
      id: 'upscale_horde_' + Date.now(),
      imageBase64: b64,
      mimeType: 'image/webp',
      width: targetWidth,
      height: targetHeight,
      scaleFactor: options.scaleFactor,
      provider: 'aihorde',
      latencyMs,
      timestamp: Date.now(),
      notes: `Облачный AI GPU апскейл AI Horde (RealESRGAN x4) • ${targetWidth}×${targetHeight}`,
    };
  }

  /**
   * Browser-Native High-Precision Bicubic / Lanczos Upscale with Unsharp Mask
   */
  private async upscaleBrowser(
    options: UpscaleOptions,
    targetWidth: number,
    targetHeight: number,
    startTime: number,
    notePrefix?: string
  ): Promise<UpscaleResult> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      const cleanB64 = options.imageBase64.startsWith('data:')
        ? options.imageBase64
        : `data:${options.mimeType || 'image/png'};base64,${options.imageBase64}`;

      img.onload = () => {
        try {
          const canvas = document.createElement('canvas');
          canvas.width = targetWidth;
          canvas.height = targetHeight;
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            reject(new Error('Не удалось получить 2D контекст канваса'));
            return;
          }

          // Enable highest quality image smoothing
          ctx.imageSmoothingEnabled = true;
          ctx.imageSmoothingQuality = 'high';

          // Multi-step progressive upscale for ultra-smooth gradients
          if (options.scaleFactor === 4) {
            const midCanvas = document.createElement('canvas');
            midCanvas.width = options.sourceWidth * 2;
            midCanvas.height = options.sourceHeight * 2;
            const midCtx = midCanvas.getContext('2d');
            if (midCtx) {
              midCtx.imageSmoothingEnabled = true;
              midCtx.imageSmoothingQuality = 'high';
              midCtx.drawImage(img, 0, 0, midCanvas.width, midCanvas.height);
              ctx.drawImage(midCanvas, 0, 0, targetWidth, targetHeight);
            } else {
              ctx.drawImage(img, 0, 0, targetWidth, targetHeight);
            }
          } else {
            ctx.drawImage(img, 0, 0, targetWidth, targetHeight);
          }

          // Apply subtle unsharp mask sharpening filter
          this.applySharpeningFilter(ctx, targetWidth, targetHeight, options.sharpness || 35);

          const dataUrl = canvas.toDataURL('image/png', 0.98);
          const outBase64 = dataUrl.replace(/^data:image\/\w+;base64,/, '');
          const latencyMs = Math.round(performance.now() - startTime);

          resolve({
            id: 'upscale_browser_' + Date.now(),
            imageBase64: outBase64,
            mimeType: 'image/png',
            width: targetWidth,
            height: targetHeight,
            scaleFactor: options.scaleFactor,
            provider: 'browser',
            latencyMs,
            timestamp: Date.now(),
            notes: (notePrefix ? `${notePrefix} • ` : '') + `Быстрый Bicubic HD апскейл (${options.scaleFactor}x) • ${targetWidth}×${targetHeight}`,
          });
        } catch (e: any) {
          reject(e);
        }
      };

      img.onerror = () => reject(new Error('Не удалось загрузить исходное изображение для апскейла'));
      img.src = cleanB64;
    });
  }

  /**
   * Applies convolution-based unsharp mask to boost fine architectural edges
   */
  private applySharpeningFilter(
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    intensity: number
  ) {
    if (intensity <= 0) return;
    try {
      const imgData = ctx.getImageData(0, 0, width, height);
      const data = imgData.data;
      const factor = Math.min(0.5, (intensity / 100) * 0.4);

      // Lightweight 3x3 unsharp convolution kernel on luminance
      const buff = new Uint8ClampedArray(data);
      for (let y = 1; y < height - 1; y++) {
        for (let x = 1; x < width - 1; x++) {
          const idx = (y * width + x) * 4;
          for (let c = 0; c < 3; c++) {
            const current = buff[idx + c];
            const up = buff[((y - 1) * width + x) * 4 + c];
            const down = buff[((y + 1) * width + x) * 4 + c];
            const left = buff[(y * width + (x - 1)) * 4 + c];
            const right = buff[(y * width + (x + 1)) * 4 + c];
            const laplacian = 4 * current - up - down - left - right;
            data[idx + c] = Math.min(255, Math.max(0, current + factor * laplacian));
          }
        }
      }
      ctx.putImageData(imgData, 0, 0);
    } catch (_) {}
  }
}

export const upscaleService = new UpscaleService();
