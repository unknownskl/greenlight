import { NextIntlClientProvider } from 'next-intl';
import { createContext, useContext, ReactNode, useState } from 'react';

interface I18nContextType {
  setLanguage: (locale: string) => void;
  language: string;
}

interface MessageFallbackParams {
  namespace?: string;
  key: string;
  error: unknown;
}

const I18nContext = createContext<I18nContextType | undefined>(undefined);

export function I18nProvider({ children }: { children: ReactNode }) {

  // @TODO: Set language to settings value
  const [language, setLanguage] = useState<string>('en');
  const translations = require('../languages/'+language+'.json');

  const getMessageFallback = ({ namespace, key, error}: MessageFallbackParams):string => {
    const fallbackTranslation = require('../languages/en.json');
    const messageKey = namespace ? `${namespace}.${key}` : key;
    // console.log(`Missing translation key for ${messageKey}:`, error);
    return namespace
      ? fallbackTranslation[namespace]?.[key] || `MISSING_TRANSLATION(${messageKey})`
      : fallbackTranslation[key] || `MISSING_TRANSLATION(${messageKey})`;
  }

  return (
    <I18nContext.Provider
      value={{
        language,
        setLanguage
      }}
    >
      <NextIntlClientProvider
            locale={language}
            timeZone="Europe/Amsterdam"
            messages={translations}
            getMessageFallback={getMessageFallback}
          >
        {children}
      </NextIntlClientProvider>

    </I18nContext.Provider>
  );
}

export function useI18n() {
  const context = useContext(I18nContext);
  if (context === undefined) {
    throw new Error('useI18n must be used within an I18nProvider');
  }
  return context;
}
