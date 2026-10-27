import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import LanguageDetector from 'i18next-browser-languagedetector'

import en from './locales/en.json'
import de from './locales/de.json'
import pl from './locales/pl.json'

export const LANGUAGES = [
    { code: 'en', label: 'English' },
    { code: 'de', label: 'Deutsch' },
    { code: 'pl', label: 'Polski' },
]

i18n
    .use(LanguageDetector)
    .use(initReactI18next)
    .init({
        resources: { en: { translation: en }, de: { translation: de }, pl: { translation: pl } },
        supportedLngs: ['en', 'de', 'pl'],
        nonExplicitSupportedLngs: true,
        fallbackLng: 'en',
        interpolation: { escapeValue: false },
        detection: {
            order: ['localStorage', 'navigator'],
            lookupLocalStorage: 'mts.lang',
            caches: ['localStorage'],
        },
    })

const syncHtmlLang = (lng) => {
    document.documentElement.lang = (lng || 'en').slice(0, 2)
}
syncHtmlLang(i18n.resolvedLanguage)
i18n.on('languageChanged', syncHtmlLang)

export default i18n
