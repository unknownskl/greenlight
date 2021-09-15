import Application from "./application";
// const xboxClient = require('../assets/xsdk/client.js')

import {Client as xCloudPlayer} from 'xbox-xcloud-player'
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
                    console.log('SDP Client:', offer)

                    this._xCloudClient.sendSdp(offer.sdp).then((sdpAnswer:any) => {
                        console.log('SDP Server:', sdpAnswer)

                        this._webrtcClient.setRemoteOffer(sdpAnswer.sdp)

                        // Continue with ICE
                        const candidates = this._webrtcClient.getIceCandidates()
                        this._xCloudClient.sendIce(candidates[0].candidate).then((iceAnswer:any) => {
                            console.log('ICE Server:', iceAnswer)
    
                            this._webrtcClient.setIceCandidates(iceAnswer)
    
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

    // requestXCloudConsole(titleId:string){
    //     return new Promise((resolve, reject) => {
    //         const postData = {
    //             "titleId":titleId,
    //             "systemUpdateGroup":"",
    //             "settings": {
    //                 "nanoVersion":"V3;RtcdcTransport.dll",
    //                 "enableTextToSpeech":false,
    //                 "highContrast":0,
    //                 "locale":"en-US",
    //                 "useIceConnection":false,
    //                 "timezoneOffsetMinutes":120,
    //                 "sdkType":"web",
    //                 "osName":"windows"
    //             },
    //             "serverId": "",
    //             "fallbackRegionNames": [Array]
    //         }

    //         // console.log('tokens set: ', this._application._tokenStore)
    //         fetch('https://'+this._application._tokenStore._xCloudRegionHost+'/v5/sessions/cloud/play', {
    //             method: 'POST', // *GET, POST, PUT, DELETE, etc.
    //             cache: 'no-cache',
    //             headers: {
    //                 'Content-Type': 'application/json',
    //                 'Authorization': 'Bearer '+ this._application._tokenStore._xCloudStreamingToken
    //             },
    //             body: JSON.stringify(postData)
    //         }).then((response) => {
    //             if(response.status !== 200 && response.status !== 202){
    //                 console.log('Error fetching consoles. Status:', response.status, 'Body:', response.body)
    //             } else {
    //                 response.json().then((data) => {
    //                     if(data.sessionPath !== undefined){
    //                         const sessionSplit = data.sessionPath.split('/')
    //                         const session = sessionSplit[sessionSplit.length-1]
    //                         this._sessionId = session

    //                         this.isExchangeReady('state', 'https://'+this._application._tokenStore._xCloudRegionHost+'/'+data.sessionPath+'/state').then((data2:any) => {
    //                             if(data2.state === 'Provisioned'){
    //                                 // Stream is already provisioned and ready to go
    //                                 resolve(true)

    //                             } else if(data2.state === 'ReadyToConnect') {
    //                                 // Stream is already provisioned and ready to go
    //                                 this.xcloudAuth(this._application._tokenStore._msalToken, data.sessionPath).then((data3:any) => {

    //                                     this.isExchangeReady('state', 'https://'+this._application._tokenStore._xCloudRegionHost+'/'+data.sessionPath+'/state').then((data4) => {
    //                                         resolve(true)

    //                                     }).catch((error)  => {
    //                                         reject(error)
    //                                     })

    //                                 }).catch((error)  => {
    //                                     reject(error)
    //                                 })
    //                             } else {
    //                                 reject('Invalid state:'+ data2.state)
    //                             }

    //                         }).catch((error)  => {
    //                             reject(error)
    //                         })
    //                     } else {
    //                         reject('Failed too retrieve sessionPath from xCloud: '+ data.sessionPath)
    //                     }

    //                 }).catch((error) => {
    //                     reject(error)
    //                 })
    //                 // const responseData = JSON.parse(response.body);
    //             }
    //         }).catch((error) => {
    //             reject(error)
    //         });
    //     })
    // }

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

        // this._webrtcClient.stopWebrtcConnection()

        const videoHolder = (<HTMLInputElement>document.getElementById('videoHolder'))
        videoHolder.innerHTML = ''
    }

    // startOrGetSession(serverId:string, firstStart: boolean) {
    //     return new Promise((resolve, reject) => {
    //         const postData = {
    //             "titleId":"",
    //             "systemUpdateGroup":"",
    //             "settings": {
    //                 "nanoVersion":"V3;RtcdcTransport.dll",
    //                 "enableTextToSpeech":false,
    //                 "highContrast":0,
    //                 "locale":"en-US",
    //                 "useIceConnection":false,
    //                 "timezoneOffsetMinutes":120,
    //                 "sdkType":"web",
    //                 "osName":"windows"
    //             },
    //             "serverId": serverId,
    //             "fallbackRegionNames": [Array]
    //         }

    //         fetch('https://uks.gssv-play-prodxhome.xboxlive.com/v4/sessions/home/play', {
    //             method: 'POST', // *GET, POST, PUT, DELETE, etc.
    //             cache: 'no-cache',
    //             headers: {
    //             'Content-Type': 'application/json',
    //             'Authorization': 'Bearer '+this._application._tokenStore._streamingToken
    //             // 'Content-Type': 'application/x-www-form-urlencoded',
    //             },
    //             body: JSON.stringify(postData)
    //         }).then((response) => {
    //             if(response.status !== 200 && response.status !== 202){
    //                 console.log('Error fetching consoles. Status:', response.status, 'Body:', response.body)
    //             } else {
    //                 response.json().then((data) => {

    //                     if(data.state === 'Provisioning'){
    //                         // setTimeout(() => {
    //                         //     streamClient.startOrGetSession(serverId).then((data:any) => {
    //                         //         resolve(data)
    //                         //     }).catch((error) => {
    //                         //         reject(error)
    //                         //     })
    //                         // }, 1000)
    //                         resolve(data)
    //                     } else {
    //                         resolve(data)
    //                     }

    //                     // this.showConsoles(data.results)

    //                 }).catch((error) => {
    //                     reject(error)
    //                 })
    //                 // const responseData = JSON.parse(response.body);
    //             }
    //         }).catch((error) => {
    //             reject(error)
    //         });
    //     })
    // }

    // sendSdp(sdp: string){
    //     return new Promise((resolve, reject) => {
    //         const postData = {
    //             "messageType":"offer",
    //             "sdp": sdp,
    //             "configuration":{
    //                "containerizeVideo":true,
    //                "requestedH264Profile":2,
    //                "chatConfiguration":{
    //                   "bytesPerSample":2,
    //                   "expectedClipDurationMs":100,
    //                   "format":{
    //                      "codec":"opus",
    //                      "container":"webm"
    //                   },
    //                   "numChannels":1,
    //                   "sampleFrequencyHz":24000
    //                },
    //                "audio":{
    //                   "minVersion":1,
    //                   "maxVersion":1
    //                },
    //                "chat":{
    //                   "minVersion":1,
    //                   "maxVersion":1
    //                },
    //                "control":{
    //                   "minVersion":1,
    //                   "maxVersion":1
    //                },
    //                "input":{
    //                   "minVersion":1,
    //                   "maxVersion":4
    //                },
    //                "message":{
    //                   "minVersion":1,
    //                   "maxVersion":1
    //                },
    //                "video":{
    //                   "minVersion":1,
    //                   "maxVersion":2
    //                }
    //             }
    //         }
            
    //         // const streamClient = this
    //         let sdpUrl:string

    //         if(this._type === 'xhome'){
    //             sdpUrl = 'https://uks.gssv-play-prodxhome.xboxlive.com/v4/sessions/home/'+ this._sessionId +'/sdp'
    //         } else {
    //             sdpUrl = "https://"+this._application._tokenStore._xCloudRegionHost+"/v5/sessions/cloud/"+this._sessionId+"/sdp"
    //         }

    //         fetch(sdpUrl, {
    //             method: 'POST', // *GET, POST, PUT, DELETE, etc.
    //             cache: 'no-cache',
    //             headers: {
    //                 'Content-Type': 'application/json',
    //                 'Authorization': (this._type === 'xcloud') ? 'Bearer '+this._application._tokenStore._xCloudStreamingToken : 'Bearer '+this._application._tokenStore._streamingToken
    //             },
    //             body: JSON.stringify(postData)
    //         }).then((response) => {
    //             if(response.status !== 202){
    //                 console.log('StreamClient.js: Error sending SDP state. Status:', response.status, 'Body:', response.body)
    //             } else {
    //                 resolve('ok')
    //             }
    //         }).catch((error) => {
    //             reject(error)
    //         });
    //     })
    // }

    sendKeepalive(){
        return new Promise((resolve, reject) => {
            fetch('https://' + this._host + '/' + this._sessionPath + '/keepalive', {
                method: 'POST', // *GET, POST, PUT, DELETE, etc.
                cache: 'no-cache',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': (this._type === 'xcloud') ? 'Bearer '+this._application._tokenStore._xCloudStreamingToken : 'Bearer '+this._application._tokenStore._streamingToken
                }
            }).then((response) => {
                if(response.status !== 200){
                    console.log('StreamClient.js: Error sending ICE candidates. Status:', response.status, 'Body:', response.body)
                    reject({
                        status: response.status
                    })
                } else {
                    resolve('ok')
                }
            }).catch((error) => {
                reject(error)
            });
        })
    }

    // sendIce(ice: string){
    //     return new Promise((resolve, reject) => {
    //         const postData = {
    //             "messageType": "iceCandidate",
    //             "candidate": ice
    //         }
            
    //         // const streamClient = this
    //         let iceUrl:string

    //         if(this._type === 'xhome'){
    //             iceUrl = 'https://uks.gssv-play-prodxhome.xboxlive.com/v4/sessions/home/'+ this._sessionId +'/ice'
    //         } else {
    //             iceUrl = "https://"+this._application._tokenStore._xCloudRegionHost+"/v5/sessions/cloud/"+this._sessionId+"/ice"
    //         }

    //         fetch(iceUrl, {
    //             method: 'POST', // *GET, POST, PUT, DELETE, etc.
    //             cache: 'no-cache',
    //             headers: {
    //                 'Content-Type': 'application/json',
    //                 'Authorization': (this._type === 'xcloud') ? 'Bearer '+this._application._tokenStore._xCloudStreamingToken : 'Bearer '+this._application._tokenStore._streamingToken
    //             },
    //             body: JSON.stringify(postData)
    //         }).then((response) => {
    //             if(response.status !== 202){
    //                 console.log('StreamClient.js: Error sending ICE candidates. Status:', response.status, 'Body:', response.body)
    //             } else {
    //                 resolve('ok')
    //             }
    //         }).catch((error) => {
    //             reject(error)
    //         });
    //     })
    // }

    // xcloudAuth(userToken:string, sessionPath:string){
    //     return new Promise((resolve, reject) => {
    //         const postData = {
    //             "userToken": userToken
    //         }

    //         // console.log('tokens set: ', this._application._tokenStore)
    //         fetch('https://'+this._application._tokenStore._xCloudRegionHost+'/'+sessionPath+'/connect', {
    //             method: 'POST', // *GET, POST, PUT, DELETE, etc.
    //             cache: 'no-cache',
    //             headers: {
    //                 'Content-Type': 'application/json',
    //                 'Authorization': 'Bearer '+ this._application._tokenStore._xCloudStreamingToken
    //             },
    //             body: JSON.stringify(postData)
    //         }).then((response) => {
    //             if(response.status !== 200 && response.status !== 202){
    //                 console.log('Error sending login command. Status:', response.status, 'Body:', response.body)
    //                 reject('/connect call failed')
    //             } else {
    //                 // console.log('OK:', response.status, 'Body:', response.body)
    //                 resolve(response.status)
    //             }
    //         }).catch((error) => {
    //             reject(error)
    //         })
    //     })
    // }

    // isExchangeReady(path:string, fullPath?:string) {
    //     return new Promise((resolve, reject) => {

    //         let url:string

    //         if(fullPath === undefined){
    //             if(this._type === 'xhome'){
    //                 url = "https://uks.gssv-play-prodxhome.xboxlive.com/v4/sessions/home/"+this._sessionId+'/'+path
    //             } else {
    //                 url = "https://"+this._application._tokenStore._xCloudRegionHost+"/v5/sessions/cloud/"+this._sessionId+"/"+path
    //             }
    //         } else {
    //             url = fullPath
    //         }

    //         fetch(url, {
    //             method: 'GET',
    //             cache: 'no-cache',
    //             headers: {
    //                 'Content-Type': 'application/json; charset=utf-8',
    //                 'Authorization': (this._type === 'xcloud') ? 'Bearer '+this._application._tokenStore._xCloudStreamingToken : 'Bearer '+this._application._tokenStore._streamingToken
    //             },
    //         }).then(response => {
    //             if(response.status !== 200){
    //                 console.log('StreamClient.js: '+url+' - Waiting...')
    //                 setTimeout(() => {
    //                     this.isExchangeReady(path, fullPath).then((data:any) => {
    //                        resolve(data)
    //                     }).catch((error)  => {
    //                         reject(error)
    //                     })
    //                 }, 1000)
    //             } else {
    //                 if(path == 'state'){
    //                     response.json().then(data => {
    //                         if(data.state === 'Provisioning' || data.state === 'WaitingForResources'){
    //                             console.log('StreamClient.js: '+url+' - Waiting... State:', data.state)
    //                             setTimeout(() => {
    //                                 this.isExchangeReady(path, fullPath).then((data) => {
    //                                     resolve(data)
    //                                 }).catch((error)  => {
    //                                     reject(error)
    //                                 })
    //                             }, 1000)
    //                         } else if(data.state === 'Provisioned' || data.state === 'ReadyToConnect') {

    //                             const streamStatusDetailed = (<HTMLInputElement>document.getElementById('streamStatusDetailed'))
    //                             streamStatusDetailed.innerHTML = 'Provisioned. Opening connection...'

    //                             resolve(data)
    //                         } else {
    //                             reject(data)
    //                         }
    //                     })
    //                 } else {
    //                     response.json().then(data => {
    //                         console.log('StreamClient.js: '+url+' - Ready! Got data:', data)
    //                         resolve(data)
    //                     })
    //                 }
    //             }
    //         })
    //     })
    // }

}