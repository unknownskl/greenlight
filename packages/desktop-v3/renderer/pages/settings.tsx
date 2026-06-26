import React from 'react'
import Head from 'next/head'
import {useTranslations} from 'next-intl';
import { useI18n } from '../contexts/I18nContext';
import { useInput } from '../contexts/InputContext';

import Select from '../components/input/select';

// import { useToast } from '../contexts/ToastContext'

export default function HomePage() {
  const t = useTranslations('Settings');
  const { language, setLanguage } = useI18n();
  const { inputMethod } = useInput();

    const languageChangeDropdown = (value: string) => {
        console.log('Selected language:', value);
        setLanguage(value);
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

            <label className="item">
              <span className="label">Application Language</span>
              <span className="ml-auto inline-flex float-right items-center gap-2">
                <Select name="language" defaultValue={language} options={{'en': 'English', 'nl': 'Dutch'}} onChange={languageChangeDropdown} />
              </span>
            </label>
            
            <p className="label">This option will only change the application language and not the language in-game.</p>
          </fieldset>

          <fieldset className="fieldset">
            <legend className="fieldset-legend">Debug Selects</legend>

            <label className="item">
              <span className="label">Select Option (Array)</span>
              <span className="ml-auto inline-flex float-right items-center gap-2">
                <Select name="debug" options={['option 1', 'option 2']} />
              </span>
            </label>

            <label className="item">
              <span className="label">Select Option (Object)</span>
              <span className="ml-auto inline-flex float-right items-center gap-2">
                <Select name="debug2" options={{'option 1':'yes', 'option 2':'no'}} />
              </span>
            </label>
          </fieldset>

           <fieldset className="fieldset">
            <legend className="fieldset-legend">Debug Options</legend>

            <label className="item">
              <span className="label">Enable Debug</span>
              <span className="ml-auto inline-flex float-right items-center gap-2">
                <Select name="debug" defaultValue="false" options={{'true': 'Enabled', 'false': 'Disabled'}} />
              </span>
            </label>
            
            {/* <p className="label">This option will only change the application language and not the language in-game.</p> */}
          </fieldset>

          <fieldset className="fieldset">
            <legend className="fieldset-legend">Input Info</legend>
            {/* <input type="text" className="input" placeholder="My awesome page" /> */}

            <label className="item">
              <span className="label">Input Method</span>
              <p>{inputMethod}</p>
            </label>

            <p className="label">This option will only change the application language and not the language in-game.</p>
          </fieldset>

          {/* <pre>{ JSON.stringify(authState, null, 2) }</pre> */}
        </div>
      </div>
    </React.Fragment>
  )
}
