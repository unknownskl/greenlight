import i18n from "i18next";
import { initReactI18next } from "react-i18next";

// Language used when no translation matches or when a translation is missing
const FALLBACK_LANGUAGE = "en-US";

// Import all JSON files from the languages directory
function importAllLanguages(): Record<string, { translation: any }> {
  const resources: Record<string, { translation: any }> = {};
  // @ts-ignore
  const context = require.context("../languages", false, /\.json$/);
  context.keys().forEach((key: string) => {
    // Get the file name without extension
    const langCode = key.replace("./", "").replace(".json", "");
    resources[langCode] = context(key);
  });
  return resources;
}

const resources = importAllLanguages();

let isInitStarted = false;

// Pick the language to display: the saved one when we have a translation for it,
// otherwise the first system language we have a translation for, otherwise English.
function resolveLanguage(preferred?: string): string {
  const available = Object.keys(resources);
  if (preferred && available.includes(preferred)) {
    return preferred;
  }

  const systemLanguages = typeof navigator !== "undefined" ? navigator.languages || [navigator.language] : [];
  for (const systemLanguage of systemLanguages) {
    const wanted = (systemLanguage || "").toLowerCase();
    const match = available.find((code) => code.toLowerCase() === wanted)
      || available.find((code) => code.toLowerCase().split("-")[0] === wanted.split("-")[0]);
    if (match) {
      return match;
    }
  }

  return FALLBACK_LANGUAGE;
}

// Function to initialize i18n with language from settings.
// The first call initializes i18next, later calls only switch the language.
export function initI18nWithLanguage(settings) {
  const language = resolveLanguage(settings?.language);

  if (isInitStarted) {
    if (i18n.language !== language) {
      console.log("[i18n] Changing language to:", language);
      i18n.changeLanguage(language);
    }
    return;
  }
  isInitStarted = true;

  console.log("[i18n] Initializing i18n with language:", language);
  i18n.use(initReactI18next).init({
    resources,
    lng: language,
    fallbackLng: FALLBACK_LANGUAGE,
    interpolation: {
      escapeValue: false,
    },
  }).then(() => {
    console.log("[i18n] i18n initialized. Current language:", i18n.language);
  }).catch((err) => {
    console.error("[i18n] i18n initialization error:", err);
  });
}

export default i18n;
