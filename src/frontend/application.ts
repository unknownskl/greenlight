import TokenStore from '../backend/TokenStore'
import Router from './router'
import AppView from './appview'
import StreamingView from './streamingview'
import xCloudView from './xcloudview'


interface EventCallback {
    (data: string): void;
}

export default class Application {

    _eventOnWebToken: EventCallback[] = []
    _eventOnStreamingToken: EventCallback[] = []
    _eventOnxCloudStreamingToken: EventCallback[] = []

    _tokenStore = new TokenStore()
    _router = new Router()

    _AppView:AppView
    _StreamingView:StreamingView
    _xCloudView:xCloudView

    _ipc:any

    constructor(){
        this.listenForTokens()

        this._ipc = window.require('electron').ipcRenderer

        // Load splashscreen for one second to let the application to lookup existing cookies.
        setTimeout(() => {
            // @TODO: Add check for expires cookies?
            if(this._tokenStore._web.uhs === '' && this._tokenStore._streamingToken === ''){
                this._router.setView('auth')
            }
        }, 1000)

        const debugStreamingView = (<HTMLInputElement>document.getElementById('actionBarStreamingView'))
        debugStreamingView.style.display = (process.env.ISDEV !== undefined) ? 'block': 'none'
        

        this._router.addEventListener('onviewshow', (event:any) => {
            // Check if we need the actionbar
            if(event.view === 'app' || event.view === 'streaming' || event.view === 'xCloud'){
                const actionBar = (<HTMLInputElement>document.getElementById('actionBar'))
                actionBar.style.display = 'block'
            } else {
                const actionBar = (<HTMLInputElement>document.getElementById('actionBar'))
                actionBar.style.display = 'none'
            }

            // Load Appviews
            if(event.view === 'auth'){
                const backgrounds = [
                    'linear-gradient(0deg, rgba(26,27,30,1) 0%, rgba(26,27,30,1) 50%, rgba(0,212,255,0) 100%), url(\'assets/images/background_1.jpg\')',
                    'linear-gradient(0deg, rgba(26,27,30,1) 0%, rgba(26,27,30,1) 50%, rgba(0,212,255,0) 100%), url(\'assets/images/background_2.jpg\')',
                    'linear-gradient(0deg, rgba(26,27,30,1) 0%, rgba(26,27,30,1) 50%, rgba(0,212,255,0) 100%), url(\'assets/images/background_3.jpg\')',
                    'linear-gradient(0deg, rgba(26,27,30,1) 0%, rgba(26,27,30,1) 50%, rgba(0,212,255,0) 100%), url(\'assets/images/background_4.jpg\')',
                ]
        
                const authView = (<HTMLInputElement>document.getElementById('authView'))
                // appView.style.backgroundImage = "linear-gradient(0deg, rgba(26,27,30,1) 0%, rgba(26,27,30,1) 50%, rgba(0,212,255,0) 100%), url('assets/images/background_1.jpg')"
                // appView.style.backgroundImage = "linear-gradient(0deg, rgba(26,27,30,1) 0%, rgba(26,27,30,1) 50%, rgba(0,212,255,0) 100%), url('assets/images/background_2.jpg')"
                const randomSelect = backgrounds[Math.floor(Math.random()*backgrounds.length)];
                authView.style.backgroundImage = randomSelect
            } else  if(event.view === 'app'){
                if(this._AppView === undefined){
                    this._AppView = new AppView(this)
                }
                this._AppView.load()

            } else if(event.previousView === 'app'){
                // Unload appview
                if(this._AppView !== undefined){
                    this._AppView.unload()
                }
            }

            if(event.view === 'streaming'){
                if(this._StreamingView === undefined){
                    this._StreamingView = new StreamingView(this)
                }
                this._StreamingView.load()
                
            } else if(event.previousView === 'streaming'){
                // Unload appview
                if(this._StreamingView !== undefined){
                    this._StreamingView.unload()
                }
            }

            if(event.view === 'xCloud'){
                if(this._xCloudView === undefined){
                    this._xCloudView = new xCloudView(this)
                }
                this._xCloudView.load()
                
            } else if(event.previousView === 'xCloud'){
                // Unload appview
                if(this._xCloudView !== undefined){
                    this._xCloudView.unload()
                }
            }
        })

        // Build nav
        document.getElementById('actionBarMyConsoles').addEventListener('click', (e:Event) => {
            this._router.setView('app')
        })
        document.getElementById('actionBarxCloud').addEventListener('click', (e:Event) => {
            this._router.setView('xCloud')
        })
        document.getElementById('actionBarStreamingView').addEventListener('click', (e:Event) => {
            this._router.setView('streaming')
        })
        document.getElementById('actionBarStreamingViewActive').addEventListener('click', (e:Event) => {
            this._router.setView('streaming')
        })

        document.getElementById('pluginsMenulink').addEventListener('click', (e:Event) => {
            // Show debug panel?
            if(document.getElementById('pluginsTooltip').style.display === 'none'){
                document.getElementById('pluginsTooltip').style.display = 'block'
            } else {
                document.getElementById('pluginsTooltip').style.display = 'none'
            }
        })
    }

    listenForTokens():void {
        const inputWebUhs = document.getElementById('token_web_uhs')
        const inputWebUserToken = document.getElementById('token_web_usertoken')
        const inputStreamingToken = document.getElementById('token_streaming_token')
        const inputxCloudStreamingToken = document.getElementById('token_xcloud_streaming_token')
        const inputxCloudStreamingHost = document.getElementById('token_xcloud_streaming_host')
        const inputxCloudMSALToken = document.getElementById('token_xcloud_msal_token')

        const inputWebTokenInterval = setInterval(() => {
            const valueUhs  = (<HTMLInputElement>inputWebUhs).value
            const valueUserToken  = (<HTMLInputElement>inputWebUserToken).value
            if(valueUhs !== '' && valueUserToken !== ''){
                clearInterval(inputWebTokenInterval)

                this._tokenStore.setWebTokens(valueUhs, valueUserToken)
                inputWebUhs.remove()
                inputWebUserToken.remove()
            }
        }, 100)

        const inputStreamingTokenInterval = setInterval(() => {
            const value  = (<HTMLInputElement>inputStreamingToken).value
            if(value !== ''){
                clearInterval(inputStreamingTokenInterval)

                this._tokenStore.setStreamingToken(value)
                inputStreamingToken.remove()
            }
        }, 100)

        const inputxCloudStreamingTokenInterval = setInterval(() => {
            const value  = (<HTMLInputElement>inputxCloudStreamingToken).value
            const host  = (<HTMLInputElement>inputxCloudStreamingHost).value
            if(value !== '' && host !== ''){
                clearInterval(inputxCloudStreamingTokenInterval)

                this._tokenStore.setxCloudStreamingToken(value, host)
                inputxCloudStreamingToken.remove()
                inputxCloudStreamingHost.remove()
            }
        }, 100)

        const inputxCloudMSALTokenInterval = setInterval(() => {
            const value  = (<HTMLInputElement>inputxCloudMSALToken).value
            if(value !== ''){
                clearInterval(inputxCloudMSALTokenInterval)
                
                this._tokenStore.setMSALToken(value)
                inputxCloudMSALToken.remove()
            }
        }, 100)

        this._tokenStore.addEventListener('onwebtoken', (tokens) => {
            if(this._tokenStore._web.uhs !== '' && this._tokenStore._streamingToken !== ''){
                this._router.setView('app')
            }
        })

        this._tokenStore.addEventListener('onstreamingtoken', (token) => {
            if(this._tokenStore._web.uhs !== '' && this._tokenStore._streamingToken !== ''){
                this._router.setView('app')
            }
        })

        this._tokenStore.addEventListener('onxcloudstreamingtoken', (token) => {
            const xCloudMenuItem = document.getElementById('actionBarxCloud')
            xCloudMenuItem.style.display = 'inline-block'

        })

        // this._tokenStore.addEventListener('onmsaltoken', (token) => {
        //     // @TODO: Enable xCloud integration
        // })
    }

    startStream(type: string, serverId:string):void {
        this._router.setView('streaming')
        if(this._StreamingView !== undefined){
            this._StreamingView.startStream(type, serverId)
        }
    }

    addEventListener(name: string, callback: EventCallback):void{
        if(name === 'onwebtoken'){
            this._eventOnWebToken.push(callback)
        } else if(name === 'onstreamingtoken'){
            this._eventOnStreamingToken.push(callback)
        } else if(name === 'onxcloudstreamingtoken'){
            this._eventOnxCloudStreamingToken.push(callback)
        }
    }

    emitEvent(name: string, data: any):void{
        if(name === 'onwebtoken'){
            for(const eventCallback in this._eventOnWebToken){
                this._eventOnWebToken[eventCallback](data)
            }
        } else if(name === 'onstreamingtoken'){
            for(const eventCallback in this._eventOnStreamingToken){
                this._eventOnStreamingToken[eventCallback](data)
            }
        } else if(name === 'onxcloudstreamingtoken'){
            for(const eventCallback in this._eventOnxCloudStreamingToken){
                this._eventOnxCloudStreamingToken[eventCallback](data)
            }
        }
    }
}