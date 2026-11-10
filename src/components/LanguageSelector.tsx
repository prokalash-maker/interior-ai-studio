import React, { useState, useRef, useEffect } from 'react';
import { useI18n } from '../i18n/i18nContext';
import { Globe, ChevronDown } from 'lucide-react';

interface LanguageSelectorProps {
  variant?: 'compact' | 'full';
}

export const LanguageSelector: React.FC<LanguageSelectorProps> = ({ variant = 'compact' }) => {
  const { language, setLanguage, languages, currentLangMeta } = useI18n();
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="relative inline-block text-left" ref={containerRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center space-x-1.5 px-2 py-1 rounded bg-studio-surfaceHover hover:bg-studio-border text-studio-text border border-studio-border/60 text-[11px] font-medium transition-colors"
        title="Зміна мови / Change Language / Смена языка"
      >
        <span className="text-xs">{currentLangMeta.flag}</span>
        <span className="uppercase font-mono">{currentLangMeta.code}</span>
        <ChevronDown className="w-3 h-3 text-studio-textSubtle" />
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-1.5 w-36 rounded-xl bg-studio-surface border border-studio-border shadow-2xl py-1 z-50 animate-in fade-in zoom-in-95 duration-100">
          {languages.map((l) => {
            const isSelected = l.code === language;
            return (
              <button
                key={l.code}
                onClick={() => {
                  setLanguage(l.code);
                  setIsOpen(false);
                }}
                className={`w-full text-left px-3 py-1.5 text-xs flex items-center justify-between transition-colors ${
                  isSelected
                    ? 'bg-indigo-600/20 text-indigo-300 font-medium'
                    : 'text-studio-textMuted hover:bg-studio-surfaceHover hover:text-white'
                }`}
              >
                <div className="flex items-center space-x-2">
                  <span>{l.flag}</span>
                  <span>{l.nativeLabel}</span>
                </div>
                {isSelected && <span className="text-indigo-400 text-xs">✓</span>}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};
