import { useEffect, useState } from 'react';
import { ChevronRight, Settings, Sparkles } from 'lucide-react';
import { LanguageSelector } from '../components/LanguageSelector';
import { AppCacheSettings } from '../components/AppCacheSettings';
import { useI18n } from '../i18n/i18nContext';

const cloudinaryConsole = 'https://console.cloudinary.com/';

export function WorkspaceSettings({ expertMode, onModeChange, onAdvanced }: {
  expertMode: boolean;
  onModeChange: (enabled: boolean) => void;
  onAdvanced: () => void;
}) {
  const { t } = useI18n();
  const [configured, setConfigured] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const api = window.electronAPI;

  useEffect(() => {
    void api?.isCloudUpscaleConfigured().then(setConfigured).catch(() => setConfigured(false));
  }, [api]);

  async function save(credentials: { cloud: string; key: string; secret: string } | null) {
    setBusy(true);
    setMessage('');
    try {
      if (!await api?.configureCloudUpscale(credentials)) throw new Error('invalid');
      setConfigured(Boolean(credentials));
      setShowForm(false);
      setMessage(t(credentials ? 'cloudUpscale.connected' : 'cloudUpscale.disconnected'));
    } catch {
      setMessage(t('cloudUpscale.invalid'));
    } finally {
      setBusy(false);
    }
  }

  return <div className="bridge-workspace min-w-0 flex-1 overflow-y-auto">
    <div className="bridge-container bridge-stack">
      <header className="bridge-header"><div><p className="bridge-eyebrow"><Settings size={15} />AI Designer</p><h1>{t('sidebar.settings')}</h1></div></header>
      <section className="bridge-card">
        <div className="bridge-setting">
          <div><h2>{t('workspace.expert')}</h2><p className="bridge-muted">{t('workspace.expertHint')}</p></div>
          <button className="bridge-switch" role="switch" aria-checked={expertMode} aria-label={t('workspace.expert')}
            onClick={() => onModeChange(!expertMode)}><span /></button>
        </div>
        {expertMode && <button className="bridge-button self-start" onClick={onAdvanced}>{t('workspace.advancedSettings')}<ChevronRight size={17} /></button>}
      </section>
      <section className="bridge-card">
        <div className="bridge-setting"><h2>{t('workspace.language')}</h2><LanguageSelector /></div>
      </section>
      {api && <AppCacheSettings api={api} />}
      <section className="bridge-card">
        <div><h2 className="flex items-center gap-2"><Sparkles size={18} />{t('cloudUpscale.title')}</h2><p className="bridge-muted mt-2">{t('cloudUpscale.setupHint')}</p></div>
        {!api ? <p className="bridge-muted">{t('cloudUpscale.desktop')}</p> : <>
          <div className="bridge-actions">
            <button className="bridge-button" onClick={() => void api.openExternal(cloudinaryConsole).catch(() => setMessage(t('cloudUpscale.service')))}>{t('cloudUpscale.openConsole')}</button>
            <button className="bridge-button bridge-primary" onClick={() => setShowForm((value) => !value)} aria-expanded={showForm}>{t(configured ? 'cloudUpscale.replace' : 'cloudUpscale.connect')}</button>
            {configured && <button className="bridge-button" disabled={busy} onClick={() => void save(null)}>{t('cloudUpscale.disconnect')}</button>}
          </div>
          {showForm && <form className="bridge-stack" onSubmit={(event) => {
            event.preventDefault();
            const form = new FormData(event.currentTarget);
            void save({ cloud: String(form.get('cloud')).trim(), key: String(form.get('key')).trim(), secret: String(form.get('secret')).trim() });
          }}>
            <div className="bridge-field-grid">
              <label className="bridge-field">Cloud name<input name="cloud" className="studio-control px-3 py-2" required autoComplete="off" /></label>
              <label className="bridge-field">API key<input name="key" className="studio-control px-3 py-2" required inputMode="numeric" autoComplete="off" /></label>
              <label className="bridge-field">API secret<input name="secret" type="password" className="studio-control px-3 py-2" required autoComplete="new-password" /></label>
            </div>
            <button className="bridge-button bridge-primary" disabled={busy}>{t('cloudUpscale.save')}</button>
          </form>}
        </>}
        {(message || configured) && <p role="status" className="bridge-muted">{message || t('cloudUpscale.connected')}</p>}
      </section>
    </div>
  </div>;
}
