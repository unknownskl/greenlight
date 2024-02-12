import React from 'react'
import { ipcRenderer } from 'electron'
import Head from 'next/head'
import Link from 'next/link'

import Header from '../components/header'
import Card from '../components/ui/card'

import { useSettings } from '../context/userContext'


function Debug() {
    const { settings, setSettings} = useSettings()

    // const [message, setMessage] = React.useState('no ipc message');

    // const onClickWithIpc = () => {
    //     ipcRenderer.send('ping-pong', 'some data from ipcRenderer');
    // };

    // const onClickWithIpcSync = () => {
    //     const message = ipcRenderer.sendSync('ping-pong-sync', 'some data from ipcRenderer');
    //     setMessage(message);
    // };
    
    React.useEffect(() => {
        // setSettings({
        //   ...settings,
        //   streamingMode: true,
        // })

        // console.log('debug settings:', settings)

        // ipcRenderer.send('stream', {
        //   type: 'start_stream',
        //   data: {
        //     type: 'home',
        //     serverId: 'F4000EEB7F3EF52A'
        //   }
        // })

        // ipcRenderer.on('ping-pong', (event, data) => {
        //     setMessage(data);
        // });
    
        // // cleanup this component
        // return () => {
        //     ipcRenderer.removeAllListeners('ping-pong');
        // };
    }, [])

    return (
        <React.Fragment>
            <Head>
                <title>Greenlight - Debug</title>
            </Head>

            <div style={{
                paddingTop: '20px',
            }}>

                <Card className='padbottom'>
                    <h1>Debug</h1>

                    <pre>{JSON.stringify(JSON.parse(JSON.stringify(settings)), null, 2) }</pre>
                </Card>

            </div>

        </React.Fragment>
    )
}

export default Debug
