import { GenerationResult } from '../../types/ai';

class GeminiBridgeService {
  /**
   * Opens the optional embedded Gemini window, which has its own persisted browser session.
   * First-time Google sign-in should use openGeminiExternal() in the system browser.
   */
  async openGeminiWeb(): Promise<boolean> {
    try {
      return (await window.electronAPI?.openGeminiBridgeWindow())?.success === true;
    } catch {
      return false;
    }
  }

  async openGeminiExternal(): Promise<boolean> {
    try {
      if (window.electronAPI) {
        await window.electronAPI.openExternal('https://gemini.google.com/');
        return true;
      }
      return !!window.open('https://gemini.google.com/', '_blank');
    } catch (error) {
      console.error('Could not open Gemini in the browser:', error);
      return false;
    }
  }

  /**
   * Copies formatted text to the user's system clipboard.
   */
  async copyText(text: string): Promise<boolean> {
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(text);
        return true;
      }
      // Fallback for environments where clipboard API is restricted
      const textArea = document.createElement('textarea');
      textArea.value = text;
      textArea.style.position = 'fixed';
      textArea.style.left = '-9999px';
      document.body.appendChild(textArea);
      textArea.select();
      const success = document.execCommand('copy');
      document.body.removeChild(textArea);
      return success;
    } catch (err) {
      console.warn('Failed to copy text to clipboard:', err);
      return false;
    }
  }

  /**
   * Copies an image directly into the system clipboard so the user can paste (Ctrl + V)
   * into the Gemini prompt box without manual file uploading.
   */
  async copyImageToClipboard(base64Data: string, mimeType = 'image/png'): Promise<boolean> {
    try {
      const cleanBase64 = base64Data.replace(/^data:image\/[\w.+-]+;base64,/, '');
      const api = window.electronAPI;
      if (api && await api.copyImageToClipboard(cleanBase64)) return true;

      const image = new Image();
      image.src = `data:${mimeType};base64,${cleanBase64}`;
      await image.decode();
      const canvas = document.createElement('canvas');
      canvas.width = image.naturalWidth;
      canvas.height = image.naturalHeight;
      const context = canvas.getContext('2d');
      if (!context) return false;
      context.drawImage(image, 0, 0);
      if (api) return api.copyImageToClipboard(canvas.toDataURL('image/png'));
      const png = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'));
      if (!png || !navigator.clipboard?.write || typeof ClipboardItem === 'undefined') return false;
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': png })]);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Saves a temporary copy of the source image to the user's downloads / temp folder
   * and opens it in Windows Explorer / Finder for seamless drag & drop.
   */
  async prepareTempFileAndReveal(base64Data: string, defaultName: string = 'archicad_reference.png', mimeType: string = 'image/png'): Promise<boolean> {
    try {
      const cleanBase64 = base64Data.replace(/^data:image\/\w+;base64,/, '');
      
      // Store handoff files under app data instead of assuming a particular Windows user path.
      const api = window.electronAPI;
      if (api?.saveGeminiSourceTemp && api.openFolderInExplorer) {
        const saved = await api.saveGeminiSourceTemp(defaultName, cleanBase64, mimeType);
        if (!saved?.success || !saved.filePath) return false;
        await api.openFolderInExplorer(saved.filePath);
        return true;
      }

      // Browser fallback: trigger simple file download
      const link = document.createElement('a');
      link.href = `data:${mimeType};base64,${cleanBase64}`;
      link.download = /\.(png|jpe?g|webp)$/i.test(defaultName)
        ? defaultName
        : defaultName + (mimeType === 'image/webp' ? '.webp' : mimeType === 'image/jpeg' ? '.jpg' : '.png');
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      return true;
    } catch (e) {
      console.error('Failed to prepare temp file:', e);
      return false;
    }
  }

  /**
   * Reads an imported file (from Drag & Drop or file dialog),
   * extracts dimensions and base64 string.
   */
  async processImportedFile(file: File): Promise<{
    imageBase64: string;
    mimeType: string;
    width: number;
    height: number;
  }> {
    if (file.size === 0 || file.size > 50 * 1024 * 1024) throw new Error('invalid-image');
    const bytes = new Uint8Array(await file.slice(0, 12).arrayBuffer());
    const header = String.fromCharCode(...bytes);
    const mimeType = header.startsWith('\x89PNG\r\n\x1a\n') ? 'image/png'
      : header.startsWith('\xff\xd8\xff') ? 'image/jpeg'
      : header.startsWith('RIFF') && header.slice(8) === 'WEBP' ? 'image/webp'
      : null;
    if (!mimeType) throw new Error('invalid-image');

    const url = URL.createObjectURL(file);
    const image = new Image();
    image.src = url;
    try {
      await image.decode();
    } finally {
      URL.revokeObjectURL(url);
    }
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(file);
    });
    return {
      imageBase64: dataUrl.slice(dataUrl.indexOf(',') + 1),
      mimeType,
      width: image.naturalWidth,
      height: image.naturalHeight,
    };
  }

  /**
   * Creates a formal GenerationResult bound to the Gemini Bridge handoff.
   */
  createBridgeGenerationResult(data: {
    imageBase64: string;
    mimeType: string;
    width: number;
    height: number;
    promptUsed: string;
    resolution?: '1k' | '2k' | '4k';
    latencyMs?: number;
  }): GenerationResult {
    return {
      id: `gemini_bridge_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      imageBase64: data.imageBase64,
      mimeType: data.mimeType || 'image/png',
      width: data.width,
      height: data.height,
      model: 'gemini-web-personal',
      provider: 'gemini_bridge',
      promptUsed: data.promptUsed,
      latencyMs: data.latencyMs || 0,
      timestamp: Date.now(),
      resolution: data.resolution || '2k',
      costUsd: 0.0, // 100% Free
      textNotes: 'Gemini Web • Personal Google Account • No API charge recorded; account plan limits apply',
    };
  }
}

export const geminiBridgeService = new GeminiBridgeService();
