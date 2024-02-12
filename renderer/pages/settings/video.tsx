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
      video_size: e
    })
  }

  function forceLowResolution(e){
    Ipc.send('app', 'setLowResolution').then(() => {
      console.log('Resizing main window...')
    })
  }

  return (
    <React.Fragment>
      <Head>
        <title>Greenlight - Settings: Video</title>
      </Head>

      <SettingsSidebar>
          <Card>
              <h1>Video</h1>

              <p>
                <label>Video aspect size</label>
                <select value={ settings.video_size } onChange={(e) => {setVideoSize(e.target.value)}}>
                    <option value='default'>Default</option>
                    <option value='stretch'>Stretch</option>
                    <option value='zoom'>Zoom</option>
                </select>
              </p>

              <p>
                <label>Force low resolution video</label>
                <label style={{ minWidth: 0 }}>
                    <input type='checkbox' onChange={ forceLowResolution } checked={settings.video_lowres} />&nbsp; ({ settings.video_lowres ? 'Enabled' : 'Disabled'})
                </label><br />
                <small>(This option is useful on the Steam Deck and enables the application to render in a low resolution so FSR can be enabled.)</small>
              </p>
          </Card>
      </SettingsSidebar>
      

    </React.Fragment>
  );
};

export default SettingsVideo;
