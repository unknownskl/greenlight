import Application from "./application";
// const xboxClient = require('../assets/xsdk/client.js')

import xCloudPlayer from 'xbox-xcloud-player'
import xCloudClient from './xcloudclient';

interface xCloudPlayerConfig {
    ui_systemui?:Array<number> // Default: [10,19,31,27,32,33]
    ui_version?:Array<number> // Default: [0,1,0]
    input_driver?:any // Default: GamepadDriver(), false to disable
}

export default class StreamClient {

    _application:Application;
    _xCloudPlayer:xCloudPlayer
    _xCloudPlayerConfig:xCloudPlayerConfig = {
        ui_systemui: [10,19,31,27,32]
    }
    _xCloudClient:xCloudClient

    _serverId:string
    _type:string

    _host:string

    _sessionId:string
    _sessionPath:string

    _keepAliveInterval:any

    _modalHelper:ModalHelper

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

            this._application._plugins.onStreamStart()

            console.log('xCloudClient:', this._xCloudClient)

            this._xCloudClient.startSession(serverId).then((response) => {
                console.log('xCloudClient: startSession resolved:', response)

                // Console is provisioned and ready to be used. 
                // Lets load the xCloudPlayer
                this._xCloudPlayer = new xCloudPlayer('videoHolder', this._xCloudPlayerConfig)
                this._xCloudPlayer.createOffer().then((offer:any) => {
                    // console.log('SDP Client:', offer)

                    this._xCloudClient.sendSdp(offer.sdp).then((sdpAnswer:any) => {
                        // console.log('SDP Server:', sdpAnswer)

                        this._xCloudPlayer.setRemoteOffer(sdpAnswer.sdp)

                        // Continue with ICE
                        const candidates = this._xCloudPlayer.getIceCandidates()
                        this._xCloudClient.sendIce(candidates[0].candidate).then((iceAnswer:any) => {
                            // console.log('ICE Server:', iceAnswer)
    
                            this._xCloudPlayer.setIceCandidates(iceAnswer)

                            // Setup keepAlive timer
                            this._keepAliveInterval = setInterval(() => {
                                this._xCloudClient.sendKeepalive()
                            }, 60000)

                            this._xCloudPlayer.getEventBus().on('connectionstate', (event) => {
                                console.log(':: Connection state updated:', event)

                                if(event.state === 'connected'){
                                    // We are connected
                                    console.log(':: We are connected!')

                                    this._streamStarted()

                                } else if(event.state === 'closing'){
                                    // Connection is closing
                                    console.log(':: We are going to disconnect!')

                                } else if(event.state === 'closed'){
                                    // Connection has been closed. We have to cleanup here
                                    console.log(':: We are disconnected!')
                                    this._streamStopped()
                                }
                            })

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

        // this._xCloudPlayer.stopWebrtcConnection()
        this._xCloudPlayer.reset()

        const videoHolder = (<HTMLInputElement>document.getElementById('videoHolder'))
        videoHolder.innerHTML = ''

        clearInterval(this._keepAliveInterval)
    }

    _streamStarted() {
        //
        this._modalHelper = new ModalHelper(this._xCloudPlayer)
        this._modalHelper.start()
    }

    _streamStopped() {
        this._modalHelper.stop()
    }

}

export class ModalHelper {

    _application:xCloudPlayer
    _activeId = ''

    constructor(application:xCloudPlayer) {
        this._application = application
    }

    start() {
        this._application.getEventBus().on('message', (event) => {
            if(event.target === '/streaming/systemUi/messages/ShowMessageDialog') {
                // Show Modal
                this._activeId = event.id
                const modalContent = JSON.parse(event.content)
                console.log('modal:', modalContent)

                this.setModal(modalContent.TitleText, modalContent.ContentText, modalContent.CommandLabel1, modalContent.CommandLabel2, modalContent.CommandLabel3)

            } else if(event.type === 'SenderCancel') {
                // Cancel transaction and reset Modal
                this._activeId = ''
                this.resetModal()
            }
            console.log('ModalHelper event', event)
        })
    }

    stop() {
        //
    }

    setModal(title:string, text:string, option1:string, option2:string, option3:string) {
        console.log('modalContext:', title, text, option1, option2, option3)
        document.getElementById('modalDialog').style.display = 'block'

        document.getElementById('dialogTitle').innerHTML = title
        document.getElementById('dialogText').innerHTML = text

        if(option1 === ''){
            document.getElementById('dialogButton1').style.display = 'none'
        } else {
            document.getElementById('dialogButton1').innerHTML = option1
            document.getElementById('dialogButton1').style.display = 'inline-block'
        }
        
        if(option2 === ''){
            document.getElementById('dialogButton2').style.display = 'none'
        } else {
            document.getElementById('dialogButton2').innerHTML = option2
            document.getElementById('dialogButton2').style.display = 'inline-block'
        }

        if(option3 === ''){
            document.getElementById('dialogButton3').style.display = 'none'
        } else {
            document.getElementById('dialogButton3').innerHTML = option3
            document.getElementById('dialogButton3').style.display = 'inline-block'
        }

        document.getElementById('dialogButton1').onclick = () => {
            this._application.getChannelProcessor('message').sendTransaction(this._activeId, { Result: 0 })
            this.resetModal()
        }

        document.getElementById('dialogButton2').onclick = () => {
            this._application.getChannelProcessor('message').sendTransaction(this._activeId, { Result: 1 })
            this.resetModal()
        }

        document.getElementById('dialogButton3').onclick = () => {
            this._application.getChannelProcessor('message').sendTransaction(this._activeId, { Result: 2 })
            this.resetModal()
        }
    }

    resetModal() {
        this.setModal('No active dialog', 'There is no active dialog. This is an error. Please try gain.', '', '', '')
        document.getElementById('modalDialog').style.display = 'none'
    }
}