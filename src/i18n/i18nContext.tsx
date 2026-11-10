import React, { createContext, useContext, useState, useEffect } from 'react';
import { Language, LANGUAGES, LanguageOption } from './types';
import { ru } from './locales/ru';
import { uk } from './locales/uk';
import { en } from './locales/en';

const dictionaries: Record<Language, Record<string, string>> = {
  ru,
  uk,
  en,
};

interface I18nContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: string, params?: Record<string, string | number>) => string;
  languages: LanguageOption[];
  currentLangMeta: LanguageOption;
}

const I18nContext = createContext<I18nContextType | null>(null);

export const I18nProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [language, setLanguageState] = useState<Language>(() => {
    const saved = localStorage.getItem('interior_ai_lang') as Language;
    if (saved && (saved === 'ru' || saved === 'uk' || saved === 'en')) {
      return saved;
    }
    // Check system language
    const navLang = navigator.language.toLowerCase();
    if (navLang.startsWith('uk')) return 'uk';
    if (navLang.startsWith('ru')) return 'ru';
    return 'en';
  });

  const setLanguage = (lang: Language) => {
    setLanguageState(lang);
    localStorage.setItem('interior_ai_lang', lang);
  };

  const t = (key: string, params?: Record<string, string | number>): string => {
    const dict = dictionaries[language] || dictionaries.ru;
    let translation = dict[key] || dictionaries.ru[key] || dictionaries.en[key] || key;

    if (params) {
      Object.entries(params).forEach(([paramKey, paramVal]) => {
        translation = translation.replace(new RegExp(`\\{${paramKey}\\}`, 'g'), String(paramVal));
      });
    }

    return translation;
  };

  const currentLangMeta = LANGUAGES.find((l) => l.code === language) || LANGUAGES[0];

  return (
    <I18nContext.Provider
      value={{
        language,
        setLanguage,
        t,
        languages: LANGUAGES,
        currentLangMeta,
      }}
    >
      {children}
    </I18nContext.Provider>
  );
};

export const useI18n = (): I18nContextType => {
  const context = useContext(I18nContext);
  if (!context) {
    throw new Error('useI18n must be used within an I18nProvider');
  }
  return context;
};
