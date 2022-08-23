import React from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { ipcRenderer } from 'electron'

import Card from '../components/ui/card'
import Button from '../components/ui/button'

function Settings() {
  const [gamertag, setGamertag] = React.useState('Loading...');


  React.useEffect(() => {
    ipcRenderer.send('auth', {
      type: 'init'
    })

    ipcRenderer.on('auth', (event, args) => {
      if(args.type === 'error'){
        alert((args.data !== undefined) ? args.message+': '+JSON.stringify(args.data) : args.message)
      } else {
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

  return (
    <React.Fragment>
        <div>
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
                  xHomestreaming settings
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
