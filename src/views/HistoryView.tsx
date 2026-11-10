import React, { useEffect, useMemo, useState } from 'react';
import {
  History, Download, Copy, Calendar, Check, DollarSign, Layers, Sparkles,
  Trash2, SplitSquareVertical, ArrowLeftRight, X, Clock3, Image as ImageIcon,
} from 'lucide-react';
import { GenerationRecord, Project } from '../types/project';
import { dbService } from '../services/db';
import { StorageService } from '../services/storageService';
import { useI18n } from '../i18n/i18nContext';
import { UpscaleModal } from '../components/UpscaleModal';
import { ImageComparisonSlider } from '../components/ImageComparisonSlider';

export const HistoryView: React.FC = () => {
  const { t, language } = useI18n();
  const [generations, setGenerations] = useState<GenerationRecord[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState('all');
  const [selectedGenerationId, setSelectedGenerationId] = useState('');
  const [loading, setLoading] = useState(true);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [copiedPromptId, setCopiedPromptId] = useState<string | null>(null);
  const [upscalingRecord, setUpscalingRecord] = useState<GenerationRecord | null>(null);
  const [compareSelection, setCompareSelection] = useState<string[]>([]);
  const [comparingPair, setComparingPair] = useState<{ a: GenerationRecord; b: GenerationRecord } | null>(null);

  const locale = language === 'uk' ? 'uk-UA' : language === 'en' ? 'en-US' : 'ru-RU';
  const msUnit = language === 'en' ? 'ms' : 'мс';

  useEffect(() => {
    let active = true;
    Promise.all([dbService.getAllGenerations(), dbService.getAllProjects()]).then(([records, projectRows]) => {
      if (!active) return;
      const sorted = [...records].sort((a, b) => b.createdAt - a.createdAt);
      setGenerations(sorted);
      setProjects(projectRows);
      setSelectedGenerationId((current) => current && sorted.some((record) => record.id === current) ? current : (sorted[0]?.id || ''));
    }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  const visibleGenerations = useMemo(
    () => selectedProjectId === 'all' ? generations : generations.filter((record) => record.projectId === selectedProjectId),
    [generations, selectedProjectId],
  );
  const selectedGeneration = visibleGenerations.find((record) => record.id === selectedGenerationId) || visibleGenerations[0] || null;
  const selectedProject = selectedGeneration ? projects.find((project) => project.id === selectedGeneration.projectId) : null;
  const selectedView = selectedGeneration?.viewId ? selectedProject?.views?.find((view) => view.id === selectedGeneration.viewId) : null;
  const totalSpent = visibleGenerations.reduce((sum, record) => sum + (record.costUsd || 0), 0);

  const formatProviderName = (provider?: string) => {
    if (!provider) return 'AI Render';
    if (provider.toLowerCase().includes('comfyui')) return 'ComfyUI';
    if (provider.toLowerCase().includes('gemini_bridge')) return 'Gemini Bridge';
    if (provider.toLowerCase().includes('gemini')) return 'Google Gemini';
    return provider;
  };

  const dateLabel = (timestamp: number) => new Date(timestamp).toLocaleString(locale, {
    day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });

  const handleCopy = async (record: GenerationRecord) => {
    if (!record.outputImageBase64) return;
    await StorageService.copyToClipboard(record.outputImageBase64);
    setCopiedId(record.id);
    window.setTimeout(() => setCopiedId(null), 2000);
  };

  const handleCopyPrompt = async (record: GenerationRecord) => {
    if (!record.prompt) return;
    await navigator.clipboard.writeText(record.prompt);
    setCopiedPromptId(record.id);
    window.setTimeout(() => setCopiedPromptId(null), 2000);
  };

  const handleExport = (record: GenerationRecord) => {
    if (record.outputImageBase64) StorageService.exportImage(record.outputImageBase64, `Render_${record.styleId}_${record.id}`, 'png');
  };

  const handleDelete = async (record: GenerationRecord) => {
    if (!window.confirm(t('history.deleteConfirm'))) return;
    await dbService.deleteGeneration(record.id);
    const remaining = generations.filter((item) => item.id !== record.id);
    setGenerations(remaining);
    if (selectedGenerationId === record.id) {
      const next = remaining.find((item) => selectedProjectId === 'all' || item.projectId === selectedProjectId);
      setSelectedGenerationId(next?.id || '');
    }
    setCompareSelection((current) => current.filter((id) => id !== record.id));
  };

  const toggleCompare = (id: string) => {
    setCompareSelection((current) => current.includes(id)
      ? current.filter((item) => item !== id)
      : current.length >= 2 ? [current[1], id] : [...current, id]);
  };

  const startComparison = () => {
    if (compareSelection.length !== 2) return;
    const first = generations.find((record) => record.id === compareSelection[0]);
    const second = generations.find((record) => record.id === compareSelection[1]);
    if (first?.outputImageBase64 && second?.outputImageBase64) setComparingPair({ a: first, b: second });
  };

  return (
    <div className="flex-1 min-h-0 flex flex-col overflow-hidden bg-studio-bg text-studio-text">
      <header className="min-h-14 border-b border-studio-border px-4 xl:px-6 py-2 flex flex-wrap items-center justify-between gap-3 bg-studio-surface/70 shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <div className="p-2 rounded-xl bg-indigo-500/15 border border-indigo-500/30 text-indigo-400"><History className="w-4 h-4" /></div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="text-sm font-bold text-white uppercase tracking-wider">{t('history.title')}</h1>
              <span className="text-[10px] text-studio-cyan bg-studio-cyan/10 border border-studio-cyan/30 px-2 py-0.5 rounded-full font-mono font-bold">{t('history.count', { count: visibleGenerations.length })}</span>
            </div>
            <p className="text-[11px] text-studio-textMuted">{t('history.subtitle')}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {compareSelection.length === 2 && (
            <button onClick={startComparison} className="px-3 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs flex items-center gap-2">
              <SplitSquareVertical className="w-3.5 h-3.5" /><span>{t('history.compareTwo')}</span>
            </button>
          )}
          {totalSpent > 0 && <span className="hidden md:inline-flex text-xs text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-1.5 rounded-lg font-mono items-center gap-1"><DollarSign className="w-3.5 h-3.5" />${totalSpent.toFixed(2)} USD</span>}
          <select
            value={selectedProjectId}
            onChange={(event) => { setSelectedProjectId(event.target.value); setCompareSelection([]); setSelectedGenerationId(''); }}
            aria-label={t('history.filterProject')}
            className="max-w-52 bg-studio-bg border border-studio-border rounded-lg px-2.5 py-2 text-xs text-studio-text focus:outline-none"
          >
            <option value="all">{t('history.allProjects')}</option>
            {projects.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}
          </select>
        </div>
      </header>

      {loading ? (
        <div className="flex-1 grid place-items-center text-sm text-studio-textMuted">{t('app.loadingView')}</div>
      ) : visibleGenerations.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center text-center p-6">
          <div className="w-16 h-16 rounded-2xl bg-studio-surfaceHover border border-studio-border grid place-items-center mb-4"><History className="w-8 h-8 text-indigo-400" /></div>
          <h3 className="text-sm font-semibold text-white mb-1">{selectedProjectId === 'all' ? t('history.emptyTitle') : t('history.emptyProjectTitle')}</h3>
          <p className="text-xs text-studio-textMuted max-w-sm">{selectedProjectId === 'all' ? t('history.emptyDesc') : t('history.emptyProjectDesc')}</p>
        </div>
      ) : (
        <div className="flex-1 min-h-0 grid grid-cols-1 xl:grid-cols-[250px_minmax(0,1fr)_300px] gap-3 p-3 xl:p-4 overflow-hidden">
          <aside className="min-h-0 flex flex-col bg-studio-surface border border-studio-border rounded-xl overflow-hidden">
            <div className="px-3 py-2.5 border-b border-studio-border flex items-center justify-between shrink-0">
              <span className="text-[11px] font-semibold uppercase tracking-wide text-white">{t('history.versions')}</span>
              <span className="text-[10px] text-studio-textMuted">{visibleGenerations.length}</span>
            </div>
            <div className="flex-1 min-h-0 overflow-y-auto p-2 space-y-2">
              {visibleGenerations.map((record) => {
                const selected = selectedGeneration?.id === record.id;
                const compareSelected = compareSelection.includes(record.id);
                return (
                  <div key={record.id} className={`rounded-lg border overflow-hidden transition-colors ${selected ? 'border-indigo-400 bg-indigo-500/10' : 'border-studio-border hover:border-studio-textSubtle'}`}>
                    <button onClick={() => setSelectedGenerationId(record.id)} className="w-full text-left">
                      <div className="relative aspect-[16/9] bg-studio-bg">
                        {record.outputImageBase64 ? <img src={record.outputImageBase64} alt={record.styleId} className="w-full h-full object-cover" /> : <div className="w-full h-full grid place-items-center text-studio-textSubtle"><ImageIcon className="w-7 h-7" /></div>}
                        <span className="absolute top-1.5 left-1.5 bg-black/75 text-white text-[9px] px-1.5 py-0.5 rounded">{record.resolution || formatProviderName(record.provider)}</span>
                      </div>
                      <div className="p-2">
                        <div className="text-[11px] font-semibold text-white truncate">{record.styleId} · {record.roomType}</div>
                        <div className="text-[10px] text-studio-textMuted mt-1 flex items-center gap-1"><Calendar className="w-3 h-3 shrink-0" />{dateLabel(record.createdAt)}</div>
                      </div>
                    </button>
                    <div className="px-2 pb-2 flex items-center justify-between">
                      <span className="text-[9px] text-studio-textSubtle truncate">{formatProviderName(record.provider)}</span>
                      <button
                        onClick={() => toggleCompare(record.id)}
                        aria-pressed={compareSelected}
                        title={t('history.selectToCompare')}
                        className={`shrink-0 px-2 py-1 rounded border text-[10px] flex items-center gap-1 ${compareSelected ? 'border-studio-cyan bg-studio-cyan/15 text-studio-cyan' : 'border-studio-border text-studio-textMuted hover:text-white'}`}
                      ><ArrowLeftRight className="w-3 h-3" />{compareSelected ? '✓' : t('history.compare')}</button>
                    </div>
                  </div>
                );
              })}
            </div>
          </aside>

          <section className="min-h-[360px] min-w-0 flex flex-col bg-studio-surface border border-studio-border rounded-xl overflow-hidden">
            <div className="px-3 xl:px-4 py-2.5 border-b border-studio-border flex flex-wrap items-center justify-between gap-2 shrink-0">
              <div className="min-w-0">
                <div className="text-xs font-semibold text-white truncate">{selectedProject?.name || t('history.allProjects')}{selectedView ? ` / ${selectedView.name}` : ''}</div>
                <div className="text-[10px] text-studio-textMuted mt-0.5">{t('history.comparisonHint')}</div>
              </div>
              {selectedGeneration && <span className="text-[10px] text-studio-textMuted font-mono">{selectedGeneration.width} × {selectedGeneration.height}</span>}
            </div>
            <div className="flex-1 min-h-0 p-2 xl:p-3">
              {selectedGeneration?.sourceImageBase64 && selectedGeneration.outputImageBase64 ? (
                <ImageComparisonSlider
                  sourceImage={selectedGeneration.sourceImageBase64}
                  generatedImage={selectedGeneration.outputImageBase64}
                  sourceLabel={t('history.clay')}
                  generatedLabel={formatProviderName(selectedGeneration.provider)}
                  onCopy={() => void handleCopy(selectedGeneration)}
                  onExport={() => handleExport(selectedGeneration)}
                  onUpscale={() => setUpscalingRecord(selectedGeneration)}
                />
              ) : selectedGeneration?.outputImageBase64 ? (
                <img src={selectedGeneration.outputImageBase64} alt={t('history.result')} className="w-full h-full object-contain rounded-xl bg-studio-bg" />
              ) : (
                <div className="w-full h-full min-h-72 rounded-xl border border-dashed border-studio-border grid place-items-center text-center p-6 text-studio-textMuted"><div><ImageIcon className="w-10 h-10 mx-auto mb-3 opacity-40" /><p className="text-xs">{t('history.noResult')}</p></div></div>
              )}
            </div>
            {selectedGeneration?.sourceImageBase64 && <div className="px-4 pb-2 flex justify-between text-[10px] text-studio-textMuted"><span>{t('history.clay')}</span><span>{t('history.result')}: {formatProviderName(selectedGeneration.provider)}</span></div>}
          </section>

          <aside className="min-h-0 flex flex-col bg-studio-surface border border-studio-border rounded-xl overflow-hidden">
            <div className="px-3 py-2.5 border-b border-studio-border flex items-center justify-between shrink-0">
              <span className="text-[11px] font-semibold uppercase tracking-wide text-white">{t('history.renderDetails')}</span>
              {selectedGeneration && <span className="text-[10px] text-emerald-400">{t('history.completed')}</span>}
            </div>
            {selectedGeneration && <div className="flex-1 min-h-0 overflow-y-auto p-3 space-y-3">
              <div className="rounded-lg border border-studio-border bg-studio-bg p-3">
                <div className="text-[9px] uppercase tracking-wide text-studio-textSubtle">{t('history.project')}</div>
                <div className="text-xs text-white mt-1 break-words">{selectedProject?.name || '—'}</div>
              </div>
              {selectedView && <div className="rounded-lg border border-studio-border bg-studio-bg p-3"><div className="text-[9px] uppercase tracking-wide text-studio-textSubtle">{t('history.view')}</div><div className="text-xs text-white mt-1">{selectedView.name}</div></div>}
              <div className="grid grid-cols-2 gap-2">
                <InfoCell label={t('history.date')} value={dateLabel(selectedGeneration.createdAt)} />
                <InfoCell label={t('history.duration')} value={selectedGeneration.latencyMs > 0 ? `${(selectedGeneration.latencyMs / 1000).toFixed(1)} ${language === 'en' ? 's' : 'с'}` : '—'} icon={<Clock3 className="w-3 h-3" />} />
                <InfoCell label={t('history.model')} value={selectedGeneration.model || formatProviderName(selectedGeneration.provider)} />
                <InfoCell label={t('history.resolution')} value={selectedGeneration.resolution || `${selectedGeneration.width}×${selectedGeneration.height}`} />
                <InfoCell label={t('history.geometry')} value={selectedGeneration.geometryMode} />
                <InfoCell label={t('history.cost')} value={selectedGeneration.costUsd === undefined ? '—' : selectedGeneration.costUsd === 0 ? (language === 'en' ? 'Free' : language === 'uk' ? 'Безкоштовно' : 'Бесплатно') : `$${selectedGeneration.costUsd.toFixed(3)}`} />
              </div>
              {(selectedGeneration.materials?.length || selectedGeneration.materialReferences?.length) ? <div className="rounded-lg border border-studio-border bg-studio-bg p-3">
                <div className="text-[9px] uppercase tracking-wide text-studio-textSubtle flex items-center gap-1"><Layers className="w-3 h-3" />{t('history.materials')}</div>
                <div className="mt-2 flex flex-wrap gap-1">{[...(selectedGeneration.materials || []), ...(selectedGeneration.materialReferences || []).map((material) => material.name)].map((material, index) => <span key={`${material}-${index}`} className="text-[10px] text-studio-text px-2 py-1 rounded bg-studio-surface border border-studio-border">{material}</span>)}</div>
              </div> : null}
              {selectedGeneration.lighting && <InfoCell label={t('history.lighting')} value={selectedGeneration.lighting} />}
              <div className="rounded-lg border border-studio-border bg-studio-bg p-3">
                <div className="flex items-center justify-between mb-2"><span className="text-[10px] font-semibold text-white">{t('history.prompt')}</span><button onClick={() => void handleCopyPrompt(selectedGeneration)} className="text-[10px] text-indigo-300 hover:text-white flex items-center gap-1"><Copy className="w-3 h-3" />{copiedPromptId === selectedGeneration.id ? t('history.promptCopied') : t('history.copyFullPrompt')}</button></div>
                <p className="text-[10px] text-studio-textMuted whitespace-pre-wrap break-words leading-relaxed select-text">{selectedGeneration.prompt || '—'}</p>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <ActionButton onClick={() => void handleCopy(selectedGeneration)} icon={copiedId === selectedGeneration.id ? <Check /> : <Copy />} label={copiedId === selectedGeneration.id ? t('action.copied') : t('action.copy')} />
                <ActionButton onClick={() => setUpscalingRecord(selectedGeneration)} icon={<Sparkles />} label={t('history.upscale')} accent />
                <ActionButton onClick={() => handleExport(selectedGeneration)} icon={<Download />} label={t('history.exportPng')} accent />
                <ActionButton onClick={() => void handleDelete(selectedGeneration)} icon={<Trash2 />} label={t('history.deleteRender')} danger />
              </div>
            </div>}
          </aside>
        </div>
      )}

      {comparingPair && <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4">
        <div className="bg-studio-surface border border-studio-border rounded-2xl w-full max-w-5xl h-[88vh] flex flex-col overflow-hidden shadow-2xl">
          <div className="h-12 border-b border-studio-border px-5 flex items-center justify-between bg-studio-bg/80 shrink-0">
            <div className="flex items-center gap-2"><SplitSquareVertical className="w-4 h-4 text-studio-cyan" /><span className="text-xs font-bold text-white">{t('history.compareTitle')}: {comparingPair.a.styleId} ↔ {comparingPair.b.styleId}</span></div>
            <button onClick={() => setComparingPair(null)} className="p-1 rounded-lg text-studio-textMuted hover:text-white" aria-label={t('action.close')}><X className="w-5 h-5" /></button>
          </div>
          <div className="flex-1 min-h-0 p-4"><ImageComparisonSlider sourceImage={comparingPair.a.outputImageBase64 || ''} generatedImage={comparingPair.b.outputImageBase64 || ''} sourceLabel={`${t('history.variantA')}: ${comparingPair.a.styleId}`} generatedLabel={`${t('history.variantB')}: ${comparingPair.b.styleId}`} /></div>
        </div>
      </div>}

      {upscalingRecord && <UpscaleModal isOpen onClose={() => setUpscalingRecord(null)} imageBase64={upscalingRecord.outputImageBase64 || ''} sourceWidth={upscalingRecord.width || 1344} sourceHeight={upscalingRecord.height || 768} promptUsed={upscalingRecord.prompt || ''} />}
    </div>
  );
};

const InfoCell: React.FC<{ label: string; value: string; icon?: React.ReactNode }> = ({ label, value, icon }) => (
  <div className="rounded-lg border border-studio-border bg-studio-bg p-2.5 min-w-0">
    <div className="text-[9px] uppercase tracking-wide text-studio-textSubtle flex items-center gap-1">{icon}{label}</div>
    <div className="text-[10px] text-white mt-1 break-words">{value}</div>
  </div>
);

const ActionButton: React.FC<{ onClick: () => void; icon: React.ReactElement<{ className?: string }>; label: string; accent?: boolean; danger?: boolean }> = ({ onClick, icon, label, accent, danger }) => (
  <button onClick={onClick} className={`min-w-0 px-2 py-2 rounded-lg border text-[10px] font-medium flex items-center justify-center gap-1.5 transition-colors ${danger ? 'border-rose-500/30 text-rose-300 hover:bg-rose-500/10' : accent ? 'border-indigo-500/40 text-indigo-200 hover:bg-indigo-500/15' : 'border-studio-border text-studio-text hover:bg-studio-surfaceHover'}`}>
    {React.cloneElement(icon, { className: 'w-3.5 h-3.5 shrink-0' })}<span className="truncate">{label}</span>
  </button>
);
