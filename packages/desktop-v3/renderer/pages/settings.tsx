import React from 'react'
import Head from 'next/head'
import {useTranslations} from 'next-intl';
import { useI18n } from '../contexts/I18nContext';
import { useInput } from '../contexts/InputContext';

import Select from '../components/input/select';
import PageHeader from '../components/ui/pageheader';
import Content from '../components/ui/content';

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
      
        {/* Header */}
        <PageHeader title={t('title')} />

        <Content>

          <fieldset className="fieldset pb-8">
            <legend className="fieldset-legend">{t('language')}</legend>

            <label className="item" htmlFor="">
              <span className="label">{t('applicationLanguage')}</span>
              <span className="ml-auto inline-flex float-right items-center gap-2">
                <Select name="language" defaultValue={language} options={{'en': 'English', 'nl': 'Dutch'}} onChange={languageChangeDropdown} />
              </span>
            </label>
            
            <p className="label">{t('applicationLanguageDescription')}</p>
          </fieldset>

          <PageHeader title={t('title')} />

          {/* Debug Options */}

          <fieldset className="fieldset">
            <legend className="fieldset-legend">Debug Selects</legend>

            <label className="item" htmlFor="">
              <span className="label">Select Option (Array)</span>
              <span className="ml-auto inline-flex float-right items-center gap-2">
                <Select name="debug_option1" options={['option 1', 'option 2']} />
              </span>
            </label>

            <label className="item" htmlFor="">
              <span className="label">Select Option (Object)</span>
              <span className="ml-auto inline-flex float-right items-center gap-2">
                <Select name="debug_option2" options={{'option 1':'yes', 'option 2':'no'}} />
              </span>
            </label>
          </fieldset>

            <fieldset className="fieldset">
            <legend className="fieldset-legend">Debug Options</legend>

            <label className="item" htmlFor="">
              <span className="label">Enable Debug</span>
              <span className="ml-auto inline-flex float-right items-center gap-2">
                <Select name="debug_enabled" defaultValue="false" options={{'true': 'Enabled', 'false': 'Disabled'}} />
              </span>
            </label>
            
          </fieldset>

          <fieldset className="fieldset">
            <legend className="fieldset-legend">Input Info</legend>
            {/* <input type="text" className="input" placeholder="My awesome page" /> */}

            <label className="item">
              <span className="label">Input Method</span>
              <p>{inputMethod}</p>
            </label>

            <p className="label">{t('applicationLanguageDescription')}</p>
          </fieldset>

          {/* End Debug Options */}
        </Content>
    </React.Fragment>
  )
}
