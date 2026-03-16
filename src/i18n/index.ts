import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

import en from './locales/en.json';
import hi from './locales/hi.json';

const LANG_KEY = 'japa_lang';

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      en: { translation: en },
      hi: { translation: hi },
    },
    fallbackLng: 'en',
    supportedLngs: ['en', 'hi'],
    detection: {
      order: ['localStorage'],
      lookupLocalStorage: LANG_KEY,
      caches: ['localStorage'],
    },
    interpolation: {
      escapeValue: false,
    },
  });

export const SUPPORTED_LANGUAGES = [
  { code: 'en', label: 'EN', nativeLabel: 'EN' },
  { code: 'hi', label: 'हिं', nativeLabel: 'हिंदी' },
];

export { LANG_KEY };
export default i18n;
