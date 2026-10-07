import { app } from 'electron'
import i18n from 'i18next'

// Language used when no translation matches or when a translation is missing
const FALLBACK_LANGUAGE = 'en-US'

// Load the same language files as the renderer, so native dialogs are translated too
function importAllLanguages(): Record<string, { translation: any }> {
    const resources: Record<string, { translation: any }> = {}
    // @ts-ignore
    const context = require.context('../../renderer/languages', false, /\.json$/)
    context.keys().forEach((key: string) => {
        // Get the file name without extension
        const langCode = key.replace('./', '').replace('.json', '')
        resources[langCode] = context(key)
    })
    return resources
}

const resources = importAllLanguages()

let isInitialized = false

// Pick the language to use: the saved one when we have a translation for it,
// otherwise the system language when we have a translation for it, otherwise English.
function resolveLanguage(preferred?: string): string {
    const available = Object.keys(resources)
    if (preferred && available.includes(preferred)) {
        return preferred
    }

    const wanted = (app.getLocale() || '').toLowerCase()
    return available.find((code) => code.toLowerCase() === wanted)
        || available.find((code) => code.toLowerCase().split('-')[0] === wanted.split('-')[0])
        || FALLBACK_LANGUAGE
}

// Set the language used by the main process (dialogs, update notifications, errors).
// The first call initializes i18next, later calls only switch the language.
// Call this after the app 'ready' event, as it reads the system locale.
export function setMainLanguage(language?: string) {
    const resolved = resolveLanguage(language)

    if (isInitialized) {
        if (i18n.language !== resolved) {
            i18n.changeLanguage(resolved)
        }
        return
    }
    isInitialized = true

    i18n.init({
        resources,
        lng: resolved,
        fallbackLng: FALLBACK_LANGUAGE,
        interpolation: {
            escapeValue: false,
        },
    })
}
