import React from 'react'
import Head from 'next/head'
import SettingsSidebar from '../../components/settings/sidebar'
import Card from '../../components/ui/card'
import Button from '../../components/ui/button'
import Ipc from '../../lib/ipc'
import { useSettings } from '../../context/userContext'
import { defaultSettings } from '../../context/userContext.defaults'
import { useTranslation } from 'react-i18next'


function SettingsWebUI() {
    const { settings, setSettings} = useSettings()
    const [webuiRunning, setWebuiRunning] = React.useState(false)
    const [portInput, setPortInput] = React.useState(settings.webui_port || 9003)
    const [portError, setPortError] = React.useState(false)
    const [saved, setSaved] = React.useState(false)
    const { t } = useTranslation()

    React.useEffect(() => {
        const webuiStatusInterval = setInterval(() => {
            Ipc.send('settings', 'getWebUIStatus').then((status) => {
                setWebuiRunning(status)
            })
        }, 1000)

        Ipc.send('settings', 'getWebUIStatus').then((status) => {
            setWebuiRunning(status)
        })

        return () => {
            clearInterval(webuiStatusInterval)
        }
    })

    function setWebUIEnabled(){
        Ipc.send('settings', (webuiRunning) ? 'stopWebUI' : 'startWebUI').then((status) => {
            setWebuiRunning(status)
        })
    }

    function setWebUIAutostart(){
        setSettings({
            ...settings,
            webui_autostart: (! settings.webui_autostart),
        })
    }

    function setWebUIPort(e){
        const raw = e.target.value
        setPortInput(raw)

        const port = Number.parseInt(raw, 10)
        if(Number.isNaN(port) || port < 1024 || port > 65535){
            setPortError(true)
            return
        }

        setPortError(false)
        setSettings({
            ...settings,
            webui_port: port,
        })
        setSaved(true)
        setTimeout(() => setSaved(false), 2000)
    }

    function resetDefaults(){
        if(!confirm(t('settings.common.resetDefaultsConfirm'))) return

        setPortInput(defaultSettings.webui_port)
        setPortError(false)
        setSettings({
            ...settings,
            webui_autostart: defaultSettings.webui_autostart,
            webui_port: defaultSettings.webui_port,
        })
    }

    return (
        <React.Fragment>
            <Head>
                <title>Greenlight - {t('settings.webUI.pageTitle')}</title>
            </Head>

            <SettingsSidebar>
                <Card>
                    <h1>{t('settings.webUI.title')}</h1>

                    <p>
                        <label>{t('settings.webUI.enableWebUILabel')}</label>
                        <label style={{ minWidth: 0 }}>
                            <Button onClick={ () => setWebUIEnabled() } disabled={ window.Greenlight.isWebUI() } className={ ((webuiRunning) ? 'btn-cancel' : 'btn-primary') + ' btn-small' } label={ webuiRunning ? t('settings.webUI.stopWebUIBtn') : t('settings.webUI.startWebUIBtn') }></Button> &nbsp;
                            <Button onClick={ () => window.Greenlight.openExternal('http://127.0.0.1:'+settings.webui_port) } className={ 'btn-small' } label={ t('settings.webUI.openWebUIBtn') }></Button>
                        </label>
                    </p>

                    <p>
                        <label>{t('settings.webUI.autostartLabel')}</label>
                        <span style={{ minWidth: 0 }}>
                            <input type='checkbox' aria-label={t('settings.webUI.autostartLabel')} onChange={ setWebUIAutostart } checked={settings.webui_autostart} />
                        </span>
                    </p>

                    <p>
                        <label>{t('settings.webUI.portLabel')}</label>
                        <label style={{ minWidth: 0 }}>
                            <input type="number" min="1024" max="65535" onChange={ setWebUIPort } className="text" placeholder={t('settings.webUI.portPlaceholder')} value={ portInput } />
                        </label>
                        { portError && <small style={{ color: 'orange' }}>{t('settings.webUI.portInvalid')}</small> }
                        { !portError && saved && <small style={{ color: '#5bd75b' }}>{t('settings.common.savedNotice')}</small> }
                    </p>
                </Card>

                <p style={{ textAlign: 'right' }}>
                    <Button onClick={ resetDefaults } className='btn-small' label={ t('settings.common.resetDefaultsBtn') }></Button>
                </p>
            </SettingsSidebar>


        </React.Fragment>
    )
}

export default SettingsWebUI
