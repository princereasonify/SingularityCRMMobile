/**
 * Lightweight i18n — no external dependencies.
 * Supports 'en' (English) and 'hi' (Hindi).
 * Language is persisted in AsyncStorage and loaded via LanguageContext.
 */

import { en } from './en';
import { hi } from './hi';

export type Language = 'en' | 'hi';

export type TranslationNamespace = keyof typeof en;

const translations: Record<Language, typeof en> = { en, hi };

let _currentLang: Language = 'en';

export function setLanguage(lang: Language) {
  _currentLang = lang;
}

export function getLanguage(): Language {
  return _currentLang;
}

/**
 * t('schools.title') → "Schools" or "स्कूल"
 */
export function t(key: string, lang?: Language): string {
  const l = lang ?? _currentLang;
  const parts = key.split('.');
  let node: any = translations[l] ?? translations.en;
  for (const part of parts) {
    if (node == null) break;
    node = node[part];
  }
  if (typeof node === 'string') return node;
  // Fallback to English
  let fallback: any = translations.en;
  for (const part of parts) {
    if (fallback == null) break;
    fallback = fallback[part];
  }
  return typeof fallback === 'string' ? fallback : key;
}

export { en, hi };
