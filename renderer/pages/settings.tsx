import React from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { ipcRenderer } from 'electron'

import { useSettings } from '../context/userContext'

import Card from '../components/ui/card'
import Button from '../components/ui/button'

function Settings() {
  const [gamertag, setGamertag] = React.useState('Loading...');
  const { settings, setSettings} = useSettings()

  React.useEffect(() => {
    ipcRenderer.send('auth', {
      type: 'get_user'
    })

    ipcRenderer.on('auth', (event, args) => {
      if(args.type === 'error'){
        alert((args.data !== undefined) ? args.message+': '+JSON.stringify(args.data) : args.message)

      } else if(args.type === 'user') {
        console.log('got event response:', args)
        setGamertag(args.gamertag)
      }
    })

    return () => {
      ipcRenderer.removeAllListeners('auth');
    };
  }, []);

  function confirmLogout() {
    if(confirm('Are you sure you want to logout?')){
      ipcRenderer.send('auth', {
        type: 'logout'
      })
    }
  }

  function setBitrate(e){
    console.log('Set bitrate to:', e.target.value)
    setSettings({
      ...settings,
      xhome_bitrate: e.target.value
    })
  }

  return (
    <React.Fragment>
      <Head>
        <title>Greenlight - Settings</title>
      </Head>
      <div style={{ paddingTop: '20px' }}>
        <Card className='padbottom'>
          <h1>Current user</h1>

          <p>
            Logged in as: {gamertag}
          </p>

          <Button label="Logout user" className="btn-small" onClick={ () => { confirmLogout() } }></Button>
        </Card>

        <Card className='padbottom'>
          <h1>xCloud</h1>

          <p>
            xCloud settings
          </p>
        </Card>

        <Card className='padbottom'>
          <h1>xHomestreaming</h1>

          <p>
            Bitrate: <select onChange={ setBitrate }>
              <option value="256">256 kbps</option>
              <option value="512">512 kbps</option>
              <option value="1024">1 mbps</option>
              <option value="2048">2 mbps</option>
              <option value="4096">4 mbps</option>
              <option value="8192">8 mbps</option>
              <option value="12288">12 mbps</option>
              <option value="16384">16 mbps</option>
              <option value="20480">20 mbps</option>
            </select>
          </p>
        </Card>

        <Card className='padbottom'>
          <h1>Gamepad</h1>

          <p>
            Gamepad settings
          </p>
        </Card>
      </div>
    </React.Fragment>
  );
};

export default Settings;
