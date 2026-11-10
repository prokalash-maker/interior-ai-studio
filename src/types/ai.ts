export interface AdvancedAiSettings {
  denoise?: number;              // Denoising strength (e.g. 0.25 strict, 0.35 realistic, 0.50 creative)
  steps?: number;                // Sampling steps (e.g. 28)
  cfg?: number;                  // Classifier-Free Guidance scale (e.g. 6.0)
  seed?: number;                 // -1 for random seed, or integer
  samplerName?: string;          // e.g. 'dpmpp_2m', 'euler'
  scheduler?: string;            // e.g. 'karras', 'simple'
  depthControlStrength?: number; // 0.0 - 1.0 (default 0.9)
  edgeControlStrength?: number;  // 0.0 - 1.0 (default 0.65)
  preserveGeometry?: boolean;    // Strict room geometry preservation lock
  preserveFurniture?: boolean;   // Keep furniture and cabinet dimensions exact
  materialCreativity?: number;   // 0.0 - 1.0
  targetRenderTimeSec?: number;  // User-chosen render time target in seconds (e.g. 15s, 30s, 60s, 120s)
  enableTwoPassRefine?: boolean; // 2-pass latent refinement for ultra-detailed PBR
  customMaterials?: string;      // Manual custom materials definition
  customStyle?: string;          // Manual custom architectural style
  customLighting?: string;       // Manual lighting & fixtures setup
  customDecor?: string;          // Manual decor, accents & props
  loraModel?: string;            // Selected custom LoRA model (e.g. archicad_interior_sdxl.safetensors)
  loraStrength?: number;         // 0.0 - 1.5 LoRA weight
  multiPassUltra?: boolean;      // True 3-Pass / 4-Pass Deep Architecture Synthesis
  usePureEmptyLatent?: boolean;  // Generate from EmptyLatentImage (pure noise) + ControlNet (Canny/Depth) to prevent grey clay bias
}

export interface GenerateImageOptions {
  prompt: string;
  negativePrompt?: string;
  sourceImageBase64: string;
  sourceImageMimeType: string;
  roomType: string;
  styleName: string;
  selectedMaterialNames?: string[];
  manualPromptOverride?: boolean;
  geometryMode: 'strict' | 'balanced' | 'creative';
  resolution?: '1k' | '2k' | '4k';
  materialReferences?: import('./project').MaterialReference[];
  temperature?: number;
  advancedSettings?: AdvancedAiSettings;
  customMaterials?: string;
  customStyle?: string;
  customLighting?: string;
  customDecor?: string;
  // Multi-turn context for iterative edits
  parentTurn?: {
    prompt: string;
    outputImageBase64?: string;
  };
}

export interface GenerationResult {
  id: string;
  imageBase64: string;
  mimeType: string;
  width: number;
  height: number;
  model: string;
  provider: string;
  promptUsed: string;
  latencyMs: number;
  timestamp: number;
  resolution?: '1k' | '2k' | '4k';
  costUsd?: number;
  textNotes?: string;
}

export interface ConnectionTestResult {
  success: boolean;
  message: string;
  latencyMs?: number;
  modelsFound?: string[];
}

export interface IAIProvider {
  readonly id: string;
  readonly name: string;
  readonly currentModel: string;
  readonly supportedModels: string[];
  
  initialize(credentials: Record<string, string>): Promise<void>;
  testConnection(): Promise<ConnectionTestResult>;
  generate(options: GenerateImageOptions): Promise<GenerationResult>;
  refine(previousResult: GenerationResult, refinementInstruction: string): Promise<GenerationResult>;
}

export interface GeminiConfig {
  apiKey: string;
  model: string;
  temperature: number;
  safetyLevel: 'default' | 'relaxed';
}
