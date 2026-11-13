import { useEffect, useState } from 'react';
import { FolderOpen, HardDrive, Trash2 } from 'lucide-react';
import { useI18n } from '../i18n/i18nContext';
import type { ElectronAPI } from '../types/electron';

export function AppCacheSettings({ api }: { api: ElectronAPI }) {
  const { t, language } = useI18n();
  const [usage, setUsage] = useState<Awaited<ReturnType<ElectronAPI['inspectAppCache']>> | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [notice, setNotice] = useState<{ key: string; removedBytes?: number } | null>(null);
  const size = (bytes: number) => new Intl.NumberFormat(language, {
    style: 'unit', unit: bytes < 1024 * 1024 ? 'kilobyte' : 'megabyte', maximumFractionDigits: 1,
  }).format(bytes / (bytes < 1024 * 1024 ? 1024 : 1024 * 1024));

  useEffect(() => {
    let mounted = true;
    void api.inspectAppCache().then((result) => { if (mounted) setUsage(result); }).catch(() => {
      if (mounted) setNotice({ key: 'cache.inspectFailed' });
    });
    return () => { mounted = false; };
  }, [api]);

  async function clear() {
    setConfirming(false);
    setClearing(true);
    setNotice(null);
    try {
      const result = await api.clearAppCache();
      setNotice({ key: 'cache.' + result.status, removedBytes: result.removedBytes });
      void api.inspectAppCache().then(setUsage).catch(() => setUsage(null));
    } catch {
      setNotice({ key: 'cache.failed' });
    } finally {
      setClearing(false);
    }
  }

  return <section className="bridge-card" aria-busy={clearing}>
    <div>
      <h2 className="flex items-center gap-2"><HardDrive size={18} />{t('cache.title')}</h2>
      <p className="bridge-muted mt-2">{t('cache.description')}</p>
    </div>
    {usage && <dl className="grid gap-2 sm:grid-cols-2">
      <div className="rounded-lg border bg-studio-bg p-3"><dt className="bridge-muted">{t('cache.temporary')}</dt><dd className="mt-1 text-lg font-semibold tabular-nums">{size(usage.temporaryBytes)}</dd></div>
      <div className="rounded-lg border bg-studio-bg p-3"><dt className="bridge-muted">{t('cache.browser')}</dt><dd className="mt-1 text-lg font-semibold tabular-nums">{size(usage.browserBytes)}</dd></div>
    </dl>}
    {usage?.incomplete && <p className="bridge-muted">{t('cache.incomplete')}</p>}
    {confirming ? <div className="bridge-stack rounded-xl border p-4" role="group" aria-label={t('cache.clear')}>
      <p className="text-sm">{t('cache.confirm')}</p>
      <div className="bridge-actions">
        <button className="bridge-button" autoFocus onClick={() => setConfirming(false)}>{t('action.cancel')}</button>
        <button className="bridge-button bridge-primary" onClick={() => void clear()}>{t('cache.clear')}</button>
      </div>
    </div> : <div className="bridge-actions">
      <button className="bridge-button" disabled={clearing} onClick={() => { setNotice(null); setConfirming(true); }}><Trash2 size={16} />{t(clearing ? 'cache.clearing' : 'cache.clear')}</button>
      <button className="bridge-button" disabled={clearing} onClick={() => void api.openDataFolder().then((result) => {
        if (!result.success) setNotice({ key: 'cache.folderFailed' });
      }).catch(() => setNotice({ key: 'cache.folderFailed' }))}><FolderOpen size={16} />{t('cache.openFolder')}</button>
    </div>}
    {notice && <p role="status" className="bridge-muted">{t(notice.key, { size: size(notice.removedBytes ?? 0) })}</p>}
  </section>;
}
