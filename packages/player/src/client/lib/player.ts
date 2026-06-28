import ChatChannel from './channel/chat'
import ControlChannel from './channel/control'
import InputChannel from './channel/input'
import MessageChannel from './channel/message'

import Ice from './ice'
import Sdp from './sdp'
import Stats from './stats'

import VideoComponent from './render/video'
import WebGpuComponent from './render/webgpu'
import AudioComponent from './render/audio'

export default class xCloudPlayer {

    _peerConnection = new RTCPeerConnection({})
    _channels = {
        chat: new ChatChannel(this),
        control: new ControlChannel(this),
        input: new InputChannel(this),
        message: new MessageChannel(this),
    }

    private _elementId: string
    private _isDestoyed: boolean = false
    private _iceHelper = new Ice(this)
    private _sdpHelper = new Sdp(this)
    private _statsHelper = new Stats(this)
    public playerState: 'Initializing' | 'Connecting' | 'Connected' | 'Destroyed' = 'Initializing'

    private _videoComponent: VideoComponent | WebGpuComponent | undefined
    private _audioComponent: AudioComponent | undefined

    constructor(elementId: string) {
        console.log('xCloudPlayer constructing...');

        this._elementId = elementId;
        this._peerConnection.addTransceiver('audio', { direction: 'sendrecv' })
        const videoTransceiver = this._peerConnection.addTransceiver('video', { direction: 'recvonly' })
        videoTransceiver.setCodecPreferences(this._sdpHelper.getDefaultCodecPreferences())

        this._peerConnection.ontrack = (event) => {
            this.playerState = 'Connected'

            if(event.track.kind === 'video'){
                // this._videoComponent = new VideoComponent(this)
                this._videoComponent = new WebGpuComponent(this)
                this._videoComponent.create(event.streams[0])

            } else if(event.track.kind === 'audio'){
                this._audioComponent = new AudioComponent(this)
                this._audioComponent.create(event.streams[0])

            } else {
                console.log('[xPlayer] Detected an unknown stream type: ', event.track.kind)
            }
        }

        console.log('xCloudPlayer constructed.');
        this.playerState = 'Connecting'
    }

    init() {
        console.log('xCloudPlayer init called.');
    }

    getElementId() {
        return this._elementId
    }

    async createOffer() {
        const offer = await this._peerConnection.createOffer({
            offerToReceiveAudio: true,
            offerToReceiveVideo: true,
        })
        const finalOffer = this._sdpHelper.setLocalSDP(offer)
        this._peerConnection.setLocalDescription(finalOffer)

        return finalOffer
    }

    async setRemoteSDP(sdp: string) {
        const finalSdp = this._sdpHelper.setRemoteSDP(sdp)
        return await this._peerConnection.setRemoteDescription({
            type: 'answer',
            sdp: finalSdp,
        })
    }

    async getICECandidates() {
        return this._iceHelper.getCandidates()
    }

    async setRemoteIceCandidates(candidates:RTCIceCandidate[]) {
        // @TODO: Sort ipv4 and ipv6, and use best route as preference (ipv6 only etc)

        this._iceHelper.setRemoteCandidates(candidates)
    }

    getVideoElement() {
        if(this._videoComponent){
            return this._videoComponent.getElement()
        } else {
            return undefined
        }
    }

    getAudioElement() {
        if(this._audioComponent){
            return this._audioComponent.getElement()
        } else {
            return undefined
        }
    }

    toggleDebugOverlay() {
        if(this._videoComponent){
            this._videoComponent.toggleDebugOverlay()
        }
    }

    getStats() {
        return this._statsHelper
    }

    destroy() {
        if(this._isDestoyed === false){
            this._peerConnection.close()

            if(this._peerConnection.onconnectionstatechange){
                this._peerConnection.onconnectionstatechange(new Event('connectionstatechanged'))
            }
            
            for(const channel in this._channels) {
                this._channels[channel].destroy()
            }

            if(this._videoComponent){ this._videoComponent.destroy() }
            if(this._audioComponent){ this._audioComponent.destroy() }

            this._isDestoyed = true
            this.playerState = 'Destroyed'
        } else {
            console.log('Cannot destroy because the player is already destroyed.')
        }
    }
}