import '../styles.css'

import React from 'react'
import Head from 'next/head'
// import { ipcRenderer } from 'electron'
import Ipc from '../lib/ipc'
// import Router from 'next/router'
import { useRouter } from 'next/navigation'


import Header from '../components/header'
import Footer from '../components/footer'
import Auth from '../components/auth'
import SidebarFriends from '../components/sidebar/friends'

import { UserProvider } from '../context/userContext'

import {
    useQuery,
    useMutation,
    useQueryClient,
    QueryClient,
    QueryClientProvider,
} from 'react-query'


// This default export is required in a new `pages/_app.js` file.
export default function MyApp({ Component, pageProps }) {
    const router = useRouter()
    const queryClient = new QueryClient()

    const [loggedIn, setLoginState] = React.useState(false)
    const [prevUserState, setPrevUserState] = React.useState({
        signedIn: false,
        gamertag: '',
        gamerpic: '',
        gamerscore: '',
        level: '',
    })
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

        const authInterval = setInterval(() => {
            console.log('Requesting AuthState...')
            Ipc.send('app', 'getAuthState').then((args) => {
                console.log('Received AuthState:', args)
        
                if(args.isAuthenticating === true){
                    setIsLoading(true)
                    setPrevUserState({ ...prevUserState, ...args.user})

                } else if(args.isAuthenticated === true){
                    clearInterval(authInterval)

                    if(loggedIn === false){
                        Ipc.send('app', 'onUiShown').then((result) => {
                            if(result.autoStream !== '')
                                setTimeout(() => {
                                    router.push('stream/'+result.autoStream)
                                }, 1000)
                        })
                    }
          
                    setLoginState(true)
                    setPrevUserState({ ...prevUserState, ...args.user})
                }
            })
        }, 500)

        const errorHandler = function(event) {
            console.error('Unhandled rejection (promise: ', event.promise, ', reason: ', event.reason, ').')
            if(event.reason.status){
                alert('HTTP Status: ' + event.reason.status + '\nPath:' + event.reason.url + '\n' + event.reason.body)
            } else {
                alert(event.reason)
            }
        }
        window.addEventListener('unhandledrejection', errorHandler)

        // cleanup this component
        return () => {
            window.removeEventListener('unhandledrejection', errorHandler)

            if(authInterval)
                clearInterval(authInterval)
        }
    }, [])

    function isStreaming(){
        return streamingMode
    }

    let appBody
    if(loggedIn && prevUserState.gamertag != ''){
        appBody = (
            <React.Fragment>
                <Header gamertag={ prevUserState.gamertag } hidden={ isStreaming() } level={ parseInt(prevUserState.level) } />

                <div id="app_body">
                    <div id="app_body_container">
                        <Component {...pageProps} />
                    </div>
                </div>

                <div id="app_sidebar" style={{
                    display: isStreaming() ? 'none' : 'block',
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
                height: '100vh',
            }}>
                <QueryClientProvider client={queryClient}>
                    <UserProvider>
                        {appBody}
                    </UserProvider>
                </QueryClientProvider>
            </div>
        </React.Fragment>
    )
}