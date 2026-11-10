import React, { useState, useRef, useCallback, useEffect } from 'react';
import { Eye, SplitSquareVertical, Maximize2, Download, Copy, Check, Sparkles, Search, ZoomIn } from 'lucide-react';
import { useI18n } from '../i18n/i18nContext';

interface ImageComparisonSliderProps {
  sourceImage: string;
  generatedImage: string;
  sourceLabel?: string;
  generatedLabel?: string;
  onExport?: () => void;
  onCopy?: () => void;
  onFullscreen?: () => void;
  onUpscale?: () => void;
}

export const ImageComparisonSlider: React.FC<ImageComparisonSliderProps> = ({
  sourceImage,
  generatedImage,
  sourceLabel,
  generatedLabel,
  onExport,
  onCopy,
  onFullscreen,
  onUpscale,
}) => {
  const { t } = useI18n();
  const [sliderPosition, setSliderPosition] = useState<number>(50); // percentage 0..100
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [copied, setCopied] = useState<boolean>(false);
  const [isLoupeActive, setIsLoupeActive] = useState<boolean>(false);
  const [loupePos, setLoupePos] = useState<{ x: number; y: number; relX: number; relY: number }>({ x: 0, y: 0, relX: 50, relY: 50 });
  const containerRef = useRef<HTMLDivElement>(null);

  const displaySourceLabel = sourceLabel || t('studio.claySourceBadge');
  const displayGeneratedLabel = generatedLabel || t('studio.nanoBananaBadge');

  const handleMove = useCallback((clientX: number) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = clientX - rect.left;
    const clamped = Math.max(0, Math.min(rect.width, x));
    setSliderPosition((clamped / rect.width) * 100);
  }, []);

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleMouseMoveContainer = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const relX = (x / rect.width) * 100;
    const relY = (y / rect.height) * 100;
    setLoupePos({ x, y, relX, relY });

    if (isDragging) {
      handleMove(e.clientX);
    }
  };

  useEffect(() => {
    const handleMouseUp = () => setIsDragging(false);
    const handleGlobalMouseMove = (e: MouseEvent) => {
      if (isDragging) handleMove(e.clientX);
    };

    window.addEventListener('mouseup', handleMouseUp);
    window.addEventListener('mousemove', handleGlobalMouseMove);
    return () => {
      window.removeEventListener('mouseup', handleMouseUp);
      window.removeEventListener('mousemove', handleGlobalMouseMove);
    };
  }, [isDragging, handleMove]);

  const handleCopyClick = () => {
    if (onCopy) {
      onCopy();
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div
      ref={containerRef}
      onMouseMove={handleMouseMoveContainer}
      className="relative w-full h-full bg-studio-bg rounded-xl overflow-hidden select-none border border-studio-border flex items-center justify-center group"
    >
      {/* Background Layer: Generated Realistic Render */}
      <img
        src={generatedImage}
        alt="AI Visualization"
        className="absolute inset-0 w-full h-full object-contain pointer-events-none"
      />

      {/* Foreground Layer (Clipped with pure CSS): Original Archicad Clay Render */}
      <div
        className="absolute inset-0 overflow-hidden pointer-events-none"
        style={{ clipPath: `inset(0 ${100 - sliderPosition}% 0 0)` }}
      >
        <img
          src={sourceImage}
          alt="Clay Render"
          className="absolute inset-0 w-full h-full object-contain pointer-events-none"
        />
      </div>

      {/* Divider Line */}
      <div
        className="absolute top-0 bottom-0 w-0.5 bg-studio-cyan shadow-[0_0_12px_rgba(6,182,212,0.9)] cursor-ew-resize flex items-center justify-center z-20 transition-colors"
        style={{ left: `${sliderPosition}%`, transform: 'translateX(-50%)' }}
        onMouseDown={handleMouseDown}
      >
        {/* Drag handle pill */}
        <div className="w-7 h-7 rounded-full bg-studio-surface border-2 border-studio-cyan shadow-xl flex items-center justify-center text-studio-cyan text-xs font-bold hover:scale-110 transition-transform">
          ↔
        </div>
      </div>

      {/* Badges */}
      <div className="absolute top-3.5 left-3.5 z-10 pointer-events-none">
        <span className="bg-black/75 backdrop-blur-md text-white/90 text-[11px] px-2.5 py-1 rounded-md font-mono border border-white/10 shadow-lg">
          {displaySourceLabel}
        </span>
      </div>

      <div className="absolute top-3.5 right-3.5 z-10 pointer-events-none">
        <span className="bg-gradient-to-r from-indigo-600/90 to-studio-cyan/90 backdrop-blur-md text-white text-[11px] px-2.5 py-1 rounded-md font-mono border border-white/15 shadow-lg flex items-center space-x-1.5 font-semibold">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
          <span>{displayGeneratedLabel}</span>
        </span>
      </div>

      {/* Interactive Loupe (2.5x Magnifier Lens) */}
      {isLoupeActive && (
        <div
          className="absolute w-44 h-44 rounded-full border-2 border-studio-cyan shadow-2xl overflow-hidden pointer-events-none z-30 bg-black"
          style={{
            left: `${loupePos.x - 88}px`,
            top: `${loupePos.y - 88}px`,
          }}
        >
          <img
            src={loupePos.relX < sliderPosition ? sourceImage : generatedImage}
            alt="Magnified Detail"
            className="absolute object-contain max-w-none"
            style={{
              width: `${(containerRef.current?.offsetWidth || 800) * 2.5}px`,
              height: `${(containerRef.current?.offsetHeight || 600) * 2.5}px`,
              left: `${-loupePos.x * 2.5 + 88}px`,
              top: `${-loupePos.y * 2.5 + 88}px`,
            }}
          />
          <div className="absolute bottom-2 inset-x-0 text-center">
            <span className="bg-black/80 text-[9px] font-mono font-bold text-studio-cyan px-2 py-0.5 rounded-full border border-studio-cyan/40">
              {loupePos.relX < sliderPosition ? 'Archicad Clay' : 'AI Render PBR'} • 2.5x
            </span>
          </div>
        </div>
      )}

      {/* Floating Toolbar */}
      <div className="absolute bottom-3.5 right-3.5 z-30 flex items-center space-x-1.5 bg-studio-surface/90 backdrop-blur-md border border-studio-border p-1.5 rounded-xl shadow-2xl opacity-90 hover:opacity-100 transition-opacity">
        <button
          onClick={() => setIsLoupeActive(!isLoupeActive)}
          className={`p-1.5 rounded-lg text-xs font-medium flex items-center space-x-1 transition-all ${
            isLoupeActive
              ? 'bg-studio-cyan/20 border border-studio-cyan text-studio-cyan font-bold'
              : 'hover:bg-studio-surfaceHover text-studio-textMuted hover:text-white'
          }`}
          title="Лупа 2.5x: наведите на текстуры для детального осмотра"
        >
          <ZoomIn className="w-3.5 h-3.5" />
          <span className="text-[11px]">Лупа</span>
        </button>

        {onUpscale && (
          <button
            onClick={onUpscale}
            className="p-1.5 bg-gradient-to-r from-studio-cyan/20 to-indigo-600/20 hover:from-studio-cyan/30 hover:to-indigo-600/30 text-studio-cyan border border-studio-cyan/40 rounded-lg font-bold flex items-center space-x-1 px-2.5 text-xs shadow-sm transition-all active:scale-[0.98]"
            title="AI Апскейл до 2K / 4K Ultra-HD"
          >
            <Sparkles className="w-3.5 h-3.5 text-studio-cyan" />
            <span>4K Апскейл</span>
          </button>
        )}

        {onCopy && (
          <button
            onClick={handleCopyClick}
            className="p-1.5 hover:bg-studio-surfaceHover text-studio-textMuted hover:text-studio-text rounded-lg transition-colors"
            title={t('studio.copyToClipboard')}
          >
            {copied ? (
              <Check className="w-4 h-4 text-studio-success" />
            ) : (
              <Copy className="w-4 h-4" />
            )}
          </button>
        )}

        {onExport && (
          <button
            onClick={onExport}
            className="p-1.5 hover:bg-studio-surfaceHover text-studio-textMuted hover:text-studio-text rounded-lg transition-colors"
            title={t('studio.exportVisualization')}
          >
            <Download className="w-4 h-4" />
          </button>
        )}

        {onFullscreen && (
          <button
            onClick={onFullscreen}
            className="p-1.5 hover:bg-studio-surfaceHover text-studio-textMuted hover:text-studio-text rounded-lg transition-colors"
            title={t('studio.fullscreen')}
          >
            <Maximize2 className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  );
};
