import Application from "./application";
const xboxClient = require('../assets/xsdk/client.js')

// interface EmptyArray {
// }

export default class StreamClient {

    _application: Application;
    _webrtcClient: any;

    _serverId: string;

    _sessionId: string;
    _sessionPath: string;

    constructor(){
        return this
    }

    start(application:Application, type: string, serverId: string) {
        return new Promise((resolve, reject) => {

            console.log('StreamClient.js: Starting stream to:', serverId, '('+type+')')

            this._application = application
            this._serverId = serverId

            if(type === 'xhome'){
                // Starting session
                this.startOrGetSession(this._serverId, true).then((data:any) => {
                    this._sessionId = data.sessionId
                    this._sessionPath = data.sessionPath

                    console.log('StreamClient.js: Console is provisioned. Lets connect...')

                    this.isExchangeReady('state').then((data:any) => {
                        this._webrtcClient = new xboxClient(this._application)
                        this._webrtcClient.startWebrtcConnection()

                        this._webrtcClient.addEventListener('openstream', () => {
                            resolve('ok')
                        })
                    }).catch((error) => {
                        reject(error)
                    })
                }).catch((error) => {
                    reject(error)
                })
            } else if(type === 'xcloud') {
                this.requestXCloudConsole(serverId).then((sessionId) => {
                    console.log('sessionId:', sessionId)
                }).catch((error) => {
                    console.log(error)
                })

            }
        })
    }

    requestXCloudConsole(titleId:string){
        return new Promise((resolve, reject) => {
            const postData = {
                "titleId":titleId,
                "systemUpdateGroup":"",
                "settings": {
                    "nanoVersion":"V3;RtcdcTransport.dll",
                    "enableTextToSpeech":false,
                    "highContrast":0,
                    "locale":"en-US",
                    "useIceConnection":false,
                    "timezoneOffsetMinutes":120,
                    "sdkType":"web",
                    "osName":"windows"
                },
                "serverId": "",
                "fallbackRegionNames": [Array]
            }

            fetch('https://weu.gssv-play-prod.xboxlive.com/v5/sessions/cloud/play', {
                method: 'POST', // *GET, POST, PUT, DELETE, etc.
                cache: 'no-cache',
                headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer '+this._application._tokenStore._streamingToken
                },
                body: JSON.stringify(postData)
            }).then((response) => {
                if(response.status !== 200 && response.status !== 202){
                    console.log('Error fetching consoles. Status:', response.status, 'Body:', response.body)
                } else {
                    response.json().then((data) => {

                        
                        if(data.sessionPath !== undefined){
                            resolve(data.sessionPath)
                        } else {
                            resolve(data)
                        }

                    }).catch((error) => {
                        reject(error)
                    })
                    // const responseData = JSON.parse(response.body);
                }
            }).catch((error) => {
                reject(error)
            });
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
        actionBarStreamingViewActive.style.display = 'none'
        actionBarStreamingDisconnect.style.display = 'none'

        this._webrtcClient.stopWebrtcConnection()

        const videoHolder = (<HTMLInputElement>document.getElementById('videoHolder'))
        videoHolder.innerHTML = ''
    }

    startOrGetSession(serverId:string, firstStart: boolean) {
        return new Promise((resolve, reject) => {
            const postData = {
                "titleId":"",
                "systemUpdateGroup":"",
                "settings": {
                    "nanoVersion":"V3;RtcdcTransport.dll",
                    "enableTextToSpeech":false,
                    "highContrast":0,
                    "locale":"en-US",
                    "useIceConnection":false,
                    "timezoneOffsetMinutes":120,
                    "sdkType":"web",
                    "osName":"windows"
                },
                "serverId": serverId,
                "fallbackRegionNames": [Array]
            }
            
            const streamClient = this

            fetch('https://uks.gssv-play-prodxhome.xboxlive.com/v4/sessions/home/play', {
                method: 'POST', // *GET, POST, PUT, DELETE, etc.
                cache: 'no-cache',
                headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer '+this._application._tokenStore._streamingToken
                // 'Content-Type': 'application/x-www-form-urlencoded',
                },
                body: JSON.stringify(postData)
            }).then((response) => {
                if(response.status !== 200 && response.status !== 202){
                    console.log('Error fetching consoles. Status:', response.status, 'Body:', response.body)
                } else {
                    response.json().then((data) => {

                        
                        if(data.state === 'Provisioning'){
                            // setTimeout(() => {
                            //     streamClient.startOrGetSession(serverId).then((data:any) => {
                            //         resolve(data)
                            //     }).catch((error) => {
                            //         reject(error)
                            //     })
                            // }, 1000)
                            resolve(data)
                        } else {
                            resolve(data)
                        }

                        // this.showConsoles(data.results)

                    }).catch((error) => {
                        reject(error)
                    })
                    // const responseData = JSON.parse(response.body);
                }
            }).catch((error) => {
                reject(error)
            });
        })
    }

    sendSdp(sdp: string){
        return new Promise((resolve, reject) => {
            const postData = {
                "messageType":"offer",
                "sdp": sdp,
                "configuration":{
                   "containerizeVideo":true,
                   "requestedH264Profile":2,
                   "chatConfiguration":{
                      "bytesPerSample":2,
                      "expectedClipDurationMs":100,
                      "format":{
                         "codec":"opus",
                         "container":"webm"
                      },
                      "numChannels":1,
                      "sampleFrequencyHz":24000
                   },
                   "audio":{
                      "minVersion":1,
                      "maxVersion":1
                   },
                   "chat":{
                      "minVersion":1,
                      "maxVersion":1
                   },
                   "control":{
                      "minVersion":1,
                      "maxVersion":1
                   },
                   "input":{
                      "minVersion":1,
                      "maxVersion":4
                   },
                   "message":{
                      "minVersion":1,
                      "maxVersion":1
                   },
                   "video":{
                      "minVersion":1,
                      "maxVersion":2
                   }
                }
            }
            
            // const streamClient = this

            fetch('https://uks.gssv-play-prodxhome.xboxlive.com/v4/sessions/home/'+ this._sessionId +'/sdp', {
                method: 'POST', // *GET, POST, PUT, DELETE, etc.
                cache: 'no-cache',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': 'Bearer '+this._application._tokenStore._streamingToken
                },
                body: JSON.stringify(postData)
            }).then((response) => {
                if(response.status !== 202){
                    console.log('StreamClient.js: Error sending SDP state. Status:', response.status, 'Body:', response.body)
                } else {
                    resolve('ok')
                }
            }).catch((error) => {
                reject(error)
            });
        })
    }

    sendIce(ice: string){
        return new Promise((resolve, reject) => {
            const postData = {
                "messageType": "iceCandidate",
                "candidate": ice
            }
            
            // const streamClient = this

            fetch('https://uks.gssv-play-prodxhome.xboxlive.com/v4/sessions/home/'+ this._sessionId +'/ice', {
                method: 'POST', // *GET, POST, PUT, DELETE, etc.
                cache: 'no-cache',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': 'Bearer '+this._application._tokenStore._streamingToken
                },
                body: JSON.stringify(postData)
            }).then((response) => {
                if(response.status !== 202){
                    console.log('StreamClient.js: Error sending ICE candidates. Status:', response.status, 'Body:', response.body)
                } else {
                    resolve('ok')
                }
            }).catch((error) => {
                reject(error)
            });
        })
    }

    isExchangeReady(path:string) {
        return new Promise((resolve, reject) => {

            const url = "https://uks.gssv-play-prodxhome.xboxlive.com/v4/sessions/home/"+this._sessionId+'/'+path

            fetch(url, {
                method: 'GET',
                cache: 'no-cache',
                headers: {
                    'Content-Type': 'application/json; charset=utf-8',
                    'Authorization': 'Bearer '+this._application._tokenStore._streamingToken
                },
            }).then(response => {
                if(response.status !== 200){
                    console.log('StreamClient.js: '+url+' - Waiting...')
                    setTimeout(() => {
                        this.isExchangeReady(path).then((data) => {
                            resolve(data)
                        }).catch((error)  => {
                            reject(error)
                        })
                    }, 1000)
                } else {
                    if(path == 'state'){
                        response.json().then(data => {
                            if(data.state === 'Provisioning'){
                                console.log('StreamClient.js: '+url+' - Waiting... State:', data.state)
                                setTimeout(() => {
                                    this.isExchangeReady(path).then((data) => {
                                        resolve(data)
                                    }).catch((error)  => {
                                        reject(error)
                                    })
                                }, 1000)
                            } else if(data.state === 'Provisioned') {

                                const streamStatusDetailed = (<HTMLInputElement>document.getElementById('streamStatusDetailed'))
                                streamStatusDetailed.innerHTML = 'Provisioned. Opening connection...'

                                resolve(data)
                            } else {
                                reject(data)
                            }
                        })
                    } else {
                        response.json().then(data => {
                            console.log('StreamClient.js: '+url+' - Ready! Got data:', data)
                            resolve(data)
                        })
                    }
                }
            })
        })
    }

}