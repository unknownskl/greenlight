import i18n from "i18next";
import { initReactI18next } from "react-i18next";

// Language used when no language is set or when a translation is missing
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

// Function to initialize i18n with language from settings.
// The first call initializes i18next, later calls only switch the language.
export function initI18nWithLanguage(settings) {
  const language = settings?.language || FALLBACK_LANGUAGE;

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
