import xCloudPlayer from '../player'

export default class Channel {
    private _player:xCloudPlayer
    private _dataChannel:RTCDataChannel

    constructor(player:xCloudPlayer) {
        this._player = player
        // console.log('creating data channel: ', this.constructor.name, this, this.getChannelConfig())

        this._dataChannel = this._player._peerConnection.createDataChannel(this.getChannelName(), this.getChannelConfig())

        this._dataChannel.onopen = this.onOpen.bind(this)
        this._dataChannel.onmessage = this.onMessage.bind(this)
        this._dataChannel.onclosing = this.onClosing.bind(this)
        this._dataChannel.onclose = this.onClose.bind(this)
        this._dataChannel.onerror = this.onError.bind(this)
    }

    // Channel config functions
    getChannelName() {
        return 'channel'
    }

    getChannelConfig() {
        return { }
    }

    // Default channel functions
    onOpen(event:Event) {
        console.log(this.getChannelName(), 'Opening channel:', event)
    }

    onMessage(event:MessageEvent) {
        console.log(this.getChannelName(), 'Message channel:', event)
    }

    onClosing(event:Event) {
        console.log(this.getChannelName(), 'Closing channel:', event)
    }

    onClose(event:Event) {
        console.log(this.getChannelName(), 'Closed channel:', event)
    }

    onError(event:Event) {
        console.log(this.getChannelName(), 'Error channel:', event)
    }

    send(data:any) {
        if(this._dataChannel.readyState !== 'open'){
            console.log('['+this.getChannelName()+'] Tried to send data while channel is not open. readyState is:', this._dataChannel.readyState)
            return
        }

        if(typeof data === 'string'){
            data = (new TextEncoder).encode(data)
        }
        
        return this._dataChannel.send(data)
    }

    getPlayer(){
        return this._player
    }

    // Channel destroy function
    destroy() {
        this._player.playerState = 'Destroyed'
    }
}