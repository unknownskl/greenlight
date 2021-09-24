// import './assets/webui/app.css'
// import Application from "./frontend/application"
// import xCloudClient from "./frontend/xcloudclient"
import apiClient from './webui/apiClient'
import xCloudPlayer from 'xbox-xcloud-player'

export default class xCloudWeb {

    _test = 'test'

    // _xCloudClient:xCloudClient
    _apiClient:apiClient
    _xCloudPlayer:xCloudPlayer

    constructor() {
        console.log('xCloud Web UI constructor called')

        this._apiClient = new apiClient()

        this._apiClient.getConsoles().then((consoles:any) => {
            const consoleListElement = document.getElementById('xHomeConsoleList')
            consoleListElement.innerHTML = ''

            for(const device in consoles){
                let html = '<div class="consoleItem">'
                html +=     consoles[device].deviceName+' ('+consoles[device].powerState+')<br />'
                html += '   <button id="xHome_startstream_'+device+'" class="btn btn-small">Stream</button>'
                html += '</div>'

                consoleListElement.innerHTML += html
            }

            for(const device in consoles){
                document.getElementById('xHome_startstream_'+device).onclick = () => {
                    console.log('Start stream for', consoles[device].serverId)

                    this._apiClient.startStream('xhome', consoles[device].serverId).then((state:any) => {
                        console.log('api response:', state)

                        if(state.state === 'Provisioned') {
                            // Lets do the handshake thingie...

                            this._xCloudPlayer = new xCloudPlayer('xCloudRender', {
                                ui_systemui: [32]
                            })

                            this.clientHandshake().then(() => {
                                //
                                console.log('Clienthandshake is done!!')

                            }).catch((error) => {
                                console.log(error)
                            })
                        } else {
                            console.log('State is not Provisioned. Got:', state)
                        }

                    }).catch((error) => {
                        console.log(error)
                    })
                }
            }
        }).catch((error:any) => {
            console.log(error)
        })
    }

    clientHandshake() {

        return new Promise((resolve, reject) => {
            this._xCloudPlayer.createOffer().then((offer:any) => {
                console.log('SDP Client:', offer.sdp)

                this._apiClient.sendSdp(offer.sdp).then((sdpAnswer:any) => {
                    console.log('SDP Server:', sdpAnswer)

                    this._xCloudPlayer.setRemoteOffer(sdpAnswer.sdp)
                    const candidates = this._xCloudPlayer.getIceCandidates()

                    this._apiClient.sendIce(candidates[0].candidate).then((iceAnswer:any) => {
                        console.log('ICE Server:', iceAnswer)

                        this._xCloudPlayer.setIceCandidates(iceAnswer)

                        // @TODO: Setup Keepalive

                        this._xCloudPlayer.getEventBus().on('connectionstate', (event) => {
                            console.log(':: Connection state updated:', event)
    
                            if(event.state === 'connected'){
                                // We are connected
                                console.log(':: We are connected!')
    
                            } else if(event.state === 'closing'){
                                // Connection is closing
                                console.log(':: We are going to disconnect!')
    
                            } else if(event.state === 'closed'){
                                // Connection has been closed. We have to cleanup here
                                console.log(':: We are disconnected!')
                            }
                        })

                        resolve(true)

                    }).catch((error:any) => {
                        reject(error)
                    })

                }).catch((error:any) => {
                    reject(error)
                })

            }).catch((error) => {
                reject(error)
            })
        })

        // this._webrtcClient.createOffer().then((offer:any) => {
        //     // console.log('SDP Client:', offer)

        //     this._xCloudClient.sendSdp(offer.sdp).then((sdpAnswer:any) => {
        //         // console.log('SDP Server:', sdpAnswer)

        //         this._webrtcClient.setRemoteOffer(sdpAnswer.sdp)

        //         // Continue with ICE
        //         const candidates = this._webrtcClient.getIceCandidates()
        //         this._xCloudClient.sendIce(candidates[0].candidate).then((iceAnswer:any) => {
        //             // console.log('ICE Server:', iceAnswer)

        //             this._webrtcClient.setIceCandidates(iceAnswer)

        //             // Setup keepAlive timer
        //             this._keepAliveInterval = setInterval(() => {
        //                 this._xCloudClient.sendKeepalive()
        //             }, 60000)

        //             this._webrtcClient.getEventBus().on('connectionstate', (event) => {
        //                 console.log(':: Connection state updated:', event)

        //                 if(event.state === 'connected'){
        //                     // We are connected
        //                     console.log(':: We are connected!')

        //                     this._streamStarted()

        //                 } else if(event.state === 'closing'){
        //                     // Connection is closing
        //                     console.log(':: We are going to disconnect!')

        //                 } else if(event.state === 'closed'){
        //                     // Connection has been closed. We have to cleanup here
        //                     console.log(':: We are disconnected!')
        //                     this._streamStopped()
        //                 }
        //             })

        //             resolve(true)

        //         }).catch((error) => {
        //             reject(error)
        //         })

        //     }).catch((error) => {
        //         reject(error)
        //     })

        // }).catch((error) => {
        //     reject(error)
        // })
    }
}

new xCloudWeb()