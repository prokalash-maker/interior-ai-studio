import { GenerationResult } from '../../types/ai';

export interface BridgeHandoffState {
  sourceImageBase64: string | null;
  sourceImageMimeType: string;
  sourceFileName: string | null;
  generatedPrompt: string;
  lastCopiedPrompt: boolean;
  lastCopiedImage: boolean;
  tempFilePath?: string;
}

class GeminiBridgeService {
  /**
   * Opens the official Gemini web application in the user's default browser.
   * Uses personal signed-in Google account without any API keys or session extraction.
   */
  async openGeminiWeb(customUrl: string = 'https://gemini.google.com/'): Promise<boolean> {
    if ((window as any).electronAPI?.openGeminiBridgeWindow && customUrl === 'https://gemini.google.com/') {
      const result = await (window as any).electronAPI.openGeminiBridgeWindow();
      if (result?.success) return true;
      console.error('Could not open embedded Gemini:', result?.error);
      return false;
    }
    if (typeof window !== 'undefined') {
      // In Electron or modern browsers, window.open with _blank delegates to OS default browser
      window.open(customUrl, '_blank');
      return true;
    }
    return false;
  }

  openGeminiExternal(): void {
    if (typeof window !== 'undefined') window.open('https://gemini.google.com/', '_blank');
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
  async copyImageToClipboard(base64Data: string, mimeType: string = 'image/png'): Promise<boolean> {
    try {
      // 1. Electron Native Clipboard Integration (Most reliable for desktop)
      if ((window as any).electronAPI?.copyImageToClipboard) {
        const cleanBase64 = base64Data.replace(/^data:image\/\w+;base64,/, '');
        const success = await (window as any).electronAPI.copyImageToClipboard(cleanBase64);
        if (success) return true;
      }

      // 2. Standard Web ClipboardItem API
      if (navigator.clipboard && typeof ClipboardItem !== 'undefined') {
        const cleanBase64 = base64Data.replace(/^data:image\/\w+;base64,/, '');
        const byteCharacters = atob(cleanBase64);
        const byteNumbers = new Array(byteCharacters.length);
        for (let i = 0; i < byteCharacters.length; i++) {
          byteNumbers[i] = byteCharacters.charCodeAt(i);
        }
        const byteArray = new Uint8Array(byteNumbers);
        const blob = new Blob([byteArray], { type: mimeType });

        await navigator.clipboard.write([
          new ClipboardItem({
            [mimeType]: blob,
          }),
        ]);
        return true;
      }
    } catch (err) {
      console.warn('Standard image clipboard copy failed, attempting fallback download:', err);
    }
    return false;
  }

  /**
   * Saves a temporary copy of the source image to the user's downloads / temp folder
   * and opens it in Windows Explorer / Finder for seamless drag & drop.
   */
  async prepareTempFileAndReveal(base64Data: string, defaultName: string = 'archicad_reference.png', mimeType: string = 'image/png'): Promise<boolean> {
    try {
      const cleanBase64 = base64Data.replace(/^data:image\/\w+;base64,/, '');
      
      // Store handoff files under app data instead of assuming a particular Windows user path.
      if ((window as any).electronAPI?.saveGeminiSourceTemp && (window as any).electronAPI?.openFolderInExplorer) {
        const saved = await (window as any).electronAPI.saveGeminiSourceTemp(defaultName, cleanBase64, mimeType);
        if (!saved?.success || !saved.filePath) return false;
        await (window as any).electronAPI.openFolderInExplorer(saved.filePath);
        return true;
      }

      // Browser fallback: trigger simple file download
      const link = document.createElement('a');
      link.href = `data:${mimeType};base64,${cleanBase64}`;
      link.download = defaultName;
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
    fileName: string;
  }> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const fullDataUrl = reader.result as string;
        const cleanBase64 = fullDataUrl.replace(/^data:image\/[\w+.-]+;base64,/, '');
        const extension = file.name.toLowerCase().match(/\.(png|jpe?g|webp)$/)?.[1];
        const mimeType = ['image/png', 'image/jpeg', 'image/webp'].includes(file.type)
          ? file.type
          : extension === 'jpg' || extension === 'jpeg'
          ? 'image/jpeg'
          : extension === 'webp'
          ? 'image/webp'
          : 'image/png';

        const img = new Image();
        img.onload = () => {
          resolve({
            imageBase64: cleanBase64,
            mimeType,
            width: img.naturalWidth || 1024,
            height: img.naturalHeight || 768,
            fileName: file.name,
          });
        };
        img.onerror = () => {
          resolve({
            imageBase64: cleanBase64,
            mimeType,
            width: 1024,
            height: 768,
            fileName: file.name,
          });
        };
        img.src = fullDataUrl;
      };
      reader.onerror = (err) => reject(err);
      reader.readAsDataURL(file);
    });
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
