import React, { useState } from 'react';
import {
  X,
  Upload,
  Link as LinkIcon,
  Type,
  Image as ImageIcon,
  Check,
  Sparkles,
  Layers,
  Clipboard,
} from 'lucide-react';
import { MaterialReference, MaterialTargetSurface } from '../types/project';
import { useI18n } from '../i18n/i18nContext';

interface MaterialReferenceModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAddReference: (ref: MaterialReference) => void;
}

export const MaterialReferenceModal: React.FC<MaterialReferenceModalProps> = ({
  isOpen,
  onClose,
  onAddReference,
}) => {
  const { t } = useI18n();

  const [refType, setRefType] = useState<'image' | 'url' | 'text'>('image');
  const [name, setName] = useState('');
  const [targetSurface, setTargetSurface] = useState<MaterialTargetSurface>('floor');
  const [notes, setNotes] = useState('');
  const [url, setUrl] = useState('');
  const [imageBase64, setImageBase64] = useState<string | null>(null);
  const [imageMimeType, setImageMimeType] = useState<string>('image/jpeg');
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleImageFile = (file: File) => {
    if (!file.type.startsWith('image/')) {
      setError(t('material.errSelectImage'));
      return;
    }
    setError(null);
    setImageMimeType(file.type);
    const reader = new FileReader();
    reader.onload = (e) => {
      const res = e.target?.result as string;
      setImageBase64(res);
      if (!name) {
        // Auto-fill name based on filename
        const cleanName = file.name.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' ');
        setName(cleanName.charAt(0).toUpperCase() + cleanName.slice(1));
      }
    };
    reader.readAsDataURL(file);
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleImageFile(file);
  };

  const handlePasteClipboard = async () => {
    try {
      const items = await navigator.clipboard.read();
      for (const item of items) {
        for (const type of item.types) {
          if (type.startsWith('image/')) {
            const blob = await item.getType(type);
            handleImageFile(new File([blob], 'clipboard_material.png', { type }));
            return;
          }
        }
      }
      setError(t('material.errNoClipboard'));
    } catch (e: any) {
      setError(t('material.errClipboardAccess'));
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleImageFile(e.dataTransfer.files[0]);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError(t('material.errEnterName'));
      return;
    }

    if (refType === 'image' && !imageBase64) {
      setError(t('material.errUploadTexture'));
      return;
    }

    if (refType === 'url' && !url.trim()) {
      setError(t('material.errEnterUrl'));
      return;
    }

    const newRef: MaterialReference = {
      id: 'mat_ref_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
      name: name.trim(),
      targetSurface,
      type: refType,
      imageBase64: refType === 'image' && imageBase64 ? imageBase64 : undefined,
      imageMimeType: refType === 'image' && imageBase64 ? imageMimeType : undefined,
      url: refType === 'url' && url.trim() ? url.trim() : undefined,
      notes: notes.trim() || undefined,
      createdAt: Date.now(),
    };

    onAddReference(newRef);
    onClose();
  };

  const surfaceOptions: { id: MaterialTargetSurface; label: string }[] = [
    { id: 'floor', label: t('material.surfaceFloor') },
    { id: 'walls', label: t('material.surfaceWalls') },
    { id: 'countertop', label: t('material.surfaceCountertop') },
    { id: 'cabinetry', label: t('material.surfaceCabinetry') },
    { id: 'furniture', label: t('material.surfaceCabinetry') },
    { id: 'textile', label: t('material.surfaceTextile') },
    { id: 'ceiling', label: t('material.surfaceCeiling') },
    { id: 'accents', label: t('material.surfaceMetal') },
    { id: 'general', label: t('material.surfaceWalls') },
  ];

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 select-none">
      <div className="max-w-lg w-full bg-studio-surface border border-studio-border rounded-2xl p-6 shadow-2xl space-y-5 relative">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-studio-textMuted hover:text-white"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Header */}
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-500/15 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
            <Layers className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-semibold text-sm text-white">
              {t('material.modalTitle')}
            </h3>
            <p className="text-xs text-studio-textMuted mt-0.5">
              {t('material.modalSubtitle')}
            </p>
          </div>
        </div>

        {/* Mode Selector Tabs (Image / URL / Text) */}
        <div className="grid grid-cols-3 gap-1.5 p-1 bg-studio-bg rounded-xl border border-studio-border">
          <button
            type="button"
            onClick={() => {
              setRefType('image');
              setError(null);
            }}
            className={`py-1.5 px-2 rounded-lg text-xs font-medium transition-all flex items-center justify-center space-x-1.5 ${
              refType === 'image'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-studio-textMuted hover:text-white'
            }`}
          >
            <ImageIcon className="w-3.5 h-3.5" />
            <span>{t('material.tabImage')}</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setRefType('url');
              setError(null);
            }}
            className={`py-1.5 px-2 rounded-lg text-xs font-medium transition-all flex items-center justify-center space-x-1.5 ${
              refType === 'url'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-studio-textMuted hover:text-white'
            }`}
          >
            <LinkIcon className="w-3.5 h-3.5" />
            <span>{t('material.tabUrl')}</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setRefType('text');
              setError(null);
            }}
            className={`py-1.5 px-2 rounded-lg text-xs font-medium transition-all flex items-center justify-center space-x-1.5 ${
              refType === 'text'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-studio-textMuted hover:text-white'
            }`}
          >
            <Type className="w-3.5 h-3.5" />
            <span>{t('material.tabText')}</span>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          {/* MODE 1: IMAGE TEXTURE UPLOAD */}
          {refType === 'image' && (
            <div className="space-y-2">
              <label className="text-[11px] font-medium text-studio-textMuted block">
                {t('material.tabImage')}:
              </label>

              {imageBase64 ? (
                <div className="flex items-center space-x-3 p-2.5 bg-studio-bg rounded-xl border border-studio-border relative">
                  <div className="w-20 h-20 rounded-lg overflow-hidden border border-studio-border/80 flex-shrink-0 bg-black">
                    <img
                      src={imageBase64}
                      alt="Texture preview"
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div className="flex-1 min-w-0 space-y-1">
                    <span className="text-white font-medium block truncate">
                      {name || 'Sample Material'}
                    </span>
                    <span className="text-[10px] text-emerald-400 font-mono block">
                      ✓ AI Material Conditioning Ready
                    </span>
                    <button
                      type="button"
                      onClick={() => setImageBase64(null)}
                      className="text-[10px] text-studio-danger hover:underline"
                    >
                      {t('material.changeTexture')}
                    </button>
                  </div>
                </div>
              ) : (
                <div
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={handleDrop}
                  className="border-2 border-dashed border-studio-border hover:border-indigo-500/60 rounded-xl p-5 text-center bg-studio-bg/60 hover:bg-studio-bg transition-colors space-y-2.5"
                >
                  <div className="w-10 h-10 rounded-xl bg-indigo-500/10 mx-auto flex items-center justify-center text-indigo-400">
                    <Upload className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="text-xs text-studio-text font-medium">
                      {t('material.dragDropTitle')}
                    </p>
                    <p className="text-[10px] text-studio-textSubtle mt-0.5">
                      {t('material.dragDropSubtitle')}
                    </p>
                  </div>
                  <div className="flex items-center justify-center space-x-2 pt-1">
                    <label className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-medium cursor-pointer transition-colors shadow-sm">
                      <span>{t('studio.selectFile')}</span>
                      <input
                        type="file"
                        accept="image/png,image/jpeg,image/webp"
                        onChange={handleFileInput}
                        className="hidden"
                      />
                    </label>
                    <button
                      type="button"
                      onClick={handlePasteClipboard}
                      className="px-3 py-1.5 bg-studio-surfaceHover hover:bg-studio-border border border-studio-border text-studio-text rounded-lg text-xs font-medium transition-colors flex items-center space-x-1"
                    >
                      <Clipboard className="w-3 h-3 text-studio-textSubtle" />
                      <span>{t('material.pasteClipboard')}</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* MODE 2: CATALOG URL */}
          {refType === 'url' && (
            <div className="space-y-1.5">
              <label className="text-[11px] font-medium text-studio-textMuted block">
                {t('material.urlLabel')}
              </label>
              <input
                type="url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder={t('material.urlPlaceholder')}
                className="w-full bg-studio-bg border border-studio-border focus:border-indigo-500 rounded-lg px-3 py-2 text-xs text-white focus:outline-none font-mono"
              />
              <span className="text-[10px] text-studio-textSubtle block">
                {t('material.urlHint')}
              </span>
            </div>
          )}

          {/* MATERIAL NAME INPUT */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-medium text-studio-textMuted block">
              {t('material.nameLabel')}
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t('material.namePlaceholder')}
              className="w-full bg-studio-bg border border-studio-border focus:border-indigo-500 rounded-lg px-3 py-2 text-xs text-white focus:outline-none"
            />
          </div>

          {/* TARGET SURFACE SELECTION */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-medium text-studio-textMuted block">
              {t('material.targetSurfaceLabel')}
            </label>
            <select
              value={targetSurface}
              onChange={(e) => setTargetSurface(e.target.value as MaterialTargetSurface)}
              className="w-full bg-studio-bg border border-studio-border focus:border-indigo-500 rounded-lg px-3 py-2 text-xs text-white focus:outline-none"
            >
              {surfaceOptions.map((opt) => (
                <option key={opt.id} value={opt.id}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          {/* SPECIFIC NOTES & DIRECTIVES */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-medium text-studio-textMuted block">
              {t('material.notesLabel')}
            </label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder={t('material.notesPlaceholder')}
              className="w-full bg-studio-bg border border-studio-border focus:border-indigo-500 rounded-lg px-3 py-2 text-xs text-white focus:outline-none"
            />
          </div>

          {error && (
            <div className="p-2.5 rounded-lg bg-studio-danger/10 border border-studio-danger/30 text-studio-danger text-xs">
              {error}
            </div>
          )}

          {/* Bottom Actions */}
          <div className="flex items-center justify-end space-x-2 pt-2 border-t border-studio-border">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-2 rounded-lg text-xs text-studio-textMuted hover:text-white transition-colors"
            >
              {t('action.cancel')}
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-semibold shadow-md transition-colors flex items-center space-x-1.5"
            >
              <Check className="w-3.5 h-3.5" />
              <span>{t('material.addReferenceBtn')}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
