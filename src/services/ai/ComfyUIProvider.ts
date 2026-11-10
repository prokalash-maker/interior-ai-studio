import { IAIProvider, GenerateImageOptions, GenerationResult, ConnectionTestResult } from '../../types/ai';

async function readImageDimensions(source: string, mimeType: string): Promise<{ width: number; height: number } | null> {
  if (typeof Image === 'undefined') return null;
  const src = source.startsWith('data:') ? source : `data:${mimeType};base64,${source}`;
  return new Promise((resolve) => {
    const image = new Image();
    image.onload = () => resolve({ width: image.naturalWidth, height: image.naturalHeight });
    image.onerror = () => resolve(null);
    image.src = src;
  });
}

export interface ComfyUISystemStats {
  system: {
    os: string;
    ram_total: number;
    ram_free: number;
    comfyui_version: string;
  };
  devices: Array<{
    name: string;
    type: string;
    vram_total: number;
    vram_free: number;
    torch_vram_total: number;
  }>;
}

export class ComfyUIProvider implements IAIProvider {
  readonly id = 'comfyui_local';
  readonly name = 'ComfyUI (Локальный сервер • RTX 4050)';

  private serverUrl: string = 'http://127.0.0.1:8188';
  private model: string = 'comfyui-sdxl';

  readonly supportedModels: string[] = [
    'comfyui-sdxl',           // ComfyUI + Juggernaut XL (Мастер-фотореализм PBR)
    'comfyui-z-image-turbo',   // Z-Image Turbo 8-Steps (Официальный шаблон ComfyUI.org)
    'comfyui-flux-schnell',   // ComfyUI + FLUX.1 Schnell FP8
  ];

  constructor() {
    this.loadSavedSettings();
  }

  private loadSavedSettings() {
    if (typeof window !== 'undefined') {
      const savedUrl = localStorage.getItem('comfyui_server_url');
      if (savedUrl) this.serverUrl = savedUrl;

      const savedModel = localStorage.getItem('comfyui_model');
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
        localStorage.setItem('comfyui_model', modelId);
      }
    }
  }

  setServerUrl(url: string) {
    let clean = url.trim();
    if (clean.endsWith('/')) clean = clean.slice(0, -1);
    this.serverUrl = clean || 'http://127.0.0.1:8188';
    if (typeof window !== 'undefined') {
      localStorage.setItem('comfyui_server_url', this.serverUrl);
    }
  }

  getServerUrl(): string {
    return this.serverUrl;
  }

  async initialize(credentials: Record<string, string>): Promise<void> {
    if (credentials.serverUrl) this.setServerUrl(credentials.serverUrl);
    if (credentials.model) this.setModel(credentials.model);
  }

  /**
   * Universal HTTP request dispatcher.
   * In Electron, routes through main-process IPC to completely bypass browser CORS & Private Network Access restrictions.
   */
  private async request(path: string, options: {
    method?: string;
    headers?: Record<string, string>;
    body?: any;
    isBinary?: boolean;
    uploadBase64?: string;
    uploadFilename?: string;
    mimeType?: string;
  } = {}): Promise<any> {
    const fullUrl = path.startsWith('http') ? path : `${this.serverUrl}${path}`;

    // Prefer Electron IPC proxy to eliminate any CORS or Private Network Access blocks
    if (typeof window !== 'undefined' && window.electronAPI?.comfyuiFetch) {
      const res = await window.electronAPI.comfyuiFetch({
        url: fullUrl,
        method: options.method || 'GET',
        headers: options.headers,
        body: options.body,
        isBinary: options.isBinary,
        uploadBase64: options.uploadBase64,
        uploadFilename: options.uploadFilename,
        mimeType: options.mimeType,
      });

      if (!res.success) {
        throw new Error(res.error || `ComfyUI request failed (${res.status || 'network error'})`);
      }
      return res.data;
    }

    // Direct browser fetch fallback
    if (options.uploadBase64) {
      const cleanB64 = options.uploadBase64.replace(/^data:image\/[a-z]+;base64,/, '');
      const byteCharacters = atob(cleanB64);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      const blob = new Blob([byteArray], { type: options.mimeType || 'image/png' });

      const formData = new FormData();
      formData.append('image', blob, options.uploadFilename || 'clay_render.png');
      formData.append('overwrite', 'true');

      const res = await fetch(fullUrl, { method: 'POST', body: formData });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    }

    const fetchHeaders = { ...options.headers };
    let fetchBody: any = options.body;
    if (options.body && typeof options.body === 'object') {
      fetchBody = JSON.stringify(options.body);
      fetchHeaders['Content-Type'] = 'application/json';
    }

    const res = await fetch(fullUrl, {
      method: options.method || 'GET',
      headers: fetchHeaders,
      body: fetchBody,
    });

    if (!res.ok) {
      const txt = await res.text().catch(() => '');
      throw new Error(`HTTP ${res.status}: ${txt.substring(0, 150)}`);
    }

    if (options.isBinary) {
      const blob = await res.blob();
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });
    }

    return await res.json();
  }

  async testConnection(): Promise<ConnectionTestResult> {
    const startTime = performance.now();
    try {
      const data: ComfyUISystemStats = await this.request('/system_stats');
      const latencyMs = Math.round(performance.now() - startTime);

      const gpu = data?.devices?.[0];
      const vramTotalMb = gpu ? Math.round(gpu.vram_total / (1024 * 1024)) : 6141;
      const vramFreeMb = gpu ? Math.round(gpu.vram_free / (1024 * 1024)) : 0;
      const gpuName = gpu?.name || 'NVIDIA GeForce RTX 4050 Laptop';

      const [checkpointInfo, controlNetInfo, depthV2Info, depthMidasInfo] = await Promise.allSettled([
        this.request('/object_info/CheckpointLoaderSimple'),
        this.request('/object_info/ControlNetLoader'),
        this.request('/object_info/DepthAnythingV2Preprocessor'),
        this.request('/object_info/MiDaS-DepthMapPreprocessor'),
      ]);
      const availableCheckpoints = checkpointInfo.status === 'fulfilled'
        ? checkpointInfo.value?.CheckpointLoaderSimple?.input?.required?.ckpt_name?.[0] || []
        : [];
      const availableControlNets = controlNetInfo.status === 'fulfilled'
        ? controlNetInfo.value?.ControlNetLoader?.input?.required?.control_net_name?.[0] || []
        : [];
      const hasCanny = availableControlNets.some((name: string) => /canny/i.test(name));
      const hasDepthModel = availableControlNets.some((name: string) => /depth/i.test(name));
      const hasDepthPreprocessor = (depthV2Info.status === 'fulfilled'
        && !!depthV2Info.value?.DepthAnythingV2Preprocessor)
        || (depthMidasInfo.status === 'fulfilled'
          && !!depthMidasInfo.value?.['MiDaS-DepthMapPreprocessor']);
      const missing: string[] = [];
      if (!availableCheckpoints.length) missing.push('не найден checkpoint');
      if (!hasCanny) missing.push('нет Canny ControlNet');
      if (hasDepthModel && !hasDepthPreprocessor) missing.push('Depth ControlNet найден без Depth-препроцессора');
      const controls = [
        hasCanny ? 'Canny готов' : 'Canny недоступен',
        hasDepthModel && hasDepthPreprocessor ? 'Depth готов' : hasDepthModel ? 'Depth требует препроцессор' : 'Depth-модель не найдена',
      ].join('; ');
      const vramFreeText = vramFreeMb ? `, свободно ${vramFreeMb} MB` : '';

      return {
        success: true,
        message: `ComfyUI онлайн (${latencyMs}мс). GPU: ${gpuName} (${vramTotalMb} MB${vramFreeText}). Checkpoints: ${availableCheckpoints.length}. ${controls}.${missing.length ? ` Предупреждения: ${missing.join('; ')}.` : ''}`,
        latencyMs,
        modelsFound: availableCheckpoints.length > 0 ? availableCheckpoints : this.supportedModels,
      };
    } catch (e: any) {
      return {
        success: false,
        message: `ComfyUI не запущен на ${this.serverUrl}. Запустите scripts\\start-comfyui.bat для аппаратного ускорения RTX 4050. (${e.message})`,
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
      width = 896;
      height = 512;
    } else if (resolution === '4k') {
      width = 1344;
      height = 768; // Upscaled via ComfyUI
    }

    // 1. Upload input Archicad clay render to ComfyUI
    const uploadedImageName = await this.uploadImageToComfyUI(
      options.sourceImageBase64,
      options.sourceImageMimeType || 'image/png'
    );
    const sourceDimensions = await readImageDimensions(
      options.sourceImageBase64,
      options.sourceImageMimeType || 'image/png'
    );

    // 2. Query available checkpoints to pick optimal one
    let targetCheckpoint = 'juggernautXL_v9_photo.safetensors';
    try {
      const infoData = await this.request('/object_info/CheckpointLoaderSimple');
      const list: string[] = infoData?.CheckpointLoaderSimple?.input?.required?.ckpt_name?.[0] || [];
      if (list.length > 0) {
        if (this.model === 'comfyui-z-image-turbo') {
          const zFound = list.find((c) => /z_image|turbo/i.test(c));
          targetCheckpoint = zFound || 'z_image_turbo_bf16.safetensors';
        } else {
          const found = list.find((c) => /juggernaut|realvis/i.test(c)) || list.find((c) => /sdxl/i.test(c));
          targetCheckpoint = found || list[0];
        }
      }
    } catch (_) {}

    // 3. Geometry preservation (denoising strength) & Render Time Budget:
    // Image-to-image denoise must stay moderate for clay-render materialization;
    // high values discard the source image and let ControlNet approximate layout.
    const defaultDenoise = options.geometryMode === 'strict' ? 0.42 : options.geometryMode === 'creative' ? 0.70 : 0.52;
    const denoise = typeof options.advancedSettings?.denoise === 'number'
      ? options.advancedSettings.denoise
      : defaultDenoise;

    // Target render time in seconds (user configurable budget: from 15 sec up to 60 minutes)
    const targetTime = options.advancedSettings?.targetRenderTimeSec || 35;
    let isTwoPass = false;
    let isMultiPassUltra = false;
    let isDeepIterative = false;
    let steps: number;

    if (this.model === 'comfyui-z-image-turbo') {
      // Official ComfyUI.org Template: Z-Image-Turbo 8-steps lightning speed
      steps = 8;
      if (targetTime > 60) isTwoPass = true;
      if (targetTime >= 300) isMultiPassUltra = true;
      if (targetTime >= 1200) isDeepIterative = true;
    } else if (this.model === 'comfyui-flux-schnell') {
      steps = Math.max(4, Math.min(24, Math.round(targetTime / 4)));
    } else {
      // SDXL Juggernaut on RTX 4050: dynamically scale resolution and pass count to strictly match user's time budget
      if (targetTime <= 25) {
        width = 1024;
        height = 576;
        steps = 20; // Fast preview (~15-20s)
      } else if (targetTime <= 50) {
        width = 1024;
        height = 576;
        steps = Math.max(25, Math.min(45, Math.round(targetTime * 0.95))); // ~35-45s
      } else if (targetTime <= 90) {
        width = 1152;
        height = 648;
        steps = Math.max(45, Math.min(75, Math.round(targetTime * 0.90))); // ~60-80s
      } else if (targetTime <= 240) {
        // 2 - 4 minutes: 2-Pass Refinement
        width = 1280;
        height = 720;
        isTwoPass = true;
        steps = 45; // Pass 1 (45 steps) + Pass 2 (35 steps) = ~120-180s
      } else if (targetTime <= 900) {
        // 5 - 15 minutes: 3-Pass Master Architectural Pipeline
        width = 1408;
        height = 792;
        isTwoPass = true;
        isMultiPassUltra = true;
        steps = Math.min(75, Math.max(50, Math.round(targetTime / 14))); // Pass 1 (65) + Pass 2 (55) + Pass 3 (50) on 1408x792 (~300-700s)
      } else {
        // 15 - 60 minutes: keep the latent below 2K on 6 GB GPUs. A 2560x1440
        // SDXL latent is a common OOM trigger even when ComfyUI uses --lowvram.
        width = 1536;
        height = 864;
        isTwoPass = true;
        isMultiPassUltra = true;
        isDeepIterative = true;
        steps = Math.min(95, Math.max(70, Math.round(targetTime / 35))); // 4 passes at 1536 -> 2048 -> 2560 (~1200-3200s)
      }
    }

    // Keep the Archicad camera framing intact. ImageScale stretches to an exact
    // width/height, so derive a same-area 64px-aligned canvas from the source ratio.
    if (sourceDimensions?.width && sourceDimensions.height) {
      const targetArea = width * height;
      const aspectRatio = sourceDimensions.width / sourceDimensions.height;
      const alignedDimension = (value: number) => Math.max(512, Math.round(value / 8) * 8);
      width = alignedDimension(Math.sqrt(targetArea * aspectRatio));
      height = alignedDimension(width / aspectRatio);
    }

    // Crucial for SDXL: CFG must remain at 3.8-4.2. For Z-Image Turbo / FLUX: CFG is strictly 1.0
    const defaultCfg = (this.model === 'comfyui-z-image-turbo' || this.model === 'comfyui-flux-schnell') ? 1.0 : 4.0;
    const cfg = options.advancedSettings?.cfg ?? defaultCfg;
    const defaultSampler = this.model === 'comfyui-z-image-turbo' ? 'res_multistep' : (this.model === 'comfyui-flux-schnell' ? 'euler' : 'dpmpp_2m');
    const samplerName = options.advancedSettings?.samplerName || defaultSampler;
    const defaultScheduler = (this.model === 'comfyui-z-image-turbo' || this.model === 'comfyui-flux-schnell') ? 'simple' : 'karras';
    const scheduler = options.advancedSettings?.scheduler || defaultScheduler;
    const seed = (typeof options.advancedSettings?.seed === 'number' && options.advancedSettings.seed >= 0)
      ? Math.floor(options.advancedSettings.seed)
      : Math.floor(Math.random() * 999999999);

    const edgeStrength = typeof options.advancedSettings?.edgeControlStrength === 'number'
      ? options.advancedSettings.edgeControlStrength
      : (options.geometryMode === 'strict' ? 0.85 : options.geometryMode === 'creative' ? 0.65 : 0.80);

    const depthStrength = typeof options.advancedSettings?.depthControlStrength === 'number'
      ? options.advancedSettings.depthControlStrength
      : 0.70;

    // Compose concise, front-loaded prompt optimized for diffusion models (SDXL / FLUX CLIP)
    const positivePrompt = this.formatDiffusionPrompt(options);
    const negativePrompt = options.negativePrompt || 
      'changed room layout, changed camera angle, moved windows, relocated furniture, redesigned cabinets, mixed cabinet finishes, white cabinets, grey clay, monochrome, duplicate furniture, extra furniture, deformed chairs, warped walls, distorted geometry, floating objects, malformed appliances, unrealistic proportions, invented architecture, excessive decoration, plastic CGI, illustration, painting, cartoon, blurry, low detail, oversaturated, watermark, signature';

    // 4. Construct ComfyUI Prompt Workflow Graph (SDXL vs FLUX.1 Schnell)
    const clientId = 'interior_ai_' + Math.random().toString(36).substring(2, 9);
    let promptGraph: Record<string, any>;
    const appliedControlNets: string[] = [];

    if (this.model === 'comfyui-flux-schnell') {
      // FLUX.1 Schnell Architecture Img2Img Graph
      promptGraph = {
        '1': {
          inputs: { unet_name: 'flux1-schnell-fp8.safetensors', weight_dtype: 'fp8_e4m3fn' },
          class_type: 'UNETLoader',
        },
        '2': {
          inputs: { clip_name1: 't5xxl_fp8_e4m3fn.safetensors', clip_name2: 'clip_l.safetensors', type: 'flux' },
          class_type: 'DualCLIPLoader',
        },
        '3': {
          inputs: { vae_name: 'ae.safetensors' },
          class_type: 'VAELoader',
        },
        '4': {
          inputs: { image: uploadedImageName },
          class_type: 'LoadImage',
        },
        '5': {
          inputs: {
            image: ['4', 0],
            upscale_method: 'lanczos',
            width,
            height,
            crop: 'disabled',
          },
          class_type: 'ImageScale',
        },
        '6': {
          inputs: { pixels: ['5', 0], vae: ['3', 0] },
          class_type: 'VAEEncode',
        },
        '7': {
          inputs: { text: positivePrompt, clip: ['2', 0] },
          class_type: 'CLIPTextEncode',
        },
        '8': {
          inputs: { text: negativePrompt, clip: ['2', 0] },
          class_type: 'CLIPTextEncode',
        },
        '9': {
          inputs: {
            seed,
            steps,
            cfg,
            sampler_name: samplerName,
            scheduler,
            denoise,
            model: ['1', 0],
            positive: ['7', 0],
            negative: ['8', 0],
            latent_image: ['6', 0],
          },
          class_type: 'KSampler',
        },
        '10': {
          inputs: { samples: ['9', 0], vae: ['3', 0] },
          class_type: 'VAEDecode',
        },
        '11': {
          inputs: { filename_prefix: 'InteriorAI_FLUX', images: ['10', 0] },
          class_type: 'SaveImage',
        },
      };
    } else {
      // SDXL Architecture Img2Img Graph with ImageScale, VAEEncode and ControlNet (Canny & Depth)
      // Discover available ControlNet models dynamically
      let cannyModel: string | null = null;
      let depthModel: string | null = null;
      let depthPreprocessor: { classType: string; inputs: Record<string, any> } | null = null;

      try {
        const cnInfo = await this.request('/object_info/ControlNetLoader');
        const availableCNs: string[] = cnInfo?.ControlNetLoader?.input?.required?.control_net_name?.[0] || [];
        cannyModel = availableCNs.find((m) => /canny/i.test(m)) || null;
        depthModel = availableCNs.find((m) => /depth/i.test(m)) || null;
      } catch (_) {}

      // A Depth ControlNet expects a depth map, not the source RGB render. Use a
      // known preprocessor only when it is installed; otherwise fall back to Canny.
      if (depthModel) {
        const preprocessors: Array<{ classType: string; inputs: Record<string, any> }> = [
          // Small (ViT-S) weights keep preprocessing light on 6 GB GPUs and use
          // the Apache-2.0 checkpoint, rather than the larger non-commercial ViT-L.
          { classType: 'DepthAnythingV2Preprocessor', inputs: { ckpt_name: 'depth_anything_v2_vits.pth', resolution: 512 } },
          { classType: 'MiDaS-DepthMapPreprocessor', inputs: { a: 6.283, bg_threshold: 0.1 } },
        ];
        for (const candidate of preprocessors) {
          try {
            const info = await this.request(`/object_info/${encodeURIComponent(candidate.classType)}`);
            const nodeInfo = info?.[candidate.classType];
            if (!nodeInfo) continue;
            const required = nodeInfo.input?.required || {};
            const optional = nodeInfo.input?.optional || {};
            if (!required.image && !optional.image) continue;

            // Object Info lists the valid options/defaults for each required input.
            // Resolve those values instead of assuming one plugin version's schema.
            let schemaIsUsable = true;
            for (const [inputName, inputSpec] of Object.entries(required) as Array<[string, any]>) {
              if (inputName === 'image' || inputName in candidate.inputs) continue;
              const choices = Array.isArray(inputSpec?.[0]) ? inputSpec[0] : null;
              const metadata = inputSpec?.[1];
              if (choices?.length) candidate.inputs[inputName] = choices[0];
              else if (metadata && typeof metadata === 'object' && 'default' in metadata) candidate.inputs[inputName] = metadata.default;
              else if (metadata && typeof metadata === 'object' && 'min' in metadata) candidate.inputs[inputName] = metadata.min;
              else schemaIsUsable = false;
            }
            if (!schemaIsUsable) continue;
            depthPreprocessor = candidate;
            break;
          } catch (_) {}
        }
      }

      // Geometry preservation takes precedence over the optional pure-latent
      // mode. An empty latent cannot retain source colors, object silhouettes,
      // or the exact cabinet/furniture arrangement.
      const usePureLatent = options.advancedSettings?.preserveGeometry === false
        && options.advancedSettings?.usePureEmptyLatent === true;

      // Core Graph: LoadImage -> ImageScale -> (EmptyLatentImage or VAEEncode)
      // Pure EmptyLatent eliminates grey clay bias completely while ControlNet pins exact 3D geometry
      promptGraph = {
        '1': {
          inputs: { ckpt_name: targetCheckpoint },
          class_type: 'CheckpointLoaderSimple',
        },
        '2': {
          inputs: { image: uploadedImageName },
          class_type: 'LoadImage',
        },
        '3': {
          inputs: {
            image: ['2', 0],
            upscale_method: 'lanczos',
            width,
            height,
            crop: 'disabled',
          },
          class_type: 'ImageScale',
        },
        '4': usePureLatent
          ? {
              inputs: { width, height, batch_size: 1 },
              class_type: 'EmptyLatentImage',
            }
          : {
              inputs: { pixels: ['3', 0], vae: ['1', 2] },
              class_type: 'VAEEncode',
            },
      };

      let activeModel = ['1', 0];
      let activeClip = ['1', 1];
      let nextNodeId = 5;

      // Optional LoRA injection for Architectural Fine-Tuning
      if (options.advancedSettings?.loraModel && (options.advancedSettings?.loraStrength ?? 0) > 0) {
        const loraNodeId = String(nextNodeId++);
        promptGraph[loraNodeId] = {
          inputs: {
            lora_name: options.advancedSettings.loraModel,
            strength_model: options.advancedSettings.loraStrength ?? 0.85,
            strength_clip: options.advancedSettings.loraStrength ?? 0.85,
            model: activeModel,
            clip: activeClip,
          },
          class_type: 'LoraLoader',
        };
        activeModel = [loraNodeId, 0];
        activeClip = [loraNodeId, 1];
      }

      const posNodeId = String(nextNodeId++);
      const negNodeId = String(nextNodeId++);
      promptGraph[posNodeId] = {
        inputs: { text: positivePrompt, clip: activeClip },
        class_type: 'CLIPTextEncode',
      };
      promptGraph[negNodeId] = {
        inputs: { text: negativePrompt, clip: activeClip },
        class_type: 'CLIPTextEncode',
      };

      let activePositive = [posNodeId, 0];
      let activeNegative = [negNodeId, 0];

      // Connect Canny ControlNet if model is installed and strength > 0
      if (cannyModel && edgeStrength > 0) {
        const cannyPreId = String(nextNodeId++);
        const cannyLoaderId = String(nextNodeId++);
        const cannyApplyId = String(nextNodeId++);

        promptGraph[cannyPreId] = {
          inputs: {
            image: ['3', 0],
            low_threshold: 0.25,
            high_threshold: 0.55,
          },
          class_type: 'Canny',
        };

        promptGraph[cannyLoaderId] = {
          inputs: { control_net_name: cannyModel },
          class_type: 'ControlNetLoader',
        };

        promptGraph[cannyApplyId] = {
          inputs: {
            positive: activePositive,
            negative: activeNegative,
            control_net: [cannyLoaderId, 0],
            image: [cannyPreId, 0],
            strength: edgeStrength,
            start_percent: 0.0,
            end_percent: 0.70,
          },
          class_type: 'ControlNetApplyAdvanced',
        };

        activePositive = [cannyApplyId, 0];
        activeNegative = [cannyApplyId, 1];
        appliedControlNets.push(`Canny (${cannyModel}, сила: ${edgeStrength})`);
      }

      // Connect depth only when both the model and an actual depth preprocessor exist.
      if (depthModel && depthPreprocessor && depthStrength > 0.05) {
        const depthLoaderId = String(nextNodeId++);
        const depthPreId = String(nextNodeId++);
        const depthApplyId = String(nextNodeId++);

        promptGraph[depthLoaderId] = {
          inputs: { control_net_name: depthModel },
          class_type: 'ControlNetLoader',
        };

        promptGraph[depthPreId] = {
          inputs: { image: ['3', 0], ...depthPreprocessor.inputs },
          class_type: depthPreprocessor.classType,
        };

        promptGraph[depthApplyId] = {
          inputs: {
            positive: activePositive,
            negative: activeNegative,
            control_net: [depthLoaderId, 0],
            image: [depthPreId, 0],
            strength: depthStrength,
            start_percent: 0.0,
            end_percent: 0.70,
          },
          class_type: 'ControlNetApplyAdvanced',
        };

        activePositive = [depthApplyId, 0];
        activeNegative = [depthApplyId, 1];
        appliedControlNets.push(`Depth (${depthModel}, ${depthPreprocessor.classType}, сила: ${depthStrength})`);
      }

      // KSampler Pass 1: Base pass (builds architecture & physical materials locked with Canny & Depth)
      const ksamplerId = String(nextNodeId++);
      promptGraph[ksamplerId] = {
        inputs: {
          seed,
          steps,
          cfg,
          sampler_name: samplerName,
          scheduler,
          denoise: usePureLatent ? 1.0 : denoise,
          model: activeModel,
          positive: activePositive,
          negative: activeNegative,
          latent_image: ['4', 0],
        },
        class_type: 'KSampler',
      };

      let finalLatentNodeId = ksamplerId;

      if (isDeepIterative) {
        // Deep Iterative 15 - 60 minute render:
        // Pass 1: Base geometry (1536x864, steps ~70-95)
        // Stage 1.5: Latent Upscale 1.25x (1920x1080 cap for 6 GB VRAM).
        const latentUpscaleId = String(nextNodeId++);
        promptGraph[latentUpscaleId] = {
          inputs: {
            samples: [ksamplerId, 0],
            upscale_method: 'bicubic',
            scale_by: 1.25,
          },
          class_type: 'LatentUpscaleBy',
        };

        // Pass 2: High-Resolution Surface Sculpting at 2K (Fine wood grain, stone veins, metal brush lines)
        const ksampler2Id = String(nextNodeId++);
        promptGraph[ksampler2Id] = {
          inputs: {
            seed: seed + 1,
            steps: Math.max(45, Math.round(steps * 0.85)),
            cfg: Math.min(cfg, 4.0),
            sampler_name: samplerName,
            scheduler,
            denoise: 0.28,
            model: activeModel,
            positive: activePositive,
            negative: activeNegative,
            latent_image: [latentUpscaleId, 0],
          },
          class_type: 'KSampler',
        };

        // Pass 3 refines details at the same 1920x1080 latent size.
        const ksampler3Id = String(nextNodeId++);
        promptGraph[ksampler3Id] = {
          inputs: {
            seed: seed + 2,
            steps: Math.max(40, Math.round(steps * 0.75)),
            cfg: Math.min(cfg, 3.8),
            sampler_name: samplerName,
            scheduler,
            denoise: 0.20,
            model: activeModel,
            positive: activePositive,
            negative: activeNegative,
            latent_image: [ksampler2Id, 0],
          },
          class_type: 'KSampler',
        };

        finalLatentNodeId = ksampler3Id;
      } else if (isMultiPassUltra) {
        // Multi-Stage Master Architectural Pipeline for 5 - 15 minute passes (1408x792 -> 1760x990):
        const latentUpscaleId = String(nextNodeId++);
        promptGraph[latentUpscaleId] = {
          inputs: {
            samples: [ksamplerId, 0],
            upscale_method: 'bicubic',
            scale_by: 1.25,
          },
          class_type: 'LatentUpscaleBy',
        };

        const ksampler2Id = String(nextNodeId++);
        promptGraph[ksampler2Id] = {
          inputs: {
            seed: seed + 1,
            steps: Math.max(35, Math.round(steps * 0.9)),
            cfg: Math.min(cfg, 4.0),
            sampler_name: samplerName,
            scheduler,
            denoise: 0.28,
            model: activeModel,
            positive: activePositive,
            negative: activeNegative,
            latent_image: [latentUpscaleId, 0],
          },
          class_type: 'KSampler',
        };

        const ksampler3Id = String(nextNodeId++);
        promptGraph[ksampler3Id] = {
          inputs: {
            seed: seed + 2,
            steps: Math.max(30, Math.round(steps * 0.8)),
            cfg: Math.min(cfg, 3.8),
            sampler_name: samplerName,
            scheduler,
            denoise: 0.16,
            model: activeModel,
            positive: activePositive,
            negative: activeNegative,
            latent_image: [ksampler2Id, 0],
          },
          class_type: 'KSampler',
        };
        finalLatentNodeId = ksampler3Id;
      } else if (isTwoPass) {
        // Standard 2-Pass Refinement (1.5 - 3 minutes)
        const ksampler2Id = String(nextNodeId++);
        promptGraph[ksampler2Id] = {
          inputs: {
            seed: seed + 1,
            steps: Math.max(25, Math.round(steps * 0.8)),
            cfg: Math.min(cfg, 4.0),
            sampler_name: samplerName,
            scheduler,
            denoise: 0.28,
            model: activeModel,
            positive: activePositive,
            negative: activeNegative,
            latent_image: [ksamplerId, 0],
          },
          class_type: 'KSampler',
        };
        finalLatentNodeId = ksampler2Id;
      }

      // VAEDecode: reconstructs photorealistic pixels from denoised latent
      const vaeDecodeId = String(nextNodeId++);
      promptGraph[vaeDecodeId] = {
        inputs: { samples: [finalLatentNodeId, 0], vae: ['1', 2] },
        class_type: 'VAEDecode',
      };

      // SaveImage: writes the output
      const saveImageId = String(nextNodeId++);
      promptGraph[saveImageId] = {
        inputs: { filename_prefix: 'InteriorAI_Arch', images: [vaeDecodeId, 0] },
        class_type: 'SaveImage',
      };
    }

    // 5. Submit Workflow to ComfyUI Queue
    const submitData = await this.request('/prompt', {
      method: 'POST',
      body: {
        prompt: promptGraph,
        client_id: clientId,
      },
    });

    const prompt_id = submitData?.prompt_id;
    if (!prompt_id) {
      throw new Error('ComfyUI не вернул prompt_id.');
    }

    // 6. Poll for output image (timeout dynamically scaled to target render time up to 60+ minutes)
    const maxWaitSec = Math.max(1800, Math.ceil((targetTime || 60) * 1.5));
    const { filename, subfolder } = await this.pollComfyUIHistory(prompt_id, maxWaitSec);

    // 7. Download output image and return as Base64
    const imageBase64 = await this.fetchComfyUIImage(filename, subfolder);
    const latencyMs = Math.round(performance.now() - startTime);

    return {
      id: 'gen_comfyui_' + Date.now(),
      imageBase64,
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
      textNotes: `ComfyUI (${this.model === 'comfyui-flux-schnell' ? 'FLUX.1 Schnell FP8' : targetCheckpoint}) • Denoise: ${denoise} • Steps: ${steps} • CFG: ${cfg} • Seed: ${seed}${appliedControlNets.length > 0 ? ` • ControlNet: ${appliedControlNets.join(' + ')}` : ' • Чистый Img2Img (без ControlNet)'}`,
    };
  }

  private async uploadImageToComfyUI(base64Data: string, mimeType: string): Promise<string> {
    const fileName = `archicad_input_${Date.now()}.png`;
    const data = await this.request('/upload/image', {
      method: 'POST',
      uploadBase64: base64Data,
      uploadFilename: fileName,
      mimeType,
    });
    return data?.name || fileName;
  }

  private async pollComfyUIHistory(promptId: string, maxAttempts = 1500): Promise<{ filename: string; subfolder: string }> {
    for (let i = 0; i < maxAttempts; i++) {
      await new Promise((r) => setTimeout(r, 1200));

      try {
        const history = await this.request(`/history/${promptId}`);
        const run = history?.[promptId];
        if (run) {
          // Immediately detect execution failure from ComfyUI (node errors, missing model, OOM, etc.)
          if (run.status?.status_str === 'error') {
            const errDetails = run.status?.messages?.[0]?.[1];
            const errMsg = errDetails?.exception_message || errDetails?.node_type || JSON.stringify(run.status.messages);
            throw new Error(`ComfyUI ошибка при рендере: ${errMsg}`);
          }

          if (run.outputs) {
            // Find output node with images
            for (const nodeId of Object.keys(run.outputs)) {
              const nodeOut = run.outputs[nodeId];
              if (nodeOut.images && nodeOut.images.length > 0) {
                const img = nodeOut.images[0];
                return { filename: img.filename, subfolder: img.subfolder || '' };
              }
            }
          }
        }
      } catch (err: any) {
        if (err.message?.includes('ComfyUI ошибка')) throw err;
      }
    }
    throw new Error('Таймаут генерации в ComfyUI (превышено время ожидания 30 мин).');
  }

  private formatDiffusionPrompt(options: GenerateImageOptions): string {
    const room = options.roomType ? options.roomType.replace(/_/g, ' ') : 'interior';
    const style = options.styleName || 'modern luxury';

    // SDXL's text encoder only attends to a short prompt. Put the design-critical
    // material assignment first, then preserve the source room and camera.
    const header = `Photorealistic ${style} ${room}; preserve source architecture, camera, window and furniture layout`;
    const compact = (value: string, maxWords: number) => value.trim().split(/\s+/).slice(0, maxWords).join(' ');

    // 2. Materials Block
    const materials: string[] = [];
    const customMaterials = options.customMaterials || options.advancedSettings?.customMaterials;
    if (customMaterials && customMaterials.trim()) {
      materials.push(customMaterials.trim());
    }

    const selectedMaterialText = options.selectedMaterialNames?.join(', ') || '';

    let materialReferenceText = '';
    if (options.materialReferences && options.materialReferences.length > 0) {
      materialReferenceText = options.materialReferences
        .map((m) => `${m.targetSurface} with ${m.name}`)
        .join(', ');
      materials.push(materialReferenceText);
    }

    if (materials.length === 0 && !selectedMaterialText) {
      if (room.includes('kitchen')) {
        materials.push('walnut veneer on all kitchen cabinetry, vertical wood grain, honed beige travertine backsplash, graphite stainless appliances, pale limestone floor');
      } else if (room.includes('living')) {
        materials.push('natural white oak wide-plank flooring, seamless beige microcement plaster feature wall, textured oatmeal bouclé sofa, travertine coffee table, matte black metal accents');
      } else if (room.includes('bedroom')) {
        materials.push('warm natural oak paneling, plush wool carpet, slubbed natural linen bedding, satin brass accent wall sconces');
      } else {
        materials.push('warm natural wood joinery with tactile grain, honed natural stone, matte black metal hardware');
      }
    }

    // 3. Lighting Block
    const customLighting = options.customLighting || options.advancedSettings?.customLighting;
    const lighting = customLighting && customLighting.trim()
      ? customLighting.trim()
      : 'soft window daylight, warm concealed lighting, realistic contact shadows';

    // 4. Details / Styling Block
    const customDecor = options.customDecor || options.advancedSettings?.customDecor;
    const details = customDecor && customDecor.trim()
      ? customDecor.trim()
      : 'restrained styling, subtle reflections';

    // 5. Finishing Standards (Corona / V-Ray 8k magazine look)
    const materialText = customMaterials?.trim()
      ? [
          compact(customMaterials.trim(), 16),
          compact(selectedMaterialText, 8),
          compact(materialReferenceText, 6),
        ].filter(Boolean).join(', ')
      : compact([
          selectedMaterialText,
          materialReferenceText,
          ...materials.filter((material) => material !== materialReferenceText),
        ].filter(Boolean).join(', '), 25);
    const fullPrompt = options.prompt?.trim() || '';
    const manualDirective = fullPrompt.match(/Specific Architect Directives:\s*([\s\S]*)$/i)?.[1]?.trim();
    const designInstruction = options.manualPromptOverride
      ? compact(fullPrompt, 18)
      : manualDirective || (fullPrompt.length <= 50 ? fullPrompt : '');
    const promptParts = [
      `Apply finishes consistently: ${materialText}.`,
      header,
    ];
    // Keep each field short so material, lighting and photo instructions fit
    // within SDXL's short text-encoder context instead of being silently cut.
    if (designInstruction) promptParts.push(compact(designInstruction, options.manualPromptOverride ? 18 : 10));
    promptParts.push(
      compact(lighting, 7),
      compact(details, 4),
      'architectural photo, realistic textures, natural light, crisp detail',
    );
    return `${promptParts.join(', ')}.`;
  }

  private async fetchComfyUIImage(filename: string, subfolder: string): Promise<string> {
    const path = `/view?filename=${encodeURIComponent(filename)}&subfolder=${encodeURIComponent(subfolder)}&type=output`;
    const dataUrl = await this.request(path, { isBinary: true });
    if (typeof dataUrl === 'string') {
      return dataUrl.replace(/^data:image\/[\w+.-]+;base64,/, '');
    }
    return '';
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

export const comfyuiProvider = new ComfyUIProvider();
