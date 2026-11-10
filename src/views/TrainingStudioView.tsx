import React, { useState, useEffect } from 'react';
import {
  Cpu,
  Sparkles,
  Download,
  FolderOpen,
  RefreshCw,
  Layers,
  CheckCircle2,
  FileText,
  BookOpen,
  Trash2,
  Globe,
  Search,
  Image as ImageIcon,
  Plus,
  ExternalLink,
  Check,
} from 'lucide-react';
import { trainingService, DatasetPair } from '../services/trainingService';
import { useI18n } from '../i18n/i18nContext';

const HARVESTER_PRESETS = [
  { label: '🪵 Американский орех', category: 'wood', query: 'modern interior american walnut kitchen cabinetry architectural photography' },
  { label: '🪵 Светлый дуб', category: 'wood', query: 'minimalist scandinavian bleached oak interior architectural photography' },
  { label: '🪵 Термоясень', category: 'wood', query: 'thermo ash wood wall slats modern interior design' },
  { label: '🪨 Римский травертин', category: 'stone', query: 'roman travertine stone bathroom luxury interior architectural photography' },
  { label: '🪨 Мрамор Калакатта', category: 'stone', query: 'calacatta gold marble kitchen island luxury interior photography' },
  { label: '🪨 Терраццо', category: 'stone', query: 'terrazzo flooring contemporary architectural interior' },
  { label: '🧱 Микроцемент', category: 'concrete', query: 'seamless microcement walls minimalist bathroom interior archdaily' },
  { label: '🧱 Арт-бетон', category: 'concrete', query: 'board-formed architectural concrete interior living room' },
  { label: '⚙️ Матовая латунь', category: 'metals', query: 'champagne brushed brass fixtures luxury interior architecture' },
  { label: '⚙️ Черный металл', category: 'metals', query: 'matte black steel frame glass doors minimalist interior' },
  { label: '🪟 Рифленое стекло', category: 'glass', query: 'fluted ribbed glass partition modern interior design' },
  { label: '🧵 Ткань букле', category: 'textiles', query: 'cream boucle wool curved sofa contemporary living room' },
  { label: '🧵 Натуральная кожа', category: 'textiles', query: 'cognac semi-aniline leather armchair modern interior' },
];

export const TrainingStudioView: React.FC = () => {
  const { t } = useI18n();
  const [dataset, setDataset] = useState<DatasetPair[]>([]);
  const [installedLoras, setInstalledLoras] = useState<string[]>(trainingService.getInstalledLoras());
  const [isScanning, setIsScanning] = useState<boolean>(false);
  const [exportStatus, setExportStatus] = useState<string>('');
  const [triggerWord, setTriggerWord] = useState('interior_ai_studio');

  // Harvester State
  const [selectedPreset, setSelectedPreset] = useState<number>(0);
  const [searchQuery, setSearchQuery] = useState<string>(HARVESTER_PRESETS[0].query);
  const [searchCategory, setSearchCategory] = useState<string>(HARVESTER_PRESETS[0].category);
  const [searchCount, setSearchCount] = useState<number>(10);
  const [isHarvesting, setIsHarvesting] = useState<boolean>(false);
  const [harvestProgress, setHarvestProgress] = useState<{ current: number; total: number; message: string; status: string } | null>(null);
  const [harvestedImages, setHarvestedImages] = useState<Array<{ fileName: string; filePath: string; base64: string; caption: string }>>([]);
  const [harvesterStats, setHarvesterStats] = useState<{ totalCategories: number; totalImages: number; categories: Array<{ name: string; count: number }> } | null>(null);
  const [transferMsg, setTransferMsg] = useState<string>('');

  useEffect(() => {
    void trainingService.loadDataset().then(setDataset);
    void handleScanLoras();
    void refreshHarvested();
    void refreshStats();
  }, []);

  useEffect(() => {
    if (window.electronAPI?.onHarvesterProgress) {
      const unsub = window.electronAPI.onHarvesterProgress((prog) => {
        setHarvestProgress({
          current: prog.current,
          total: prog.total,
          message: prog.message,
          status: prog.status,
        });
        if (prog.status === 'completed' || prog.status === 'error') {
          setIsHarvesting(false);
          void refreshHarvested();
          void refreshStats();
        }
      });
      return unsub;
    }
  }, [searchCategory]);

  const refreshHarvested = async (cat?: string) => {
    const targetCat = cat || searchCategory;
    if (window.electronAPI?.loadHarvestedImages) {
      const res = await window.electronAPI.loadHarvestedImages(targetCat);
      if (res.success && res.images) {
        setHarvestedImages(res.images);
      }
    }
  };

  const refreshStats = async () => {
    if (window.electronAPI?.getHarvesterStats) {
      const stats = await window.electronAPI.getHarvesterStats();
      setHarvesterStats(stats);
    }
  };

  const handleSelectPreset = (idx: number) => {
    setSelectedPreset(idx);
    setSearchQuery(HARVESTER_PRESETS[idx].query);
    setSearchCategory(HARVESTER_PRESETS[idx].category);
    void refreshHarvested(HARVESTER_PRESETS[idx].category);
  };

  const handleStartHarvest = async () => {
    if (!searchQuery.trim()) return;
    setIsHarvesting(true);
    setTransferMsg('');
    setHarvestProgress({ current: 0, total: searchCount, message: t('harvester.searching'), status: 'searching' });
    try {
      const res = await window.electronAPI?.harvestImages({
        query: searchQuery,
        category: searchCategory,
        count: searchCount,
        minWidth: 1024,
        minHeight: 768,
      });
      if (res?.success) {
        await refreshHarvested();
        await refreshStats();
      } else if (res?.error) {
        setHarvestProgress({ current: 0, total: searchCount, message: res.error, status: 'error' });
      }
    } catch (e: any) {
      setHarvestProgress({ current: 0, total: searchCount, message: e.message || 'Error', status: 'error' });
    } finally {
      setIsHarvesting(false);
    }
  };

  const handleOpenHarvestFolder = () => {
    if (window.electronAPI?.openHarvestFolder) {
      void window.electronAPI.openHarvestFolder(searchCategory);
    }
  };

  const handleTransferToDataset = async () => {
    if (harvestedImages.length === 0) return;
    let added = 0;
    for (const img of harvestedImages) {
      await trainingService.addPairToDataset({
        sourceBase64: img.base64,
        outputBase64: img.base64,
        prompt: img.caption || searchQuery,
        styleName: searchCategory,
        roomType: 'interior',
        tags: [searchCategory, 'harvested_pbr'],
      });
      added++;
    }
    const updated = trainingService.getDataset();
    setDataset([...updated]);
    setTransferMsg(t('harvester.transferSuccess', { count: added }));
    setTimeout(() => setTransferMsg(''), 6000);
  };

  const handleScanLoras = async () => {
    setIsScanning(true);
    const loras = await trainingService.scanLocalLoras();
    setInstalledLoras(loras);
    setIsScanning(false);
  };

  const handleOpenLorasFolder = () => {
    if (window.electronAPI?.openModelsFolder) {
      window.electronAPI.openModelsFolder('loras');
    }
  };

  const handleExportDataset = async () => {
    const pairs = trainingService.getDataset();
    if (pairs.length === 0) return;
    if (!window.electronAPI?.exportTrainingDataset) { setExportStatus(t('training.electronRequired')); return; }
    setExportStatus(t('training.exporting'));
    try {
      const result = await window.electronAPI.exportTrainingDataset(pairs, triggerWord);
      if (result.canceled) { setExportStatus(''); return; }
      if (!result.success) { setExportStatus(t('training.exportFailed', { error: result.error || '' })); return; }
      setExportStatus(t('training.exported', { count: result.pairsCount || pairs.length, path: result.folderPath || '' }));
    } catch (error) {
      setExportStatus(t('training.exportFailed', { error: error instanceof Error ? error.message : String(error) }));
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-studio-bg overflow-y-auto select-none">
      {/* Top Header */}
      <div className="p-6 border-b border-studio-border bg-gradient-to-r from-studio-surface via-studio-surface/90 to-studio-bg flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2.5 mb-1.5">
            <div className="p-2 rounded-xl bg-gradient-to-tr from-purple-600/30 to-studio-cyan/30 border border-purple-500/40 text-purple-300">
              <Cpu className="w-5 h-5" />
            </div>
            <h1 className="text-xl font-bold text-white tracking-wide">
              {t('training.title')}
            </h1>
            <span className="text-[10px] font-mono text-purple-300 bg-purple-500/15 border border-purple-500/30 px-2 py-0.5 rounded-full font-bold">
              {t('training.hardwareBadge')}
            </span>
          </div>
          <p className="text-xs text-studio-textMuted max-w-2xl leading-relaxed">
            {t('training.subtitle')}
          </p>
        </div>

        <div className="flex items-center space-x-2.5 shrink-0">
            <button
            onClick={handleOpenLorasFolder}
            className="px-3.5 py-2 rounded-xl text-xs font-semibold bg-studio-surfaceLight hover:bg-studio-border text-white border border-studio-border transition-all flex items-center space-x-1.5 shadow-sm active:scale-[0.98]"
            title={t('training.openLoraFolder')}
          >
            <FolderOpen className="w-4 h-4 text-studio-cyan" />
            <span>{t('training.loraFolder')}</span>
          </button>

          <button
            onClick={handleScanLoras}
            disabled={isScanning}
            className="px-3.5 py-2 rounded-xl text-xs font-semibold bg-purple-500/15 hover:bg-purple-500/25 text-purple-300 border border-purple-500/35 transition-all flex items-center space-x-1.5 shadow-sm active:scale-[0.98]"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isScanning ? 'animate-spin' : ''}`} />
            <span>{isScanning ? t('training.scanning') : t('training.refreshLoras')}</span>
          </button>
        </div>
      </div>

      <div className="p-6 space-y-6">
        {/* SECTION 1: INSTALLED LORA MODELS */}
        <div className="bg-studio-surface border border-studio-border rounded-2xl p-5 space-y-4 shadow-sm">
          <div className="flex items-center justify-between pb-3 border-b border-studio-border">
            <div className="flex items-center space-x-2">
              <Sparkles className="w-4 h-4 text-studio-cyan" />
              <h2 className="text-sm font-bold text-white uppercase tracking-wider">
                {t('training.localLoras', { count: installedLoras.length })}
              </h2>
            </div>
            <span className="text-[11px] font-mono text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
              {t('training.loraFolder')}
            </span>
          </div>

          {installedLoras.length === 0 ? (
            <div className="p-5 rounded-xl border border-dashed border-studio-border bg-studio-bg/60 text-center space-y-2">
              <Cpu className="w-8 h-8 text-zinc-500 mx-auto" />
              <h4 className="text-xs font-semibold text-white">{t('training.noLoras')}</h4>
              <p className="text-[11px] text-zinc-400 max-w-md mx-auto">
                {t('training.copyLorasHint')}
              </p>
              <button
                onClick={handleOpenLorasFolder}
                className="mt-2 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-medium inline-flex items-center space-x-1.5"
              >
                <FolderOpen className="w-3.5 h-3.5" />
                <span>{t('training.openLoraFolder')}</span>
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
              {installedLoras.map((lora, idx) => (
                <div
                  key={idx}
                  className="p-3 rounded-xl bg-studio-bg border border-studio-border hover:border-studio-cyan/40 flex items-center justify-between transition-all"
                >
                  <div className="min-w-0 pr-2">
                    <div className="flex items-center space-x-1.5">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                      <span className="font-semibold text-xs text-white truncate">{lora}</span>
                    </div>
                    <span className="text-[10px] text-zinc-500 font-mono block mt-0.5">
                      {t('training.detectedInFolder')}
                    </span>
                  </div>
                  <span className="text-[10px] bg-studio-cyan/15 text-studio-cyan px-2 py-0.5 rounded font-mono shrink-0">
                    {t('training.detected')}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* SECTION: AI DATASET HARVESTER (Парсер материалов) */}
        <div className="bg-studio-surface border border-studio-border rounded-2xl p-5 space-y-4 shadow-sm">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-studio-border">
            <div>
              <div className="flex items-center space-x-2">
                <Globe className="w-4 h-4 text-studio-cyan" />
                <h2 className="text-sm font-bold text-white uppercase tracking-wider">
                  {t('harvester.title')}
                </h2>
                <span className="text-[10px] font-mono text-studio-cyan bg-studio-cyan/15 px-2 py-0.5 rounded font-bold">
                  {t('harvester.badge')}
                </span>
                {harvesterStats && harvesterStats.totalImages > 0 && (
                  <span className="text-[10px] font-mono text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                    Всего собрано: {harvesterStats.totalImages} фото ({harvesterStats.totalCategories} кат.)
                  </span>
                )}
              </div>
              <p className="text-[11px] text-zinc-400 mt-1 max-w-3xl leading-relaxed">
                {t('harvester.subtitle')}
              </p>
            </div>

            <div className="flex items-center space-x-2 shrink-0">
              <button
                onClick={handleOpenHarvestFolder}
                className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-studio-surfaceLight hover:bg-studio-border text-white border border-studio-border transition-all flex items-center space-x-1.5 shadow-sm active:scale-[0.98]"
              >
                <FolderOpen className="w-3.5 h-3.5 text-studio-cyan" />
                <span>{t('harvester.openFolder')}</span>
              </button>

              <button
                onClick={() => { void refreshHarvested(); void refreshStats(); }}
                className="p-1.5 text-zinc-400 hover:text-white rounded-lg transition-colors border border-studio-border bg-studio-surfaceLight"
                title={t('harvester.refresh')}
              >
                <RefreshCw className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Preset Chips */}
          <div className="space-y-1.5">
            <span className="text-[11px] font-semibold text-zinc-300 block">
              {t('harvester.presetLabel')}
            </span>
            <div className="flex flex-wrap gap-2">
              {HARVESTER_PRESETS.map((preset, idx) => {
                const isSelected = selectedPreset === idx;
                return (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => handleSelectPreset(idx)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-all flex items-center space-x-1.5 border ${
                      isSelected
                        ? 'bg-studio-cyan/20 border-studio-cyan text-white shadow-sm'
                        : 'bg-studio-bg hover:bg-studio-surfaceLight border-studio-border text-zinc-300'
                    }`}
                  >
                    <span>{preset.label}</span>
                    {isSelected && <Check className="w-3 h-3 text-studio-cyan ml-1" />}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Search Controls */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-3 pt-2">
            <div className="md:col-span-8 relative">
              <Search className="w-4 h-4 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={t('harvester.queryPlaceholder')}
                className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-studio-border bg-studio-bg text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-studio-cyan transition-colors"
              />
            </div>

            <div className="md:col-span-2">
              <select
                value={searchCount}
                onChange={(e) => setSearchCount(Number(e.target.value))}
                className="w-full px-3 py-2.5 rounded-xl border border-studio-border bg-studio-bg text-xs text-white focus:outline-none focus:border-studio-cyan transition-colors"
              >
                <option value={5}>5 качественных фото</option>
                <option value={10}>10 качественных фото</option>
                <option value={15}>15 качественных фото</option>
                <option value={20}>20 качественных фото</option>
                <option value={30}>30 качественных фото</option>
              </select>
            </div>

            <div className="md:col-span-2">
              <button
                type="button"
                onClick={handleStartHarvest}
                disabled={isHarvesting || !searchQuery.trim()}
                className="w-full py-2.5 rounded-xl text-xs font-bold bg-gradient-to-r from-studio-cyan to-blue-600 hover:brightness-110 text-black shadow-md transition-all flex items-center justify-center space-x-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isHarvesting ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Сбор...</span>
                  </>
                ) : (
                  <>
                    <Search className="w-3.5 h-3.5" />
                    <span>{t('harvester.startBtn')}</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Live Progress Bar */}
          {harvestProgress && (
            <div className="p-3.5 rounded-xl bg-studio-bg border border-studio-border space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-white flex items-center space-x-2">
                  {harvestProgress.status === 'searching' && <Search className="w-3.5 h-3.5 text-studio-cyan animate-pulse" />}
                  {harvestProgress.status === 'downloading' && <Download className="w-3.5 h-3.5 text-studio-cyan animate-bounce" />}
                  {harvestProgress.status === 'completed' && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />}
                  <span>{harvestProgress.message}</span>
                </span>
                <span className="font-mono text-studio-cyan text-[11px]">
                  {harvestProgress.current} / {harvestProgress.total} фото
                </span>
              </div>
              <div className="w-full h-1.5 rounded-full bg-studio-border overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-studio-cyan to-emerald-400 transition-all duration-300"
                  style={{ width: `${Math.min(100, Math.round((harvestProgress.current / harvestProgress.total) * 100))}%` }}
                />
              </div>
            </div>
          )}

          {/* Transfer Notification */}
          {transferMsg && (
            <div className="p-3 bg-emerald-500/15 border border-emerald-500/30 rounded-xl text-xs text-emerald-300 flex items-center space-x-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>{transferMsg}</span>
            </div>
          )}

          {/* Harvested Images Gallery */}
          <div className="space-y-3 pt-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-white flex items-center space-x-1.5">
                <ImageIcon className="w-3.5 h-3.5 text-studio-cyan" />
                <span>
                  {t('harvester.harvestedCount', {
                    category: HARVESTER_PRESETS[selectedPreset]?.label || searchCategory,
                    count: harvestedImages.length,
                  })}
                </span>
              </span>

              {harvestedImages.length > 0 && (
                <button
                  type="button"
                  onClick={handleTransferToDataset}
                  className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white transition-all flex items-center space-x-1.5 shadow-sm active:scale-[0.98]"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>{t('harvester.transferBtn')}</span>
                </button>
              )}
            </div>

            {harvestedImages.length === 0 ? (
              <div className="p-6 rounded-xl border border-dashed border-studio-border bg-studio-bg/60 text-center space-y-1.5">
                <Globe className="w-7 h-7 text-zinc-500 mx-auto" />
                <p className="text-xs text-zinc-400">{t('harvester.emptyGallery')}</p>
                <p className="text-[10px] text-zinc-500">
                  Выберите материал из списка выше и нажмите «Начать сбор HD-картинок»
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 max-h-72 overflow-y-auto p-1">
                {harvestedImages.map((img, idx) => (
                  <div
                    key={idx}
                    className="group bg-studio-bg rounded-xl border border-studio-border overflow-hidden flex flex-col justify-between hover:border-studio-cyan/50 transition-all shadow-sm"
                  >
                    <div className="relative aspect-video w-full bg-black/40 overflow-hidden">
                      <img
                        src={img.base64}
                        alt={img.fileName}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        loading="lazy"
                      />
                      <span className="absolute bottom-1 right-1 px-1.5 py-0.5 rounded text-[9px] font-mono bg-black/75 text-zinc-300 border border-white/10">
                        HD 1080p
                      </span>
                    </div>
                    <div className="p-2 space-y-1">
                      <span className="text-[10px] font-semibold text-white truncate block">
                        {img.fileName}
                      </span>
                      <p className="text-[9px] text-zinc-400 line-clamp-2 leading-tight font-mono">
                        {img.caption || searchQuery}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* SECTION 2: DATASET PAIR COLLECTOR */}
        <div className="bg-studio-surface border border-studio-border rounded-2xl p-5 space-y-4 shadow-sm">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-studio-border">
            <div>
              <div className="flex items-center space-x-2">
                <Layers className="w-4 h-4 text-purple-400" />
                <h2 className="text-sm font-bold text-white uppercase tracking-wider">
                  {t('training.datasetTitle', { count: dataset.length })}
                </h2>
              </div>
              <p className="text-[11px] text-zinc-400 mt-0.5">
                {t('training.datasetDescription')}
              </p>
            </div>

            <div className="flex items-center space-x-2">
              <button
                onClick={handleExportDataset}
                disabled={dataset.length === 0}
                className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-gradient-to-r from-purple-600 to-indigo-600 hover:brightness-110 text-white shadow-md transition-all flex items-center space-x-1.5 disabled:opacity-50"
              >
                <Download className="w-3.5 h-3.5" />
                <span>{t('training.exportDataset')}</span>
              </button>

              {dataset.length > 0 && (
                <button
                  onClick={() => { if (window.confirm(t('training.confirmClear'))) void trainingService.clearDataset().then(() => setDataset([])); }}
                  className="p-1.5 text-zinc-500 hover:text-rose-400 rounded-lg transition-colors"
                  title={t('training.clearDataset')}
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>

          {exportStatus && (
            <div className="p-3 bg-emerald-500/15 border border-emerald-500/30 rounded-xl text-xs text-emerald-300 flex items-center space-x-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span className="break-all">{exportStatus}</span>
            </div>
          )}

          <label className="block text-[11px] text-zinc-300">
            {t('training.triggerWord')}
            <input value={triggerWord} onChange={(event) => setTriggerWord(event.target.value)} maxLength={48} className="mt-1 w-full rounded-lg border border-studio-border bg-studio-bg px-3 py-2 text-xs text-white" />
          </label>

          {dataset.length === 0 ? (
            <div className="p-6 rounded-xl border border-dashed border-studio-border bg-studio-bg/60 text-center space-y-1.5">
              <FileText className="w-8 h-8 text-zinc-500 mx-auto" />
              <h4 className="text-xs font-semibold text-white">{t('training.emptyDataset')}</h4>
              <p className="text-[11px] text-zinc-400 max-w-md mx-auto">
                {t('training.emptyHint')}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {dataset.map((pair) => (
                <div
                  key={pair.id}
                  className="bg-studio-bg border border-studio-border rounded-xl p-3 flex flex-col justify-between space-y-2 group"
                >
                  <div className="grid grid-cols-2 gap-2 h-28 overflow-hidden rounded-lg">
                    <img
                      src={pair.sourceBase64}
                      alt={t('training.clayAlt')}
                      className="w-full h-full object-cover rounded border border-studio-border/50"
                    />
                    <img
                      src={pair.outputBase64}
                      alt={t('training.targetAlt')}
                      className="w-full h-full object-cover rounded border border-studio-border/50"
                    />
                  </div>

                  <div>
                    <div className="flex items-center justify-between text-[10px] text-zinc-400 mb-1">
                      <span className="font-semibold text-white">{pair.roomType}</span>
                      <span>{new Date(pair.timestamp).toLocaleDateString()}</span>
                    </div>
                    <p className="text-[10px] text-zinc-500 font-mono line-clamp-2 leading-relaxed">
                      {pair.prompt}
                    </p>
                  </div>

                  <div className="pt-2 border-t border-studio-border/50 flex items-center justify-between">
                    <span className="text-[9px] text-purple-300 bg-purple-500/10 px-1.5 py-0.5 rounded font-mono">
                      Пара #{pair.id.substring(pair.id.length - 4)}
                    </span>
                    <button
                      onClick={() => {
                        void trainingService.removePair(pair.id).then(() => setDataset(trainingService.getDataset()));
                      }}
                      className="text-zinc-500 hover:text-rose-400 p-1 transition-colors"
                      title={t('training.removePair')}
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Optional external cloud workflow; this app exports data but does not run Colab jobs. */}
        <div className="bg-gradient-to-r from-amber-500/10 via-studio-surface to-indigo-950/30 border border-amber-500/30 rounded-2xl p-5 space-y-4 shadow-sm">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-studio-border">
            <div>
              <div className="flex items-center space-x-2">
                <Sparkles className="w-5 h-5 text-amber-400" />
                <h2 className="text-sm font-bold text-white uppercase tracking-wider">
                  {t('training.cloudTitle')}
                </h2>
                <span className="text-[10px] font-mono text-amber-300 bg-amber-500/20 border border-amber-500/40 px-2 py-0.5 rounded font-bold">
                  {t('training.cloudOptional')}
                </span>
              </div>
              <p className="text-[11px] text-zinc-300 mt-1 max-w-2xl leading-relaxed">
                {t('training.cloudNote')}
              </p>
            </div>

            <div className="flex items-center space-x-2 shrink-0">
              <button
                type="button"
                onClick={() => {
                  if (window.electronAPI?.showColabNotebook) {
                    void window.electronAPI.showColabNotebook();
                  }
                }}
                className="px-3.5 py-2 rounded-xl text-xs font-semibold bg-studio-surfaceLight hover:bg-studio-border text-white border border-studio-border transition-all flex items-center space-x-1.5 shadow-sm active:scale-[0.98]"
              >
                <FileText className="w-4 h-4 text-amber-400" />
                <span>{t('training.showNotebook')}</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  if (window.electronAPI?.openExternal) {
                    void window.electronAPI.openExternal('https://colab.research.google.com/#create=true');
                  } else {
                    window.open('https://colab.research.google.com/', '_blank');
                  }
                }}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-gradient-to-r from-amber-500 to-orange-500 hover:brightness-110 text-black transition-all flex items-center space-x-1.5 shadow-md active:scale-[0.98]"
              >
                <ExternalLink className="w-4 h-4" />
                <span>{t('training.openColab')}</span>
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-3 text-xs">
            <div className="p-3 rounded-xl bg-studio-bg/80 border border-studio-border/70 space-y-1">
              <span className="text-[10px] font-bold text-amber-300 block font-mono">1. {t('training.cloudStepExport')}</span>
              <p className="text-[11px] text-zinc-400">
                {t('training.cloudStepExportHint')}
              </p>
            </div>

            <div className="p-3 rounded-xl bg-studio-bg/80 border border-studio-border/70 space-y-1">
              <span className="text-[10px] font-bold text-amber-300 block font-mono">2. {t('training.cloudStepUpload')}</span>
              <p className="text-[11px] text-zinc-400">
                {t('training.cloudStepUploadHint')}
              </p>
            </div>

            <div className="p-3 rounded-xl bg-studio-bg/80 border border-studio-border/70 space-y-1">
              <span className="text-[10px] font-bold text-amber-300 block font-mono">3. {t('training.cloudStepRun')}</span>
              <p className="text-[11px] text-zinc-400">
                {t('training.cloudStepRunHint')}
              </p>
            </div>

            <div className="p-3 rounded-xl bg-studio-bg/80 border border-studio-border/70 space-y-1">
              <span className="text-[10px] font-bold text-emerald-400 block font-mono">4. {t('training.cloudStepResult')}</span>
              <p className="text-[11px] text-zinc-400">
                {t('training.cloudStepResultHint')} <span className="text-white font-mono">D:\AI\models\loras</span>.
              </p>
            </div>
          </div>
        </div>

        {/* SECTION 3: STEP-BY-STEP TRAINING GUIDE FOR NVIDIA RTX 4050 (6GB) */}
        <div className="bg-studio-surface border border-studio-border rounded-2xl p-5 space-y-4 shadow-sm">
          <div className="flex items-center space-x-2 pb-3 border-b border-studio-border">
            <BookOpen className="w-4 h-4 text-studio-cyan" />
            <h2 className="text-sm font-bold text-white uppercase tracking-wider">
              {t('training.guideTitle')}
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
            <div className="p-3.5 rounded-xl bg-studio-bg border border-studio-border space-y-2">
              <span className="text-[11px] font-bold text-studio-cyan block">{t('training.guideCollectTitle')}</span>
              <p className="text-zinc-400 leading-relaxed text-[11px]">
                {t('training.guideCollect')}
              </p>
            </div>

            <div className="p-3.5 rounded-xl bg-studio-bg border border-studio-border space-y-2">
              <span className="text-[11px] font-bold text-purple-400 block">{t('training.guideTrainTitle')}</span>
              <p className="text-zinc-400 leading-relaxed text-[11px]">
                {t('training.guideTrain')}
              </p>
            </div>

            <div className="p-3.5 rounded-xl bg-studio-bg border border-studio-border space-y-2">
              <span className="text-[11px] font-bold text-emerald-400 block">{t('training.guideUseTitle')}</span>
              <p className="text-zinc-400 leading-relaxed text-[11px]">
                {t('training.guideUse')}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
