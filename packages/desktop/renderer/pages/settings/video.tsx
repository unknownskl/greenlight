import React from 'react'
import Head from 'next/head'
import SettingsSidebar from '../../components/settings/sidebar'
import Card from '../../components/ui/card'
import Button from '../../components/ui/button'
import Ipc from '../../lib/ipc'
import { useSettings } from '../../context/userContext'
import { defaultSettings } from '../../context/userContext.defaults'
import { useTranslation } from 'react-i18next'


function SettingsVideo() {
    const { settings, setSettings} = useSettings()
    const { t } = useTranslation()

    React.useEffect(() => {
    //
    })

    function setVideoSize(e){
        setSettings({
            ...settings,
            video_size: e,
        })
    }

    function forceLowResolution(){
        Ipc.send('settings', 'setLowResolution').then(() => {
            console.log('Resizing main window...')
            setSettings({
                ...settings,
                app_lowresolution: (!settings.app_lowresolution),
            })
        })
    }

    function setAudioEnabled(){
        setSettings({
            ...settings,
            audio_enabled: (!settings.audio_enabled),
        })
    }

    function setVideoEnabled(){
        setSettings({
            ...settings,
            video_enabled: (!settings.video_enabled),
        })
    }

    function resetDefaults(){
        if(!confirm(t('settings.common.resetDefaultsConfirm'))) return

        setSettings({
            ...settings,
            video_enabled: defaultSettings.video_enabled,
            audio_enabled: defaultSettings.audio_enabled,
            video_size: defaultSettings.video_size,
            app_lowresolution: defaultSettings.app_lowresolution,
        })
    }

    return (
        <React.Fragment>
            <Head>
                <title>Greenlight - {t('settings.videoAudio.pageTitle')}</title>
            </Head>

            <SettingsSidebar>
                <Card>
                    <h1>{t('settings.videoAudio.title')}</h1>

                    <p>
                        <label>{t('settings.videoAudio.disableVideoLabel')}</label>
                        <span style={{ minWidth: 0 }}>
                            <input type='checkbox' aria-label={t('settings.videoAudio.disableVideoLabel')} onChange={ setVideoEnabled } checked={!settings.video_enabled} />
                        </span>
                    </p>

                    <p>
                        <label>{t('settings.videoAudio.aspectSizeLabel')}</label>
                        <select value={ settings.video_size } onChange={(e) => {
                            setVideoSize(e.target.value)
                        }}>
                            <option value='default'>{t('settings.videoAudio.aspectSizeValueDefault')}</option>
                            <option value='stretch'>{t('settings.videoAudio.aspectSizeValueStretch')}</option>
                            <option value='zoom'>{t('settings.videoAudio.aspectSizeValueZoom')}</option>
                        </select>
                    </p>

                    <p>
                        <label>{t('settings.videoAudio.forceLowResLabel')}</label>
                        <span style={{ minWidth: 0 }}>
                            <input type='checkbox' aria-label={t('settings.videoAudio.forceLowResLabel')} onChange={ forceLowResolution } checked={settings.app_lowresolution} />
                        </span><br />
                        <small>{t('settings.videoAudio.forceLowResDescription')}</small>
                    </p>
                </Card>

                <Card>
                    <h1>{t('settings.videoAudio.audioTitle')}</h1>

                    <p>
                        <label>{t('settings.videoAudio.disableAudioLabel')}</label>
                        <span style={{ minWidth: 0 }}>
                            <input type='checkbox' aria-label={t('settings.videoAudio.disableAudioLabel')} onChange={ setAudioEnabled } checked={!settings.audio_enabled} />
                        </span>
                    </p>
                </Card>

                <p style={{ textAlign: 'right' }}>
                    <Button onClick={ resetDefaults } className='btn-small' label={ t('settings.common.resetDefaultsBtn') }></Button>
                </p>
            </SettingsSidebar>


        </React.Fragment>
    )
}

export default SettingsVideo
