import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import messages from './local/index';

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    // No hardcode lng — let LanguageDetector decide
    fallbackLng: 'es',
    supportedLngs: ['es', 'en'],
    debug: false,
    resources: messages,
    interpolation: {
      escapeValue: false,
    },
    detection: {
      // Order of detection: localStorage first (manual override), then browser language
      order: ['localStorage', 'navigator'],
      lookupLocalStorage: 'rankd_lang',
      caches: ['localStorage'],
    },
  });

export default i18n;
