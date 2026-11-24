import React from 'react'
import Head from 'next/head'
import SettingsSidebar from '../../components/settings/sidebar'
import Card from '../../components/ui/card'
import RegionEditor from '../../components/translator/regioneditor'
import { useSettings } from '../../context/userContext'
import Button from '../../components/ui/button'
import { Region, clampRegion, MAX_REGIONS, getRegions, regionsToSettings, constrainRegion, findFreeRegion, windowMode } from '../../lib/translator/geometry'
import usePadRegion from '../../lib/translator/usepadregion'
import { useTranslation } from 'react-i18next'
import { SOURCE_LANGUAGES } from '../../lib/translator/ocr'
import LocalTranslatorCard from '../../components/translator/localcard'

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
    // The rare switches are folded away
    const [advanced, setAdvanced] = React.useState(false)

    const regions = getRegions(settings)
    const [selected, setSelected] = React.useState(0)
    const selectedIndex = Math.min(selected, regions.length - 1)
    const selectedRef = React.useRef(selectedIndex)
    selectedRef.current = selectedIndex
    const saved = regions[selectedIndex]
    const others = regions.filter((_, i) => i !== selectedIndex)

    // While the window is placed with the gamepad the changes stay in a draft and are saved when done
    const [padEditing, setPadEditing] = React.useState(false)
    const [draft, setDraft] = React.useState<Region>(saved)
    const draftRef = React.useRef(draft)
    draftRef.current = draft
    const settingsRef = React.useRef(settings)
    settingsRef.current = settings

    const region = padEditing ? draft : saved

    const finishPadEditing = React.useCallback(() => {
        const list = getRegions(settingsRef.current)
        list[Math.min(selectedRef.current, list.length - 1)] = clampRegion(draftRef.current)
        setSettings({ ...settingsRef.current, ...regionsToSettings(list) })
        setPadEditing(false)
    }, [])

    const constrain = React.useCallback((next: Region, previous: Region) => {
        const list = getRegions(settingsRef.current)
        const index = Math.min(selectedRef.current, list.length - 1)
        return constrainRegion(next, previous, list.filter((_, i) => i !== index))
    }, [])

    usePadRegion(padEditing, () => draftRef.current, setDraft, finishPadEditing, { constrain })

    function startPadEditing() {
        setDraft(getRegions(settingsRef.current)[selectedRef.current])
        setPadEditing(true)
    }

    function update(values: object) {
        setSettings({ ...settings, ...values })
    }

    function setRegion(next: Region) {
        const list = regions.slice()
        list[selectedIndex] = constrainRegion(next, saved, others)
        update(regionsToSettings(list))
    }

    function addWindow() {
        const free = findFreeRegion(regions)
        if(free === null){
            return
        }

        update(regionsToSettings([...regions, free]))
        setSelected(regions.length)
    }

    function removeWindow() {
        if(regions.length <= 1){
            return
        }

        const list = regions.filter((_, i) => i !== selectedIndex)
        update(regionsToSettings(list))
        setSelected(Math.max(0, selectedIndex - 1))
    }

    function regionSlider(label: string, key: 'x' | 'y' | 'w' | 'h') {
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
                        <label>{t('translator.autoLabel')}</label>
                        <label style={{ minWidth: 0 }} className="toggle-label">
                            <input type='checkbox' checked={settings.translator_auto === true} onChange={(e) => {
                                update({ translator_auto: e.target.checked })
                            }} />
                        </label>
                        <small style={{ display: 'block', opacity: 0.7 }}>{t('translator.autoHint')}</small>
                    </p>

                    { settings.translator_auto === true ? <p>
                        <label>{t('translator.profileLabel')}</label>
                        <label style={{ minWidth: 0 }} className="toggle-label">
                            <input type='checkbox' checked={settings.translator_profile_on !== false} onChange={(e) => {
                                update({ translator_profile_on: e.target.checked })
                            }} />
                        </label>
                        {' '}<Button label={<span><i className="fa-solid fa-eraser"></i> {t('translator.profileForget')}</span>} className="btn-cancel" onClick={() => {
                            update({ translator_profiles: {} })
                        }}></Button>
                        <small style={{ display: 'block', opacity: 0.7 }}>{t('translator.profileHint')}</small>
                    </p> : '' }

                    { settings.translator_auto === true ? <p>
                        <Button label={<span><i className={advanced ? 'fa-solid fa-chevron-up' : 'fa-solid fa-chevron-down'}></i> {advanced ? t('translator.advancedHide') : t('translator.advancedShow')}</span>} onClick={() => {
                            setAdvanced(!advanced)
                        }}></Button>
                        <small style={{ display: 'block', opacity: 0.7 }}>{t('translator.advancedHint')}</small>
                    </p> : '' }

                    { (settings.translator_auto === true && advanced) ? <p>
                        <label>{t('translator.engineLabel')}</label>
                        <label style={{ minWidth: 0 }} className="toggle-label">
                            <input type='checkbox' checked={settings.translator_engine === 'elements'} onChange={(e) => {
                                update({ translator_engine: e.target.checked ? 'elements' : 'classic' })
                            }} />
                        </label>
                        <small style={{ display: 'block', opacity: 0.7 }}>{t('translator.engineHint')}</small>
                    </p> : '' }

                    { (settings.translator_auto === true && advanced) ? <p>
                        <label>{t('translator.menuAutoLabel')}</label>
                        <label style={{ minWidth: 0 }} className="toggle-label">
                            <input type='checkbox' checked={settings.translator_menu_auto !== false} onChange={(e) => {
                                update({ translator_menu_auto: e.target.checked })
                            }} />
                        </label>
                        <small style={{ display: 'block', opacity: 0.7 }}>{t('translator.menuAutoHint')}</small>
                    </p> : '' }

                    { (settings.translator_auto === true && advanced) ? <p>
                        <label>{t('translator.panelsLabel')}</label>
                        <label style={{ minWidth: 0 }} className="toggle-label">
                            <input type='checkbox' checked={settings.translator_panels !== false} onChange={(e) => {
                                update({ translator_panels: e.target.checked })
                            }} />
                        </label>
                        <small style={{ display: 'block', opacity: 0.7 }}>{t('translator.panelsHint')}</small>
                    </p> : '' }

                    { (settings.translator_auto === true && advanced) ? <p>
                        <label>{t('translator.fullscreenLabel')}</label>
                        <label style={{ minWidth: 0 }} className="toggle-label">
                            <input type='checkbox' checked={settings.translator_fullscreen === true} onChange={(e) => {
                                update({ translator_fullscreen: e.target.checked })
                            }} />
                        </label>
                        <small style={{ display: 'block', opacity: 0.7 }}>{t('translator.fullscreenHint')}</small>
                    </p> : '' }

                    { (settings.translator_auto === true && advanced) ? <p>
                        <label>{t('translator.autoDebugLabel')}</label>
                        <label style={{ minWidth: 0 }} className="toggle-label">
                            <input type='checkbox' checked={settings.translator_auto_debug === true} onChange={(e) => {
                                update({ translator_auto_debug: e.target.checked })
                            }} />
                        </label>
                        <small style={{ display: 'block', opacity: 0.7 }}>{t('translator.autoDebugHint')}</small>
                    </p> : '' }

                    <p>
                        <label>{t('translator.coverLabel')}</label>
                        <label style={{ minWidth: 0 }} className="toggle-label">
                            <input type='checkbox' checked={settings.translator_cover !== false} onChange={(e) => {
                                update({ translator_cover: e.target.checked })
                            }} />
                        </label>
                        <small style={{ display: 'block', opacity: 0.7 }}>{t('translator.coverHint')}</small>
                    </p>

                    <p>
                        <label>{t('translator.sourceLabel')}</label>
                        <select value={settings.translator_source_lang || 'en'} onChange={(e) => {
                            update({ translator_source_lang: e.target.value })
                        }}>
                            { Object.keys(SOURCE_LANGUAGES).map((code) => (
                                <option key={code} value={code}>{languageName(code, settings.language || 'en-US')}</option>
                            )) }
                        </select>
                        <small style={{ display: 'block', opacity: 0.7 }}>{t('translator.sourceHint')}</small>
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
                        <label>{t('translator.fontAutoLabel')}</label>
                        <label style={{ minWidth: 0 }} className="toggle-label">
                            <input type='checkbox' checked={settings.translator_font_auto !== false} onChange={(e) => {
                                update({ translator_font_auto: e.target.checked })
                            }} />
                        </label>
                    </p>

                    { settings.translator_font_auto === false ? <p>
                        <label>{t('translator.fontSizeLabel')}</label>
                        <input type="range" min={12} max={56} step={1} value={settings.translator_font_size || 26} onChange={(e) => {
                            update({ translator_font_size: parseInt(e.target.value) })
                        }} /> {settings.translator_font_size || 26}px
                    </p> : '' }

                    <p>
                        <label>{t('translator.opacityLabel')}</label>
                        <input type="range" min={30} max={100} step={5} value={Math.round(settings.translator_opacity * 100)} onChange={(e) => {
                            update({ translator_opacity: parseInt(e.target.value) / 100 })
                        }} /> {Math.round(settings.translator_opacity * 100)}%
                    </p>

                    <p><small>{t('translator.note')}</small></p>
                    <p><small><i className="fa-solid fa-gamepad"></i> {t('translator.padShortcuts')}</small></p>
                </Card>

                <LocalTranslatorCard />

                <Card>
                    <h1>{t('translator.regionTitle')}</h1>
                    <p>{t('translator.regionDescription')}</p>

                    <p>
                        { regions.map((_, index) => (
                            <Button key={index} label={t('translator.windowName', { n: index + 1 })} className={index === selectedIndex ? 'btn-primary' : ''} onClick={() => {
                                if(!padEditing){ setSelected(index) }
                            }}></Button>
                        )) }
                        { (regions.length < MAX_REGIONS && !padEditing) ? <Button label={<span><i className="fa-solid fa-plus"></i> {t('translator.addWindow')}</span>} onClick={addWindow}></Button> : '' }
                        { (regions.length > 1 && !padEditing) ? <Button label={<span><i className="fa-solid fa-trash"></i> {t('translator.removeWindow')}</span>} onClick={removeWindow}></Button> : '' }
                    </p>

                    { padEditing ? <p className="translator-pad-hint">{t('translator.padEditActive')}</p> : <p>
                        <Button label={<span><i className="fa-solid fa-gamepad"></i> {t('translator.padEditBtn')}</span>} className="btn-primary" onClick={startPadEditing}></Button>
                    </p> }

                    <p>
                        <label>{t('translator.windowEnabled')}</label>
                        <label style={{ minWidth: 0 }} className="toggle-label">
                            <input type='checkbox' checked={saved.enabled !== false} onChange={(e) => {
                                setRegion({ ...region, enabled: e.target.checked })
                            }} />
                        </label>
                    </p>

                    <p>
                        <label>{t('translator.windowType')}</label>
                        <select value={windowMode(saved, selectedIndex)} onChange={(e) => {
                            setRegion({ ...region, mode: e.target.value as any })
                        }}>
                            <option value="dialog">{t('translator.typeDialog')}</option>
                            <option value="task">{t('translator.typeTask')}</option>
                        </select>
                        <small style={{ display: 'block', opacity: 0.7 }}>{t('translator.typeHint')}</small>
                    </p>

                    <div className="translator-preview" data-gp-ignore>
                        { regions.map((frame, index) => index === selectedIndex ? null : (
                            <div key={index} className="region-frame region-frame-other" style={{
                                left: (frame.x * 100) + '%',
                                top: (frame.y * 100) + '%',
                                width: (frame.w * 100) + '%',
                                height: (frame.h * 100) + '%',
                            }} onPointerDown={() => { if(!padEditing){ setSelected(index) } }}>
                                <span>{index + 1}</span>
                            </div>
                        )) }
                        <RegionEditor region={region} onChange={padEditing ? setDraft : setRegion} constrain={padEditing ? constrain : undefined} className={padEditing ? 'pad-active' : ''}>
                            <span>{regions.length > 1 ? (selectedIndex + 1) + ' - ' : ''}{t('translator.previewText')}</span>
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
