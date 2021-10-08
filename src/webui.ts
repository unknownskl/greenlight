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

                            const config = {
                                ui_systemui: [32],
                                input_driver: new GamepadDriver()
                            }
                            this._xCloudPlayer = new xCloudPlayer('xCloudRender', config)

                            this.clientHandshake().then(() => {
                                //
                                console.log('Clienthandshake is done!!')

                                // Set size to fullscreen
                                document.getElementById('xCloudRender').style.position = 'absolute'
                                document.getElementById('xCloudRender').style.width = '100%'
                                document.getElementById('xCloudRender').style.height = '100%'
                                document.getElementById('xCloudRender').style.top = '0'
                                document.getElementById('xCloudRender').style.left = '0'
                                document.getElementById('xCloudRender').style.right = '0'
                                document.getElementById('xCloudRender').style.bottom = '0'
                                document.getElementById('xCloudRender').style.backgroundColor = '#000000'

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

        // Setup xCloud
        document.getElementById('xCloud_startstream').onclick = () => {
            const titleId = (document.getElementById('xCloudTitleid') as any).value
            console.log('Start stream for xCloud title:', titleId)

            this._apiClient.startStream('xcloud', titleId).then((state:any) => {
                console.log('api response:', state)

                if(state.state === 'Provisioned') {
                    // Lets do the handshake thingie...

                    const config = {
                        ui_systemui: [32],
                        input_driver: new GamepadDriver()
                    }
                    this._xCloudPlayer = new xCloudPlayer('xCloudRender', config)

                    this.clientHandshake().then(() => {
                        //
                        console.log('Clienthandshake is done!!')

                        // Set size to fullscreen
                        document.getElementById('xCloudRender').style.position = 'absolute'
                        document.getElementById('xCloudRender').style.width = '100%'
                        document.getElementById('xCloudRender').style.height = '100%'
                        document.getElementById('xCloudRender').style.top = '0'
                        document.getElementById('xCloudRender').style.left = '0'
                        document.getElementById('xCloudRender').style.right = '0'
                        document.getElementById('xCloudRender').style.bottom = '0'
                        document.getElementById('xCloudRender').style.backgroundColor = '#000000'


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

class GamepadDriver {

    _application:xCloudPlayer

    _gamepads:Array<any> = []

    constructor() {
        //
    }

    setApplication(application:xCloudPlayer) {
        this._application = application
    }

    start() {
        // window.addEventListener("gamepadconnected", (e) => {

        //     const gamepad = {
        //         index: e.gamepad.index,
        //         name: e.gamepad.id,
        //         buttons: e.gamepad.buttons,
        //         axes: e.gamepad.axes,
        //     }
        //     this._gamepads.push(gamepad)

        //     this._application.getEventBus().emit('gamepad_connect', gamepad)
        //     console.log('xCloudPlayer WebUI.ts - Controller connected:', this._gamepads)

        //     document.getElementById('gamepadButtons').innerHTML = JSON.stringify(gamepad)
        // })

        // window.addEventListener("gamepaddisconnected", (e) => {
        //     for(const gamepad in this._gamepads){
        //         if(this._gamepads[gamepad].index === e.gamepad.index){
        //             const removedGamepad = this._gamepads[gamepad]
        //             this._gamepads.splice(e.gamepad.index, 1)

        //             this._application.getEventBus().emit('gamepad_disconnect', removedGamepad)
        //             console.log('xCloudPlayer WebUI.ts - Controller disconnected:', this._gamepads)

        //             document.getElementById('gamepadButtons').innerHTML = 'Controller disconnected'
        //         }
        //     }
        // })

        // function runAnimation() {
        //     const gamepads = navigator.getGamepads()
        //     document.getElementById('gamepadButtonsframe').innerHTML = JSON.stringify(gamepads)

        //     window.requestAnimationFrame(runAnimation)
        // }

        // window.requestAnimationFrame(runAnimation)

        // setInterval(() => {
        //     console.log('loop')
        //     document.getElementById('gamepadButtons').innerHTML = 'Gamepad is started...' // JSON.stringify(navigator.getGamepads())
        // }, 1000)
    }



    stop() {
        // console.log('xCloudPlayer Driver/Gamepad.ts - Stop collecting events:', this._gamepads)
    }

    requestState() {
        // document.getElementById('gamepadButtons').innerHTML = JSON.stringify(navigator.getGamepads())

        const gamepads = navigator.getGamepads()
        for(let gamepad = 0; gamepad < gamepads.length; gamepad++){
            const gamepadState = gamepads[gamepad]
            
            if(gamepadState !== null){
                const state = this.mapStateLabels(gamepadState.buttons, gamepadState.axes)
                this._application.getChannelProcessor('input').queueGamepadState(state)
            }
        }
    }

    mapStateLabels(buttons:any, axes:any, gamepadIndex=0) {
        return {
            GamepadIndex: gamepadIndex,
            A: buttons[0].value,
            B: buttons[1].value,
            X: buttons[2].value,
            Y: buttons[3].value,
            LeftShoulder: buttons[4].value,
            RightShoulder: buttons[5].value,
            LeftTrigger: buttons[6].value,
            RightTrigger: buttons[7].value,
            View: buttons[8].value,
            Menu: buttons[9].value,
            LeftThumb: buttons[10].value,
            RightThumb: buttons[11].value,
            DPadUp: buttons[12].value,
            DPadDown: buttons[13].value,
            DPadLeft: buttons[14].value,
            DPadRight: buttons[15].value,
            Nexus: buttons[16]?.value || 0,
            LeftThumbXAxis: axes[0],
            LeftThumbYAxis: axes[1],
            RightThumbXAxis: axes[2],
            RightThumbYAxis: axes[3]
        }
    }
}

new xCloudWeb()