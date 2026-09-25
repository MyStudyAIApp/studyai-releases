import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import LanguageDetector from 'i18next-browser-languagedetector'

import es from './locales/es.json'
import en from './locales/en.json'
import de from './locales/de.json'
import fr from './locales/fr.json'

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: { es: { translation: es }, en: { translation: en }, de: { translation: de }, fr: { translation: fr } },
    // Idioma del móvil que no tenemos (polaco, italiano...) -> inglés, que es
    // lo que más gente entiende; antes caía al español. Las lenguas de España
    // van al español, no al inglés (ver convertDetectedLanguage).
    fallbackLng: 'en',
    supportedLngs: ['es', 'en', 'de', 'fr'],
    detection: {
      order: ['localStorage', 'navigator'],
      convertDetectedLanguage: (l) => (/^(ca|gl|eu|ast)(-|$)/i.test(l) ? 'es' : l),
      caches: ['localStorage'],
      lookupLocalStorage: 'studyai_lang',
    },
    interpolation: { escapeValue: false },
  })

export default i18n
export const SUPPORTED_LANGS = [
  { code: 'es', label: 'Español', flag: '🇪🇸' },
  { code: 'en', label: 'English', flag: '🇬🇧' },
  { code: 'de', label: 'Deutsch', flag: '🇩🇪' },
  { code: 'fr', label: 'Français', flag: '🇫🇷' },
]
