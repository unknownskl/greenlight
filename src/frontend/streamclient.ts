import Application from "./application";
// const xboxClient = require('../assets/xsdk/client.js')

import xCloudPlayer from 'xbox-xcloud-player'
import xCloudClient from './xcloudclient';

// interface EmptyArray {
// }

export default class StreamClient {

    _application:Application;
    _webrtcClient:xCloudPlayer
    _xCloudClient:xCloudClient

    _serverId:string
    _type:string

    _host:string

    _sessionId:string
    _sessionPath:string

    _keepAliveInterval:any

    constructor(){
        return this
    }

    start(application:Application, type: string, serverId: string) {
        return new Promise((resolve, reject) => {

            console.log('StreamClient.js: Starting stream to:', serverId, '('+type+')')

            this._application = application
            this._serverId = serverId
            this._type = type

            if(type === 'xhome'){
                this._host = 'uks.gssv-play-prodxhome.xboxlive.com'
                this._xCloudClient = new xCloudClient(this._application, this._host, this._application._tokenStore._streamingToken, 'home')
            } else {
                this._host = this._application._tokenStore._xCloudRegionHost
                this._xCloudClient = new xCloudClient(this._application, this._host, this._application._tokenStore._xCloudStreamingToken, 'cloud')
            }

            console.log('xCloudClient:', this._xCloudClient)

            this._xCloudClient.startSession(serverId).then((response) => {
                console.log('xCloudClient: startSession resolved:', response)

                // Console is provisioned and ready to be used. 
                // Lets load the xCloudPlayer
                this._webrtcClient = new xCloudPlayer('videoHolder')
                this._webrtcClient.createOffer().then((offer:any) => {
                    // console.log('SDP Client:', offer)

                    this._xCloudClient.sendSdp(offer.sdp).then((sdpAnswer:any) => {
                        // console.log('SDP Server:', sdpAnswer)

                        this._webrtcClient.setRemoteOffer(sdpAnswer.sdp)

                        // Continue with ICE
                        const candidates = this._webrtcClient.getIceCandidates()
                        this._xCloudClient.sendIce(candidates[0].candidate).then((iceAnswer:any) => {
                            // console.log('ICE Server:', iceAnswer)
    
                            this._webrtcClient.setIceCandidates(iceAnswer)

                            // Setup keepAlive timer
                            this._keepAliveInterval = setInterval(() => {
                                this._xCloudClient.sendKeepalive()
                            }, 60000)
    
                            // Are we done?
                            resolve(true)
    
                        }).catch((error) => {
                            reject(error)
                        })

                    }).catch((error) => {
                        reject(error)
                    })

                }).catch((error) => {
                    reject(error)
                })

            }).catch((error) => {
                reject(error)
            })
        })
    }

    disconnect(){
        //
        this._application._router.setView('app')

        this.destroy()
    }

    destroy(){
        const actionBarStreamingViewActive = (<HTMLInputElement>document.getElementById('actionBarStreamingViewActive'))
        const actionBarStreamingDisconnect = (<HTMLInputElement>document.getElementById('actionBarStreamingDisconnect'))
        const loadingScreen = (<HTMLInputElement>document.getElementById('loadingScreen'))
        actionBarStreamingViewActive.style.display = 'none'
        actionBarStreamingDisconnect.style.display = 'none'
        loadingScreen.style.display = 'block'

        // this._webrtcClient.stopWebrtcConnection()
        this._webrtcClient.reset()

        const videoHolder = (<HTMLInputElement>document.getElementById('videoHolder'))
        videoHolder.innerHTML = ''

        clearInterval(this._keepAliveInterval)
    }

}