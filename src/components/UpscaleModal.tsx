import React, { useState, useRef, useEffect } from 'react';
import {
  X,
  Maximize2,
  Sparkles,
  Cpu,
  Cloud,
  Download,
  Check,
  RefreshCw,
  Zap,
  AlertCircle,
  Layers,
  Wand2,
  ZoomIn
} from 'lucide-react';
import { upscaleService, UpscaleFactor, UpscaleProviderType, UpscaleResult } from '../services/ai/UpscaleService';

interface UpscaleModalProps {
  isOpen: boolean;
  onClose: () => void;
  imageBase64?: string;
  mimeType?: string;
  sourceWidth?: number;
  sourceHeight?: number;
  promptUsed?: string;
  onApplyUpscaledImage?: (newBase64: string, newWidth: number, newHeight: number) => void;
}

export const UpscaleModal: React.FC<UpscaleModalProps> = ({
  isOpen,
  onClose,
  imageBase64 = '',
  mimeType = 'image/png',
  sourceWidth = 1344,
  sourceHeight = 768,
  promptUsed = '',
  onApplyUpscaledImage,
}) => {
  const [currentImage, setCurrentImage] = useState<string>(imageBase64 || '');
  const [currWidth, setCurrWidth] = useState<number>(sourceWidth || 1344);
  const [currHeight, setCurrHeight] = useState<number>(sourceHeight || 768);
  const [scaleFactor, setScaleFactor] = useState<UpscaleFactor>(2);
  const [provider, setProvider] = useState<UpscaleProviderType>('comfyui_ultrasharp');
  const [modelName, setModelName] = useState<string>('4x-UltraSharp.pth');
  const [denoise, setDenoise] = useState<number>(0.22);
  const [sharpness, setSharpness] = useState<number>(35);
  const [allowFallback, setAllowFallback] = useState<boolean>(false);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [result, setResult] = useState<UpscaleResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sliderPos, setSliderPos] = useState<number>(50);
  const [isLoupeActive, setIsLoupeActive] = useState<boolean>(false);
  const [loupePos, setLoupePos] = useState<{ x: number; y: number; relX: number }>({ x: 0, y: 0, relX: 50 });
  const viewportRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (imageBase64) {
      setCurrentImage(imageBase64);
    }
  }, [imageBase64]);

  useEffect(() => {
    if (sourceWidth) setCurrWidth(sourceWidth);
    if (sourceHeight) setCurrHeight(sourceHeight);
  }, [sourceWidth, sourceHeight]);

  if (!isOpen) return null;

  const rawW = Math.round(currWidth * scaleFactor);
  const rawH = Math.round(currHeight * scaleFactor);
  const targetWidth = Math.max(512, Math.round(rawW / 64) * 64);
  const targetHeight = Math.max(512, Math.round(rawH / 64) * 64);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = () => {
        const b64 = reader.result as string;
        setCurrentImage(b64);
        const img = new Image();
        img.onload = () => {
          setCurrWidth(img.naturalWidth || 1024);
          setCurrHeight(img.naturalHeight || 768);
        };
        img.src = b64;
      };
      reader.readAsDataURL(file);
    }
  };

  const handleStartUpscale = async () => {
    if (!currentImage) {
      setError('Загрузите изображение для апскейла');
      return;
    }
    setIsProcessing(true);
    setError(null);
    try {
      const res = await upscaleService.upscaleImage({
        imageBase64: currentImage,
        mimeType,
        sourceWidth: currWidth,
        sourceHeight: currHeight,
        scaleFactor,
        provider,
        denoise,
        sharpness,
        prompt: promptUsed,
        modelName,
        allowFallback,
      });
      setResult(res);
    } catch (err: any) {
      setError(err.message || 'Ошибка апскейла');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleApply = () => {
    if (result && onApplyUpscaledImage) {
      onApplyUpscaledImage(result.imageBase64, result.width, result.height);
      onClose();
    }
  };

  const handleDownload = () => {
    if (!result) return;
    const a = document.createElement('a');
    a.href = `data:${result.mimeType};base64,${result.imageBase64}`;
    a.download = `Architectural_4K_Upscale_${result.width}x${result.height}.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const handleMouseMoveViewport = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!viewportRef.current) return;
    const rect = viewportRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const relX = (x / rect.width) * 100;
    setLoupePos({ x, y, relX });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-sm p-4 animate-in fade-in select-none">
      <div className="bg-studio-surface border border-studio-border rounded-2xl w-full max-w-5xl max-h-[94vh] flex flex-col shadow-2xl overflow-hidden text-studio-text">
        {/* Header */}
        <div className="h-14 px-6 border-b border-studio-border flex items-center justify-between shrink-0 bg-studio-bg/70">
          <div className="flex items-center space-x-3">
            <div className="p-2 rounded-xl bg-gradient-to-tr from-indigo-500/20 to-studio-cyan/20 border border-studio-cyan/30 text-studio-cyan">
              <Maximize2 className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                  AI Апскейлер рендера (Нейросетевая четкость 4K)
                </h3>
                <span className="text-[10px] bg-studio-cyan/15 text-studio-cyan border border-studio-cyan/30 px-2 py-0.5 rounded-full font-mono font-bold">
                  True AI Super-Resolution
                </span>
              </div>
              <p className="text-[11px] text-studio-textMuted">
                Настоящая нейросетевая прорисовка микротекстур дерева, камня и устранение шума без растягивания пикселей
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-studio-border text-studio-textMuted hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 grid grid-cols-12 gap-5 p-6 overflow-y-auto">
          {/* Controls Column (5 cols) */}
          <div className="col-span-5 space-y-4">
            {/* Resolution Badge Card */}
            <div className="bg-studio-bg/80 border border-studio-border rounded-xl p-3 flex items-center justify-between font-mono text-xs">
              <div>
                <span className="text-[10px] text-studio-textMuted block">Исходное:</span>
                <span className="font-semibold text-zinc-300">{sourceWidth} × {sourceHeight}</span>
              </div>
              <div className="text-indigo-400 font-bold text-base">➔</div>
              <div className="text-right">
                <span className="text-[10px] text-studio-cyan block">Результат ({scaleFactor}x):</span>
                <span className="font-bold text-studio-cyan">{targetWidth} × {targetHeight}</span>
              </div>
            </div>

            {/* Scale Factor Selector */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-white">Коэффициент увеличения:</label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => setScaleFactor(2)}
                  className={`p-2.5 rounded-xl border text-left transition-all ${
                    scaleFactor === 2
                      ? 'border-studio-cyan bg-studio-cyan/15 text-white font-bold shadow-md shadow-studio-cyan/5'
                      : 'border-studio-border bg-studio-bg text-studio-textMuted hover:text-white'
                  }`}
                >
                  <div className="flex items-center justify-between text-xs">
                    <span>2x Увеличение</span>
                    <span className="text-[10px] font-mono text-studio-cyan">QHD / 2.5K</span>
                  </div>
                  <span className="text-[10px] text-zinc-400 font-normal mt-0.5 block">
                    Быстрый апскейл (~5-8 сек)
                  </span>
                </button>

                <button
                  onClick={() => setScaleFactor(4)}
                  className={`p-2.5 rounded-xl border text-left transition-all ${
                    scaleFactor === 4
                      ? 'border-studio-cyan bg-studio-cyan/15 text-white font-bold shadow-md shadow-studio-cyan/5'
                      : 'border-studio-border bg-studio-bg text-studio-textMuted hover:text-white'
                  }`}
                >
                  <div className="flex items-center justify-between text-xs">
                    <span>4x Увеличение</span>
                    <span className="text-[10px] font-mono text-emerald-400">4K Ultra-HD</span>
                  </div>
                  <span className="text-[10px] text-zinc-400 font-normal mt-0.5 block">
                    Максимальная четкость для печати
                  </span>
                </button>
              </div>
            </div>

            {/* Provider Selector */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-white">Движок улучшения:</label>
              <div className="space-y-2">
                {/* 1. ComfyUI 4x-UltraSharp */}
                <button
                  onClick={() => setProvider('comfyui_ultrasharp')}
                  className={`w-full p-2.5 rounded-xl border text-left flex items-start space-x-2.5 transition-all ${
                    provider === 'comfyui_ultrasharp'
                      ? 'border-studio-cyan bg-studio-cyan/15 text-white ring-1 ring-studio-cyan/30'
                      : 'border-studio-border bg-studio-bg text-studio-textMuted hover:text-white'
                  }`}
                >
                  <Cpu className="w-4 h-4 text-studio-cyan shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-white">ComfyUI 4x-UltraSharp</span>
                      <span className="text-[9px] bg-studio-cyan/20 text-studio-cyan px-1.5 py-0.5 rounded font-mono">RTX 4050 • Топ</span>
                    </div>
                    <p className="text-[10px] text-zinc-400 mt-0.5">
                      Нейросетевая реконструкция: идеальная резкость стыков, плинтусов и дерева без смещения стен
                    </p>
                  </div>
                </button>

                {/* 2. ComfyUI SDXL Latent Refiner */}
                <button
                  onClick={() => setProvider('comfyui_refiner')}
                  className={`w-full p-2.5 rounded-xl border text-left flex items-start space-x-2.5 transition-all ${
                    provider === 'comfyui_refiner'
                      ? 'border-indigo-500 bg-indigo-500/15 text-white ring-1 ring-indigo-500/30'
                      : 'border-studio-border bg-studio-bg text-studio-textMuted hover:text-white'
                  }`}
                >
                  <Wand2 className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-white">ComfyUI + SDXL PBR Рефайнер</span>
                      <span className="text-[9px] bg-indigo-500/20 text-indigo-300 px-1.5 py-0.5 rounded font-mono">Синтез текстур</span>
                    </div>
                    <p className="text-[10px] text-zinc-400 mt-0.5">
                      UltraSharp + SDXL диффузия: синтезирует поры дерева, мраморные прожилки и микроотражения
                    </p>
                  </div>
                </button>

                {/* 3. AI Horde Cloud */}
                <button
                  onClick={() => setProvider('aihorde')}
                  className={`w-full p-2.5 rounded-xl border text-left flex items-start space-x-2.5 transition-all ${
                    provider === 'aihorde'
                      ? 'border-purple-500 bg-purple-500/15 text-white'
                      : 'border-studio-border bg-studio-bg text-studio-textMuted hover:text-white'
                  }`}
                >
                  <Cloud className="w-4 h-4 text-purple-400 shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-white">AI Horde Cloud (RealESRGAN)</span>
                      <span className="text-[9px] bg-purple-500/20 text-purple-300 px-1.5 py-0.5 rounded font-mono">100% Free Cloud</span>
                    </div>
                    <p className="text-[10px] text-zinc-400 mt-0.5">
                      Бесплатная облачная GPU-сеть. Апскейл без нагрузки на ноутбук
                    </p>
                  </div>
                </button>

                {/* 4. Browser Fast Bicubic */}
                <button
                  onClick={() => setProvider('browser')}
                  className={`w-full p-2.5 rounded-xl border text-left flex items-start space-x-2.5 transition-all ${
                    provider === 'browser'
                      ? 'border-zinc-500 bg-zinc-500/15 text-white'
                      : 'border-studio-border bg-studio-bg text-studio-textMuted hover:text-white'
                  }`}
                >
                  <Zap className="w-4 h-4 text-zinc-400 shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-zinc-300">Быстрый Bicubic HD</span>
                      <span className="text-[9px] bg-zinc-700 text-zinc-300 px-1.5 py-0.5 rounded font-mono">&lt; 0.5 сек</span>
                    </div>
                    <p className="text-[10px] text-zinc-400 mt-0.5">
                      Масштабирование канвасом без нейросетей (для предпросмотра)
                    </p>
                  </div>
                </button>
              </div>
            </div>

            {/* Neural Model Selector for UltraSharp */}
            {provider === 'comfyui_ultrasharp' && (
              <div className="space-y-1.5 bg-studio-bg/60 border border-studio-border p-3 rounded-xl">
                <div className="flex justify-between text-xs items-center">
                  <span className="text-studio-textMuted flex items-center space-x-1">
                    <Layers className="w-3.5 h-3.5 text-studio-cyan" />
                    <span>Нейросетевая модель:</span>
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2 mt-1">
                  <button
                    onClick={() => setModelName('4x-UltraSharp.pth')}
                    className={`py-1.5 px-2 rounded-lg border text-xs text-left transition-all ${
                      modelName === '4x-UltraSharp.pth'
                        ? 'border-studio-cyan bg-studio-cyan/20 text-white font-bold'
                        : 'border-studio-border bg-studio-surface text-studio-textMuted'
                    }`}
                  >
                    4x-UltraSharp
                    <span className="block text-[9px] text-zinc-400 font-normal">Для интерьеров & фото</span>
                  </button>
                  <button
                    onClick={() => setModelName('RealESRGAN_x4plus.pth')}
                    className={`py-1.5 px-2 rounded-lg border text-xs text-left transition-all ${
                      modelName === 'RealESRGAN_x4plus.pth'
                        ? 'border-studio-cyan bg-studio-cyan/20 text-white font-bold'
                        : 'border-studio-border bg-studio-surface text-studio-textMuted'
                    }`}
                  >
                    RealESRGAN_x4+
                    <span className="block text-[9px] text-zinc-400 font-normal">Очистка шума & артефактов</span>
                  </button>
                </div>
              </div>
            )}

            {/* Denoise Slider for SDXL Refiner */}
            {provider === 'comfyui_refiner' && (
              <div className="space-y-2 bg-studio-bg/60 border border-studio-border p-3 rounded-xl">
                <div className="flex justify-between text-xs items-center">
                  <span className="text-studio-textMuted">Интенсивность синтеза (Denoise):</span>
                  <span className="font-mono text-indigo-400 font-bold">{denoise.toFixed(2)}</span>
                </div>
                <input
                  type="range"
                  min="0.14"
                  max="0.30"
                  step="0.02"
                  value={denoise}
                  onChange={(e) => setDenoise(parseFloat(e.target.value))}
                  className="w-full accent-indigo-400 cursor-pointer"
                />
                <div className="grid grid-cols-3 gap-1.5 pt-1">
                  <button
                    onClick={() => setDenoise(0.16)}
                    className={`px-1.5 py-1 rounded text-[10px] font-mono border transition-all ${
                      denoise === 0.16
                        ? 'bg-indigo-500/20 border-indigo-400 text-white'
                        : 'bg-studio-surface border-studio-border text-zinc-400'
                    }`}
                  >
                    0.16 Деликатно
                  </button>
                  <button
                    onClick={() => setDenoise(0.22)}
                    className={`px-1.5 py-1 rounded text-[10px] font-mono border transition-all ${
                      denoise === 0.22
                        ? 'bg-indigo-500/20 border-indigo-400 text-white'
                        : 'bg-studio-surface border-studio-border text-zinc-400'
                    }`}
                  >
                    0.22 PBR баланс
                  </button>
                  <button
                    onClick={() => setDenoise(0.28)}
                    className={`px-1.5 py-1 rounded text-[10px] font-mono border transition-all ${
                      denoise === 0.28
                        ? 'bg-indigo-500/20 border-indigo-400 text-white'
                        : 'bg-studio-surface border-studio-border text-zinc-400'
                    }`}
                  >
                    0.28 Глубокий
                  </button>
                </div>
              </div>
            )}

            {/* Fallback Checkbox */}
            <div className="flex items-center space-x-2 pt-1 text-xs text-studio-textMuted">
              <input
                type="checkbox"
                id="allowFallback"
                checked={allowFallback}
                onChange={(e) => setAllowFallback(e.target.checked)}
                className="rounded border-studio-border accent-studio-cyan"
              />
              <label htmlFor="allowFallback" className="cursor-pointer text-[11px] select-none text-zinc-400">
                Переключать на быстрый режим при ошибке сервера
              </label>
            </div>

            {/* Action Button */}
            <button
              onClick={handleStartUpscale}
              disabled={isProcessing}
              className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-studio-cyan to-indigo-600 hover:from-studio-cyan/90 hover:to-indigo-500 text-white font-bold text-xs flex items-center justify-center space-x-2 shadow-lg shadow-studio-cyan/10 transition-all active:scale-[0.98] disabled:opacity-50"
            >
              {isProcessing ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin text-white" />
                  <span>Нейросетевая генерация {scaleFactor}x...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4 text-white" />
                  <span>Запустить AI-апскейл {scaleFactor}x ({targetWidth}×{targetHeight})</span>
                </>
              )}
            </button>

            {error && (
              <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-start space-x-2">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-400" />
                <span>{error}</span>
              </div>
            )}
          </div>

          {/* Preview / Comparison Column (7 cols) */}
          <div className="col-span-7 flex flex-col space-y-3">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-white">Интерактивное сравнение «До / После»:</span>
              <div className="flex items-center space-x-2">
                {result && (
                  <button
                    onClick={() => setIsLoupeActive(!isLoupeActive)}
                    className={`px-2 py-0.5 rounded text-[11px] font-medium border flex items-center space-x-1 transition-all ${
                      isLoupeActive
                        ? 'bg-studio-cyan/20 border-studio-cyan text-studio-cyan font-bold'
                        : 'bg-studio-surface border-studio-border text-zinc-400 hover:text-white'
                    }`}
                    title="Лупа 2.5x для осмотра микротекстур"
                  >
                    <ZoomIn className="w-3 h-3" />
                    <span>Лупа 2.5x</span>
                  </button>
                )}
                {result && (
                  <span className="font-mono text-emerald-400 text-[11px] bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                    Готово ({result.width}×{result.height}) за {(result.latencyMs / 1000).toFixed(1)}с
                  </span>
                )}
              </div>
            </div>

            {/* Viewport Box */}
            <div
              ref={viewportRef}
              onMouseMove={handleMouseMoveViewport}
              className="relative flex-1 min-h-[380px] bg-studio-bg rounded-xl border border-studio-border overflow-hidden flex items-center justify-center group"
            >
              {!currentImage ? (
                <div
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => {
                    e.preventDefault();
                    const file = e.dataTransfer.files[0];
                    if (file && file.type.startsWith('image/')) {
                      const reader = new FileReader();
                      reader.onload = () => {
                        const b64 = reader.result as string;
                        setCurrentImage(b64);
                        const img = new Image();
                        img.onload = () => {
                          setCurrWidth(img.naturalWidth || 1024);
                          setCurrHeight(img.naturalHeight || 768);
                        };
                        img.src = b64;
                      };
                      reader.readAsDataURL(file);
                    }
                  }}
                  className="flex flex-col items-center justify-center p-8 text-center space-y-3 cursor-pointer group"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <div className="w-16 h-16 rounded-2xl bg-studio-cyan/15 border border-studio-cyan/30 flex items-center justify-center text-studio-cyan group-hover:scale-110 transition-transform">
                    <Maximize2 className="w-8 h-8" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-white mb-1">Загрузите изображение для 4K AI-апскейла</h4>
                    <p className="text-xs text-zinc-400">Перетащите рендер сюда или нажмите кнопку ниже</p>
                  </div>
                  <button
                    type="button"
                    className="px-3.5 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs shadow-md transition-all"
                  >
                    Выбрать файл с диска
                  </button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleFileChange}
                  />
                </div>
              ) : result ? (
                <div className="relative w-full h-full select-none overflow-hidden">
                  {/* Before (Original) */}
                  <img
                    src={currentImage.startsWith('data:') ? currentImage : `data:${mimeType};base64,${currentImage}`}
                    alt="Original"
                    className="absolute inset-0 w-full h-full object-contain pointer-events-none"
                  />

                  {/* After (Upscaled with clip-path) */}
                  <div
                    className="absolute inset-0 overflow-hidden pointer-events-none"
                    style={{ clipPath: `inset(0 0 0 ${sliderPos}%)` }}
                  >
                    <img
                      src={`data:${result.mimeType};base64,${result.imageBase64}`}
                      alt="Upscaled"
                      className="absolute inset-0 w-full h-full object-contain pointer-events-none"
                    />
                  </div>

                  {/* Split divider line */}
                  <div
                    className="absolute top-0 bottom-0 w-0.5 bg-studio-cyan shadow-[0_0_12px_rgba(6,182,212,0.9)] pointer-events-none"
                    style={{ left: `${sliderPos}%` }}
                  >
                    <div className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-6 h-6 rounded-full bg-studio-cyan text-black flex items-center justify-center text-[10px] font-bold shadow-md">
                      ↔
                    </div>
                  </div>

                  {/* Transparent slider input */}
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={sliderPos}
                    onChange={(e) => setSliderPos(parseFloat(e.target.value))}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-ew-resize z-20"
                  />

                  {/* Loupe Lens */}
                  {isLoupeActive && (
                    <div
                      className="absolute w-40 h-40 rounded-full border-2 border-studio-cyan shadow-2xl overflow-hidden pointer-events-none z-30 bg-black"
                      style={{
                        left: `${loupePos.x - 80}px`,
                        top: `${loupePos.y - 80}px`,
                      }}
                    >
                      <img
                        src={
                          loupePos.relX < sliderPos
                            ? (currentImage.startsWith('data:') ? currentImage : `data:${mimeType};base64,${currentImage}`)
                            : `data:${result.mimeType};base64,${result.imageBase64}`
                        }
                        alt="Zoomed Detail"
                        className="absolute object-contain max-w-none"
                        style={{
                          width: `${(viewportRef.current?.offsetWidth || 600) * 2.5}px`,
                          height: `${(viewportRef.current?.offsetHeight || 400) * 2.5}px`,
                          left: `${-loupePos.x * 2.5 + 80}px`,
                          top: `${-loupePos.y * 2.5 + 80}px`,
                        }}
                      />
                    </div>
                  )}

                  {/* Labels */}
                  <div className="absolute bottom-3 left-3 bg-black/75 backdrop-blur-sm text-[10px] px-2 py-1 rounded text-zinc-300 pointer-events-none border border-white/10 font-mono">
                    До: {currWidth}×{currHeight}
                  </div>
                  <div className="absolute bottom-3 right-3 bg-studio-cyan text-black font-bold text-[10px] px-2 py-1 rounded pointer-events-none shadow-md font-mono">
                    AI 4K ({scaleFactor}x): {result.width}×{result.height}
                  </div>
                </div>
              ) : (
                <div className="relative w-full h-full flex flex-col items-center justify-center p-6 text-center">
                  <img
                    src={currentImage.startsWith('data:') ? currentImage : `data:${mimeType};base64,${currentImage}`}
                    alt="Original Preview"
                    className="max-h-[300px] w-auto object-contain rounded-lg shadow-md opacity-75"
                  />
                  <div className="absolute inset-0 bg-studio-bg/65 backdrop-blur-[2px] flex flex-col items-center justify-center p-4">
                    <Maximize2 className="w-10 h-10 text-studio-cyan/60 mb-2" />
                    <span className="text-xs font-semibold text-white">Выберите режим и нажмите «Запустить AI-апскейл»</span>
                    <span className="text-[11px] text-zinc-400 mt-1 max-w-sm">
                      Нейросеть 4x-UltraSharp реконструирует волокна дерева, мраморные венки и устраняет шум до {targetWidth} × {targetHeight}
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* Bottom Actions if Result is Available */}
            {result && (
              <div className="flex items-center justify-between pt-1">
                <span className="text-[11px] text-zinc-400 truncate max-w-[300px]">
                  {result.notes}
                </span>

                <div className="flex items-center space-x-2">
                  <button
                    onClick={handleDownload}
                    className="px-3 py-1.5 rounded-lg bg-studio-surfaceLight hover:bg-studio-border border border-studio-border text-white text-xs font-medium transition-all flex items-center space-x-1.5"
                  >
                    <Download className="w-3.5 h-3.5 text-studio-cyan" />
                    <span>Скачать PNG</span>
                  </button>

                  <button
                    onClick={handleApply}
                    className="px-4 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition-all flex items-center space-x-1.5 shadow-md shadow-emerald-600/20"
                  >
                    <Check className="w-3.5 h-3.5" />
                    <span>Применить к проекту</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
