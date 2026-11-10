export type RoomType =
  | 'living_room'
  | 'kitchen'
  | 'kitchen_living'
  | 'bedroom'
  | 'kids_room'
  | 'bathroom'
  | 'toilet'
  | 'hallway'
  | 'office'
  | 'dressing_room'
  | 'commercial'
  | 'other';

export interface RoomTypeOption {
  id: RoomType;
  labelRu: string;
  labelUk: string;
  labelEn: string;
  iconName: string;
}

export type GeometryPreservationMode = 'strict' | 'balanced' | 'creative';

export interface GeometryModeOption {
  id: GeometryPreservationMode;
  titleRu: string;
  titleUk: string;
  titleEn: string;
  descRu: string;
  descUk: string;
  descEn: string;
  fidelityScore: number;
}

export interface InteriorStyle {
  id: string;
  name: string;
  category: 'contemporary' | 'classic' | 'minimalist' | 'natural' | 'custom';
  descriptionRu: string;
  descriptionUk: string;
  descriptionEn: string;
  promptKeywords: string;
  defaultMaterials: string[];
  defaultLighting: string;
  previewColor: string;
  isCustom?: boolean;
}

export interface LightingOption {
  id: string;
  labelRu: string;
  labelUk: string;
  labelEn: string;
  promptDescription: string;
}

export interface AtmosphereOption {
  id: string;
  labelRu: string;
  labelUk: string;
  labelEn: string;
  promptDescription: string;
}

export interface MaterialOption {
  id: string;
  labelRu: string;
  labelUk: string;
  labelEn: string;
  promptDescription: string;
  category?: 'wood' | 'stone' | 'surface' | 'metal' | 'glass' | 'textile';
}

export type MaterialTargetSurface =
  | 'floor'
  | 'walls'
  | 'countertop'
  | 'cabinetry'
  | 'furniture'
  | 'textile'
  | 'ceiling'
  | 'accents'
  | 'general';

export interface MaterialReference {
  id: string;
  name: string;
  targetSurface: MaterialTargetSurface;
  type: 'image' | 'url' | 'text';
  imageBase64?: string;
  imageMimeType?: string;
  url?: string;
  notes?: string;
  createdAt: number;
}

export interface GenerationRecord {
  id: string;
  projectId: string;
  parentId?: string; // For multi-turn edits
  viewId?: string;
  sourceImagePath: string;
  sourceImageBase64?: string;
  outputImagePath: string;
  outputImageBase64?: string;
  prompt: string;
  styleId: string;
  roomType: RoomType;
  geometryMode: GeometryPreservationMode;
  lighting?: string;
  materials?: string[];
  materialReferences?: MaterialReference[];
  atmosphere?: string;
  provider: string;
  model: string;
  width: number;
  height: number;
  latencyMs: number;
  createdAt: number;
  resolution?: '1k' | '2k' | '4k';
  costUsd?: number;
  metadata?: Record<string, any>;
}

export interface ProjectView {
  id: string;
  name: string;
  sourceImagePath?: string;
  sourceImageBase64: string;
  sourceMimeType: string;
  resultImageBase64?: string;
  resultMimeType?: string;
  resultWidth?: number;
  resultHeight?: number;
  resultGenerationId?: string;
  approved: boolean;
  createdAt: number;
  updatedAt: number;
  designOverride?: string;
}

export interface ApprovedProjectDesign {
  masterViewId: string;
  masterGenerationId?: string;
  masterImageBase64?: string;
  masterMimeType: string;
  decisions: string;
  styleId?: string;
  materialIds?: string[];
  surfaceAssignments?: Partial<Record<'floor' | 'walls' | 'cabinetry' | 'countertop' | 'furniture' | 'textile', string>>;
  lightingId?: string;
  atmosphereId?: string;
  roomType?: string;
  geometryMode?: 'strict' | 'balanced' | 'creative';
  cameraOptics?: string;
  negativePrompt?: string;
  customStyle?: string;
  customMaterials?: string;
  customLighting?: string;
  customDecor?: string;
  approvedAt: number;
}

export interface ProjectDesignVariant extends ApprovedProjectDesign {
  id: string;
  name: string;
}

/** In-progress project settings, kept separate from the explicitly approved master design. */
export interface ProjectDesignDraft {
  styleId?: string;
  materialIds?: string[];
  surfaceAssignments?: Partial<Record<'floor' | 'walls' | 'cabinetry' | 'countertop' | 'furniture' | 'textile', string>>;
  lightingId?: string;
  atmosphereId?: string;
  roomType?: string;
  geometryMode?: 'strict' | 'balanced' | 'creative';
  cameraOptics?: string;
  negativePrompt?: string;
  customStyle?: string;
  customMaterials?: string;
  customLighting?: string;
  customDecor?: string;
  updatedAt: number;
}

export interface Project {
  id: string;
  name: string;
  description?: string;
  roomType: RoomType;
  createdAt: number;
  updatedAt: number;
  thumbnailPath?: string;
  sourceImagePath?: string;
  sourceImageBase64?: string;
  materialReferences?: MaterialReference[];
  generationsCount?: number;
  views?: ProjectView[];
  approvedDesign?: ApprovedProjectDesign;
  designDraft?: ProjectDesignDraft;
  designVariants?: ProjectDesignVariant[];
}
