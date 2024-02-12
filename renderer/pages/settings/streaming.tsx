import React from 'react'
import Head from 'next/head'

import SettingsSidebar from '../../components/settings/sidebar'
import Card from '../../components/ui/card'
import Ipc from '../../lib/ipc'

import { useSettings } from '../../context/userContext'


function SettingsStreaming() {
    const { settings, setSettings} = useSettings()

    React.useEffect(() => {
    //
    })

    function setxCloudBitrate(e){
        console.log('Set xCloud bitrate to:', e.target.value)
        setSettings({
            ...settings,
            xcloud_bitrate: parseInt(e.target.value),
        })
    }

    function setxHomeBitrate(e){
        console.log('Set xHome bitrate to:', e.target.value)
        setSettings({
            ...settings,
            xhome_bitrate: parseInt(e.target.value),
        })
    }

    function setVideoProfile(profile){
        console.log('Set video profile to:', profile)
        setSettings({
            ...settings,
            video_profiles: (profile !== '') ? [profile] : [],
        })
    }

    // video_profiles ([])

    function setForceRegionIp(e){
        setSettings({
            ...settings,
            force_region_ip: e,
        })

        Ipc.send('app', 'setForceRegionIp', { ip: e }).then((res) => {
            console.log('Set force region IP:', res)
        })
    }

    return (
        <React.Fragment>
            <Head>
                <title>Greenlight - Settings: Streaming</title>
            </Head>

            <SettingsSidebar>
                <Card>
                    <h1>Stream settings</h1>

                    <p>
                xHome and xCloud does not support more then 20mbps by default. This setting does not override this limit.
                    </p>
                    <p>

                        <label>xCloud streaming bitrate</label>
                        <input type="range" min="0" max="40960" step="1024" value={settings.xcloud_bitrate} onChange={ setxCloudBitrate } />
                ({ settings.xcloud_bitrate === 0 ? 'Unlimited / Off' : Math.floor(settings.xcloud_bitrate / 1024) + ' mbps' })
                    </p>
                    <p>
                        <label>xHome streaming bitrate</label>
                        <input type="range" min="0" max="40960" step="1024" value={settings.xhome_bitrate} onChange={ setxHomeBitrate } />
                ({ settings.xhome_bitrate === 0 ? 'Unlimited / Off' : Math.floor(settings.xhome_bitrate / 1024) + ' mbps' })
                    </p>

                    <p>
                        <label>Set H264 Profile </label>
                        <select value={ (settings.video_profiles.length > 0) ? settings.video_profiles[0] : '' } onChange={ (e) => setVideoProfile(e.target.value) }>
                            <option value="">Auto-Negotiate</option>
                            <option value="4d">High</option>
                            <option value="42e">Medium</option>
                            <option value="420">Low</option>
                        </select>
                    </p>

                </Card>

                <Card>
                    <h1>Force region</h1>
                    <p>

                        <label>Set region:</label>
                        <select value={ settings.force_region_ip || '' } onChange={ (e) => setForceRegionIp(e.target.value) }>
                            <option value="">Disabled</option>
                            <option value="203.41.44.20">Australia</option>
                            <option value="200.221.11.101">Brazil</option>
                            <option value="194.25.0.68">Europe</option>
                            <option value="122.1.0.154">Japan</option>
                            <option value="203.253.64.1">Korea</option>
                            <option value="4.2.2.2">United States</option>
                        </select>
                    </p>
                </Card>
            </SettingsSidebar>
      

        </React.Fragment>
    )
}

export default SettingsStreaming
