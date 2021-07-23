import TokenStore from '../backend/TokenStore'
import Router from './router'

interface EventCallback {
    (data: string): void;
}

export default class Application {

    _eventOnWebToken: EventCallback[] = []
    _eventOnStreamingToken: EventCallback[] = []

    _tokenStore = new TokenStore()
    _router = new Router()

    constructor(){
        this.listenForTokens()
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
            this._router.setView('app')
        })

        this._tokenStore.addEventListener('onstreamingtoken', (token) => {
            this._router.setView('app')
        })
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