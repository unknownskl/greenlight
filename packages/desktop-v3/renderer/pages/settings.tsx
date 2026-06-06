import React from 'react'
import Head from 'next/head'
import {useTranslations} from 'next-intl';
import { useAuth } from '../contexts/AuthContext';
import { useI18n } from '../contexts/I18nContext';

// import { useToast } from '../contexts/ToastContext'

export default function HomePage() {
  const t = useTranslations('Settings');
  const { language, setLanguage } = useI18n();


const { isAuthenticated, isAuthenticating, authState } = useAuth();

console.log('Authentication status in _app:', { isAuthenticated, isAuthenticating, authState });
//   const toast = useToast();

    const languageChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
        const selectedLanguage = event.target.value;
        console.log('Selected language:', selectedLanguage);
        setLanguage(selectedLanguage);
    }

  return (
    <React.Fragment>
      <Head>
        <title>{`Greenlight - ${t('title')}`}</title>
      </Head>
      <div className="p-6 md:p-8 max-w-5xl mx-auto">
        {/* Header */}
        <div className="mb-6 animate-fade-in-up">
          <h2 className="text-2xl font-bold text-white mb-1">{t('title')}</h2>
          {/* <p className="text-white/40 text-sm">0 titles in your collection</p> */}

          
          <fieldset className="fieldset">
            <legend className="fieldset-legend">Language</legend>
            {/* <input type="text" className="input" placeholder="My awesome page" /> */}

            <select value={language} className="select" onChange={languageChange}>
                <option value="en">EN</option>
                <option value="nl">NL</option>
            </select>

            <p className="label">This option will only change the application language and not the language in-game.</p>
          </fieldset>

          {/* <pre>{ JSON.stringify(authState, null, 2) }</pre> */}
        </div>
      </div>
    </React.Fragment>
  )
}
