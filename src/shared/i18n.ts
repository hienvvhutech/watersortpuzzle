import en from '../../locales/en.json';
import vi from '../../locales/vi.json';

const translations: Record<string, any> = { en, vi };

export type LanguageCode = 'en' | 'vi';

/**
 * Translates a key based on the selected language, supporting interpolation and pluralization.
 * 
 * Examples:
 *   t('home.title', 'en') -> "WATER SORT"
 *   t('home.level', 'vi', { level: 5 }) -> "CẤP ĐỘ 5"
 */
export function t(key: string, lang: LanguageCode = 'en', params?: Record<string, any>): string {
  const keys = key.split('.');
  let current: any = translations[lang] || translations['en'];

  for (const k of keys) {
    if (current && typeof current === 'object') {
      current = current[k];
    } else {
      current = undefined;
      break;
    }
  }

  // Fallback to English if not found in the target language
  if (current === undefined && lang !== 'en') {
    current = translations['en'];
    for (const k of keys) {
      if (current && typeof current === 'object') {
        current = current[k];
      } else {
        current = undefined;
        break;
      }
    }
  }

  if (current === undefined) {
    return key;
  }

  // Handle Pluralization if a count parameter is provided and subkeys exist
  if (params && typeof params.count === 'number' && typeof current === 'object') {
    const isOne = params.count === 1;
    if (isOne && current.one !== undefined) {
      current = current.one;
    } else if (current.other !== undefined) {
      current = current.other;
    } else {
      // Return key if no matching plural keys
      return key;
    }
  }

  if (typeof current !== 'string') {
    return key;
  }

  // Handle Variable Interpolation
  let result = current;
  if (params) {
    Object.keys(params).forEach((paramKey) => {
      const value = params[paramKey];
      result = result.replace(new RegExp(`{{${paramKey}}}`, 'g'), String(value));
    });
  }

  return result;
}

/**
 * Custom React hook for i18n to automatically re-render components on language changes.
 */
import { useSettingsStore } from '../presentation/store/settingsStore';

export function useTranslation() {
  const language = useSettingsStore((state) => state.language) as LanguageCode;
  const setLanguage = useSettingsStore((state) => state.setLanguage);

  return {
    t: (key: string, params?: Record<string, any>) => t(key, language, params),
    language,
    setLanguage,
  };
}
