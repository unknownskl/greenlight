import Application from "./application";
import StreamClient from "./streamclient";
// const xCloudClient from '../xsdk/client.js'

export default class StreamingView {

    _application:Application;
    _streamClient:StreamClient;

    _streamActive = false
    _lastMouseMovement = 0;
    _mouseInterval:any;

    _showDebug = false

    constructor(application:Application){
        this._application = application

        console.log('StreamingView.js: Created view')

        document.onmousemove = () => {
            this._lastMouseMovement = Date.now()
        }
        document.onkeypress = (e:any) => {
            e = e || window.event;
            console.log('pressed key:', e.keyCode)
            if(e.keyCode === 126) { // This is the tidle (~)
                this._showDebug = (this._showDebug === false) ? true : false
                this.updateDebugLayer()
            }
        };

        // Display loading screen...
        const actionBar = (<HTMLInputElement>document.getElementById('loadingScreen'))
        actionBar.style.display = 'block'
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
            })
            this._streamClient._webrtcClient.getChannelProcessor('audio').addEventListener('fps', (event:any) => {
                // console.log('FPS Event:', event)
                document.getElementById('audioFpsCounter').innerHTML = event.fps
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
            this._streamClient._webrtcClient.getChannelProcessor('input').addEventListener('queue', (event:any) => {
                document.getElementById('inputPerformance').innerHTML = JSON.stringify(event)
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

            if(lastMovement > 5){
                const actionBar = (<HTMLInputElement>document.getElementById('actionBar'))
                actionBar.style.display = 'none'
            } else {
                const actionBar = (<HTMLInputElement>document.getElementById('actionBar'))
                actionBar.style.display = 'block'
            }
        }, 1000)
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