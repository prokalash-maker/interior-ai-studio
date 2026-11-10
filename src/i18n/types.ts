export type Language = 'ru' | 'uk' | 'en';

export interface LanguageOption {
  code: Language;
  label: string;
  nativeLabel: string;
  flag: string;
}

export const LANGUAGES: LanguageOption[] = [
  { code: 'ru', label: 'Русский', nativeLabel: 'Русский', flag: '🇷🇺' },
  { code: 'uk', label: 'Украинский', nativeLabel: 'Українська', flag: '🇺🇦' },
  { code: 'en', label: 'English', nativeLabel: 'English', flag: '🇬🇧' },
];

export type TranslationKey = string;

export type Translations = Record<string, string>;
