import React from 'react'
import Head from 'next/head'
import SettingsSidebar from '../../components/settings/sidebar'
import Card from '../../components/ui/card'
import RegionEditor from '../../components/translator/regioneditor'
import { useSettings } from '../../context/userContext'
import { Region, clampRegion } from '../../lib/translator/geometry'
import { useTranslation } from 'react-i18next'

// Languages the translation can be made into (codes of the translation service)
const TARGET_LANGUAGES = ['uk', 'ru', 'pl', 'de', 'es', 'fr', 'it', 'pt', 'tr', 'cs', 'nl', 'sv', 'ja', 'ko', 'zh-CN', 'ar', 'en']

function languageName(code: string, locale: string): string {
    try {
        const name = new Intl.DisplayNames([locale], { type: 'language' }).of(code) || code
        return name.charAt(0).toUpperCase() + name.slice(1)
    } catch(error) {
        return code
    }
}

function SettingsTranslator() {
    const { settings, setSettings } = useSettings()
    const { t } = useTranslation()

    const region = clampRegion(settings.translator_region)

    function update(values: object) {
        setSettings({ ...settings, ...values })
    }

    function setRegion(next: Region) {
        update({ translator_region: clampRegion(next) })
    }

    function regionSlider(label: string, key: keyof Region) {
        return (
            <p>
                <label>{label}</label>
                <input type="range" min={0} max={100} step={1} value={Math.round(region[key] * 100)} onChange={(e) => {
                    setRegion({ ...region, [key]: parseInt(e.target.value) / 100 })
                }} /> {Math.round(region[key] * 100)}%
            </p>
        )
    }

    return (
        <React.Fragment>
            <Head>
                <title>Greenlight - {t('translator.pageTitle')}</title>
            </Head>

            <SettingsSidebar>
                <Card>
                    <h1>{t('translator.title')}</h1>
                    <p>{t('translator.description')}</p>

                    <p>
                        <label>{t('translator.enableLabel')}</label>
                        <label style={{ minWidth: 0 }} className="toggle-label">
                            <input type='checkbox' checked={settings.translator_enabled === true} onChange={(e) => {
                                update({ translator_enabled: e.target.checked })
                            }} />
                        </label>
                    </p>

                    <p>
                        <label>{t('translator.targetLabel')}</label>
                        <select value={settings.translator_target_lang} onChange={(e) => {
                            update({ translator_target_lang: e.target.value })
                        }}>
                            { TARGET_LANGUAGES.map((code) => (
                                <option key={code} value={code}>{languageName(code, settings.language || 'en-US')}</option>
                            )) }
                        </select>
                    </p>

                    <p>
                        <label>{t('translator.colorLabel')}</label>
                        <select value={settings.translator_text_color} onChange={(e) => {
                            update({ translator_text_color: e.target.value })
                        }}>
                            <option value='light'>{t('translator.colorLight')}</option>
                            <option value='dark'>{t('translator.colorDark')}</option>
                            <option value='auto'>{t('translator.colorAuto')}</option>
                        </select>
                    </p>

                    <p>
                        <label>{t('translator.fontSizeLabel')}</label>
                        <input type="range" min={16} max={48} step={1} value={settings.translator_font_size} onChange={(e) => {
                            update({ translator_font_size: parseInt(e.target.value) })
                        }} /> {settings.translator_font_size}px
                    </p>

                    <p>
                        <label>{t('translator.opacityLabel')}</label>
                        <input type="range" min={30} max={100} step={5} value={Math.round(settings.translator_opacity * 100)} onChange={(e) => {
                            update({ translator_opacity: parseInt(e.target.value) / 100 })
                        }} /> {Math.round(settings.translator_opacity * 100)}%
                    </p>

                    <p><small>{t('translator.note')}</small></p>
                </Card>

                <Card>
                    <h1>{t('translator.regionTitle')}</h1>
                    <p>{t('translator.regionDescription')}</p>

                    <div className="translator-preview" data-gp-ignore>
                        <RegionEditor region={region} onChange={setRegion}>
                            <span>{t('translator.previewText')}</span>
                        </RegionEditor>
                    </div>

                    { regionSlider(t('translator.regionX'), 'x') }
                    { regionSlider(t('translator.regionY'), 'y') }
                    { regionSlider(t('translator.regionW'), 'w') }
                    { regionSlider(t('translator.regionH'), 'h') }
                </Card>
            </SettingsSidebar>
        </React.Fragment>
    )
}

export default SettingsTranslator
