interface EventCallback {
    (data: string): void;
}

export default class TokenStore {
    _web = {
        uhs: '',
        userToken: ''
    };
    _streamingToken = '';

    _eventOnWebToken: EventCallback[] = []
    _eventOnStreamingToken: EventCallback[] = []

    setWebTokens(uhs: string, userToken: string):boolean {
        this._web.uhs = uhs
        this._web.userToken = userToken
        this.emitEvent('onwebtoken', this._web)

        return true
    }

    setStreamingToken(token: string):boolean {
        this._streamingToken = token
        this.emitEvent('onstreamingtoken', this._streamingToken)

        return true
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