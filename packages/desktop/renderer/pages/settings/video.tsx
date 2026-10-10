import React from 'react'
import Head from 'next/head'
import SettingsSidebar from '../../components/settings/sidebar'
import Card from '../../components/ui/card'
import Button from '../../components/ui/button'
import Ipc from '../../lib/ipc'
import { useSettings } from '../../context/userContext'
import { useTranslation } from 'react-i18next'


function SettingsVideo() {
    const { settings, setSettings} = useSettings()
    const { t } = useTranslation()

    const [micDevices, setMicDevices] = React.useState<MediaDeviceInfo[]>([])

    // The "default" and "communications" entries are aliases of a real device: the choice "System default" replaces them.
    function loadMicDevices() {
        return navigator.mediaDevices.enumerateDevices().then((devices) => {
            setMicDevices(devices.filter((device) => device.kind === 'audioinput' && device.deviceId !== 'default' && device.deviceId !== 'communications'))
        })
    }

    // The names of the devices are only shown once the microphone has been allowed, so the button asks for it first.
    function refreshMicDevices() {
        navigator.mediaDevices.getUserMedia({ audio: true }).then((stream) => {
            stream.getTracks().forEach((track) => track.stop())
        }).catch(() => { /* not allowed: the list keeps the numbered names */ }).then(loadMicDevices)
    }

    function setMicDevice(deviceId: string){
        setSettings({
            ...settings,
            mic_device_id: deviceId,
        })
    }

    React.useEffect(() => {
        loadMicDevices()
    }, [])

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
                        <label style={{ minWidth: 0 }}>
                            <input type='checkbox' onChange={ setVideoEnabled } checked={!settings.video_enabled} />&nbsp; ({ !settings.video_enabled ? t('settings.videoAudio.enabledLabel') : t('settings.videoAudio.disabledLabel')})
                        </label>
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
                        <label style={{ minWidth: 0 }}>
                            <input type='checkbox' onChange={ forceLowResolution } checked={settings.app_lowresolution} />&nbsp; ({ settings.app_lowresolution ? t('settings.videoAudio.enabledLabel') : t('settings.videoAudio.disabledLabel')})
                        </label><br />
                        <small>{t('settings.videoAudio.forceLowResDescription')}</small>
                    </p>
                </Card>

                <Card>
                    <h1>{t('settings.videoAudio.audioTitle')}</h1>

                    <p>
                        <label>{t('settings.videoAudio.disableAudioLabel')}</label>
                        <label style={{ minWidth: 0 }}>
                            <input type='checkbox' onChange={ setAudioEnabled } checked={!settings.audio_enabled} />&nbsp; ({ !settings.audio_enabled ? t('settings.videoAudio.enabledLabel') : t('settings.videoAudio.disabledLabel')})
                        </label>
                    </p>

                    <p>
                        <label>{t('settings.videoAudio.micLabel')}</label>
                        <select value={ settings.mic_device_id || '' } onChange={(e) => {
                            setMicDevice(e.target.value)
                        }}>
                            <option value=''>{t('settings.videoAudio.micDefault')}</option>
                            {(settings.mic_device_id && !micDevices.some((device) => device.deviceId === settings.mic_device_id)) ?
                                <option value={settings.mic_device_id}>{t('settings.videoAudio.micUnavailable')}</option> : ''}
                            {micDevices.map((device, i) => {
                                return <option key={device.deviceId} value={device.deviceId}>{device.label || (t('settings.videoAudio.micUnnamed') + ' ' + (i + 1))}</option>
                            })}
                        </select>
                        &nbsp;
                        <Button label={<span><i className="fa-solid fa-arrows-rotate"></i></span>} title={t('settings.videoAudio.micRefreshBtn')} className='btn-small' onClick={ refreshMicDevices } /><br />
                        <small>{t('settings.videoAudio.micDescription')}</small>
                    </p>
                </Card>
            </SettingsSidebar>


        </React.Fragment>
    )
}

export default SettingsVideo
