import { Project, GenerationRecord } from './project';
import { GoogleUser } from './auth';

export interface ElectronAPI {
  // Window controls
  minimizeWindow: () => Promise<void>;
  maximizeWindow: () => Promise<void>;
  closeWindow: () => Promise<void>;
  isMaximized: () => Promise<boolean>;

  // System File Dialogs
  selectImageDialog: () => Promise<{ canceled: boolean; filePath?: string; base64?: string; mimeType?: string; fileName?: string }>;
  selectDirectoryDialog: (defaultPath?: string) => Promise<{ canceled: boolean; path?: string }>;
  saveImageDialog: (defaultFileName: string, format: 'png' | 'jpeg') => Promise<{ canceled: boolean; filePath?: string }>;
  writeImageFile: (filePath: string, base64Data: string) => Promise<boolean>;
  openFolderInExplorer: (filePath: string) => Promise<void>;
  openDataFolder: () => Promise<{ success: boolean; folder: string; error?: string }>;
  openExternal: (url: string) => Promise<void>;
  showColabNotebook: () => Promise<{ success: boolean; path?: string; error?: string }>;
  copyImageToClipboard: (base64Data: string) => Promise<boolean>;
  openGeminiBridgeWindow: () => Promise<{ success: boolean; error?: string }>;
  listGeminiDownloads: () => Promise<{ success: boolean; files: Array<{ filePath: string; fileName: string; byteLength: number; modifiedAt: number }>; error?: string }>;
  saveGeminiSourceTemp: (fileName: string, base64Data: string, mimeType: string) => Promise<{ success: boolean; filePath?: string; error?: string }>;
  readGeminiDownloadedImage: (filePath: string) => Promise<{ success: boolean; fileName?: string; filePath?: string; mimeType?: string; base64?: string; byteLength?: number; error?: string }>;
  onGeminiImageDownloaded: (callback: (event: { filePath: string; fileName: string; byteLength: number }) => void) => () => void;

  // Secure Storage (Windows DPAPI)
  saveSecureItem: (key: string, value: string) => Promise<boolean>;
  getSecureItem: (key: string) => Promise<string | null>;
  deleteSecureItem: (key: string) => Promise<boolean>;

  // Google OAuth 2.0 PKCE Loopback
  startGoogleOAuth: (credentials: { clientId?: string; clientSecret?: string }) => Promise<{ success: boolean; user?: GoogleUser; requiresConfig?: boolean; error?: string }>;
  getGoogleSession: () => Promise<{ success: boolean; user?: GoogleUser; error?: string }>;
  saveProfile: (profile: any) => Promise<boolean>;
  logoutGoogle: () => Promise<boolean>;

  // ComfyUI & Local System Tools
  openModelsFolder: (subfolder?: string) => Promise<boolean>;
  exportTrainingDataset: (pairs: Array<{ sourceBase64: string; outputBase64: string; prompt: string; styleName: string; roomType: string; tags: string[] }>, triggerWord?: string) => Promise<{ success: boolean; canceled?: boolean; folderPath?: string; pairsCount?: number; totalBytes?: number; error?: string }>;
  launchComfyUI: () => Promise<{ success: boolean; ready?: boolean; message?: string; error?: string }>;
  stopComfyUI: () => Promise<{ success: boolean; isStillOnline?: boolean; error?: string }>;
  getComfyUIStatus: () => Promise<{ online: boolean; port: number; systemStats?: any }>;
  openComfyUIWeb: () => Promise<boolean>;
  getCustomPaths: () => Promise<{ comfyuiPath: string; modelsPath: string; autoStartComfyUI: boolean }>;
  saveCustomPaths: (config: { comfyuiPath: string; modelsPath: string; autoStartComfyUI: boolean }) => Promise<{ success: boolean; error?: string }>;
  scanModelsFolder: (customFolder?: string) => Promise<{ baseFolder: string; checkpoints: any[]; controlnet: any[]; loras: any[]; vae: any[]; totalCount: number; totalBytes: number }>;
  getArchicadWatchStatus: () => Promise<{ running: boolean; folderPath: string }>;
  startArchicadWatch: (folderPath: string) => Promise<{ success: boolean; folderPath?: string; error?: string }>;
  stopArchicadWatch: () => Promise<{ success: boolean; running: boolean; folderPath: string }>;
  readWatchedArchicadImage: (filePath: string) => Promise<{ success: boolean; filePath?: string; fileName?: string; mimeType?: string; base64?: string; error?: string }>;
  onArchicadFileDetected: (callback: (event: { path: string; fileName: string }) => void) => () => void;
  comfyuiFetch: (options: {
    url: string;
    method?: string;
    headers?: Record<string, string>;
    body?: any;
    isJson?: boolean;
    isBinary?: boolean;
    uploadBase64?: string;
    uploadFilename?: string;
    mimeType?: string;
  }) => Promise<{ success: boolean; status?: number; data?: any; error?: string }>;

  // SQLite Persistence
  dbExecute: (sql: string, params?: any[]) => Promise<any>;
  dbClearProjectData: () => Promise<{ success: boolean; error?: string }>;
  dbQuery: (sql: string, params?: any[]) => Promise<any[]>;
  saveDatabaseSnapshot: () => Promise<boolean>;

  // AI Dataset Harvester
  harvestImages: (options: {
    query: string;
    category?: string;
    count?: number;
    minWidth?: number;
    minHeight?: number;
    customFolder?: string;
  }) => Promise<{
    success: boolean;
    count?: number;
    folder?: string;
    error?: string;
    files?: Array<{ fileName: string; filePath: string; caption: string; width: number; height: number; sizeBytes: number }>;
  }>;
  openHarvestFolder: (category?: string) => Promise<{ success: boolean; folder: string }>;
  getHarvesterStats: () => Promise<{
    totalCategories: number;
    totalImages: number;
    categories: Array<{ name: string; count: number; path: string }>;
    root?: string;
    error?: string;
  }>;
  loadHarvestedImages: (category?: string) => Promise<{
    success: boolean;
    images: Array<{ fileName: string; filePath: string; base64: string; caption: string }>;
    folder?: string;
    error?: string;
  }>;
  onHarvesterProgress: (callback: (event: {
    status: 'searching' | 'downloading' | 'completed' | 'error';
    message: string;
    current: number;
    total: number;
    currentTitle?: string;
  }) => void) => () => void;
}

declare global {
  interface Window {
    electronAPI?: ElectronAPI;
  }
}
