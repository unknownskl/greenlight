import '../styles.css'

import React from 'react';
import Head from 'next/head';
import { ipcRenderer } from 'electron'

import Header from '../components/header'
import Footer from '../components/footer'
import Auth from '../components/auth'

import { UserProvider } from '../context/userContext'

// This default export is required in a new `pages/_app.js` file.
export default function MyApp({ Component, pageProps }) {
  // return <Component {...pageProps} />
  const [loggedIn, setLoginState] = React.useState(false);
  const [headerLinks, setHeaderLinks] = React.useState([
    {
      name: 'My Consoles',
      title: '',
      url: '/home',
      active: true
    },{
      name: 'xCloud Library',
      title: '',
      url: '/xcloud/home',
      active: false
    },{
      name: 'Marketplace',
      title: '',
      url: '/store/home',
      active: false
    },{
      name: 'Debug',
      title: '',
      url: '/debug',
      active: false
    },{
      name: 'Setings',
      title: '',
      url: '/settings',
      active: false
    },{
      name: 'Profile',
      title: '',
      url: '/profile',
      active: false
    }
  ])

  React.useEffect(() => {
    const tokenInterval = setInterval(() => {
      ipcRenderer.send('auth-tokens', {
        type: 'request'
      })
    }, 500)


    ipcRenderer.on('auth-tokens', (event, data) => {
      if(data.loggedIn === true){
        // We are logged in!
        setLoginState(true)
        clearInterval(tokenInterval)
      }
    })

    // cleanup this component
    return () => {
        clearInterval(tokenInterval)
        ipcRenderer.removeAllListeners('auth-tokens');
    };
}, []);

  let appBody
  if(loggedIn){
    appBody = (
      <React.Fragment>
        <Header links={ headerLinks } />
        <div id="app_body">
          <Component {...pageProps} />
        </div>
        <Footer />
      </React.Fragment>)
  } else {
    appBody = (
      <React.Fragment>
        <Auth />
      </React.Fragment>)
  }

  return (
    <React.Fragment>
      <Head>
        <title>Greenlight</title>
      </Head>
      <UserProvider>
        {appBody}
      </UserProvider>
    </React.Fragment>
  );
}