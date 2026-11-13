const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  // Window controls
  minimizeWindow: () => ipcRenderer.invoke('window:minimize'),
  maximizeWindow: () => ipcRenderer.invoke('window:maximize'),
  closeWindow: () => ipcRenderer.invoke('window:close'),
  isMaximized: () => ipcRenderer.invoke('window:isMaximized'),

  // System File & Directory Dialogs
  selectImageDialog: () => ipcRenderer.invoke('dialog:selectImage'),
  selectDirectoryDialog: (defaultPath) => ipcRenderer.invoke('dialog:selectDirectory', defaultPath),
  saveImageDialog: (defaultFileName, format) => ipcRenderer.invoke('dialog:saveImage', defaultFileName, format),
  writeImageFile: (filePath, base64Data) => ipcRenderer.invoke('fs:writeImageFile', filePath, base64Data),
  openFolderInExplorer: (filePath) => ipcRenderer.invoke('shell:openFolder', filePath),
  openDataFolder: () => ipcRenderer.invoke('system:openDataFolder'),
  openExternal: (url) => ipcRenderer.invoke('shell:openExternal', url),
  showColabNotebook: () => ipcRenderer.invoke('training:showColabNotebook'),
  copyImageToClipboard: (base64Data) => ipcRenderer.invoke('clipboard:copyImage', base64Data),
  openGeminiBridgeWindow: () => ipcRenderer.invoke('gemini:openWindow'),
  listGeminiDownloads: () => ipcRenderer.invoke('gemini:listDownloads'),
  listRecentGeminiImages: (mode, since) => ipcRenderer.invoke('gemini:recentImages', mode, since),
  readRecentGeminiImage: (mode, since, filePath) => ipcRenderer.invoke('gemini:readRecentImage', mode, since, filePath),
  readGeminiClipboardImage: () => ipcRenderer.invoke('gemini:clipboardImage'),
  prepareBridgeFiles: (files, prompt) => ipcRenderer.invoke('bridge:prepareFiles', files, prompt),
  isCloudUpscaleConfigured: () => ipcRenderer.invoke('upscale:configured'),
  configureCloudUpscale: (credentials) => ipcRenderer.invoke('upscale:configure', credentials),
  runCloudUpscale: (base64, mime) => ipcRenderer.invoke('upscale:run', base64, mime),
  saveGeminiSourceTemp: (fileName, base64Data, mimeType) => ipcRenderer.invoke('gemini:saveSourceTemp', fileName, base64Data, mimeType),
  readGeminiDownloadedImage: (filePath) => ipcRenderer.invoke('gemini:readDownloadedImage', filePath),
  onGeminiImageDownloaded: (callback) => {
    const listener = (_event, payload) => callback(payload);
    ipcRenderer.on('gemini:downloaded', listener);
    return () => ipcRenderer.removeListener('gemini:downloaded', listener);
  },

  // Secure Storage
  saveSecureItem: (key, value) => ipcRenderer.invoke('secure:save', key, value),
  getSecureItem: (key) => ipcRenderer.invoke('secure:get', key),
  deleteSecureItem: (key) => ipcRenderer.invoke('secure:delete', key),

  // Google OAuth
  startGoogleOAuth: (credentials) => ipcRenderer.invoke('auth:googleOAuth', credentials),
  getGoogleSession: () => ipcRenderer.invoke('auth:getGoogleSession'),
  getOAuthConfigStatus: () => ipcRenderer.invoke('auth:getOAuthConfigStatus'),
  saveProfile: (profile) => ipcRenderer.invoke('auth:saveProfile', profile),
  logoutGoogle: () => ipcRenderer.invoke('auth:logout'),

  // ComfyUI & Local System Tools
  openModelsFolder: (subfolder) => ipcRenderer.invoke('system:openModelsFolder', subfolder),
  exportTrainingDataset: (pairs, triggerWord) => ipcRenderer.invoke('training:exportDataset', pairs, triggerWord),
  launchComfyUI: () => ipcRenderer.invoke('system:launchComfyUI'),
  stopComfyUI: () => ipcRenderer.invoke('system:stopComfyUI'),
  getComfyUIStatus: () => ipcRenderer.invoke('system:getComfyUIStatus'),
  openComfyUIWeb: () => ipcRenderer.invoke('system:openComfyUIWeb'),
  getCustomPaths: () => ipcRenderer.invoke('system:getCustomPaths'),
  saveCustomPaths: (config) => ipcRenderer.invoke('system:saveCustomPaths', config),
  scanModelsFolder: (customFolder) => ipcRenderer.invoke('system:scanModelsFolder', customFolder),
  comfyuiFetch: (options) => ipcRenderer.invoke('comfyui:fetch', options),
  getArchicadWatchStatus: () => ipcRenderer.invoke('archicad:getWatchStatus'),
  startArchicadWatch: (folderPath) => ipcRenderer.invoke('archicad:startWatch', folderPath),
  stopArchicadWatch: () => ipcRenderer.invoke('archicad:stopWatch'),
  readWatchedArchicadImage: (filePath) => ipcRenderer.invoke('archicad:readWatchedImage', filePath),
  onArchicadFileDetected: (callback) => {
    const listener = (_event, payload) => callback(payload);
    ipcRenderer.on('archicad:fileDetected', listener);
    return () => ipcRenderer.removeListener('archicad:fileDetected', listener);
  },

  // SQLite Persistence
  dbExecute: (sql, params) => ipcRenderer.invoke('db:execute', sql, params),
  dbClearProjectData: () => ipcRenderer.invoke('db:clearProjectData'),
  dbQuery: (sql, params) => ipcRenderer.invoke('db:query', sql, params),
  saveDatabaseSnapshot: () => ipcRenderer.invoke('db:saveSnapshot'),

  // AI Dataset Harvester
  harvestImages: (options) => ipcRenderer.invoke('harvester:searchAndDownload', options),
  openHarvestFolder: (category) => ipcRenderer.invoke('harvester:openFolder', category),
  getHarvesterStats: () => ipcRenderer.invoke('harvester:getStats'),
  loadHarvestedImages: (category) => ipcRenderer.invoke('harvester:loadImages', category),
  onHarvesterProgress: (callback) => {
    const listener = (_event, payload) => callback(payload);
    ipcRenderer.on('harvester:progress', listener);
    return () => ipcRenderer.removeListener('harvester:progress', listener);
  },
});
