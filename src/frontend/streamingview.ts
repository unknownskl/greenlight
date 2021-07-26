import Application from "./application";
import StreamClient from "./streamclient";
// const xCloudClient from '../xsdk/client.js'

export default class StreamingView {

    _application:Application
    _streamClient:StreamClient

    _streamActive = false
    _lastMouseMovement = 0
    _mouseInterval:any

    _networkIndicatorLastToggle = 0

    _showDebug = false

    // _quality = {
    //     video: 'bad',
    //     audio: 'unknown',
    //     metadata: 'unknown',
    //     gamepad: 'unknown',
    // }

    _qualityVideo = 'perfect'
    _qualityAudio = 'perfect'
    _qualityMetadata = 'perfect'
    _qualityGamepad = 'perfect'

    constructor(application:Application){
        this._application = application

        console.log('StreamingView.js: Created view')

        document.onmousemove = () => {
            this._lastMouseMovement = Date.now()
        }
        document.onkeypress = (e:any) => {
            e = e || window.event;

            switch(e.keyCode){
                case 126:
                    this._showDebug = (this._showDebug === false) ? true : false
                    this.updateDebugLayer()
                    break;
            }
        };
        document.onkeydown = (e:any) => {
            e = e || window.event;
            console.log('pressed key:', e.keyCode)

            if(this._application._StreamingView._streamClient !== undefined){
                switch(e.keyCode){
                    case 38:
                        this._application._StreamingView._streamClient._webrtcClient.getChannelProcessor('input').pressButton(0, { DPadUp: 1 })
                        break;
                    case 40:
                        this._application._StreamingView._streamClient._webrtcClient.getChannelProcessor('input').pressButton(0, { DPadDown: 1 })
                        break;
                    case 37:
                        this._application._StreamingView._streamClient._webrtcClient.getChannelProcessor('input').pressButton(0, { DPadLeft: 1 })
                        break;
                    case 39:
                        this._application._StreamingView._streamClient._webrtcClient.getChannelProcessor('input').pressButton(0, { DPadRight: 1 })
                        break;
                    case 13:
                    case 65:
                        this._application._StreamingView._streamClient._webrtcClient.getChannelProcessor('input').pressButton(0, { A: 1 })
                        break;
                    case 8:
                    case 66:
                        this._application._StreamingView._streamClient._webrtcClient.getChannelProcessor('input').pressButton(0, { B: 1 })
                        break;
                    case 88:
                        this._application._StreamingView._streamClient._webrtcClient.getChannelProcessor('input').pressButton(0, { X: 1 })
                        break;
                    case 89:
                        this._application._StreamingView._streamClient._webrtcClient.getChannelProcessor('input').pressButton(0, { Y: 1 })
                        break;
                    case 78:
                        this._application._StreamingView._streamClient._webrtcClient.getChannelProcessor('input').pressButton(0, { Nexus: 1 })
                        break;
                    case 48:
                        this._application._StreamingView._streamClient._webrtcClient.getChannelProcessor('audio').softReset()
                        break;
                }
            }
        };

        // Display loading screen...
        const actionBar = (<HTMLInputElement>document.getElementById('loadingScreen'))
        actionBar.style.display = 'block'

        // Handle network indicator
        const checkNetworkIndicator = () => {

            let overallQuality = 'perfect'
            if((this._qualityVideo === 'good' || this._qualityAudio === 'good' || this._qualityMetadata === 'good' || this._qualityGamepad === 'good') && overallQuality === 'perfect'){
                overallQuality = 'good'
            }
            if((this._qualityVideo === 'low' || this._qualityAudio === 'low' || this._qualityMetadata === 'low' || this._qualityGamepad === 'low') && (overallQuality === 'good' || overallQuality === 'perfect')){
                overallQuality = 'low'
            }
            if((this._qualityVideo === 'bad' || this._qualityAudio === 'bad' || this._qualityMetadata === 'bad' || this._qualityGamepad === 'bad') && (overallQuality === 'bad' || overallQuality === 'good' || overallQuality === 'perfect')){
                overallQuality = 'bad'
            }

            const niVideo = (<HTMLInputElement>document.getElementById('niVideo'))
            const niAudio = (<HTMLInputElement>document.getElementById('niAudio'))
            const niMetadata = (<HTMLInputElement>document.getElementById('niMetadata'))
            const niGamepad = (<HTMLInputElement>document.getElementById('niGamepad'))

            niVideo.innerHTML = (this._qualityVideo === 'perfect' || this._qualityVideo === 'good') ? '&#x2713;' : this._qualityVideo
            niAudio.innerHTML = (this._qualityAudio === 'perfect' || this._qualityAudio === 'good') ? '&#x2713;' : this._qualityAudio
            niMetadata.innerHTML = (this._qualityMetadata === 'perfect' || this._qualityMetadata === 'good') ? '&#x2713;' : this._qualityMetadata
            niGamepad.innerHTML = (this._qualityGamepad === 'perfect' || this._qualityGamepad === 'good') ? '&#x2713;' : this._qualityGamepad


            console.log('stream quality is:', overallQuality)

            const actionBar = (<HTMLInputElement>document.getElementById('networkIndicator'))
            if(overallQuality === 'low' || overallQuality === 'bad'){
                // actionBar.style.display = 'block'
                if(actionBar.classList.contains('hidden'))
                    actionBar.classList.remove('hidden')

                this._networkIndicatorLastToggle = Math.floor(Date.now() / 1000)
            } else {
                if((Math.floor(Date.now() / 1000) - this._networkIndicatorLastToggle) > 3){
                    // actionBar.style.display = 'none'
                    if(! actionBar.classList.contains('hidden'))
                        actionBar.classList.add('hidden')

                    this._networkIndicatorLastToggle = Math.floor(Date.now() / 1000)
                }
            }
            

            setTimeout(checkNetworkIndicator, 500)
        }
        setTimeout(checkNetworkIndicator, 500)
    }

    startStream(type: string, serverId:string):void {
        console.log('StreamingView.js: Start stream for:', serverId)

        this._streamClient = new StreamClient()

        const streamStatus = (<HTMLInputElement>document.getElementById('streamStatus'))
        streamStatus.innerHTML = 'Connecting to: '+ serverId

        const loadingStatus = (<HTMLInputElement>document.getElementById('loadingStatus'))
        loadingStatus.innerHTML = 'Connecting to console: '+ serverId

        

        this._streamClient.start(this._application, type, serverId).then(() => {
            // this._streamClient._webrtcClient.addEventListener('connect', (event:any) => {
            //     const streamStatus = (<HTMLInputElement>document.getElementById('streamStatus'))
            //     streamStatus.innerHTML = 'Connecting to '+ event.serverId
            //     console.log('STREAM CONNECT')
            // })
    
            // this._streamClient._webrtcClient.addEventListener('openstream', (event:any) => {
            //     const streamStatus = (<HTMLInputElement>document.getElementById('streamStatus'))
            //     streamStatus.innerHTML = 'Connected to '+ event.serverId
            //     console.log('STREAM CONNECTED')
            // })

            this.streamIsReady()

            // const streamStatus = (<HTMLInputElement>document.getElementById('streamStatus'))
            streamStatus.innerHTML = 'Connected to: '+ serverId
            loadingStatus.innerHTML = 'Connected to console: '+ serverId +'.<br /> Waiting for video stream...'


            setTimeout(() => {
                const loadingPage = (<HTMLInputElement>document.getElementById('loadingScreen'))
                loadingPage.style.display = 'none'

                const videoHolder = (<HTMLInputElement>document.getElementById('videoHolder'))
                videoHolder.style.display = 'block'

                const videoRender = (<HTMLInputElement>document.getElementById('videoRender'))
                videoRender.width = videoHolder.clientWidth
                videoRender.height = videoHolder.clientHeight
            }, 1000)

            // Show link in menubar
            const activeStreamingView = (<HTMLInputElement>document.getElementById('actionBarStreamingViewActive'))
            const actionBarStreamingDisconnect = (<HTMLInputElement>document.getElementById('actionBarStreamingDisconnect'))
            const actionBarStreamingDisconnectElem = (<HTMLInputElement>document.getElementById('actionBarStreamingDisconnect'))
            activeStreamingView.style.display = (this._streamActive === true) ? 'block': 'none'
            actionBarStreamingDisconnectElem.style.display = (this._streamActive === true) ? 'block': 'none'
            
            actionBarStreamingDisconnect.addEventListener('click', () => {
                // alert('Disconnect stream')
                this._streamClient.disconnect()
            })

            // FPS Counters
            this._streamClient._webrtcClient.getChannelProcessor('video').addEventListener('fps', (event:any) => {
                // console.log('FPS Event:', event)
                document.getElementById('videoFpsCounter').innerHTML = event.fps
            })
            this._streamClient._webrtcClient.getChannelProcessor('video').addEventListener('latency', (event:any) => {
                // console.log('FPS Event:', event)
                document.getElementById('videoLatencyCounter').innerHTML = 'min: '+event.minLatency+'ms / avg: '+event.avgLatency+'ms / max: '+event.maxLatency+'ms'
                
                if(event.maxLatency > 25 && event.maxLatency <= 50){
                    this._qualityVideo = 'good'
                } else if(event.maxLatency > 50 && event.maxLatency < 100){
                    this._qualityVideo = 'low'
                } else if(event.maxLatency > 100){
                    this._qualityVideo = 'bad'
                } else {
                    this._qualityVideo = 'perfect'
                }
            })
            this._streamClient._webrtcClient.getChannelProcessor('audio').addEventListener('fps', (event:any) => {
                // console.log('FPS Event:', event)
                document.getElementById('audioFpsCounter').innerHTML = event.fps
            })
            this._streamClient._webrtcClient.getChannelProcessor('audio').addEventListener('latency', (event:any) => {
                // console.log('FPS Event:', event)
                document.getElementById('audioLatencyCounter').innerHTML = 'min: '+event.minLatency+'ms / avg: '+event.avgLatency+'ms / max: '+event.maxLatency+'ms'
                
                if(event.maxLatency > 25 && event.maxLatency <= 50){
                    this._qualityAudio = 'good'
                } else if(event.maxLatency > 50 && event.maxLatency < 100){
                    this._qualityAudio = 'low'
                } else if(event.maxLatency > 100){
                    this._qualityAudio = 'bad'
                } else {
                    this._qualityAudio = 'perfect'
                }
            })
            this._streamClient._webrtcClient.getChannelProcessor('input').addEventListener('latency', (event:any) => {
                // console.log('FPS Event:', event)
                document.getElementById('inputLatencyCounter').innerHTML = 'min: '+event.minLatency+'ms / avg: '+event.avgLatency+'ms / max: '+event.maxLatency+'ms'
                
                if(event.maxLatency > 150 && event.maxLatency <= 300){
                    this._qualityMetadata = 'good'
                } else if(event.maxLatency > 300 && event.maxLatency <= 450){
                    this._qualityMetadata = 'low'
                } else if(event.maxLatency > 450){
                    this._qualityMetadata = 'bad'
                } else {
                    this._qualityMetadata = 'perfect'
                }
            })
            this._streamClient._webrtcClient.getChannelProcessor('input').addEventListener('gamepadlatency', (event:any) => {
                // console.log('FPS Event:', event)
                document.getElementById('gamepadLatencyCounter').innerHTML = 'min: '+event.minLatency+'ms / avg: '+event.avgLatency+'ms / max: '+event.maxLatency+'ms'
                
                if(event.maxLatency > 10 && event.maxLatency <= 25){
                    this._qualityGamepad = 'good'
                } else if(event.maxLatency > 25 && event.maxLatency < 100){
                    this._qualityGamepad = 'low'
                } else if(event.maxLatency > 100){
                    this._qualityGamepad = 'bad'
                } else {
                    this._qualityGamepad = 'perfect'
                }
            })

            // Debug: Bitrates:
            this._streamClient._webrtcClient.getChannelProcessor('video').addEventListener('bitrate', (event:any) => {
                // document.getElementById('videoBitrate').innerHTML = JSON.stringify(event)
                document.getElementById('videoBitrate').innerHTML = (event.videoBitrate/8)+' KBps / '+(event.packetBitrate/8)+' KBps'
            })
            this._streamClient._webrtcClient.getChannelProcessor('audio').addEventListener('bitrate', (event:any) => {
                document.getElementById('audioBitrate').innerHTML = JSON.stringify(event)
                // document.getElementById('audioBitrate').innerHTML = (event.audioBitrate/8)+' KBps'
            })

            // Debug: Performance
            this._streamClient._webrtcClient.getChannelProcessor('video').addEventListener('queue', (event:any) => {
                document.getElementById('videoPerformance').innerHTML = JSON.stringify(event)
            })
            this._streamClient._webrtcClient.getChannelProcessor('video').addEventListener('latency', (event:any) => {
                document.getElementById('videoLatency').innerHTML = JSON.stringify(event)
            })
            this._streamClient._webrtcClient.getChannelProcessor('audio').addEventListener('queue', (event:any) => {
                document.getElementById('audioPerformance').innerHTML = JSON.stringify(event)
            })
            this._streamClient._webrtcClient.getChannelProcessor('audio').addEventListener('latency', (event:any) => {
                document.getElementById('audioLatency').innerHTML = JSON.stringify(event)
            })
            this._streamClient._webrtcClient.getChannelProcessor('input').addEventListener('queue', (event:any) => {
                document.getElementById('inputPerformance').innerHTML = JSON.stringify(event)
            })
            this._streamClient._webrtcClient.getChannelProcessor('input').addEventListener('latency', (event:any) => {
                document.getElementById('inputLatency').innerHTML = JSON.stringify(event)
            })

            // Dialogs
            this._streamClient._webrtcClient.getChannelProcessor('message').addEventListener('dialog', (event:any) => {
                console.log('Got dialog event:', event)

                document.getElementById('modalDialog').style.display = 'block'

                document.getElementById('dialogTitle').innerHTML = event.TitleText
                document.getElementById('dialogText').innerHTML = event.ContentText

                if(event.CommandLabel1 !== '')
                    document.getElementById('dialogButton1').innerHTML = event.CommandLabel1
                else 
                    document.getElementById('dialogButton1').style.display = 'none'
                
                if(event.CommandLabel2 !== '')
                    document.getElementById('dialogButton2').innerHTML = event.CommandLabel2
                else 
                    document.getElementById('dialogButton2').style.display = 'none'

                if(event.CommandLabel3 !== '')
                    document.getElementById('dialogButton3').innerHTML = event.CommandLabel3
                else 
                    document.getElementById('dialogButton3').style.display = 'none'

                // if(event.CancelIndex != event.DefaultIndex){
                    const primaryIndex = (event.DefaultIndex+1)
                    console.log('prim index', primaryIndex)
                    document.getElementById('dialogButton'+primaryIndex).classList.add("btn-primary")
                // }

                // var cancelIndex = (event.CancelIndex+1)
                // document.getElementById('dialogButton'+cancelIndex).classList.add("btn-cancel")

                document.getElementById('dialogButton1').onclick = (clickEvent) =>{
                    this._streamClient._webrtcClient.getChannelProcessor('message').sendTransaction(event.id, { Result: 0 })
                    resetDialog()
                }
                document.getElementById('dialogButton2').onclick = (clickEvent) => {
                    this._streamClient._webrtcClient.getChannelProcessor('message').sendTransaction(event.id, { Result: 1 })
                    resetDialog()
                }
                document.getElementById('dialogButton3').onclick = (clickEvent) => {
                    this._streamClient._webrtcClient.getChannelProcessor('message').sendTransaction(event.id, { Result: 2 })
                    resetDialog()
                }
            })

            const resetDialog = function(){
                document.getElementById('modalDialog').style.display = 'none'

                document.getElementById('dialogTitle').innerHTML = 'No active dialog'
                document.getElementById('dialogText').innerHTML = 'There is no active dialog. This is an error. Please try gain.'
                document.getElementById('dialogButton1').innerHTML = 'Button1'
                document.getElementById('dialogButton2').innerHTML = 'Button2'
                document.getElementById('dialogButton3').innerHTML = 'Button3'

                document.getElementById('dialogButton1').style.display = 'inline-block'
                document.getElementById('dialogButton2').style.display = 'inline-block'
                document.getElementById('dialogButton3').style.display = 'inline-block'

                document.getElementById('dialogButton1').classList.remove("btn-primary")
                document.getElementById('dialogButton2').classList.remove("btn-primary")
                document.getElementById('dialogButton3').classList.remove("btn-primary")
                document.getElementById('dialogButton1').classList.remove("btn-cancel")
                document.getElementById('dialogButton2').classList.remove("btn-cancel")
                document.getElementById('dialogButton3').classList.remove("btn-cancel")

                document.getElementById('dialogButton1').onclick = function(){}
                document.getElementById('dialogButton2').onclick = function(){}
                document.getElementById('dialogButton3').onclick = function(){}
            }

        }).catch((error) => {
            console.log('StreamingView.js: Start stream error:', error)
        })

        // const client = new xCloudClient()
        // console.log(client)
    }

    streamIsReady():void {
        this._streamActive = true

        this._mouseInterval = setInterval(() => {
            const lastMovement = (Date.now()-this._lastMouseMovement)/1000
            // console.log('last Movement:', lastMovement)

            if(lastMovement > 3){
                const actionBar = (<HTMLInputElement>document.getElementById('actionBar'))
                // actionBar.style.display = 'none'
                if(! actionBar.classList.contains('hidden'))
                        actionBar.classList.add('hidden')
            } else {
                const actionBar = (<HTMLInputElement>document.getElementById('actionBar'))
                // actionBar.style.display = 'block'
                if(actionBar.classList.contains('hidden'))
                        actionBar.classList.remove('hidden')
            }
        }, 250)
    }

    updateDebugLayer(){
        const debugRightTop = (<HTMLInputElement>document.getElementById('debugRightTop'))
        const debugRightBottom = (<HTMLInputElement>document.getElementById('debugRightBottom'))
        const debugLeftBottom = (<HTMLInputElement>document.getElementById('debugLeftBottom'))

        debugRightTop.style.display = (this._showDebug === true) ? 'block' : 'none'
        debugRightBottom.style.display = (this._showDebug === true) ? 'block' : 'none'
        debugLeftBottom.style.display = (this._showDebug === true) ? 'block' : 'none'
    }

    load(){
        return new Promise((resolve, reject) => {
            console.log('StreamingView.js: Loaded view')

            if(this._mouseInterval != undefined){
                this._mouseInterval = setInterval(() => {
                    const lastMovement = (Date.now()-this._lastMouseMovement)/1000
                    // console.log('last Movement:', lastMovement)

                    if(lastMovement > 5){
                        const actionBar = (<HTMLInputElement>document.getElementById('actionBar'))
                        actionBar.style.display = 'none'
                    } else {
                        const actionBar = (<HTMLInputElement>document.getElementById('actionBar'))
                        actionBar.style.display = 'block'
                    }
                }, 1000)
            }

            resolve(true)
        })
    }

    unload(){
        return new Promise((resolve, reject) => {

            console.log('StreamingView.js: Unloaded view')
            clearInterval(this._mouseInterval)

            resolve(true)

        })
        
        
    }
}