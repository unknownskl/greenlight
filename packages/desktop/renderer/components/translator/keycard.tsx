import React from 'react'
import { useTranslation } from 'react-i18next'
import Card from '../ui/card'
import Button from '../ui/button'
import Ipc from '../../lib/ipc'
import { useSettings } from '../../context/userContext'

interface KeyStatus {
    provider: string;
    state: string;
    retryAt: number | null;
    usedChars: number;
    limit: number;
    message: string;
}

interface Status {
    key: KeyStatus | null;
    lastProvider: string;
}

/**
 * The translation service of the player (optional): a key of DeepL or Google Cloud Translation. The free services stay
 * as the reserve: when the key does not work, or the plan is used up, translation goes on through them by itself.
 */
function TranslatorKeyCard() {
    const { settings, setSettings } = useSettings()
    const { t } = useTranslation()

    const provider = settings.translator_provider === 'deepl' || settings.translator_provider === 'google' ? settings.translator_provider : 'none'
    const secret = (settings.translator_key || '').trim()
    const limit = typeof settings.translator_key_limit === 'number' ? settings.translator_key_limit : 500000
    const active = provider !== 'none' && secret !== ''

    const [status, setStatus] = React.useState<Status | null>(null)
    const [testing, setTesting] = React.useState(false)
    const [testResult, setTestResult] = React.useState('')
    const [visible, setVisible] = React.useState(false)

    const settingsRef = React.useRef(settings)
    settingsRef.current = settings

    function update(values: object) {
        setSettings({ ...settingsRef.current, ...values })
        setTestResult('')
    }

    // How the key stands (it may change while this page is open: a test, or a request of a game)
    React.useEffect(() => {
        let stopped = false
        const load = () => {
            Ipc.send('app', 'translatorStatus', { provider, key: secret, limit }).then((result: any) => {
                if(!stopped){ setStatus(result) }
            }).catch(() => { /* the status is only information */ })
        }

        load()
        const timer = setInterval(load, 4000)
        return () => {
            stopped = true
            clearInterval(timer)
        }
    }, [provider, secret, limit])

    async function testKey() {
        setTesting(true)
        setTestResult('')
        try {
            const result: any = await Ipc.send('app', 'translatorTestKey', { provider, key: secret })
            setTestResult(result?.ok ? t('translator.keyTestOk', { sample: result.sample }) : t('translator.keyTestFailed_' + (result?.reason || 'temporary')))
        } catch(error) {
            setTestResult(t('translator.keyTestFailed_temporary'))
        }
        setTesting(false)
    }

    const key = status?.key ?? null
    const providerNames: Record<string, string> = {
        'deepl': 'DeepL',
        'google': 'Google Cloud',
        'free:google': t('translator.providerFreeGoogle'),
        'free:mymemory': 'MyMemory',
    }

    let stateText = ''
    if(active && key !== null){
        stateText = t('translator.keyState_' + key.state)
        if(key.state !== 'ok' && key.state !== 'invalid' && key.state !== 'limit' && typeof key.retryAt === 'number' && key.retryAt > 0){
            stateText += ' ' + t('translator.keyRetryAt', { time: new Date(key.retryAt).toLocaleTimeString() })
        }
    }

    return (
        <Card>
            <h1>{t('translator.keyTitle')}</h1>
            <p>{t('translator.keyDescription')}</p>

            <p>
                <label>{t('translator.keyProviderLabel')}</label>
                <select value={provider} onChange={(e) => {
                    update({ translator_provider: e.target.value })
                }}>
                    <option value="none">{t('translator.keyProviderNone')}</option>
                    <option value="deepl">DeepL (Free / Pro)</option>
                    <option value="google">Google Cloud Translation</option>
                </select>
            </p>

            { provider !== 'none' ? <React.Fragment>
                <p>
                    <label>{t('translator.keyLabel')}</label>
                    <input type={visible ? 'text' : 'password'} value={settings.translator_key || ''} autoComplete="off" spellCheck={false} onChange={(e) => {
                        update({ translator_key: e.target.value })
                    }} />
                    {' '}<Button label={<i className={visible ? 'fa-solid fa-eye-slash' : 'fa-solid fa-eye'}></i>} title={t('translator.keyShow')} onClick={() => setVisible(!visible)}></Button>
                    <small style={{ display: 'block', opacity: 0.7 }}>{provider === 'deepl' ? t('translator.keyHelpDeepl') : t('translator.keyHelpGoogle')}</small>
                </p>

                <p>
                    <label>{t('translator.keyLimitLabel')}</label>
                    <input type="number" min={0} step={10000} value={limit} onChange={(e) => {
                        update({ translator_key_limit: Math.max(0, parseInt(e.target.value) || 0) })
                    }} />
                    <small style={{ display: 'block', opacity: 0.7 }}>{t('translator.keyLimitHint')}</small>
                </p>

                <p>
                    <Button label={<span><i className="fa-solid fa-vial"></i> {testing ? t('translator.keyTesting') : t('translator.keyTest')}</span>} className="btn-primary" onClick={() => { if(!testing && active){ testKey() } }}></Button>
                    {' '}{testResult}
                </p>

                { active ? <p>
                    <strong>{t('translator.keyStateLabel')}:</strong> {stateText || '...'}
                    { key !== null && key.limit > 0 ? <small style={{ display: 'block', opacity: 0.7 }}>{t('translator.keyUsed', { used: key.usedChars.toLocaleString(), limit: key.limit.toLocaleString() })}</small> : '' }
                    { status !== null && status.lastProvider !== '' ? <small style={{ display: 'block', opacity: 0.7 }}>{t('translator.keyLastProvider', { name: providerNames[status.lastProvider] || status.lastProvider })}</small> : '' }
                </p> : '' }
            </React.Fragment> : '' }

            <p><small>{t('translator.keyPrivacy')}</small></p>
        </Card>
    )
}

export default TranslatorKeyCard
