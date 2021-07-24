import TokenStore from '../backend/TokenStore'
import Router from './router'
import AppView from './appview'
import StreamingView from './streamingview'

interface EventCallback {
    (data: string): void;
}

export default class Application {

    _eventOnWebToken: EventCallback[] = []
    _eventOnStreamingToken: EventCallback[] = []

    _tokenStore = new TokenStore()
    _router = new Router()

    _AppView:AppView
    _StreamingView:StreamingView

    constructor(){
        this.listenForTokens()

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
            if(event.view === 'app' || event.view === 'streaming'){
                const actionBar = (<HTMLInputElement>document.getElementById('actionBar'))
                actionBar.style.display = 'block'
            } else {
                const actionBar = (<HTMLInputElement>document.getElementById('actionBar'))
                actionBar.style.display = 'none'
            }

            // Load Appviews
            if(event.view === 'app'){
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
        })

        // Build nav
        document.getElementById('actionBarMyConsoles').addEventListener('click', (e:Event) => {
            this._router.setView('app')
        })
        document.getElementById('actionBarStreamingView').addEventListener('click', (e:Event) => {
            this._router.setView('streaming')
        })
        document.getElementById('actionBarStreamingViewActive').addEventListener('click', (e:Event) => {
            this._router.setView('streaming')
        })
    }

    listenForTokens():void {
        const inputWebUhs = document.getElementById('token_web_uhs')
        const inputWebUserToken = document.getElementById('token_web_usertoken')
        const inputStreamingToken = document.getElementById('token_streaming_token')

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
        }
    }
}