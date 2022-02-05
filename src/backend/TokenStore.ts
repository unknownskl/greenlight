import { UploadData } from "electron";

interface EventCallback {
    (data: string): void;
}

export default class TokenStore {
    _web = {
        uhs: '',
        userToken: ''
    };
    _streamingToken = '';
    _xCloudStreamingToken = '';
    _xCloudRegionHost = '';
    _xCloudRegions:any = [];
    _msalData:Array<UploadData>;
    _msalHeaders:Record<string,string>;
    _msalToken = '';

    _eventOnWebToken: EventCallback[] = []
    _eventOnStreamingToken: EventCallback[] = []
    _eventOnxCloudStreamingToken: EventCallback[] = []
    _eventOnMSALToken: EventCallback[] = []
    _eventOnMSALData: EventCallback[] = []


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

    setxCloudStreamingToken(token: string, host: string):boolean {
        this._xCloudStreamingToken = token
        this._xCloudRegionHost = host
        
        this.emitEvent('onxcloudstreamingtoken', { token: this._xCloudStreamingToken, host: this._xCloudRegionHost })
        return true
    }

    setxCloudRegions(regions:any) {
        this._xCloudRegions = regions
    }
    
    setMSALData(data: any, headers: any):boolean {
        this._msalData = data
        this._msalHeaders = headers
        this.emitEvent('onmsal', {data: this._msalData, headers: this._msalHeaders})
        return true
    }

    setMSALToken(token: string):boolean {
        this._msalToken = token
        this.emitEvent('onmsaltoken', this._msalToken)

        return true
    }

    addEventListener(name: string, callback: EventCallback):void{
        if(name === 'onwebtoken'){
            this._eventOnWebToken.push(callback)
        } else if(name === 'onstreamingtoken'){
            this._eventOnStreamingToken.push(callback)

        } else if(name === 'onxcloudstreamingtoken'){
            this._eventOnxCloudStreamingToken.push(callback)

        } else if(name === 'onmsal'){
            this._eventOnMSALData.push(callback)

        } else if(name === 'onmsaltoken'){
            this._eventOnMSALToken.push(callback)
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

        } else if(name === 'onmsal'){
            for(const eventCallback in this._eventOnMSALData){
                this._eventOnMSALData[eventCallback](data)

            }
        } else if(name === 'onmsaltoken'){
            for(const eventCallback in this._eventOnMSALData){
                this._eventOnMSALToken[eventCallback](data)

            }
        }
    }
  }