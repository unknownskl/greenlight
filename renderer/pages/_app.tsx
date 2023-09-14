import '../styles.css'

import React from 'react'
import Head from 'next/head'
// import { ipcRenderer } from 'electron'
import Ipc from '../lib/ipc'
import Router from 'next/router'

import Header from '../components/header'
import Footer from '../components/footer'
import Auth from '../components/auth'
import SidebarFriends from '../components/sidebar/friends'

import { UserProvider } from '../context/userContext'


// This default export is required in a new `pages/_app.js` file.
export default function MyApp({ Component, pageProps }) {
  const [loggedIn, setLoginState] = React.useState(false);
  const [prevUserState, setPrevUserState] = React.useState({
    signedIn: false,
    gamertag: '',
    gamerpic: '',
    gamerscore: '',
    level: '',
  });
  // const [headerLinks, setHeaderLinks] = React.useState([])
  const [streamingMode, setStreamingMode] = React.useState(false)
  const [isLoading, setIsLoading] = React.useState(false)

  React.useEffect(() => {
    Ipc.send('app', 'loadCachedUser').then((user) => {
      setPrevUserState({
        signedIn: user.signedIn,
        gamertag: user.gamertag,
        gamerpic: user.gamerpic,
        gamerscore: user.gamerscore,
        level: user.level,
      })
    })

    const authState = Ipc.onAction('app', 'authState', (event, args) => {
      
      if(args.isAuthenticating === true){
        setIsLoading(true)
        setPrevUserState({ ...prevUserState, level: args.level})

      } else if(args.isAuthenticated === true){
        setLoginState(true)
        setPrevUserState({ ...prevUserState, level: args.level})
      }
    })

  //   // ipcRenderer.on('xbox_friends', (event, friends) => {
  //   //   setOnlineFriends(friends)
  //   // })

  //   ipcRenderer.on('app_view', (event, data) => {
  //     if(data.streamingMode !== undefined){
  //       setStreamingMode(data.streamingMode)
  //     }
  //   })

  //   ipcRenderer.on('app_loading', (event, data) => {
  //     setIsLoading(true)
  //   })

  //   ipcRenderer.on('do_action', (event, data) => {
  //     console.log('Got do_action event:', event, data)
      
  //     if(data.type == 'startStream'){
  //       Router.push('stream/' + data.data.titleId)
  //     }
  //   })

    // cleanup this component
    return () => {
      Ipc.removeListener('app', authState)
    };
  }, []);

  function isStreaming(){
    return streamingMode
  }

  let appBody
  if(loggedIn){
    appBody = (
      <React.Fragment>
        <Header gamertag={ prevUserState.gamertag } hidden={ isStreaming() } level={ parseInt(prevUserState.level) } />

        <div id="app_body">
          <div id="app_body_container">
            <Component {...pageProps} />
          </div>
        </div>

        <div id="app_sidebar" style={{
          display: isStreaming() ? 'none' : 'block'
        }}>
          <SidebarFriends></SidebarFriends>
        </div>
        <Footer />
      </React.Fragment>)

  } else {
    appBody = (
      <React.Fragment>
        <Auth signedIn={ prevUserState.signedIn} gamertag={ prevUserState.gamertag } gamerpic={ prevUserState.gamerpic } gamerscore={ prevUserState.gamerscore } isLoading={ isLoading } />
      </React.Fragment>)
  }

  return (
    <React.Fragment>
      <Head>
        <title>Greenlight</title>
      </Head>
      
      <div style={ {
        background: 'linear-gradient(0deg, rgba(26,27,30,1) 0%, rgba(26,27,30,1) 25%, rgba(0,212,255,0) 100%), url(\'/images/backgrounds/background1.jpeg\') fixed',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat',
        backgroundSize: 'cover',
        width: '100vw',
        height: '100vh'
      }}>
        <UserProvider>
          {appBody}
        </UserProvider>
      </div>
    </React.Fragment>
  );
}