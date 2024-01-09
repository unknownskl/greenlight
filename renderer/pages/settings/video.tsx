import React from 'react';
import Head from 'next/head';

import SettingsSidebar from '../../components/settings/sidebar';
import Card from '../../components/ui/card';

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
          </Card>
      </SettingsSidebar>
      

    </React.Fragment>
  );
};

export default SettingsVideo;
