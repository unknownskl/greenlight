import React from 'react'
import { useTranslation } from 'react-i18next'
import Card from '../ui/card'
import Button from '../ui/button'
import { useSettings } from '../../context/userContext'
import { getLocalStatus, installLocal, isLocalInstalled, modelsFor, removeLocal, subscribeLocal, LocalStatus } from '../../lib/translator/local'
import { localMode } from '../../lib/translator/translate'

// What the models of one language pair weigh (MB, about)
const MODEL_MB = 35

/**
 * The local translator: models that run on the device (fast, offline, the text never leaves it). The player downloads
 * the models of the language pair that is set (about 35 MB each); other pairs go through English.
 */
function LocalTranslatorCard() {
    const { settings, setSettings } = useSettings()
    const { t } = useTranslation()

    const from = settings.translator_source_lang || 'en'
    const to = settings.translator_target_lang || 'uk'
    const needed = modelsFor(from, to)
    const mode = localMode(settings)

    const [status, setStatus] = React.useState<LocalStatus>(getLocalStatus())
    React.useEffect(() => {
        setStatus(getLocalStatus())
        return subscribeLocal(() => setStatus(getLocalStatus()))
    }, [])

    const ready = isLocalInstalled(from, to)
    const downloading = status.state === 'downloading'

    return (
        <Card>
            <h1>{t('translator.localTitle')}</h1>
            <p>{t('translator.localDescription')}</p>

            <p>
                <label>{t('translator.localModeLabel')}</label>
                <select value={mode} onChange={(e) => {
                    setSettings({ ...settings, translator_local_mode: e.target.value })
                }}>
                    <option value="smart">{t('translator.localModeSmart')}</option>
                    <option value="local">{t('translator.localModeLocal')}</option>
                    <option value="backup">{t('translator.localModeBackup')}</option>
                    <option value="off">{t('translator.localModeOff')}</option>
                </select>
                <small style={{ display: 'block', opacity: 0.7 }}>{t('translator.localModeHint_' + mode)}</small>
            </p>

            <p>
                <strong>{from} → {to}:</strong>{' '}
                { needed.length === 0
                    ? t('translator.localNoModel')
                    : (ready ? t('translator.localInstalled') : t('translator.localNotInstalled', { size: needed.length * MODEL_MB })) }
                { needed.length > 1 ? <small style={{ display: 'block', opacity: 0.7 }}>{t('translator.localPivot')}</small> : '' }
            </p>

            { downloading ? <p>
                <progress max={1} value={status.progress} style={{ width: '60%' }}></progress> {Math.round(status.progress * 100)}%
            </p> : '' }

            { status.state === 'error' ? <p style={{ color: 'orange' }}>{t('translator.localError', { message: status.message })}</p> : '' }

            { needed.length > 0 ? <p>
                { !ready ? <Button label={<span><i className="fa-solid fa-download"></i> {t('translator.localDownload')}</span>} className="btn-primary" onClick={() => {
                    if(!downloading){ installLocal(from, to).catch(() => { /* shown in the status */ }) }
                }}></Button> : '' }
                { status.installed.length > 0 ? <Button label={<span><i className="fa-solid fa-trash"></i> {t('translator.localRemove')}</span>} className="btn-cancel" onClick={() => {
                    if(!downloading){ void removeLocal() }
                }}></Button> : '' }
            </p> : '' }

            { status.installed.length > 0 ? <small style={{ display: 'block', opacity: 0.7 }}>{t('translator.localOnDevice', { models: status.installed.join(', ') })}</small> : '' }
            <p><small>{t('translator.localPrivacy')}</small></p>
        </Card>
    )
}

export default LocalTranslatorCard
