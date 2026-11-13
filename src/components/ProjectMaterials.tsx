import { useState } from 'react';
import { Download, ExternalLink, Plus } from 'lucide-react';
import { useI18n } from '../i18n/i18nContext';
import { MaterialReference, MaterialTargetSurface } from '../types/project';
import { materialCatalog } from '../services/materialCatalog';
import { exportMaterials, materialName, openBridgePage } from '../services/bridgeFiles';

const surfaces: MaterialTargetSurface[] = ['floor', 'walls', 'cabinetry', 'countertop', 'furniture', 'textile', 'ceiling', 'accents', 'general'];
const surfaceKeys: Record<MaterialTargetSurface, string> = {
  floor: 'bridge.surfaceFloor', walls: 'bridge.surfaceWalls', cabinetry: 'bridge.surfaceCabinetry', countertop: 'bridge.surfaceCountertop',
  furniture: 'bridge.surfaceFurniture', textile: 'bridge.surfaceTextile', ceiling: 'material.surfaceCeiling', accents: 'catalog.accents', general: 'catalog.general',
};
const emptyMaterial = (): MaterialReference => ({
  id: crypto.randomUUID(), name: '', targetSurface: 'floor', type: 'text', createdAt: Date.now(),
});

export function ProjectMaterials({ items, disabled, onChange }: {
  items: MaterialReference[];
  disabled: boolean;
  onChange: (items: MaterialReference[]) => Promise<void>;
}) {
  const { t } = useI18n();
  const [draft, setDraft] = useState<MaterialReference | null>(null);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [reading, setReading] = useState(false);
  const update = (fields: Partial<MaterialReference>) => setDraft((item) => item && { ...item, ...fields });

  async function loadSwatch(file: File) {
    setReading(true);
    setError('');
    const url = URL.createObjectURL(file);
    try {
      if (!/^image\/(png|jpeg|webp)$/.test(file.type) || file.size > 20 * 1024 * 1024) throw new Error('Invalid swatch');
      const image = new Image();
      image.src = url;
      await image.decode();
      const scale = Math.min(1, 640 / Math.max(image.naturalWidth, image.naturalHeight));
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
      canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Canvas unavailable');
      ctx.fillStyle = '#fff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
      update({ imageBase64: canvas.toDataURL('image/jpeg', 0.88), imageMimeType: 'image/jpeg', type: 'image' });
    } catch {
      setError(t('catalog.invalidImage'));
    } finally {
      URL.revokeObjectURL(url);
      setReading(false);
    }
  }

  async function save(next: MaterialReference[]) {
    setSaving(true);
    setError('');
    try {
      await onChange(next);
      setDraft(null);
    } catch {
      setError(t('bridgeFlow.saveFailed'));
    } finally {
      setSaving(false);
    }
  }

  function catalogLink(url: string) {
    if (!/^https:\/\//i.test(url)) return;
    void openBridgePage(url).catch(() => setError(t('catalog.openFailed')));
  }

  return <div className="bridge-stack">
    <p className="bridge-muted">{t('catalog.hint')}</p>
    <div className="bridge-actions">
      <button className="bridge-button" disabled={disabled || saving || reading} onClick={() => { setError(''); setDraft(emptyMaterial()); }}><Plus size={16} />{t('catalog.add')}</button>
      {items.length > 0 && <button className="bridge-button" onClick={() => exportMaterials(items)}><Download size={16} />{t('catalog.export')}</button>}
    </div>
    {items.length > 0 && <ul className="grid gap-2">{items.map((item) => <li key={item.id} className="flex flex-wrap items-center gap-3 rounded-lg border p-3 text-sm">
      {item.imageBase64 && <img className="h-12 w-16 rounded object-cover" src={item.imageBase64.startsWith('data:') ? item.imageBase64 : `data:${item.imageMimeType || 'image/png'};base64,${item.imageBase64}`} alt={materialName(item)} />}
      <div className="min-w-0 flex-1 break-words"><strong>{materialName(item)}</strong><p className="bridge-muted">{[t(surfaceKeys[item.targetSurface]), item.format, item.layout].filter(Boolean).join(' · ')}</p></div>
      {item.url && <button className="bridge-button" disabled={reading} onClick={() => catalogLink(item.url!)}><ExternalLink size={15} />{t('catalog.source')}</button>}
      <button className="bridge-button" disabled={disabled || saving || reading} onClick={() => { setError(''); setDraft({ ...item }); }}>{t('catalog.edit')}</button>
    </li>)}</ul>}
    {draft && <form className="bridge-stack rounded-xl border p-4" onSubmit={(event) => {
      event.preventDefault();
      if (disabled || saving || reading || !draft.name.trim()) return;
      const item: MaterialReference = {
        ...draft, name: draft.name.trim(), url: draft.url?.trim(), updatedAt: Date.now(),
        type: draft.imageBase64 ? 'image' : draft.url?.trim() ? 'url' : 'text',
      };
      if (item.url && !/^https:\/\//i.test(item.url)) { setError(t('catalog.https')); return; }
      void save(items.some((current) => current.id === item.id) ? items.map((current) => current.id === item.id ? item : current) : [...items, item]);
    }}>
      <fieldset disabled={disabled || saving || reading} className="bridge-stack">
        <label className="bridge-field">{t('catalog.choose')}<select defaultValue="" className="studio-control px-3 py-2" onChange={(event) => {
          const entry = materialCatalog[Number(event.target.value)];
          if (event.target.value && entry) {
            const { surface, ...fields } = entry;
            update({ ...fields, targetSurface: surface, imageBase64: undefined, imageMimeType: undefined });
          }
        }}>
          <option value="">{t('catalog.custom')}</option>
          {materialCatalog.map((item, index) => <option key={item.article} value={index}>{item.brand} · {item.name} · {item.article}</option>)}
        </select></label>
        <div className="bridge-field-grid">
          {(['brand', 'name', 'article', 'format', 'finish', 'layout'] as const).map((field) => <label className="bridge-field" key={field}>{t('catalog.' + field)}
            <input className="studio-control px-3 py-2" maxLength={160} required={field === 'name'} value={draft[field] || ''} onChange={(event) => update({ [field]: event.target.value })} />
          </label>)}
          <label className="bridge-field">{t('catalog.surface')}<select className="studio-control px-3 py-2" value={draft.targetSurface}
            onChange={(event) => update({ targetSurface: event.target.value as MaterialTargetSurface })}>
            {surfaces.map((surface) => <option key={surface} value={surface}>{t(surfaceKeys[surface])}</option>)}
          </select></label>
        </div>
        <label className="bridge-field">{t('catalog.url')}<input type="url" className="studio-control px-3 py-2" maxLength={1000} value={draft.url || ''} onChange={(event) => update({ url: event.target.value })} /></label>
        <label className="bridge-field">{t('catalog.notes')}<textarea rows={2} className="studio-control px-3 py-2" maxLength={500} value={draft.notes || ''} onChange={(event) => update({ notes: event.target.value })} /></label>
        <label className="bridge-field">{t(draft.imageBase64 ? 'catalog.replaceSwatch' : 'catalog.swatch')}<input type="file" accept="image/png,image/jpeg,image/webp" onChange={(event) => {
          const file = event.currentTarget.files?.[0];
          if (file) void loadSwatch(file);
          event.currentTarget.value = '';
        }} /></label>
        <div className="bridge-actions">
          <button type="submit" className="bridge-button bridge-primary">{t('catalog.save')}</button>
          <button type="button" className="bridge-button" onClick={() => setDraft(null)}>{t('action.cancel')}</button>
          {items.some((item) => item.id === draft.id) && <button type="button" className="bridge-button" onClick={() => void save(items.filter((item) => item.id !== draft.id))}>{t('action.delete')}</button>}
        </div>
      </fieldset>
    </form>}
    {error && <p className="bridge-error" role="alert">{error}</p>}
  </div>;
}
