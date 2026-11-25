import i18n from "i18next";
import { initReactI18next } from "react-i18next";

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

// Initialise once, when this module is first imported (from _app.tsx), so the instance is
// bound to React before the first render. Otherwise useTranslation() runs before init and
// react-i18next warns "You will need to pass in an i18next instance".
if (!i18n.isInitialized) {
  i18n.use(initReactI18next).init({
    resources,
    lng: "en-US",
    fallbackLng: "en-US",
    interpolation: {
      escapeValue: false,
    },
  }).catch((err) => {
    console.error("[i18n] i18n initialization error:", err);
  });
}

// Apply the language from settings. Safe to call repeatedly: it only switches language.
export function initI18nWithLanguage(settings) {
  const language = settings?.language || "en-US";
  if (i18n.language === language) return;
  console.log("[i18n] Switching language to:", language);
  i18n.changeLanguage(language).catch((err) => {
    console.error("[i18n] Unable to switch language:", err);
  });
}

export default i18n;
