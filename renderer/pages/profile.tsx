import React from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { ipcRenderer } from 'electron'

import Header from '../components/header'
import Button from '../components/ui/button'

function Home() {
  const [consoles, setConsoles] = React.useState([])

  React.useEffect(() => {
    // ipcRenderer.send('stream', {
    //   type: 'get_consoles'
    // })

    // ipcRenderer.on('stream', (event, args) => {
    //   if(args.type === 'error'){
    //     alert((args.data !== undefined) ? args.message+': '+JSON.stringify(args.data) : args.message)
    //   } else {
    //     console.log('got event response:', args)
    //     setConsoles(args.data)
    //   }
    // })

    return () => {
    //   ipcRenderer.removeAllListeners('stream');
  };
}, []);

  return (
    <React.Fragment>
      <Head>
        <title>Greenlight - My Profile</title>
      </Head>

      <div>
        derp
      </div>

    </React.Fragment>
  );
};

export default Home;
