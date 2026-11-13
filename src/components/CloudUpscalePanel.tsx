import { useEffect, useState } from 'react';
import { Download, Sparkles } from 'lucide-react';
import { useI18n } from '../i18n/i18nContext';
import { GenerationResult } from '../types/ai';

type UpscaleImage = Pick<GenerationResult, 'imageBase64' | 'mimeType' | 'width' | 'height' | 'timestamp'>;

export function CloudUpscalePanel({ result, onSettings }: {
  result: UpscaleImage;
  onSettings: () => void;
}) {
  const { t } = useI18n();
  const [configured, setConfigured] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [output, setOutput] = useState<{ url: string; width: number; height: number; cleanupFailed?: boolean } | null>(null);
  const eligible = result.width * result.height <= 2048 * 2048;

  useEffect(() => {
    void (window.electronAPI?.isCloudUpscaleConfigured() ?? Promise.resolve(false)).then(setConfigured).catch(() => setConfigured(false));
  }, []);

  async function upscale() {
    if (!window.electronAPI || busy || !eligible) return;
    setBusy(true);
    setError('');
    setOutput(null);
    try {
      let mime = result.mimeType;
      let data = result.imageBase64.replace(/^data:image\/[\w.+-]+;base64,/, '');
      if (mime === 'image/webp' || data.length > 10 * 1024 * 1024 * 4 / 3) {
        const image = new Image();
        image.src = 'data:' + mime + ';base64,' + data;
        await image.decode();
        const canvas = document.createElement('canvas');
        canvas.width = image.naturalWidth;
        canvas.height = image.naturalHeight;
        const context = canvas.getContext('2d');
        if (!context) throw new Error('service');
        context.drawImage(image, 0, 0);
        mime = 'image/jpeg';
        data = canvas.toDataURL(mime, 0.96).split(',')[1];
      }
      const response = await window.electronAPI.runCloudUpscale(data, mime);
      if (!response.base64) {
        setError(response.error || 'service');
        return;
      }
      const url = 'data:image/jpeg;base64,' + response.base64;
      const image = new Image();
      image.src = url;
      await image.decode();
      if (image.naturalWidth <= result.width || image.naturalHeight <= result.height) throw new Error('service');
      setOutput({ url, width: image.naturalWidth, height: image.naturalHeight, cleanupFailed: response.cleanupFailed });
    } catch {
      setError('service');
    } finally {
      setBusy(false);
    }
  }

  return <section className="bridge-cloud bridge-stack" aria-busy={busy}>
    <h3>{t('cloudUpscale.title')} · Cloudinary</h3>
    <p className="bridge-muted">{t('cloudUpscale.uploadNotice')}</p>
    {!eligible && <p className="bridge-muted">{t('cloudUpscale.size')}</p>}
    {!window.electronAPI && <p className="bridge-muted">{t('cloudUpscale.desktop')}</p>}
    {window.electronAPI && configured === false && <button className="bridge-button" onClick={onSettings}>{t('cloudUpscale.connect')}</button>}
    {configured && eligible && <button className="bridge-button bridge-primary" onClick={upscale} disabled={busy}>
      <Sparkles size={16} />{t(busy ? 'cloudUpscale.processing' : 'cloudUpscale.run')}
    </button>}
    {error && <p className="bridge-error" role="alert">{t('cloudUpscale.' + error)}</p>}
    {output && <>
      <img className="max-h-[480px] w-full object-contain rounded-xl" src={output.url} alt={t('cloudUpscale.title')} />
      <div className="bridge-actions">
        <a className="bridge-button bridge-primary" href={output.url} download={'Gemini-' + result.timestamp + '-upscaled.jpg'}><Download size={17} />{t('bridge.saveImage')}</a>
        <span className="bridge-muted">{output.width} × {output.height}</span>
      </div>
      {output.cleanupFailed && <p className="bridge-error" role="status">{t('cloudUpscale.cleanupFailed')}</p>}
    </>}
  </section>;
}

export function CloudUpscaleDialog({ result, onSettings, onClose }: {
  result: UpscaleImage;
  onSettings: () => void;
  onClose: () => void;
}) {
  const { t } = useI18n();
  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [onClose]);
  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
    <section className="bridge-card max-h-[90vh] w-full max-w-2xl overflow-y-auto" role="dialog" aria-modal="true" aria-label={t('cloudUpscale.title')}>
      <button className="bridge-button self-end" autoFocus onClick={onClose}>{t('action.close')}</button>
      <CloudUpscalePanel result={result} onSettings={onSettings} />
    </section>
  </div>;
}
