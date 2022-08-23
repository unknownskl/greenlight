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
  const [prevUserState, setPrevUserState] = React.useState({
    signedIn: false,
    gamertag: '',
    gamerpic: '',
    gamerscore: '',
  });
  const [headerLinks, setHeaderLinks] = React.useState([
    {
      name: 'My Consoles',
      title: 'View consoles',
      url: '/home',
      active: true
    },{
      name: 'xCloud Library',
      title: 'Browse xCloud library',
      url: '/xcloud/home',
      active: false
    },{
    //   name: 'Marketplace',
    //   title: 'Browse the marketplace',
    //   url: '/store/home',
    //   active: false
    // },{
      name: 'Debug',
      title: 'Debug page',
      url: '/debug',
      active: false
    },{
      name: 'Settings',
      title: 'Change application settings',
      url: '/settings',
      active: false
    },{
      name: 'Profile',
      title: 'View profile',
      url: '/profile',
      active: false
    }
  ])

  React.useEffect(() => {
    const tokenInterval = setInterval(() => {
      ipcRenderer.send('auth', {
        type: 'init'
      })
    }, 500)


    ipcRenderer.on('auth', (event, data) => {
      if(data.loggedIn === true){
        // We are logged in!
        setLoginState(true)
        clearInterval(tokenInterval)

      } else {
        setPrevUserState({
          signedIn: data.signedIn,
          gamertag: data.gamertag,
          gamerpic: data.gamerpic,
          gamerscore: data.gamerscore,
        })
      }
    })

    // cleanup this component
    return () => {
        clearInterval(tokenInterval)
        ipcRenderer.removeAllListeners('auth');
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
        <Auth signedIn={ prevUserState.signedIn} gamertag={ prevUserState.gamertag } gamerpic={ prevUserState.gamerpic } gamerscore={ prevUserState.gamerscore } />
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