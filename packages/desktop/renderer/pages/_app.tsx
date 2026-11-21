import '../styles.css'

import React from 'react'
import Head from 'next/head'
import Ipc from '../lib/ipc'
import { useRouter } from 'next/navigation'
import Header from '../components/header'
import Footer from '../components/footer'
import Auth from '../components/auth'
import GamepadNav from '../components/gamepadnav'
import '../lib/i18n'

import { UserProvider } from '../context/userContext'
import { LanguageProvider } from '../context/languageContext'

import {
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
    // const [streamingMode, setStreamingMode] = React.useState(false)
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

                } else if(args.isAuthenticated === true && args.user.signedIn === true){
                    clearInterval(authInterval)

                    // After successful authentication, load and apply language setting
                    Ipc.send('settings', 'getSettings').then(settings => {
                        if (settings.language) {
                            const i18n = require('../lib/i18n').default;
                            i18n.changeLanguage(settings.language);
                        }
                    });

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

    // function isStreaming(){
    //     return streamingMode
    // }

    let appBody
    if(loggedIn && prevUserState.gamertag !== ''){
        appBody = (
            <React.Fragment>
                <Header gamertag={ prevUserState.gamertag } gamerpic={ prevUserState.gamerpic } gamerscore={ prevUserState.gamerscore } level={ parseInt(prevUserState.level) } />

                <div id="app_body">
                    <div id="app_body_container">
                        <Component {...pageProps} />
                    </div>
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

            <div className="app_shell">
                <QueryClientProvider client={queryClient}>
                    <LanguageProvider>
                        <UserProvider>
                            {appBody}
                            <GamepadNav />
                        </UserProvider>
                    </LanguageProvider>
                </QueryClientProvider>
            </div>
        </React.Fragment>
    )
}