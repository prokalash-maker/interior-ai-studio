import React, { useState, useEffect } from 'react';
import { History, Download, Copy, Calendar, Check, DollarSign, Layers, Sparkles, Trash2, SplitSquareVertical, ArrowLeftRight, X } from 'lucide-react';
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
  const [loading, setLoading] = useState(true);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [copiedPromptId, setCopiedPromptId] = useState<string | null>(null);
  const [upscalingRecord, setUpscalingRecord] = useState<GenerationRecord | null>(null);
  
  // Multi-render comparison state
  const [compareSelection, setCompareSelection] = useState<string[]>([]);
  const [comparingPair, setComparingPair] = useState<{ a: GenerationRecord; b: GenerationRecord } | null>(null);

  useEffect(() => {
    loadGenerations();
  }, []);

  const loadGenerations = async () => {
    const [data, projectData] = await Promise.all([dbService.getAllGenerations(), dbService.getAllProjects()]);
    setGenerations(data);
    setProjects(projectData);
    setLoading(false);
  };

  const handleExport = (record: GenerationRecord, format: 'png' | 'jpeg') => {
    if (record.outputImageBase64) {
      StorageService.exportImage(
        record.outputImageBase64,
        `Render_${record.styleId}_${record.id}`,
        format
      );
    }
  };

  const handleCopy = (record: GenerationRecord) => {
    if (record.outputImageBase64) {
      StorageService.copyToClipboard(record.outputImageBase64);
      setCopiedId(record.id);
      setTimeout(() => setCopiedId(null), 2000);
    }
  };

  const handleCopyPrompt = (record: GenerationRecord) => {
    if (record.prompt) {
      navigator.clipboard.writeText(record.prompt);
      setCopiedPromptId(record.id);
      setTimeout(() => setCopiedPromptId(null), 2000);
    }
  };

  const handleDelete = async (id: string) => {
    if (window.confirm(t('history.deleteConfirm'))) {
      await dbService.deleteGeneration(id);
      setGenerations((prev) => prev.filter((g) => g.id !== id));
      setCompareSelection((prev) => prev.filter((sid) => sid !== id));
    }
  };

  const toggleCompare = (id: string) => {
    setCompareSelection((prev) => {
      if (prev.includes(id)) {
        return prev.filter((sid) => sid !== id);
      }
      if (prev.length >= 2) {
        return [prev[1], id];
      }
      return [...prev, id];
    });
  };

  const handleStartComparison = () => {
    if (compareSelection.length === 2) {
      const a = generations.find((g) => g.id === compareSelection[0]);
      const b = generations.find((g) => g.id === compareSelection[1]);
      if (a && b) {
        setComparingPair({ a, b });
      }
    }
  };

  const getLocaleCode = () => {
    if (language === 'uk') return 'uk-UA';
    if (language === 'en') return 'en-US';
    return 'ru-RU';
  };

  const formatProviderName = (prov?: string) => {
    if (!prov) return 'AI Render';
    if (prov.includes('comfyui')) return 'ComfyUI (RTX 4050)';
    if (prov.includes('gemini_bridge') || prov.includes('Gemini Bridge')) return 'Gemini Bridge';
    if (prov.includes('pollinations')) return 'Pollinations FLUX';
    if (prov.includes('horde')) return 'AI Horde (Free)';
    if (prov.includes('gemini')) return 'Google Gemini';
    if (prov.includes('krea')) return 'Krea AI';
    if (prov.includes('local_sd')) return 'Local SD WebUI';
    return prov;
  };

  const msUnit = language === 'en' ? 'ms' : 'мс';
  const visibleGenerations = selectedProjectId === 'all' ? generations : generations.filter((g) => g.projectId === selectedProjectId);
  const totalSpent = visibleGenerations.reduce((sum, g) => sum + (g.costUsd || 0), 0);

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-studio-bg text-studio-text select-none">
      {/* Top Header */}
      <div className="h-14 border-b border-studio-border px-6 flex items-center justify-between bg-studio-surface/70 shrink-0">
        <div className="flex items-center space-x-3">
          <div className="p-2 rounded-xl bg-indigo-500/15 border border-indigo-500/30 text-indigo-400">
            <History className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h1 className="text-sm font-bold text-white uppercase tracking-wider">{t('history.title')}</h1>
              <span className="text-[10px] text-studio-cyan bg-studio-cyan/10 border border-studio-cyan/30 px-2 py-0.5 rounded-full font-mono font-bold">
                {t('history.count', { count: visibleGenerations.length })}
              </span>
            </div>
            <p className="text-[11px] text-studio-textMuted">
              {t('history.subtitle')}
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-3">
          {compareSelection.length === 2 && (
            <button
              onClick={handleStartComparison}
              className="px-3 py-1.5 rounded-xl bg-gradient-to-r from-studio-cyan to-indigo-600 hover:from-studio-cyan/90 hover:to-indigo-500 text-white font-bold text-xs flex items-center space-x-1.5 shadow-md shadow-studio-cyan/15 animate-pulse transition-all active:scale-[0.98]"
            >
              <SplitSquareVertical className="w-3.5 h-3.5" />
              <span>{t('history.compareTwo')}</span>
            </button>
          )}

          {totalSpent > 0 && (
            <span className="text-xs text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-1 rounded-lg font-mono flex items-center space-x-1">
              <DollarSign className="w-3.5 h-3.5" />
              <span>{language === 'en' ? `Total: $${totalSpent.toFixed(2)} USD` : language === 'uk' ? `Всього: $${totalSpent.toFixed(2)} USD` : `Всего: $${totalSpent.toFixed(2)} USD`}</span>
            </span>
          )}
          <select
            value={selectedProjectId}
            onChange={(event) => { setSelectedProjectId(event.target.value); setCompareSelection([]); }}
            aria-label={t('history.filterProject')}
            className="max-w-56 bg-studio-bg border border-studio-border rounded-lg px-2.5 py-1.5 text-xs text-studio-text focus:outline-none"
          >
            <option value="all">{t('history.allProjects')}</option>
            {projects.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}
          </select>
        </div>
      </div>

      {/* Generations Feed */}
      <div className="flex-1 overflow-y-auto p-6">
        {visibleGenerations.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center">
            <div className="w-16 h-16 rounded-2xl bg-studio-surfaceHover border border-studio-border flex items-center justify-center text-studio-textSubtle mb-4">
              <History className="w-8 h-8 text-indigo-400" />
            </div>
            <h3 className="text-sm font-semibold text-white mb-1">{selectedProjectId === 'all' ? t('history.emptyTitle') : t('history.emptyProjectTitle')}</h3>
            <p className="text-xs text-studio-textMuted max-w-sm">
              {selectedProjectId === 'all' ? t('history.emptyDesc') : t('history.emptyProjectDesc')}
            </p>
          </div>
        ) : (
          <div className="space-y-4 max-w-5xl mx-auto">
            {visibleGenerations.map((gen) => {
              const isSelectedForCompare = compareSelection.includes(gen.id);
              const dateStr = new Date(gen.createdAt).toLocaleString(getLocaleCode(), {
                day: 'numeric',
                month: 'short',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
              });

              return (
                <div
                  key={gen.id}
                  className={`bg-studio-surface border rounded-xl p-4 flex flex-col md:flex-row gap-4 items-start shadow-sm transition-all ${
                    isSelectedForCompare
                      ? 'border-studio-cyan ring-1 ring-studio-cyan/30 bg-studio-cyan/5'
                      : 'border-studio-border hover:border-studio-border/90'
                  }`}
                >
                  {/* Images Comparison Thumbnails */}
                  <div className="flex items-center space-x-3 flex-shrink-0">
                    {/* Clay Source */}
                    <div className="w-36 h-24 bg-studio-bg rounded-lg border border-studio-border overflow-hidden relative group">
                      {gen.sourceImageBase64 ? (
                        <img
                          src={gen.sourceImageBase64}
                          alt="Clay"
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-[10px] text-studio-textSubtle">
                          Archicad Clay
                        </div>
                      )}
                      <span className="absolute bottom-1 left-1 bg-black/75 text-[9px] px-1.5 py-0.5 rounded font-mono text-white/90 border border-white/10">
                        {t('history.clay')}
                      </span>
                    </div>

                    <span className="text-indigo-400 font-bold text-xs">➔</span>

                    {/* AI Output */}
                    <div className="w-36 h-24 bg-studio-bg rounded-lg border border-indigo-500/40 overflow-hidden relative shadow-md">
                      {gen.outputImageBase64 ? (
                        <img
                          src={gen.outputImageBase64}
                          alt="Render"
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-[10px] text-studio-textSubtle">
                          Result
                        </div>
                      )}
                      <span className="absolute bottom-1 left-1 bg-gradient-to-r from-indigo-600/90 to-studio-cyan/90 text-[9px] px-1.5 py-0.5 rounded font-mono text-white font-semibold">
                        {formatProviderName(gen.provider)}
                      </span>
                    </div>
                  </div>

                  {/* Metadata & Prompt */}
                  <div className="flex-1 space-y-2 min-w-0">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2 flex-wrap gap-y-1">
                        <span className="font-semibold text-xs text-white capitalize">
                          {gen.styleId} • {gen.roomType}
                        </span>
                        <span className="text-[10px] font-mono text-indigo-300 bg-indigo-500/15 px-2 py-0.5 rounded border border-indigo-500/30">
                          {gen.model || 'SDXL PBR'}
                        </span>
                        {gen.resolution && (
                          <span className="text-[10px] font-mono text-studio-cyan bg-studio-cyan/15 px-1.5 py-0.5 rounded border border-studio-cyan/30 uppercase font-bold">
                            {gen.resolution}
                          </span>
                        )}
                        {gen.costUsd !== undefined && (
                          <span className="text-[10px] font-mono text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20">
                            {gen.costUsd === 0 ? '0.00$ Free' : `$${gen.costUsd.toFixed(3)}`}
                          </span>
                        )}
                        {gen.materialReferences && gen.materialReferences.length > 0 && (
                          <span className="text-[10px] font-mono text-studio-cyan bg-studio-cyan/10 px-1.5 py-0.5 rounded border border-studio-cyan/20 flex items-center space-x-1">
                            <Layers className="w-2.5 h-2.5" />
                            <span>{gen.materialReferences.length} {language === 'en' ? 'mat.' : 'мат.'}</span>
                          </span>
                        )}
                      </div>
                      <div className="flex items-center space-x-3 text-[11px] text-studio-textSubtle font-mono">
                        <span className="flex items-center space-x-1">
                          <Calendar className="w-3 h-3" />
                          <span>{dateStr}</span>
                        </span>
                        {gen.latencyMs > 0 && <span>{gen.latencyMs} {msUnit}</span>}
                      </div>
                    </div>

                    <div className="relative group">
                      <p className="text-[11px] text-studio-textMuted bg-studio-bg p-2 rounded-lg border border-studio-border line-clamp-2 font-mono leading-relaxed">
                        {gen.prompt}
                      </p>
                      <button
                        onClick={() => handleCopyPrompt(gen)}
                        className="absolute top-1.5 right-1.5 opacity-0 group-hover:opacity-100 p-1 bg-studio-surface border border-studio-border rounded text-[10px] text-zinc-300 hover:text-white transition-opacity flex items-center space-x-1"
                        title={t('history.copyFullPrompt')}
                      >
                        {copiedPromptId === gen.id ? (
                          <Check className="w-3 h-3 text-studio-success" />
                        ) : (
                          <Copy className="w-3 h-3" />
                        )}
                        <span>{copiedPromptId === gen.id ? t('history.promptCopied') : t('history.prompt')}</span>
                      </button>
                    </div>

                    {/* Actions Row */}
                    <div className="flex items-center justify-between pt-1">
                      <button
                        onClick={() => toggleCompare(gen.id)}
                        className={`px-2 py-1 text-xs rounded-lg border flex items-center space-x-1 transition-all ${
                          isSelectedForCompare
                            ? 'bg-studio-cyan text-black font-bold border-studio-cyan shadow-sm'
                            : 'bg-studio-bg border-studio-border text-studio-textMuted hover:text-white'
                        }`}
                        title={t('history.selectToCompare')}
                      >
                        <ArrowLeftRight className="w-3 h-3" />
                        <span>{isSelectedForCompare ? `✓ ${t('history.selectedForCompare')}` : t('history.compare')}</span>
                      </button>

                      <div className="flex items-center space-x-2">
                        <button
                          onClick={() => handleCopy(gen)}
                          className="px-2.5 py-1 text-xs rounded-lg bg-studio-surfaceHover hover:bg-studio-border text-studio-text flex items-center space-x-1 transition-colors"
                        >
                          {copiedId === gen.id ? (
                            <Check className="w-3.5 h-3.5 text-studio-success" />
                          ) : (
                            <Copy className="w-3.5 h-3.5" />
                          )}
                          <span>{copiedId === gen.id ? t('action.copied') : t('action.copy')}</span>
                        </button>
                        <button
                          onClick={() => setUpscalingRecord(gen)}
                          className="px-2.5 py-1 text-xs rounded-lg bg-studio-cyan/20 hover:bg-studio-cyan/30 text-studio-cyan border border-studio-cyan/40 flex items-center space-x-1 font-semibold transition-all active:scale-[0.98]"
                          title={t('history.upscaleTitle')}
                        >
                          <Sparkles className="w-3.5 h-3.5 text-studio-cyan" />
                          <span>{t('history.upscale')}</span>
                        </button>
                        <button
                          onClick={() => handleExport(gen, 'png')}
                          className="px-2.5 py-1 text-xs rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white flex items-center space-x-1 font-medium shadow-sm transition-colors"
                        >
                          <Download className="w-3.5 h-3.5" />
                          <span>{t('history.exportPng')}</span>
                        </button>
                        <button
                          onClick={() => handleDelete(gen.id)}
                          className="p-1.5 text-studio-textSubtle hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-colors"
                          title={t('history.deleteRender')}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Comparison Modal (Split Slider between 2 user-selected renders) */}
      {comparingPair && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-studio-surface border border-studio-border rounded-2xl w-full max-w-5xl h-[88vh] flex flex-col overflow-hidden shadow-2xl">
            <div className="h-12 border-b border-studio-border px-5 flex items-center justify-between bg-studio-bg/80">
              <div className="flex items-center space-x-2">
                <SplitSquareVertical className="w-4 h-4 text-studio-cyan" />
                <span className="text-xs font-bold text-white uppercase tracking-wider">
                  {t('history.compareTitle')}: {comparingPair.a.styleId} ↔ {comparingPair.b.styleId}
                </span>
              </div>
              <button
                onClick={() => setComparingPair(null)}
                className="p-1 rounded-lg text-studio-textMuted hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="flex-1 p-4 relative overflow-hidden">
              <ImageComparisonSlider
                sourceImage={comparingPair.a.outputImageBase64 || ''}
                generatedImage={comparingPair.b.outputImageBase64 || ''}
                sourceLabel={`${t('history.variantA')}: ${comparingPair.a.styleId} (${comparingPair.a.model})`}
                generatedLabel={`${t('history.variantB')}: ${comparingPair.b.styleId} (${comparingPair.b.model})`}
              />
            </div>
          </div>
        </div>
      )}

      {/* Upscale Modal for History Card */}
      {upscalingRecord && (
        <UpscaleModal
          isOpen={true}
          onClose={() => setUpscalingRecord(null)}
          imageBase64={upscalingRecord.outputImageBase64 || ''}
          sourceWidth={upscalingRecord.width || 1344}
          sourceHeight={upscalingRecord.height || 768}
          promptUsed={upscalingRecord.prompt || ''}
        />
      )}
    </div>
  );
};
