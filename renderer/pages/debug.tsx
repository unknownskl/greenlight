import React from 'react';
import { ipcRenderer } from 'electron'
import Head from 'next/head';
import Link from 'next/link';

import Header from '../components/header'

function Debug() {
    const [message, setMessage] = React.useState('no ipc message');

    const onClickWithIpc = () => {
        ipcRenderer.send('ping-pong', 'some data from ipcRenderer');
    };

    const onClickWithIpcSync = () => {
        const message = ipcRenderer.sendSync('ping-pong-sync', 'some data from ipcRenderer');
        setMessage(message);
    };
    
    React.useEffect(() => {
        ipcRenderer.on('ping-pong', (event, data) => {
            setMessage(data);
        });
    
        // cleanup this component
        return () => {
            ipcRenderer.removeAllListeners('ping-pong');
        };
    }, []);

  return (
    <React.Fragment>
      <Head>
        <title>Greenlight - Debug</title>
      </Head>

      <div>
        <p>
          ⚡ Electron + Next.js ⚡ -
          <Link href="/home">
            <a>Go to home page</a>
          </Link>
        </p>
      </div>

      <div id="ipcLog">{message}</div>

      <button onClick={onClickWithIpc}>IPC messaging</button>
      <button onClick={onClickWithIpcSync}>IPC messaging (sync)</button>
    </React.Fragment>
  );
};

export default Debug;
