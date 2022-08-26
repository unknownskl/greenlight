import React from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { ipcRenderer } from 'electron'

import Header from '../components/header'
import Button from '../components/ui/button'
import Card from '../components/ui/card'

// import { UserProvider } from '../context/userContext'
import { useUser } from '../context/userContext'

function Home() {
  const { consoles, setConsoles} = useUser()

  React.useEffect(() => {
    ipcRenderer.send('stream', {
      type: 'get_consoles'
    })

    ipcRenderer.on('stream', (event, args) => {
      if(args.type === 'error'){
        alert((args.data !== undefined) ? args.message+': '+JSON.stringify(args.data) : args.message)
      } else {
        console.log('got event response:', args)
        setConsoles(args.data)
      }
    })

    return () => {
      ipcRenderer.removeAllListeners('stream');
    };
  }, []);

  return (
    <React.Fragment>
      <Head>
        <title>Greenlight - My Consoles</title>
      </Head>

      <div style={ {
        display: 'flex',
        flexDirection: 'row',
        flexWrap: 'wrap',
        alignItems: 'stretch',
        paddingTop: '20px'
      }
      }>
        {consoles.map((item, i) => {               
           return (
            <Card className='padbottom' key={i}>
              <h1>{item.name}</h1>
              <h2 className='grey'>{item.id}</h2>

              <p>{item.powerState == 'On' ? 'Powered on' : item.powerState == 'ConnectedStandby' ? 'Standby' : item.powerState}</p>

              {/* <p>Name: {item.name}</p>
              <p>ID: {item.id}</p>
              <p>State: {item.powerState}</p>
              <p>Type: {item.consoleType}</p> */}
              {/* <p>Assistant: {item.digitalAssistantRemoteControlEnabled ? 'Enabled' : 'Disabled'}</p>
              <p>Remote: {item.remoteManagementEnabled ? 'Enabled' : 'Disabled'}</p>
              <p>Streaming: {item.consoleStreamingEnabled ? 'Enabled' : 'Disabled'}</p><br /> */}

              <div style={ { display: 'flex', gap: '20px' }}>
                <Link href={ `stream/${item.id}` }>
                  <Button label="Start stream" className='btn-primary' />
                </Link>
                <Link href={ `stream/${item.id}` }>
                  <Button label="Remote Control" />
                </Link>
              </div>
            </Card>
           ) 
        })}
      </div>

    </React.Fragment>
  );
};

export default Home;
