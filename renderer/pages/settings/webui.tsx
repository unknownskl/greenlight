import React from 'react'
import Head from 'next/head'
import SettingsSidebar from '../../components/settings/sidebar'
import Card from '../../components/ui/card'
import Button from '../../components/ui/button'
import Ipc from '../../lib/ipc'
import { useSettings } from '../../context/userContext'


function SettingsWebUI() {
    const { settings, setSettings} = useSettings()
    const [webuiRunning, setWebuiRunning] = React.useState(false)

  React.useEffect(() => {
    const webuiStatusInterval = setInterval(() => {
      Ipc.send('app', 'getWebUIStatus').then((status) => {
        setWebuiRunning(status)
      })
    }, 1000)

    Ipc.send('app', 'getWebUIStatus').then((status) => {
      setWebuiRunning(status)
    })

    return () => {
      clearInterval(webuiStatusInterval)
    }
  })

  function setWebUIEnabled(){
    Ipc.send('app', (webuiRunning) ? 'stopWebUI' : 'startWebUI').then((status) => {
      setWebuiRunning(status)
    })
  }

  function setWebUIAutostart(e){
    setSettings({
      ...settings,
      webui_autostart: (! settings.webui_autostart)
    })
  }

  function setWebUIPort(e){
    console.log('change port:', e.target.value)
    // setSettings({
    //   ...settings,
    //   webui_port: e
    // })
  }

  return (
    <React.Fragment>
      <Head>
        <title>Greenlight - Settings: Web UI</title>
      </Head>

      <SettingsSidebar>
          <Card>
              <h1>WebUI</h1>

              <p>
                <label>Enable WebUI</label>
                <label style={{ minWidth: 0 }}>
                    {/* <input type='checkbox' onChange={ setWebUIEnabled } checked={(settings.webui_enabled || settings.webui_autostart) ? true : false} disabled={settings.webui_autostart} />&nbsp; ({ settings.webui_enabled ? 'Enabled' : 'Disabled'}) */}
                    <Button onClick={ () => setWebUIEnabled() } disabled={ window.Greenlight.isWebUI() } className={ ((webuiRunning) ? 'btn-primary' : 'btn-cancel') + ' btn-small' } label={ webuiRunning ? 'Stop Web UI' : 'Start Web UI' }></Button>
                </label>
              </p>

              <p>
                <label>Start WebUI on application start</label>
                <label style={{ minWidth: 0 }}>
                    <input type='checkbox' onChange={ setWebUIAutostart } checked={settings.webui_autostart} />&nbsp; ({ settings.webui_autostart ? 'Enabled' : 'Disabled'})
                </label>
              </p>

              <p>
                <label>Port</label>
                <label style={{ minWidth: 0 }}>
                  <input type="text" onChange={ setWebUIPort} className="text" placeholder="example: 9003" value={ settings.webui_port || 9003 } />
                </label>
              </p>
          </Card>
      </SettingsSidebar>
      

    </React.Fragment>
  );
};

export default SettingsWebUI;
