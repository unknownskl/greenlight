import React from "react";
import Card from "../../components/ui/card";
import { useTranslation } from "react-i18next";
import { useLanguage } from "../../context/languageContext";
import i18n from "../../lib/i18n";
import { useSettings } from "../../context/userContext";

// Language selector for settings page
const LanguageSelector: React.FC = () => {
  const { setLanguage } = useLanguage();
  const { t } = useTranslation();
  const { settings, setSettings } = useSettings();

  // Get the list of available languages and their names from i18n resources
  const resources = i18n.options.resources || {};
  const availableLanguages = Object.keys(resources);

  // Create an array of objects: { code, name }
  const languageOptions = availableLanguages.map((langCode) => {
    const translation = resources[langCode]?.translation;
    const langName = translation && typeof translation === "object" ? translation["languageName"] : langCode;
    return { code: langCode, name: langName };
  });

  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const lang = e.target.value;
    setLanguage(lang);
    i18n.changeLanguage(lang); // Apply language instantly
    setSettings({ ...settings, language: lang });
  };

  return (
    <Card>
      <div
        style={{ paddingBottom: 20, display: "flex", gap: 10, alignItems: "center", justifyContent: "space-between" }}
      >
        <label htmlFor="language-select">{t("settings.about.selectorSelectLanguage")}:</label>
        <select id="language-select" value={settings.language || i18n.language || ""} onChange={handleChange}>
          {languageOptions.map(({ code, name }) => (
            <option key={code} value={code}>
              {name}
            </option>
          ))}
        </select>
      </div>
    </Card>
  );
};

export default LanguageSelector;
