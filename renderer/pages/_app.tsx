import '../styles.css'

import React from 'react'
import Head from 'next/head'
import { ipcRenderer } from 'electron'
import Router from 'next/router'

import Header from '../components/header'
import Footer from '../components/footer'
import Auth from '../components/auth'
import SidebarFriends from '../components/sidebar/friends'
import StreamComponent from '../components/ui/streamcomponent'


import { UserProvider, SettingsProvider, useSettings, useUser } from '../context/userContext'


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
  const [headerLinks, setHeaderLinks] = React.useState([])
  const [streamingMode, setStreamingMode] = React.useState(false)

  React.useEffect(() => {
    const tokenInterval = setInterval(() => {
      ipcRenderer.send('auth', {
        type: 'init'
      })
    }, 500)

    // ipcRenderer.on('xbox_friends', (event, friends) => {
    //   setOnlineFriends(friends)
    // })

    ipcRenderer.on('app_view', (event, data) => {
      if(data.streamingMode !== undefined){
        setStreamingMode(data.streamingMode)
      }
    })


    ipcRenderer.on('auth', (event, data) => {
      setPrevUserState({
        signedIn: data.signedIn,
        gamertag: data.gamertag,
        gamerpic: data.gamerpic,
        gamerscore: data.gamerscore,
      })
      
      setHeaderLinks((headerLinks.length > 0) ? headerLinks : [
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
          name: data.gamertag,
          title: 'View profile',
          url: '/profile',
          active: false
        }
      ])

      if(data.loggedIn === true){
        // We are logged in!
        setLoginState(true)
        clearInterval(tokenInterval)

      }
    })

    // cleanup this component
    return () => {
        clearInterval(tokenInterval)
        ipcRenderer.removeAllListeners('auth');
    };
  }, []);

  function isStreaming(){
    return streamingMode
  }

  let appBody
  if(loggedIn){
    // if(! isStreaming()){
      appBody = (
        <React.Fragment>
          <Header links={ headerLinks } hidden={ isStreaming() } />

          <div id="app_body">
            <Component {...pageProps} />
          </div>

          <div id="app_sidebar" style={{
            display: isStreaming() ? 'none' : 'block'
          }}>
            <SidebarFriends></SidebarFriends>
          </div>
          <Footer />
        </React.Fragment>)
    // } else {
    //   appBody = (
    //     <React.Fragment>
    //         <Header links={ headerLinks } hidden={ true } />

    //         <div id="app_body full">
    //           <Component {...pageProps} />
    //         </div>
    //       <Footer />
    //     </React.Fragment>)
    // }
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
      
      <div style={ {
        background: 'linear-gradient(0deg, rgba(26,27,30,1) 0%, rgba(26,27,30,1) 25%, rgba(0,212,255,0) 100%), url(\'/images/backgrounds/background1.jpeg\')',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat',
        backgroundSize: 'cover',
        width: '100vw',
        height: '100vh'
      }}>
        <UserProvider>
          <SettingsProvider>
            {appBody}

            <StreamComponent></StreamComponent>
          </SettingsProvider>
        </UserProvider>
      </div>
    </React.Fragment>
  );
}