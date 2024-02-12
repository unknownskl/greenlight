import React from 'react'
import Head from 'next/head'
import SettingsSidebar from '../../components/settings/sidebar'
import Card from '../../components/ui/card'
import Ipc from '../../lib/ipc'
import { useSettings } from '../../context/userContext'


function SettingsVideo() {
    const { settings, setSettings} = useSettings()

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
                <title>Greenlight - Settings: Video & Audio</title>
            </Head>

            <SettingsSidebar>
                <Card>
                    <h1>Video</h1>

                    <p>
                        <label>Disable video</label>
                        <label style={{ minWidth: 0 }}>
                            <input type='checkbox' onChange={ setVideoEnabled } checked={!settings.video_enabled} />&nbsp; ({ !settings.video_enabled ? 'Enabled' : 'Disabled'})
                        </label>
                    </p>

                    <p>
                        <label>Video aspect size</label>
                        <select value={ settings.video_size } onChange={(e) => {
                            setVideoSize(e.target.value)
                        }}>
                            <option value='default'>Default</option>
                            <option value='stretch'>Stretch</option>
                            <option value='zoom'>Zoom</option>
                        </select>
                    </p>

                    <p>
                        <label>Force low resolution video</label>
                        <label style={{ minWidth: 0 }}>
                            <input type='checkbox' onChange={ forceLowResolution } checked={settings.app_lowresolution} />&nbsp; ({ settings.app_lowresolution ? 'Enabled' : 'Disabled'})
                        </label><br />
                        <small>(This option is useful on the Steam Deck and enables the application to render in a low resolution so FSR can be enabled.)</small>
                    </p>
                </Card>

                <Card>
                    <h1>Audio</h1>

                    <p>
                        <label>Disable audio</label>
                        <label style={{ minWidth: 0 }}>
                            <input type='checkbox' onChange={ setAudioEnabled } checked={!settings.audio_enabled} />&nbsp; ({ !settings.audio_enabled ? 'Enabled' : 'Disabled'})
                        </label>
                    </p>
                </Card>
            </SettingsSidebar>
      

        </React.Fragment>
    )
}

export default SettingsVideo
