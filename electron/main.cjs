const { app, BrowserWindow, ipcMain, dialog, safeStorage, shell, clipboard, nativeImage, session } = require('electron');
const path = require('path');
const fs = require('fs');
const http = require('http');
const https = require('https');
const crypto = require('crypto');
const initSqlJs = require('sql.js');
const { startGoogleOAuth, refreshGoogleSession } = require('./googleAuth.cjs');
const { resolveOAuthConfig, isValidClientId } = require('./oauthConfig.cjs');

// Keep the existing Windows profile directory stable across the product rename.
// The SQLite database, secure settings and project assets live below this path.
const legacyUserDataPath = path.join(app.getPath('appData'), 'Interior AI Studio');
app.setName('AI Designer by V1PERCOREJZ');
app.setPath('userData', legacyUserDataPath);

let mainWindow = null;
let geminiWindow = null;
let geminiDownloadListenerInstalled = false;
let db = null;
let dbPath = '';
let activeComfyProcess = null;
let activeComfyPid = null;
let activeComfyRoot = null;
let archicadWatcher = null;
let archicadWatchRoot = null;
const archicadWatchTimers = new Map();
const archicadLastNotified = new Map();

const isDev = !app.isPackaged && process.env.VITE_DEV === 'true';

function getStoragePath() {
  const userData = app.getPath('userData');
  const dir = path.join(userData, 'InteriorAIStudio');
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  return dir;
}

function getArchicadWatchConfigPath() {
  return path.join(app.getPath('userData'), 'archicad_watch.json');
}

function closeArchicadWatcher() {
  if (archicadWatcher) {
    try { archicadWatcher.close(); } catch (_) {}
  }
  archicadWatcher = null;
  archicadWatchRoot = null;
  for (const timer of archicadWatchTimers.values()) clearTimeout(timer);
  archicadWatchTimers.clear();
  archicadLastNotified.clear();
}

function startArchicadWatcher(folderPath) {
  const root = path.resolve(folderPath);
  if (!fs.existsSync(root) || !fs.statSync(root).isDirectory()) {
    throw new Error('Выбранная папка Archicad не существует или недоступна.');
  }
  closeArchicadWatcher();
  archicadWatchRoot = root;
  archicadWatcher = fs.watch(root, { persistent: true }, (_eventType, rawName) => {
    if (!rawName) return;
    const fileName = rawName.toString();
    if (!/\.(png|jpe?g|webp)$/i.test(fileName)) return;
    const fullPath = path.resolve(root, fileName);
    if (path.dirname(fullPath) !== root) return;
    const oldTimer = archicadWatchTimers.get(fullPath);
    if (oldTimer) clearTimeout(oldTimer);
    const timer = setTimeout(async () => {
      try {
        const before = await fs.promises.stat(fullPath);
        if (!before.isFile() || before.size <= 0) return;
        await new Promise((resolve) => setTimeout(resolve, 1200));
        const after = await fs.promises.stat(fullPath);
        if (!after.isFile() || before.size !== after.size || before.mtimeMs !== after.mtimeMs) return;
        const signature = `${after.size}:${after.mtimeMs}`;
        if (archicadLastNotified.get(fullPath) === signature) return;
        archicadLastNotified.set(fullPath, signature);
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('archicad:fileDetected', { path: fullPath, fileName });
        }
      } catch (_) {
        // Ignore temporary/partial files that disappear during export.
      } finally {
        archicadWatchTimers.delete(fullPath);
      }
    }, 400);
    archicadWatchTimers.set(fullPath, timer);
  });
  archicadWatcher.on('error', () => closeArchicadWatcher());
  fs.writeFileSync(getArchicadWatchConfigPath(), JSON.stringify({ folderPath: root, enabled: true }, null, 2), 'utf8');
  return root;
}

// ---------------- Database Initialization (sql.js) ----------------
async function initDatabase() {
  const storageDir = getStoragePath();
  dbPath = path.join(storageDir, 'studio.sqlite');
  
  const SQL = await initSqlJs();
  
  if (fs.existsSync(dbPath)) {
    const filebuffer = fs.readFileSync(dbPath);
    db = new SQL.Database(filebuffer);
  } else {
    db = new SQL.Database();
  }

  // Schema setup
  db.run(`
    CREATE TABLE IF NOT EXISTS projects (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      room_type TEXT NOT NULL DEFAULT 'living_room',
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      thumbnail_path TEXT,
      source_image_path TEXT,
      source_image_base64 TEXT,
      views_json TEXT,
      approved_design_json TEXT,
      design_draft_json TEXT,
      design_variants_json TEXT
    );

    CREATE TABLE IF NOT EXISTS generations (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL,
      parent_id TEXT,
      view_id TEXT,
      source_image_path TEXT,
      source_image_base64 TEXT,
      output_image_path TEXT,
      output_image_base64 TEXT,
      prompt TEXT NOT NULL,
      style_id TEXT NOT NULL,
      room_type TEXT NOT NULL,
      geometry_mode TEXT NOT NULL,
      lighting TEXT,
      materials TEXT,
      atmosphere TEXT,
      provider TEXT NOT NULL DEFAULT 'gemini',
      model TEXT NOT NULL DEFAULT 'gemini-3-pro-image',
      width INTEGER,
      height INTEGER,
      latency_ms INTEGER,
      created_at INTEGER NOT NULL,
      resolution TEXT DEFAULT '2k',
      cost_usd REAL DEFAULT 0.0,
      material_references TEXT
    );

    CREATE TABLE IF NOT EXISTS custom_styles (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      prompt_keywords TEXT NOT NULL,
      created_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS secure_kv (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
  `);

  try {
    db.run("ALTER TABLE projects ADD COLUMN material_references TEXT");
  } catch(e) {}
  try { db.run("ALTER TABLE projects ADD COLUMN views_json TEXT"); } catch(e) {}
  try { db.run("ALTER TABLE projects ADD COLUMN approved_design_json TEXT"); } catch(e) {}
  try { db.run("ALTER TABLE projects ADD COLUMN design_draft_json TEXT"); } catch(e) {}
  try { db.run("ALTER TABLE projects ADD COLUMN design_variants_json TEXT"); } catch(e) {}
  try { db.run("ALTER TABLE generations ADD COLUMN view_id TEXT"); } catch(e) {}
  try {
    db.run("ALTER TABLE generations ADD COLUMN resolution TEXT DEFAULT '2k'");
  } catch(e) {}
  try {
    db.run("ALTER TABLE generations ADD COLUMN cost_usd REAL DEFAULT 0.0");
  } catch(e) {}
  try {
    db.run("ALTER TABLE generations ADD COLUMN material_references TEXT");
  } catch(e) {}

  saveDatabaseFile();
}

function saveDatabaseFile(requirePersistence = false) {
  if (!db || !dbPath) return;
  try {
    const data = db.export();
    const buffer = Buffer.from(data);
    fs.writeFileSync(dbPath, buffer);
  } catch (err) {
    console.error('Failed to save SQLite file:', err);
    if (requirePersistence) throw err;
  }
}

// ---------------- Window Creation ----------------
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 920,
    minWidth: 960,
    minHeight: 640,
    frame: false, // Custom dark studio titlebar
    backgroundColor: '#0d0f12',
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: false,
    },
    show: false,
  });

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  if (isDev) {
    mainWindow.loadURL('http://localhost:5173');
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }

  // Handle external links safely
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });
}

function getGeminiDownloadRoot() {
  const dir = path.join(app.getPath('userData'), 'InteriorAIStudio', 'GeminiBridgeDownloads');
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

const geminiImageExtensions = new Map([
  ['.png', 'image/png'], ['.jpg', 'image/jpeg'], ['.jpeg', 'image/jpeg'], ['.webp', 'image/webp'],
]);

function isGeminiBrowserDownload(name) {
  return /^gemini[_ -]generated[_ -]image/i.test(name);
}

async function getRecentGeminiImages(mode, since) {
  if (!Number.isFinite(since) || since <= 0) return [];
  const embedded = mode === 'embedded';
  const root = embedded ? getGeminiDownloadRoot() : app.getPath('downloads');
  const entries = await fs.promises.readdir(root, { withFileTypes: true });
  const files = await Promise.all(entries.filter((entry) =>
    entry.isFile() && geminiImageExtensions.has(path.extname(entry.name).toLowerCase()) &&
    (embedded || isGeminiBrowserDownload(entry.name))
  ).map(async (entry) => {
    const filePath = path.join(root, entry.name);
    const stat = await fs.promises.stat(filePath).catch(() => null);
    if (!stat?.isFile() || stat.size <= 0 || stat.mtimeMs < since) return null;
    return { filePath, fileName: entry.name, byteLength: stat.size, modifiedAt: stat.mtimeMs };
  }));
  return files.filter(Boolean).sort((a, b) => b.modifiedAt - a.modifiedAt).slice(0, 8);
}

async function openGeminiBridgeWindow() {
  if (geminiWindow && !geminiWindow.isDestroyed()) {
    geminiWindow.show();
    geminiWindow.focus();
    return true;
  }

  const geminiSession = session.fromPartition('persist:interior-ai-gemini');
  if (!geminiDownloadListenerInstalled) geminiSession.on('will-download', (_event, item) => {
    const originalName = path.basename(item.getFilename() || `gemini-image-${Date.now()}`);
    const mimeExtensions = { 'image/png': '.png', 'image/jpeg': '.jpg', 'image/webp': '.webp' };
    const originalExtension = path.extname(originalName).toLowerCase();
    const detectedExtension = mimeExtensions[item.getMimeType()] || (/^\.(png|jpe?g|webp)$/.test(originalExtension) ? originalExtension : '');
    if (!detectedExtension) return;
    const baseName = path.basename(originalName, path.extname(originalName)).replace(/[^a-zA-Z0-9_-]/g, '_').slice(-100) || `gemini-image-${Date.now()}`;
    const safeName = `${baseName}${detectedExtension}`;
    const downloadPath = path.join(getGeminiDownloadRoot(), `${Date.now()}-${crypto.randomUUID()}-${safeName}`);
    item.setSavePath(downloadPath);
    item.once('done', (_downloadEvent, state) => {
      if (state !== 'completed' || !/\.(png|jpe?g|webp)$/i.test(downloadPath)) return;
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('gemini:downloaded', {
          filePath: downloadPath,
          fileName: path.basename(downloadPath),
          byteLength: item.getReceivedBytes(),
        });
      }
    });
  });
  geminiDownloadListenerInstalled = true;

  geminiWindow = new BrowserWindow({
    width: 1180,
    height: 860,
    minWidth: 800,
    minHeight: 620,
    title: 'Gemini — AI Designer by V1PERCOREJZ',
    backgroundColor: '#ffffff',
    webPreferences: {
      partition: 'persist:interior-ai-gemini',
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      webSecurity: true,
    },
  });
  geminiWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('https://')) shell.openExternal(url);
    return { action: 'deny' };
  });
  geminiWindow.on('closed', () => { geminiWindow = null; });
  try {
    await geminiWindow.loadURL('https://gemini.google.com/');
  } catch (error) {
    if (geminiWindow && !geminiWindow.isDestroyed()) geminiWindow.close();
    throw error;
  }
  return true;
}

// ---------------- Secure Storage (Windows DPAPI) ----------------
function encryptData(text) {
  if (safeStorage && safeStorage.isEncryptionAvailable()) {
    const encrypted = safeStorage.encryptString(text);
    return encrypted.toString('base64');
  } else {
    // Fallback AES-256-GCM with machine-derived key if safeStorage unavailable
    const key = crypto.scryptSync(app.getPath('userData'), 'interior_studio_salt', 32);
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
    let enc = cipher.update(text, 'utf8', 'base64');
    enc += cipher.final('base64');
    const authTag = cipher.getAuthTag().toString('base64');
    return JSON.stringify({ iv: iv.toString('base64'), authTag, data: enc });
  }
}

function decryptData(ciphertext) {
  if (safeStorage && safeStorage.isEncryptionAvailable()) {
    const buffer = Buffer.from(ciphertext, 'base64');
    return safeStorage.decryptString(buffer);
  } else {
    try {
      const parsed = JSON.parse(ciphertext);
      const key = crypto.scryptSync(app.getPath('userData'), 'interior_studio_salt', 32);
      const decipher = crypto.createDecipheriv('aes-256-gcm', key, Buffer.from(parsed.iv, 'base64'));
      decipher.setAuthTag(Buffer.from(parsed.authTag, 'base64'));
      let dec = decipher.update(parsed.data, 'base64', 'utf8');
      dec += decipher.final('utf8');
      return dec;
    } catch (e) {
      return null;
    }
  }
}

// ---------------- IPC Setup ----------------
function setupIPC() {
  const rendererSecureKeys = new Set(['gemini_api_key', 'krea_api_key', 'google_oauth_client_id', 'google_oauth_client_secret', 'local_user_profile']);
  const cloudinaryKey = 'cloudinary_upscale_credentials';
  ipcMain.handle('upscale:configured', () => Boolean(readAuthRecord(cloudinaryKey)));
  ipcMain.handle('upscale:configure', (_event, credentials) => {
    if (credentials === null) {
      db.run('DELETE FROM secure_kv WHERE key = ?', [cloudinaryKey]);
      saveDatabaseFile(true);
      return true;
    }
    if (!/^[a-z0-9_-]{1,64}$/i.test(credentials?.cloud || '') ||
        !/^\d{8,30}$/.test(credentials?.key || '') ||
        !/^[a-z0-9_-]{8,128}$/i.test(credentials?.secret || '')) return false;
    writeAuthRecord(cloudinaryKey, JSON.stringify({ cloud: credentials.cloud, key: credentials.key, secret: credentials.secret }), true);
    return true;
  });
  ipcMain.handle('upscale:run', async (_event, base64, mime) => {
    const stored = readAuthRecord(cloudinaryKey);
    if (!stored) return { error: 'setup' };
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(mime) ||
        typeof base64 !== 'string' || base64.length > Math.ceil(10 * 1024 * 1024 * 4 / 3) + 4) return { error: 'size' };
    const bytes = Buffer.from(base64, 'base64');
    const image = nativeImage.createFromBuffer(bytes);
    // Electron's native decoder does not handle all WebP files.
    if (image.isEmpty() || bytes.length > 10 * 1024 * 1024) return { error: 'size' };
    const { width, height } = image.getSize();
    if (width * height > 2048 * 2048) return { error: 'size' };
    const { cloud, key, secret } = JSON.parse(stored);
    const publicId = 'visual-ai-' + crypto.randomUUID();
    const base = 'https://api.cloudinary.com/v1_1/' + cloud + '/image/';
    const call = (operation, fields, file) => {
      const params = { ...fields, public_id: publicId, timestamp: String(Math.floor(Date.now() / 1000)), type: 'authenticated' };
      const query = Object.keys(params).sort().map((name) => name + '=' + params[name]).join('&');
      const signature = crypto.createHash('sha1').update(query + secret).digest('hex');
      const form = new FormData();
      for (const [name, value] of Object.entries({ ...params, api_key: key, signature })) form.set(name, value);
      if (file) form.set('file', new Blob([file], { type: mime }), 'visualization.' + (mime === 'image/jpeg' ? 'jpg' : mime.split('/')[1]));
      return fetch(base + operation, { method: 'POST', body: form, signal: AbortSignal.timeout(25000), redirect: 'error' });
    };
    let uploaded = false;
    let output;
    try {
      const response = await call('upload', { overwrite: 'false' }, bytes);
      if (response.status === 401 || response.status === 403) return { error: 'auth' };
      if (response.status === 429) return { error: 'quota' };
      if (!response.ok) return { error: 'service' };
      uploaded = true;
      const asset = await response.json();
      if (!Number.isInteger(asset.version)) return { error: 'service' };
      // Keep large 4× intermediates within the free plan's 25 MP delivery limit.
      const ratio = Math.sqrt(25_000_000 / (width * height));
      const fit = ratio < 4 ? '/c_limit,w_' + Math.floor(width * ratio) + ',h_' + Math.floor(height * ratio) : '';
      const pathToSign = 'e_upscale' + fit + '/v' + asset.version + '/' + publicId + '.jpg';
      const signature = crypto.createHash('sha1').update(pathToSign + secret).digest('base64url').slice(0, 8);
      const url = 'https://res.cloudinary.com/' + cloud + '/image/authenticated/s--' + signature + '--/' + pathToSign;
      for (let attempt = 0; attempt < 30; attempt++) {
        const result = await fetch(url, { signal: AbortSignal.timeout(15000), redirect: 'error' });
        if (result.status === 423 || result.status === 420) {
          await new Promise((resolve) => setTimeout(resolve, 2500));
          continue;
        }
        if (result.status === 429) return { error: 'quota' };
        if (!result.ok) return { error: 'service' };
        const data = Buffer.from(await result.arrayBuffer());
        if (data.length > 50 * 1024 * 1024) return { error: 'service' };
        output = { base64: data.toString('base64') };
        break;
      }
      if (!output) return { error: 'timeout' };
    } catch {
      return { error: 'service' };
    } finally {
      if (uploaded) {
        let removed = false;
        try {
          const response = await call('destroy', { invalidate: 'true' });
          const result = await response.json();
          removed = response.ok && (result.result === 'ok' || result.result === 'not found');
        } catch (_) {}
        if (!removed && output) output.cleanupFailed = true;
      }
    }
    return output;
  });
  ipcMain.handle('gemini:openWindow', async () => {
    try { return { success: await openGeminiBridgeWindow() }; }
    catch (error) { return { success: false, error: error.message || 'Не удалось открыть Gemini.' }; }
  });

  ipcMain.handle('gemini:listDownloads', async () => {
    try {
      const root = getGeminiDownloadRoot();
      const entries = await fs.promises.readdir(root, { withFileTypes: true });
      const files = await Promise.all(entries.filter((entry) => entry.isFile() && /\.(png|jpe?g|webp)$/i.test(entry.name)).map(async (entry) => {
        const filePath = path.join(root, entry.name);
        const stat = await fs.promises.stat(filePath);
        if (stat.size <= 0 || stat.size > 500 * 1024 * 1024) return null;
        return { filePath, fileName: entry.name, byteLength: stat.size, modifiedAt: stat.mtimeMs };
      }));
      return { success: true, files: files.filter(Boolean).sort((a, b) => b.modifiedAt - a.modifiedAt).slice(0, 8) };
    } catch (error) {
      return { success: false, files: [], error: error.message || 'Не удалось получить загрузки Gemini.' };
    }
  });

  ipcMain.handle('gemini:recentImages', async (_event, mode, since) => {
    try {
      return await getRecentGeminiImages(mode, since);
    } catch (_) {
      return [];
    }
  });

  ipcMain.handle('gemini:readRecentImage', async (_event, mode, since, filePath) => {
    const files = await getRecentGeminiImages(mode, since).catch(() => []);
    const file = files.find((entry) => entry.filePath === filePath);
    if (!file || file.byteLength > 50 * 1024 * 1024) return null;
    const root = await fs.promises.realpath(mode === 'embedded' ? getGeminiDownloadRoot() : app.getPath('downloads'));
    const realPath = await fs.promises.realpath(file.filePath);
    if (path.dirname(realPath).toLowerCase() !== root.toLowerCase()) return null;
    const data = await fs.promises.readFile(realPath);
    if (data.length !== file.byteLength) return null;
    return { fileName: file.fileName, mimeType: geminiImageExtensions.get(path.extname(file.fileName).toLowerCase()), base64: data.toString('base64') };
  });

  ipcMain.handle('gemini:clipboardImage', () => {
    const image = clipboard.readImage();
    if (image.isEmpty()) return null;
    const data = image.toPNG();
    return data.length <= 50 * 1024 * 1024 ? data.toString('base64') : null;
  });

  ipcMain.handle('gemini:saveSourceTemp', async (_event, fileName, base64Data, mimeType = 'image/png') => {
    try {
      const allowed = new Set(['image/png', 'image/jpeg', 'image/webp']);
      if (!allowed.has(mimeType) || typeof base64Data !== 'string' || base64Data.length > 70 * 1024 * 1024) throw new Error('Недопустимый формат или размер исходного изображения.');
      const ext = mimeType === 'image/jpeg' ? '.jpg' : mimeType === 'image/webp' ? '.webp' : '.png';
      const safeName = path.basename(String(fileName || 'archicad_reference')).replace(/[^\w.-]/g, '_').replace(/\.[^.]+$/, '');
      const root = path.join(app.getPath('userData'), 'InteriorAIStudio', 'GeminiBridgeSources');
      await fs.promises.mkdir(root, { recursive: true });
      const filePath = path.join(root, `${safeName || 'archicad_reference'}-${Date.now()}${ext}`);
      const buffer = Buffer.from(base64Data.replace(/^data:image\/[\w+.-]+;base64,/, ''), 'base64');
      if (!buffer.length || buffer.length > 50 * 1024 * 1024) throw new Error('Исходное изображение должно быть меньше 50 МБ.');
      await fs.promises.writeFile(filePath, buffer, { flag: 'wx' });
      return { success: true, filePath };
    } catch (error) {
      return { success: false, error: error.message || 'Не удалось подготовить исходный файл.' };
    }
  });

  ipcMain.handle('gemini:readDownloadedImage', async (_event, filePath) => {
    try {
      const root = await fs.promises.realpath(getGeminiDownloadRoot());
      const realPath = await fs.promises.realpath(filePath);
      const relative = path.relative(root, realPath);
      if (!relative || relative.startsWith('..') || path.isAbsolute(relative)) throw new Error('Файл находится вне папки загрузок Gemini.');
      if (!/\.(png|jpe?g|webp)$/i.test(realPath)) throw new Error('Формат файла не поддерживается.');
      const stat = await fs.promises.stat(realPath);
      if (!stat.isFile() || stat.size <= 0 || stat.size > 50 * 1024 * 1024) throw new Error('Размер изображения для импорта должен быть до 50 МБ. Исходный скачанный файл сохранён в папке Gemini Bridge.');
      const extension = path.extname(realPath).toLowerCase();
      const mimeType = extension === '.jpg' || extension === '.jpeg' ? 'image/jpeg' : extension === '.webp' ? 'image/webp' : 'image/png';
      const data = await fs.promises.readFile(realPath);
      return { success: true, fileName: path.basename(realPath), filePath: realPath, mimeType, base64: data.toString('base64'), byteLength: stat.size };
    } catch (error) {
      return { success: false, error: error.message || 'Не удалось прочитать файл Gemini.' };
    }
  });

  // Window controls
  ipcMain.handle('window:minimize', () => {
    if (mainWindow) mainWindow.minimize();
  });

  ipcMain.handle('window:maximize', () => {
    if (mainWindow) {
      if (mainWindow.isMaximized()) {
        mainWindow.unmaximize();
      } else {
        mainWindow.maximize();
      }
    }
  });

  ipcMain.handle('window:close', () => {
    if (mainWindow) mainWindow.close();
  });

  ipcMain.handle('window:isMaximized', () => {
    return mainWindow ? mainWindow.isMaximized() : false;
  });

  // System Dialog: Open Image (Clay Render from Archicad)
  ipcMain.handle('dialog:selectImage', async () => {
    const result = await dialog.showOpenDialog(mainWindow, {
      title: 'Выберите изображение рендера из Archicad',
      filters: [
        { name: 'Изображения (Рендеры Archicad)', extensions: ['png', 'jpg', 'jpeg', 'webp'] },
        { name: 'Все файлы', extensions: ['*'] }
      ],
      properties: ['openFile']
    });

    if (result.canceled || result.filePaths.length === 0) {
      return { canceled: true };
    }

    const filePath = result.filePaths[0];
    const buffer = fs.readFileSync(filePath);
    const base64 = buffer.toString('base64');
    const ext = path.extname(filePath).toLowerCase().replace('.', '');
    const mimeType = ext === 'png' ? 'image/png' : ext === 'webp' ? 'image/webp' : 'image/jpeg';
    const fileName = path.basename(filePath);

    return {
      canceled: false,
      filePath,
      base64,
      mimeType,
      fileName
    };
  });

  // System Dialog: Save Image
  ipcMain.handle('dialog:saveImage', async (event, defaultFileName, format) => {
    const ext = format === 'png' ? 'png' : 'jpg';
    const result = await dialog.showSaveDialog(mainWindow, {
      title: 'Экспорт визуализации интерьера',
      defaultPath: defaultFileName.endsWith(`.${ext}`) ? defaultFileName : `${defaultFileName}.${ext}`,
      filters: [
        { name: format === 'png' ? 'PNG Image (*.png)' : 'JPEG Image (*.jpg)', extensions: [ext] }
      ]
    });

    if (result.canceled || !result.filePath) {
      return { canceled: true };
    }

    return { canceled: false, filePath: result.filePath };
  });

  // Write image file
  ipcMain.handle('fs:writeImageFile', async (event, filePath, base64Data) => {
    try {
      const cleanBase64 = base64Data.replace(/^data:image\/\w+;base64,/, '');
      const buffer = Buffer.from(cleanBase64, 'base64');
      fs.writeFileSync(filePath, buffer);
      return true;
    } catch (e) {
      console.error('Failed to write image file:', e);
      return false;
    }
  });

  // Open file in Windows Explorer
  ipcMain.handle('shell:openFolder', async (event, filePath) => {
    if (fs.existsSync(filePath)) {
      shell.showItemInFolder(filePath);
    }
  });

  ipcMain.handle('system:openDataFolder', async () => {
    const folder = getStoragePath();
    const error = await shell.openPath(folder);
    return { success: !error, folder, error: error || undefined };
  });

  ipcMain.handle('shell:openExternal', async (_event, url) => {
    if (typeof url === 'string' && (url.startsWith('https://') || url.startsWith('http://'))) {
      await shell.openExternal(url);
    }
  });

  ipcMain.handle('training:showColabNotebook', async () => {
    const notebookPath = path.join(__dirname, '..', 'Interior_AI_Studio_SDXL_LoRA_Trainer.ipynb');
    if (fs.existsSync(notebookPath)) {
      shell.showItemInFolder(notebookPath);
      return { success: true, path: notebookPath };
    }
    return { success: false, error: 'Notebook not found.' };
  });

  // System Dialog: Select Directory / Folder
  ipcMain.handle('dialog:selectDirectory', async (event, defaultPath) => {
    const result = await dialog.showOpenDialog(mainWindow, {
      title: 'Выберите папку',
      defaultPath: defaultPath && fs.existsSync(defaultPath) ? defaultPath : undefined,
      properties: ['openDirectory', 'createDirectory'],
    });
    if (result.canceled || !result.filePaths || result.filePaths.length === 0) {
      return { canceled: true };
    }
    return { canceled: false, path: result.filePaths[0] };
  });

  ipcMain.handle('training:exportDataset', async (_event, pairs, triggerWord = '') => {
    let outputRoot = '';
    try {
      if (!Array.isArray(pairs) || pairs.length < 1 || pairs.length > 500) {
        return { success: false, error: 'Dataset must contain between 1 and 500 image pairs.' };
      }
      const picked = await dialog.showOpenDialog(mainWindow, {
        title: 'Choose where to save the LoRA training dataset',
        properties: ['openDirectory', 'createDirectory'],
      });
      if (picked.canceled || !picked.filePaths?.[0]) return { success: false, canceled: true };

      outputRoot = path.join(picked.filePaths[0], `InteriorAI_LoRA_Dataset_${new Date().toISOString().replace(/[:.]/g, '-')}`);
      const trainingImages = path.join(outputRoot, '10_interior');
      const claySources = path.join(outputRoot, 'source_clay');
      await fs.promises.mkdir(trainingImages, { recursive: true });
      await fs.promises.mkdir(claySources, { recursive: true });

      const decodeImage = (input) => {
        if (typeof input !== 'string' || input.length < 100) throw new Error('An image is missing or invalid.');
        const match = input.match(/^data:(image\/(?:png|jpeg|jpg|webp));base64,([\s\S]+)$/i);
        const mime = match?.[1]?.toLowerCase() || 'image/png';
        const encoded = (match?.[2] || input).replace(/\s/g, '');
        if (!/^[A-Za-z0-9+/]+={0,2}$/.test(encoded)) throw new Error('Image data is not valid base64.');
        const buffer = Buffer.from(encoded, 'base64');
        if (!buffer.length || buffer.length > 50 * 1024 * 1024) throw new Error('Each dataset image must be under 50 MB.');
        const ext = mime.includes('jpeg') || mime.includes('jpg') ? 'jpg' : mime.includes('webp') ? 'webp' : 'png';
        return { buffer, ext };
      };

      let totalBytes = 0;
      const manifest = [];
      const prefix = String(triggerWord || '').trim().replace(/[^\p{L}\p{N}_-]+/gu, '_').slice(0, 48);
      for (let i = 0; i < pairs.length; i += 1) {
        const pair = pairs[i];
        const target = decodeImage(pair.outputBase64);
        const source = decodeImage(pair.sourceBase64);
        totalBytes += target.buffer.length + source.buffer.length;
        if (totalBytes > 1024 * 1024 * 1024) throw new Error('The dataset is larger than the 1 GB export limit.');
        const number = String(i + 1).padStart(4, '0');
        const targetName = `interior_${number}.${target.ext}`;
        const sourceName = `interior_${number}_clay.${source.ext}`;
        const captionParts = [prefix, pair.roomType, pair.styleName, pair.prompt]
          .map((part) => String(part || '').trim().replace(/[\r\n]+/g, ' '))
          .filter(Boolean);
        const caption = [...new Set(captionParts)].join(', ').slice(0, 4000);
        await Promise.all([
          fs.promises.writeFile(path.join(trainingImages, targetName), target.buffer, { flag: 'wx' }),
          fs.promises.writeFile(path.join(claySources, sourceName), source.buffer, { flag: 'wx' }),
          fs.promises.writeFile(path.join(trainingImages, `interior_${number}.txt`), caption, { flag: 'wx' }),
        ]);
        manifest.push({ target: `10_interior/${targetName}`, caption: `10_interior/interior_${number}.txt`, claySource: `source_clay/${sourceName}`, roomType: pair.roomType || '', style: pair.styleName || '', tags: Array.isArray(pair.tags) ? pair.tags : [] });
      }

      const guide = [
        'Interior AI Studio — SDXL LoRA dataset',
        '',
        'Training images and matching .txt captions are in 10_interior/. The white/clay input images are archived separately in source_clay/.',
        'This package contains data and instructions; it does not train a model by itself.',
        '',
        'For Kohya_ss GUI, create an SDXL LoRA using 10_interior as the image directory. Start conservatively on a 6 GB GPU: batch size 1, gradient checkpointing enabled, cache latents to disk, 8-bit AdamW, rank 8–16, fp16, and a short test run. Reduce resolution or stop if VRAM is exhausted.',
        'A standard SDXL LoRA learns visual appearance from the target renders and captions. It does not learn a clay-to-render paired transformation or guarantee preservation of room geometry. Keep using ControlNet for geometry conditioning.',
        '',
        'Review every image/caption pair before training and remove inconsistent or low-quality renders.',
      ].join('\r\n');
      await Promise.all([
        fs.promises.writeFile(path.join(outputRoot, 'README.txt'), guide, 'utf8'),
        fs.promises.writeFile(path.join(outputRoot, 'dataset_manifest.json'), JSON.stringify({ format: 'interior-ai-sdxl-lora-dataset', version: 1, pairsCount: manifest.length, triggerWord: prefix, files: manifest }, null, 2), 'utf8'),
      ]);
      return { success: true, folderPath: outputRoot, pairsCount: manifest.length, totalBytes };
    } catch (error) {
      return { success: false, error: error?.message || 'Could not export the training dataset.' };
    }
  });

  // ==========================================
  // AI DATASET HARVESTER (High-Res Architectural Image Scraper)
  // ==========================================
  function getHarvesterRoot() {
    const userData = app.getPath('userData');
    const root = path.join(userData, 'HarvestedDatasets');
    if (!fs.existsSync(root)) {
      fs.mkdirSync(root, { recursive: true });
    }
    return root;
  }

  ipcMain.handle('harvester:searchAndDownload', async (_event, options = {}) => {
    const {
      query = 'modern architectural interior',
      category = 'general',
      count = 10,
      minWidth = 1024,
      minHeight = 768,
      customFolder = '',
    } = options;

    const win = BrowserWindow.getFocusedWindow() || BrowserWindow.getAllWindows()[0];
    const targetDir = customFolder && fs.existsSync(customFolder)
      ? customFolder
      : path.join(getHarvesterRoot(), category.replace(/[^\w-]/g, '_'));

    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true });
    }

    try {
      if (win) {
        win.webContents.send('harvester:progress', {
          status: 'searching',
          message: `Поиск изображений по запросу "${query}"...`,
          current: 0,
          total: count,
        });
      }

      // Step 1: Fetch vqd token from DuckDuckGo
      const tokenRes = await fetch(`https://duckduckgo.com/?q=${encodeURIComponent(query)}&t=h_&iar=images&iax=images&ia=images`, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        },
        signal: AbortSignal.timeout(10000),
      });

      if (!tokenRes.ok) {
        throw new Error(`Ошибка подключения к поисковой системе (HTTP ${tokenRes.status})`);
      }

      const html = await tokenRes.text();
      const vqdMatch = html.match(/vqd=(["'])([\d-]+)\1/) || html.match(/vqd=([\d-]+)/);
      if (!vqdMatch) {
        throw new Error('Не удалось получить токен поиска DuckDuckGo. Попробуйте еще раз через несколько секунд.');
      }
      const vqd = vqdMatch[2] || vqdMatch[1];

      // Step 2: Fetch images JSON
      const imgApiUrl = `https://duckduckgo.com/i.js?l=us-en&o=json&q=${encodeURIComponent(query)}&vqd=${vqd}&f=,,,&p=1`;
      const imgRes = await fetch(imgApiUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
          'Referer': 'https://duckduckgo.com/',
        },
        signal: AbortSignal.timeout(10000),
      });

      if (!imgRes.ok) {
        throw new Error(`Ошибка получения результатов поиска (HTTP ${imgRes.status})`);
      }

      const imgData = await imgRes.json();
      const rawResults = imgData.results || [];

      // Filter by min resolution
      const filtered = rawResults.filter((r) => {
        const w = Number(r.width) || 0;
        const h = Number(r.height) || 0;
        return w >= minWidth && h >= minHeight;
      });

      const candidateList = filtered.length >= count ? filtered : rawResults;
      if (candidateList.length === 0) {
        return { success: false, error: 'По вашему запросу не найдено подходящих изображений.' };
      }

      let savedCount = 0;
      const savedFiles = [];

      for (let i = 0; i < candidateList.length && savedCount < count; i++) {
        const item = candidateList[i];
        const imageUrl = item.image;
        if (!imageUrl || !imageUrl.startsWith('http')) continue;

        if (win) {
          win.webContents.send('harvester:progress', {
            status: 'downloading',
            message: `Скачивание [${savedCount + 1}/${count}]: ${item.title?.substring(0, 40) || 'изображение'}...`,
            current: savedCount,
            total: count,
            currentTitle: item.title,
          });
        }

        try {
          const downloadRes = await fetch(imageUrl, {
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
              'Accept': 'image/jpeg,image/png,image/webp,*/*',
            },
            signal: AbortSignal.timeout(12000),
          });

          if (!downloadRes.ok) continue;

          const arrayBuf = await downloadRes.arrayBuffer();
          const buffer = Buffer.from(arrayBuf);

          // Skip corrupt or tiny files (< 25 KB)
          if (buffer.length < 25 * 1024) continue;

          const fileExt = imageUrl.toLowerCase().includes('.png') ? '.png' : '.jpg';
          const fileBase = `arch_${category.replace(/[^\w-]/g, '_')}_${Date.now()}_${savedCount + 1}`;
          const imgFileName = `${fileBase}${fileExt}`;
          const txtFileName = `${fileBase}.txt`;

          const imgPath = path.join(targetDir, imgFileName);
          const txtPath = path.join(targetDir, txtFileName);

          await fs.promises.writeFile(imgPath, buffer);

          // Rich PBR Caption
          const cleanTitle = (item.title || '')
            .replace(/[^\w\sа-яА-ЯёЁ,.-]/gi, ' ')
            .replace(/\s+/g, ' ')
            .trim();
          const pbrCaption = [
            `Photorealistic interior architectural visualization, ${query}.`,
            cleanTitle ? `Subject: ${cleanTitle}.` : '',
            `Materials: high-end natural finishes, detailed tactile surface textures.`,
            `Lighting: soft global illumination, realistic ambient occlusion, photographic balance.`,
            `Style: professional architectural photography, 8k resolution, Corona Render, V-Ray quality.`,
          ].filter(Boolean).join(' ');

          await fs.promises.writeFile(txtPath, pbrCaption, 'utf8');

          savedFiles.push({
            fileName: imgFileName,
            filePath: imgPath,
            caption: pbrCaption,
            width: item.width,
            height: item.height,
            sizeBytes: buffer.length,
          });

          savedCount++;
        } catch (_) {
          // If a single image download fails, continue to next candidate
        }
      }

      if (win) {
        win.webContents.send('harvester:progress', {
          status: 'completed',
          message: `Успешно скачано ${savedCount} качественных изображений с разметкой!`,
          current: savedCount,
          total: count,
        });
      }

      return {
        success: true,
        count: savedCount,
        folder: targetDir,
        files: savedFiles,
      };
    } catch (err) {
      if (win) {
        win.webContents.send('harvester:progress', {
          status: 'error',
          message: err?.message || 'Ошибка парсера изображений',
          current: 0,
          total: count,
        });
      }
      return { success: false, error: err?.message || 'Не удалось выполнить сбор изображений.' };
    }
  });

  ipcMain.handle('harvester:openFolder', async (_event, category = '') => {
    const root = getHarvesterRoot();
    const folder = category ? path.join(root, category.replace(/[^\w-]/g, '_')) : root;
    if (fs.existsSync(folder)) {
      await shell.openPath(folder);
      return { success: true, folder };
    }
    await shell.openPath(root);
    return { success: true, folder: root };
  });

  ipcMain.handle('harvester:getStats', async () => {
    const root = getHarvesterRoot();
    if (!fs.existsSync(root)) return { totalCategories: 0, totalImages: 0, categories: [] };

    try {
      const dirs = await fs.promises.readdir(root, { withFileTypes: true });
      const categories = [];
      let totalImages = 0;

      for (const d of dirs) {
        if (d.isDirectory()) {
          const catPath = path.join(root, d.name);
          const files = await fs.promises.readdir(catPath);
          const imgFiles = files.filter((f) => /\.(jpg|jpeg|png|webp)$/i.test(f));
          totalImages += imgFiles.length;
          categories.push({
            name: d.name,
            count: imgFiles.length,
            path: catPath,
          });
        }
      }

      return {
        totalCategories: categories.length,
        totalImages,
        categories,
        root,
      };
    } catch (e) {
      return { totalCategories: 0, totalImages: 0, categories: [], error: e.message };
    }
  });

  ipcMain.handle('harvester:loadImages', async (_event, category = '') => {
    const root = getHarvesterRoot();
    const folder = category ? path.join(root, category.replace(/[^\w-]/g, '_')) : root;
    if (!fs.existsSync(folder)) return { success: true, images: [] };

    try {
      const files = await fs.promises.readdir(folder);
      const imgNames = files.filter((f) => /\.(jpg|jpeg|png|webp)$/i.test(f)).slice(0, 30);
      const list = [];

      for (const name of imgNames) {
        const fullPath = path.join(folder, name);
        const txtPath = path.join(folder, name.replace(/\.[^.]+$/, '.txt'));
        let caption = '';
        if (fs.existsSync(txtPath)) {
          caption = await fs.promises.readFile(txtPath, 'utf8');
        }
        const buf = await fs.promises.readFile(fullPath);
        const mime = name.endsWith('.png') ? 'image/png' : 'image/jpeg';
        list.push({
          fileName: name,
          filePath: fullPath,
          base64: `data:${mime};base64,${buf.toString('base64')}`,
          caption,
        });
      }

      return { success: true, images: list, folder };
    } catch (e) {
      return { success: false, error: e.message, images: [] };
    }
  });

  // Get User AI Paths Configuration
  function getPathsConfigFile() {
    const userData = app.getPath('userData');
    return path.join(userData, 'comfyui_custom_paths.json');
  }

  ipcMain.handle('system:getCustomPaths', async () => {
    try {
      const cfgPath = getPathsConfigFile();
      if (fs.existsSync(cfgPath)) {
        const raw = fs.readFileSync(cfgPath, 'utf8');
        return JSON.parse(raw);
      }
    } catch (e) {}

    // Default paths (Prefers Drive D: D:\AI\ComfyUI_windows_portable and D:\AI\models)
    const defaultComfyUI = fs.existsSync('d:\\AI\\ComfyUI_windows_portable')
      ? 'd:\\AI\\ComfyUI_windows_portable'
      : fs.existsSync('d:\\AI\\ComfyUI')
      ? 'd:\\AI'
      : path.join(__dirname, '..', 'comfyui_runtime');

    const defaultModels = fs.existsSync('d:\\AI\\models')
      ? 'd:\\AI\\models'
      : path.join(__dirname, '..', 'models');

    return {
      comfyuiPath: defaultComfyUI,
      modelsPath: defaultModels,
      autoStartComfyUI: false,
    };
  });

  // Save User AI Paths Configuration & sync extra_model_paths.yaml
  ipcMain.handle('system:saveCustomPaths', async (event, config) => {
    try {
      const cfgPath = getPathsConfigFile();
      fs.writeFileSync(cfgPath, JSON.stringify(config, null, 2), 'utf8');

      // If ComfyUI directory exists, generate / update extra_model_paths.yaml
      if (config.comfyuiPath && fs.existsSync(config.comfyuiPath)) {
        const normalizedModelsPath = (config.modelsPath || 'd:\\AI\\models').replace(/\\/g, '/');
        const yamlContent = `custom_models:\n    base_path: ${normalizedModelsPath}\n    checkpoints: checkpoints\n    configs: configs\n    vae: vae\n    loras: loras\n    upscale_models: upscale_models\n    controlnet: controlnet\n    clip: clip\n    clip_vision: clip_vision\n    style_models: style_models\n    diffusers: diffusers\n    unet: unet\n`;

        const possibleYamlPaths = [
          path.join(config.comfyuiPath, 'extra_model_paths.yaml'),
          path.join(config.comfyuiPath, 'ComfyUI', 'extra_model_paths.yaml'),
        ];

        for (const yp of possibleYamlPaths) {
          try {
            const dir = path.dirname(yp);
            if (fs.existsSync(dir)) {
              fs.writeFileSync(yp, yamlContent, 'utf8');
            }
          } catch (_) {}
        }
      }

      return { success: true };
    } catch (e) {
      console.error('Failed to save custom paths:', e);
      return { success: false, error: e.message };
    }
  });

  // Scan Models Folder (Checkpoints, ControlNets, LoRAs, VAE)
  ipcMain.handle('system:scanModelsFolder', async (event, customFolder) => {
    const targetFolder = customFolder && fs.existsSync(customFolder)
      ? customFolder
      : fs.existsSync('d:\\AI\\models')
      ? 'd:\\AI\\models'
      : path.join(__dirname, '..', 'models');

    const result = {
      baseFolder: targetFolder,
      checkpoints: [],
      controlnet: [],
      loras: [],
      vae: [],
      upscale_models: [],
      totalCount: 0,
      totalBytes: 0,
    };

    if (!fs.existsSync(targetFolder)) return result;

    function scanDir(dir, category) {
      if (!fs.existsSync(dir)) return;
      try {
        const entries = fs.readdirSync(dir, { withFileTypes: true });
        for (const entry of entries) {
          const fullPath = path.join(dir, entry.name);
          if (entry.isDirectory()) {
            scanDir(fullPath, category);
          } else if (/\.(safetensors|ckpt|pt|pth|bin)$/i.test(entry.name)) {
            const stats = fs.statSync(fullPath);
            const sizeGb = (stats.size / (1024 * 1024 * 1024)).toFixed(2);
            const sizeMb = (stats.size / (1024 * 1024)).toFixed(1);
            const item = {
              name: entry.name,
              path: fullPath,
              sizeGb: stats.size >= 1024 * 1024 * 1024 ? `${sizeGb} GB` : `${sizeMb} MB`,
              bytes: stats.size,
              category,
            };
            if (result[category]) {
              result[category].push(item);
            }
            result.totalCount++;
            result.totalBytes += stats.size;
          }
        }
      } catch (_) {}
    }

    scanDir(path.join(targetFolder, 'checkpoints'), 'checkpoints');
    scanDir(path.join(targetFolder, 'controlnet'), 'controlnet');
    scanDir(path.join(targetFolder, 'loras'), 'loras');
    scanDir(path.join(targetFolder, 'vae'), 'vae');
    scanDir(path.join(targetFolder, 'upscale_models'), 'upscale_models');

    // Also scan root of targetFolder if user put files directly there
    try {
      const rootFiles = fs.readdirSync(targetFolder, { withFileTypes: true });
      for (const rf of rootFiles) {
        if (!rf.isDirectory() && /\.(safetensors|ckpt)$/i.test(rf.name)) {
          const stats = fs.statSync(path.join(targetFolder, rf.name));
          const sizeGb = (stats.size / (1024 * 1024 * 1024)).toFixed(2);
          const isCn = /controlnet|depth|canny/i.test(rf.name);
          const cat = isCn ? 'controlnet' : 'checkpoints';
          result[cat].push({
            name: rf.name,
            path: path.join(targetFolder, rf.name),
            sizeGb: `${sizeGb} GB`,
            bytes: stats.size,
            category: cat,
          });
          result.totalCount++;
          result.totalBytes += stats.size;
        }
      }
    } catch (_) {}

    return result;
  });

  // Get Live ComfyUI Server Status
  ipcMain.handle('system:getComfyUIStatus', async () => {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 1200);
      const res = await fetch('http://127.0.0.1:8188/system_stats', { signal: controller.signal });
      clearTimeout(timeoutId);
      if (res.ok) {
        const data = await res.json().catch(() => ({}));
        return { online: true, port: 8188, systemStats: data };
      }
    } catch (_) {}
    return { online: false, port: 8188 };
  });

  ipcMain.handle('archicad:getWatchStatus', async () => ({
    running: !!archicadWatcher,
    folderPath: archicadWatchRoot || (() => {
      try { return JSON.parse(fs.readFileSync(getArchicadWatchConfigPath(), 'utf8')).folderPath || ''; }
      catch (_) { return ''; }
    })(),
  }));

  ipcMain.handle('archicad:startWatch', async (_event, folderPath) => {
    try {
      return { success: true, folderPath: startArchicadWatcher(folderPath) };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('archicad:stopWatch', async () => {
    let folderPath = archicadWatchRoot || '';
    closeArchicadWatcher();
    try {
      const configPath = getArchicadWatchConfigPath();
      const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
      folderPath = folderPath || config.folderPath || '';
      fs.writeFileSync(configPath, JSON.stringify({ ...config, enabled: false }, null, 2), 'utf8');
    } catch (_) {}
    return { success: true, running: false, folderPath };
  });

  ipcMain.handle('archicad:readWatchedImage', async (_event, filePath) => {
    try {
      const config = JSON.parse(fs.readFileSync(getArchicadWatchConfigPath(), 'utf8'));
      const root = await fs.promises.realpath(archicadWatchRoot || config.folderPath || '');
      const target = await fs.promises.realpath(filePath);
      const relative = path.relative(root, target);
      if (!root || !relative || relative === '..' || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) {
        throw new Error('Файл находится вне отслеживаемой папки.');
      }
      if (!/\.(png|jpe?g|webp)$/i.test(target)) throw new Error('Поддерживаются только PNG, JPG и WEBP.');
      const stat = await fs.promises.stat(target);
      if (!stat.isFile() || stat.size > 50 * 1024 * 1024) throw new Error('Файл пустой, недоступный или превышает 50 МБ.');
      const ext = path.extname(target).toLowerCase();
      const mimeType = ext === '.jpg' || ext === '.jpeg' ? 'image/jpeg' : ext === '.webp' ? 'image/webp' : 'image/png';
      const data = await fs.promises.readFile(target);
      return { success: true, filePath: target, fileName: path.basename(target), mimeType, base64: data.toString('base64') };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  // Stop only ComfyUI processes under the configured installation root.
  ipcMain.handle('system:stopComfyUI', async () => {
    const child_process = require('child_process');
    const cfgPath = getPathsConfigFile();
    let comfyuiRoot = activeComfyRoot;
    if (!comfyuiRoot) {
      try {
        const cfg = JSON.parse(fs.readFileSync(cfgPath, 'utf8'));
        comfyuiRoot = cfg.comfyuiPath;
      } catch (_) {}
    }
    if (!comfyuiRoot) {
      comfyuiRoot = fs.existsSync('d:\\AI\\ComfyUI_windows_portable')
        ? 'd:\\AI\\ComfyUI_windows_portable'
        : fs.existsSync('d:\\AI\\ComfyUI') ? 'd:\\AI' : path.join(__dirname, '..', 'comfyui_runtime');
    }

    const pids = new Set();
    if (activeComfyPid) pids.add(activeComfyPid);

    // Find the ComfyUI process tree by its configured install path. Never kill
    // an unrelated process merely because it happens to listen on port 8188.
    if (comfyuiRoot) {
      try {
        const safeRoot = path.resolve(comfyuiRoot).replace(/'/g, "''");
        const psCmd = `$root='${safeRoot}'; Get-CimInstance Win32_Process | Where-Object { $_.Name -match '^(python|pythonw|cmd)(\.exe)?$' -and $_.CommandLine -and $_.CommandLine -like ('*' + $root + '*') -and $_.CommandLine -match 'main\.py' } | ForEach-Object { $_.ProcessId }`;
        const found = child_process.execFileSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', psCmd], { encoding: 'utf8', windowsHide: true, stdio: ['ignore', 'pipe', 'ignore'] });
        for (const id of found.split(/\s+/)) if (/^\d+$/.test(id)) pids.add(Number(id));
      } catch (_) {}
    }

    for (const pid of pids) {
      try {
        child_process.execFileSync('taskkill.exe', ['/F', '/T', '/PID', String(pid)], { stdio: 'ignore', windowsHide: true });
      } catch (_) {}
    }

    activeComfyPid = null;
    activeComfyProcess = null;
    activeComfyRoot = null;

    // Verify status
    await new Promise((r) => setTimeout(r, 600));
    let isStillOnline = false;
    try {
      const res = await fetch('http://127.0.0.1:8188/system_stats', { signal: AbortSignal.timeout(800) });
      if (res.ok) isStillOnline = true;
    } catch (_) {}

    return { success: !isStillOnline, isStillOnline };
  });

  // Open ComfyUI Web in External Browser
  ipcMain.handle('system:openComfyUIWeb', async () => {
    await shell.openExternal('http://127.0.0.1:8188');
    return true;
  });

  // Open local models folder in Explorer
  ipcMain.handle('system:openModelsFolder', async (_event, subfolder) => {
    const cfgPath = getPathsConfigFile();
    let modelsPath = 'd:\\AI\\models';
    if (fs.existsSync(cfgPath)) {
      try {
        const cfg = JSON.parse(fs.readFileSync(cfgPath, 'utf8'));
        if (cfg.modelsPath && fs.existsSync(cfg.modelsPath)) {
          modelsPath = cfg.modelsPath;
        }
      } catch (_) {}
    }
    if (!fs.existsSync(modelsPath)) {
      modelsPath = fs.existsSync('d:\\AI\\models') ? 'd:\\AI\\models' : path.join(__dirname, '..', 'models');
      if (!fs.existsSync(modelsPath)) {
        fs.mkdirSync(modelsPath, { recursive: true });
      }
    }
    const target = subfolder === 'loras' ? path.join(modelsPath, 'loras') : modelsPath;
    if (!fs.existsSync(target)) fs.mkdirSync(target, { recursive: true });
    await shell.openPath(target);
    return true;
  });

  // Launch ComfyUI directly with robust arguments and custom paths
  ipcMain.handle('system:launchComfyUI', async () => {
    const child_process = require('child_process');

    // Check if already online
    try {
      const ping = await fetch('http://127.0.0.1:8188/system_stats', { signal: AbortSignal.timeout(1000) });
      if (ping.ok) {
        return { success: true, message: 'ComfyUI уже запущен и готов на 127.0.0.1:8188' };
      }
    } catch (_) {}

    // Resolve paths
    const cfgPath = getPathsConfigFile();
    let comfyuiRoot = 'd:\\AI\\ComfyUI_windows_portable';
    let modelsRoot = 'd:\\AI\\models';

    if (fs.existsSync(cfgPath)) {
      try {
        const cfg = JSON.parse(fs.readFileSync(cfgPath, 'utf8'));
        if (cfg.comfyuiPath) comfyuiRoot = cfg.comfyuiPath;
        if (cfg.modelsPath) modelsRoot = cfg.modelsPath;
      } catch (_) {}
    }

    if (!fs.existsSync(comfyuiRoot)) {
      if (fs.existsSync('d:\\AI\\ComfyUI_windows_portable')) {
        comfyuiRoot = 'd:\\AI\\ComfyUI_windows_portable';
      } else if (fs.existsSync('d:\\AI\\ComfyUI')) {
        comfyuiRoot = 'd:\\AI';
      } else {
        comfyuiRoot = path.join(__dirname, '..', 'comfyui_runtime');
      }
    }

    // Resolve python
    let pythonExe = path.join(comfyuiRoot, 'python_embeded', 'python.exe');
    if (!fs.existsSync(pythonExe)) {
      pythonExe = path.join(comfyuiRoot, 'venv', 'Scripts', 'python.exe');
      if (!fs.existsSync(pythonExe)) {
        pythonExe = 'python.exe';
      }
    }

    // Resolve main.py
    let mainPy = path.join(comfyuiRoot, 'ComfyUI', 'main.py');
    if (!fs.existsSync(mainPy)) {
      mainPy = path.join(comfyuiRoot, 'main.py');
    }
    if (!fs.existsSync(mainPy)) {
      return { success: false, error: `Не найден ComfyUI main.py в папке: ${comfyuiRoot}` };
    }

    // Prepare extra_model_paths.yaml if models directory configured
    const yamlPath = path.join(comfyuiRoot, 'extra_model_paths.yaml');
    if (modelsRoot && fs.existsSync(modelsRoot)) {
      try {
        const normalized = modelsRoot.replace(/\\/g, '/');
        const yamlContent = `custom_models:\n    base_path: ${normalized}\n    checkpoints: checkpoints\n    configs: configs\n    vae: vae\n    loras: loras\n    upscale_models: upscale_models\n    controlnet: controlnet\n    clip: clip\n    clip_vision: clip_vision\n    style_models: style_models\n    diffusers: diffusers\n    unet: unet\n`;
        fs.writeFileSync(yamlPath, yamlContent, 'utf8');
      } catch (_) {}
    }

    const args = [
      mainPy,
      '--windows-standalone-build',
      '--lowvram',
      '--fp8_e4m3fn-text-enc',
      '--listen', '127.0.0.1',
      '--port', '8188',
      '--enable-cors-header', '*',
    ];

    if (fs.existsSync(yamlPath)) {
      args.push('--extra-model-paths-config', yamlPath);
    }

    try {
      const proc = child_process.spawn(pythonExe, args, {
        cwd: comfyuiRoot,
        detached: true,
        stdio: 'ignore',
      });
      activeComfyProcess = proc;
      activeComfyPid = proc.pid;
      activeComfyRoot = comfyuiRoot;
      proc.unref();
      const readyDeadline = Date.now() + 120000;
      let spawnError = null;
      proc.once('error', (error) => { spawnError = error; });
      while (Date.now() < readyDeadline) {
        if (spawnError) throw spawnError;
        if (proc.exitCode !== null) {
          throw new Error(`ComfyUI завершился при запуске (код ${proc.exitCode}).`);
        }
        try {
          const ready = await fetch('http://127.0.0.1:8188/system_stats', { signal: AbortSignal.timeout(1000) });
          if (ready.ok) return { success: true, ready: true, message: 'ComfyUI готов на 127.0.0.1:8188.' };
        } catch (_) {}
        await new Promise((resolve) => setTimeout(resolve, 750));
      }
      return { success: true, ready: false, message: 'Процесс ComfyUI запущен, API пока не ответил. Проверьте журнал ComfyUI.' };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  // Dedicated ComfyUI IPC proxy (bypasses browser CORS / Private Network Access restrictions)
  ipcMain.handle('comfyui:fetch', async (event, { url, method = 'GET', headers = {}, body, isJson = true, isBinary = false, uploadBase64, uploadFilename, mimeType }) => {
    try {
      let fetchBody = body;
      let fetchHeaders = { ...headers };

      if (uploadBase64) {
        const cleanB64 = uploadBase64.replace(/^data:image\/[a-z]+;base64,/, '');
        const buf = Buffer.from(cleanB64, 'base64');
        const blob = new Blob([buf], { type: mimeType || 'image/png' });
        const formData = new FormData();
        formData.append('image', blob, uploadFilename || 'clay_render.png');
        formData.append('overwrite', 'true');
        fetchBody = formData;
      } else if (isJson && body && typeof body === 'object') {
        fetchBody = JSON.stringify(body);
        fetchHeaders['Content-Type'] = 'application/json';
      }

      const response = await fetch(url, {
        method,
        headers: fetchHeaders,
        body: fetchBody,
      });

      if (!response.ok) {
        const errText = await response.text().catch(() => '');
        return {
          success: false,
          status: response.status,
          error: `HTTP ${response.status}: ${errText.substring(0, 200)}`,
        };
      }

      if (isBinary) {
        const arrayBuffer = await response.arrayBuffer();
        const base64 = Buffer.from(arrayBuffer).toString('base64');
        const contentType = response.headers.get('content-type') || 'image/png';
        return {
          success: true,
          status: response.status,
          data: `data:${contentType};base64,${base64}`,
        };
      }

      const json = await response.json().catch(() => null);
      return {
        success: true,
        status: response.status,
        data: json,
      };
    } catch (err) {
      return {
        success: false,
        error: err.message || 'Network error connecting to ComfyUI',
      };
    }
  });

  // Copy image to clipboard
  ipcMain.handle('clipboard:copyImage', async (event, base64Data) => {
    try {
      const cleanBase64 = base64Data.replace(/^data:image\/\w+;base64,/, '');
      const buffer = Buffer.from(cleanBase64, 'base64');
      const img = nativeImage.createFromBuffer(buffer);
      // Chromium decodes WebP in the renderer, where the Bridge can retry as PNG.
      if (img.isEmpty()) return false;
      clipboard.writeImage(img);
      return true;
    } catch (e) {
      console.error('Failed to copy to clipboard:', e);
      return false;
    }
  });

  // Secure Storage Items
  ipcMain.handle('secure:save', async (event, key, value) => {
    try {
      if (!rendererSecureKeys.has(key) || typeof value !== 'string') return false;
      const encrypted = encryptData(value);
      db.run('INSERT OR REPLACE INTO secure_kv (key, value) VALUES (?, ?)', [key, encrypted]);
      saveDatabaseFile();
      return true;
    } catch (e) {
      console.error('Secure save failed:', e);
      return false;
    }
  });

  ipcMain.handle('secure:get', async (event, key) => {
    try {
      if (!rendererSecureKeys.has(key)) return null;
      const stmt = db.prepare('SELECT value FROM secure_kv WHERE key = ?');
      stmt.bind([key]);
      if (stmt.step()) {
        const row = stmt.getAsObject();
        stmt.free();
        return decryptData(row.value);
      }
      stmt.free();
      return null;
    } catch (e) {
      console.error('Secure get failed:', e);
      return null;
    }
  });

  ipcMain.handle('secure:delete', async (event, key) => {
    try {
      if (!rendererSecureKeys.has(key)) return false;
      db.run('DELETE FROM secure_kv WHERE key = ?', [key]);
      saveDatabaseFile();
      return true;
    } catch (e) {
      return false;
    }
  });

  // Database Execute & Query
  ipcMain.handle('db:execute', async (event, sql, params = []) => {
    try {
      db.run(sql, params);
      saveDatabaseFile(true);
      return { success: true };
    } catch (e) {
      console.error('db:execute error:', e, sql);
      return { success: false, error: e.message };
    }
  });

  ipcMain.handle('db:clearProjectData', async () => {
    try {
      db.run('BEGIN TRANSACTION');
      db.run('DELETE FROM generations');
      db.run('DELETE FROM projects');
      db.run('COMMIT');
      saveDatabaseFile();
      return { success: true };
    } catch (e) {
      try { db.run('ROLLBACK'); } catch (_) {}
      console.error('db:clearProjectData error:', e);
      return { success: false, error: e.message };
    }
  });

  ipcMain.handle('db:query', async (event, sql, params = []) => {
    try {
      const stmt = db.prepare(sql);
      stmt.bind(params);
      const results = [];
      while (stmt.step()) {
        results.push(stmt.getAsObject());
      }
      stmt.free();
      return results;
    } catch (e) {
      console.error('db:query error:', e, sql);
      return [];
    }
  });

  ipcMain.handle('db:saveSnapshot', async () => {
    saveDatabaseFile();
    return true;
  });

  // Google identity uses the system browser. Tokens stay in the encrypted main-process store.
  const readAuthRecord = (key) => {
    const stmt = db.prepare('SELECT value FROM secure_kv WHERE key = ?');
    try {
      stmt.bind([key]);
      return stmt.step() ? decryptData(stmt.getAsObject().value) : null;
    } finally {
      stmt.free();
    }
  };
  const writeAuthRecord = (key, value, requirePersistence = false) => {
    db.run('INSERT OR REPLACE INTO secure_kv (key, value) VALUES (?, ?)', [key, encryptData(value)]);
    saveDatabaseFile(requirePersistence);
  };
  let googleOAuthInProgress = false;

  ipcMain.handle('auth:getOAuthConfigStatus', async () => {
    try {
      const config = resolveOAuthConfig({ readStoredRecord });
      const isConfigured = Boolean(config.clientId && isValidClientId(config.clientId));
      return {
        isConfigured,
        source: config.source,
        maskedClientId: isConfigured ? (config.clientId.substring(0, 10) + '...' + config.clientId.slice(-22)) : '',
        hasClientSecret: Boolean(config.clientSecret),
      };
    } catch (error) {
      return {
        isConfigured: false,
        source: 'error',
        maskedClientId: '',
        hasClientSecret: false,
      };
    }
  });

  ipcMain.handle('auth:googleOAuth', async (_event, developerOverride = {}) => {
    const config = resolveOAuthConfig({
      explicitClientId: developerOverride.clientId,
      explicitClientSecret: developerOverride.clientSecret,
      readStoredRecord,
    });

    if (!config.clientId || !isValidClientId(config.clientId)) {
      return {
        success: false,
        notConfigured: true,
        error: 'Вход через Google временно недоступен: OAuth Desktop Client приложения не настроен разработчиком.',
      };
    }
    if (config.clientSecret && config.clientSecret.length > 512) {
      return { success: false, error: 'Client Secret слишком длинный. Проверьте значение из Google Cloud Console.' };
    }
    if (googleOAuthInProgress) {
      return { success: false, error: 'Вход Google уже выполняется. Дождитесь результата в браузере.' };
    }
    googleOAuthInProgress = true;
    try {
      if (developerOverride.clientId && developerOverride.saveAsDefault) {
        writeAuthRecord('google_oauth_client_id', config.clientId);
        if (config.clientSecret) {
          writeAuthRecord('google_oauth_client_secret', config.clientSecret);
        } else {
          db.run("DELETE FROM secure_kv WHERE key = 'google_oauth_client_secret'");
        }
      }
      const result = await startGoogleOAuth(config.clientId, config.clientSecret, (url) => shell.openExternal(url), async (verified) => {
        const record = {
          verifiedGoogle: true,
          clientId: config.clientId,
          clientSecret: config.clientSecret || undefined,
          user: verified.user,
          accessToken: verified.accessToken,
          refreshToken: verified.refreshToken,
          expiresAt: verified.expiresAt,
        };
        writeAuthRecord('google_oauth_session', JSON.stringify(record));
        db.run("DELETE FROM secure_kv WHERE key = 'google_user_session'");
        saveDatabaseFile();
      });
      if (!result.success) return result;
      return { success: true, user: result.user };
    } catch (error) {
      return { success: false, error: error.message || 'Не удалось завершить вход Google.' };
    } finally {
      googleOAuthInProgress = false;
    }
  });

  ipcMain.handle('auth:getGoogleSession', async () => {
    try {
      const legacy = readAuthRecord('google_user_session');
      if (legacy) {
        try {
          const parsed = JSON.parse(legacy);
          if (parsed.user?.name && !readAuthRecord('local_user_profile')) {
            writeAuthRecord('local_user_profile', JSON.stringify({ user: parsed.user }));
          }
        } catch (_) { /* Ignore malformed legacy profiles. */ }
        db.run("DELETE FROM secure_kv WHERE key = 'google_user_session'");
        saveDatabaseFile();
      }
      const stored = readAuthRecord('google_oauth_session');
      if (!stored) return { success: false };
      let record = JSON.parse(stored);
      if (!record.verifiedGoogle || !record.user?.id || !record.user?.email || !record.clientId) {
        return { success: false, error: 'Сохранённая сессия Google недействительна. Повторите вход.' };
      }
      if (!record.accessToken || !Number.isFinite(record.expiresAt) || record.expiresAt < Date.now() + 60000) {
        record = await refreshGoogleSession(record);
        if (!record) return { success: false, error: 'Срок действия сессии Google истёк. Повторите вход.' };
        writeAuthRecord('google_oauth_session', JSON.stringify(record));
      }
      return { success: true, user: record.user };
    } catch (error) {
      return { success: false, error: error.message || 'Не удалось проверить сессию Google.' };
    }
  });

  // Local profiles are stored separately and never presented as Google authorization.
  ipcMain.handle('auth:saveProfile', async (_event, profileData) => {
    try {
      if (!profileData?.user?.name) return false;
      writeAuthRecord('local_user_profile', JSON.stringify({ user: profileData.user }));
      return true;
    } catch (_) {
      return false;
    }
  });

  ipcMain.handle('auth:logout', async () => {
    db.run("DELETE FROM secure_kv WHERE key IN ('google_oauth_session', 'google_user_session', 'google_tokens', 'local_user_profile')");
    saveDatabaseFile();
    return true;
  });
}
// ---------------- App Lifecycle ----------------
app.whenReady().then(async () => {
  await initDatabase();
  setupIPC();
  try {
    const watchConfig = JSON.parse(fs.readFileSync(getArchicadWatchConfigPath(), 'utf8'));
    if (watchConfig.enabled && watchConfig.folderPath) startArchicadWatcher(watchConfig.folderPath);
  } catch (_) {}
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
}).catch((error) => {
  const message = error && error.stack ? error.stack : String(error);
  console.error('AI Designer startup failed:', message);
  dialog.showErrorBox('AI Designer не удалось запустить', message);
  app.exit(1);
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('will-quit', closeArchicadWatcher);
