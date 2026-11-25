import React from 'react'
import Head from 'next/head'
import SettingsSidebar from '../../components/settings/sidebar'
import Card from '../../components/ui/card'
import Ipc from '../../lib/ipc'
import { useSettings } from '../../context/userContext'
import { useTranslation } from 'react-i18next'
import { supportedCodecs } from '../../lib/videoCodec'


function SettingsVideo() {
    const { settings, setSettings} = useSettings()
    const { t } = useTranslation()
    // Codecs this device can receive (checked in the browser, so after mount)
    const [codecSupport, setCodecSupport] = React.useState({ auto: true, h265: true, av1: true, h264: true })
    React.useEffect(() => {
        setCodecSupport(supportedCodecs())
    }, [])

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
                        <label>{t('settings.videoAudio.streamResolutionLabel')}</label>
                        <select value={ settings.video_resolution } onChange={(e) => {
                            setSettings({
                                ...settings,
                                video_resolution: parseInt(e.target.value),
                            })
                        }}>
                            <option value={720}>720p</option>
                            <option value={1080}>1080p</option>
                            <option value={1440}>1440p ({t('settings.videoAudio.streamResolutionCloudOnly')})</option>
                        </select><br />
                        <small>{t('settings.videoAudio.streamResolutionDescription')}</small>
                    </p>

                    <p>
                        <label>{t('settings.videoAudio.codecLabel')}</label>
                        <select value={ settings.video_codec || 'auto' } onChange={(e) => {
                            setSettings({
                                ...settings,
                                video_codec: e.target.value,
                            })
                        }}>
                            <option value='auto'>{t('settings.videoAudio.codecValueAuto')}</option>
                            <option value='h265' disabled={!codecSupport.h265}>H.265 / HEVC ({codecSupport.h265 ? t('settings.videoAudio.codecExperimental') : t('settings.videoAudio.codecNotSupported')})</option>
                            <option value='av1' disabled={!codecSupport.av1}>AV1{codecSupport.av1 ? '' : ' (' + t('settings.videoAudio.codecNotSupported') + ')'}</option>
                            <option value='h264'>H.264</option>
                        </select><br />
                        <small>{t('settings.videoAudio.codecDescription')}</small>
                    </p>

                    <p>
                        <label>{t('settings.videoAudio.frameRateLabel')}</label>
                        <select value={ settings.video_framerate } onChange={(e) => {
                            setSettings({
                                ...settings,
                                video_framerate: parseInt(e.target.value),
                            })
                        }}>
                            <option value={0}>{t('settings.videoAudio.frameRateValueNoLimit')}</option>
                            <option value={30}>30 FPS</option>
                        </select><br />
                        <small>{t('settings.videoAudio.frameRateDescription')}</small>
                    </p>

                    <p>
                        <label>{t('settings.videoAudio.motionSmoothingLabel')}</label>
                        <label style={{ minWidth: 0 }}>
                            <input type='checkbox' onChange={() => {
                                setSettings({
                                    ...settings,
                                    video_motion_smoothing: !settings.video_motion_smoothing,
                                })
                            }} checked={settings.video_motion_smoothing} />&nbsp; ({ settings.video_motion_smoothing ? t('settings.videoAudio.enabledLabel') : t('settings.videoAudio.disabledLabel')})
                        </label><br />
                        <small>{t('settings.videoAudio.motionSmoothingDescription')}</small>
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
                </Card>
            </SettingsSidebar>


        </React.Fragment>
    )
}

export default SettingsVideo
