// interface EmptyArray {
// }

import Application from "./application"
import https from 'https'

export default class xCloudClient {

    _application

    _host:string
    _token:string
    _type:'home'|'cloud'

    _sessionPath:string

    constructor(application:Application, host:string, token: string, type:'home'|'cloud' = 'home'){
        this._application = application
        this._host = host
        this._token = token
        this._type = type
    }

    get(url: string) {
        return new Promise((resolve, reject) => {
            fetch(url, {
                method: 'GET', // *GET, POST, PUT, DELETE, etc.
                headers: {
                    'Authorization': 'Bearer '+this._token,
                    'Accept-Language': 'en-US',
                }
            }).then((response) => {
                if(response.status !== 200){
                    console.log('Error fetching consoles. Status:', response.status, 'Body:', response.body)
                } else {
                    response.json().then((data) => {
                        resolve(data)
                    }).catch((error) => {
                        reject(error)
                    })
                }
            }).catch((error) => {
                reject(error)
            });
        })
    }

    getTitles() {
        return this.get('https://' + this._host + '/v1/titles')
    }

    getConsoles() {
        return new Promise((resolve, reject) => {
            let responseData = ''

            const req = https.request({
                host: this._host,
                path: '/v6/servers/home',
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': 'Bearer '+this._token
                },
            }, (response:any) => {
                response.on('data', (data:any) => {
                    console.log('data', data)
                    responseData += data
                });

                response.on('end', (data:any) => {
                    if(response.statusCode === 200){
                        resolve(JSON.parse(responseData))
                    } else {
                        reject({
                            status: response.statusCode
                        })
                    }
                });
            })

            req.on('error', (error) => {
                reject(error)
            });
            req.end();
        })
    }

    startSession(inputId:string){
        return new Promise((resolve, reject) => {
            let postData
            if(this._type === 'home'){
                postData = {
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
                    "serverId": inputId,
                    "fallbackRegionNames": [Array]
                }
            } else {
                postData = {
                    "titleId": inputId,
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
            }

            fetch('https://'+this._host+'/v5/sessions/'+this._type+'/play', {
                method: 'POST', // *GET, POST, PUT, DELETE, etc.
                cache: 'no-cache',
                headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer '+this._token
                // 'Content-Type': 'application/x-www-form-urlencoded',
                },
                body: JSON.stringify(postData)
            }).then((response) => {
                if(response.status !== 200 && response.status !== 202){
                    console.log('Error fetching consoles. Status:', response.status, 'Body:', response.body)
                    reject({
                        status: response.status,
                        body: response.body
                    })
                } else {
                    response.json().then((data) => {

                        this.isProvisioningReady('/'+data.sessionPath+'/state').then((state:any) => {
                            this._sessionPath = data.sessionPath

                            // Console can be in 2 states now: Provisioned and ReadyToConnect
                            if(state.state === 'ReadyToConnect'){
                                // We need to authenticate with the MSAL token

                                this.xcloudAuth(this._application._tokenStore._msalToken, data.sessionPath).then((authResponse) => {
                                    // Authentication ok. Lets connect!
                                    this.isProvisioningReady('/'+data.sessionPath+'/state').then((state:any) => {
                                        resolve(state)

                                    }).catch((error) =>{
                                        reject(error)
                                    })

                                }).catch((error) =>{
                                    reject(error)
                                })

                            } else {
                                // Lets connect
                                resolve(state)
                            }

                        }).catch((error) => {
                            reject(error)
                        })

                    }).catch((error) => {
                        reject(error)
                    })
                }
            }).catch((error) => {
                reject(error)
            });
        })
    }

    isExchangeReady(url:string) {
        return new Promise((resolve, reject) => {

            fetch('https://'+this._host+''+url, {
                method: 'GET',
                cache: 'no-cache',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': 'Bearer '+this._token
                },
            }).then(response => {
                if(response.status !== 200){
                    console.log('xCloudPlayer Client - '+url+' - Waiting...')
                    setTimeout(() => {
                        this.isExchangeReady(url).then((data) => {
                            resolve(data)
                        }).catch((error)  => {
                            reject(error)
                        })
                    }, 1000)
                } else {
                    response.json().then(data => {
                        console.log('xCloudPlayer Client - '+url+' - Ready! Got data:', data)
                        resolve(data)
                    })
                }
            })
        })
    }

    isProvisioningReady(url:string) {
        return new Promise((resolve, reject) => {

            fetch('https://'+this._host+''+url, {
                method: 'GET',
                cache: 'no-cache',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': 'Bearer '+this._token
                },
            }).then(response => {
                if(response.status !== 200){
                    console.log('xCloudPlayer Client - '+url+' - Waiting...')
                    setTimeout(() => {
                        this.isProvisioningReady(url).then((data) => {
                            resolve(data)
                        }).catch((error)  => {
                            reject(error)
                        })
                    }, 1000)
                } else {
                    response.json().then(data => {
                        if(data.state === 'Provisioned' || data.state === 'ReadyToConnect'){
                            console.log('xCloudPlayer Client - '+url+' - Ready! Got data:', data)
                            resolve(data)
                        } else {
                            setTimeout(() => {
                                this.isProvisioningReady(url).then((data) => {
                                    resolve(data)
                                }).catch((error)  => {
                                    reject(error)
                                })
                            }, 1000)
                        }
                    })
                }
            })
        })
    }

    xcloudAuth(userToken:string, sessionPath:string){
        return new Promise((resolve, reject) => {
            const postData = {
                "userToken": userToken
            }

            // console.log('tokens set: ', this._application._tokenStore)
            fetch('https://'+this._host+'/'+sessionPath+'/connect', {
                method: 'POST', // *GET, POST, PUT, DELETE, etc.
                cache: 'no-cache',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': 'Bearer '+ this._token
                },
                body: JSON.stringify(postData)
            }).then((response) => {
                if(response.status !== 200 && response.status !== 202){
                    console.log('Error sending login command. Status:', response.status, 'Body:', response.body)
                    reject('/connect call failed')
                } else {
                    // console.log('OK:', response.status, 'Body:', response.body)
                    resolve(response.status)
                }
            }).catch((error) => {
                reject(error)
            })
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

            fetch('https://'+this._host+'/'+this._sessionPath+'/sdp', {
                method: 'POST', // *GET, POST, PUT, DELETE, etc.
                cache: 'no-cache',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': 'Bearer '+this._token
                },
                body: JSON.stringify(postData)
            }).then((response) => {
                if(response.status !== 202){
                    console.log('StreamClient.js: Error sending SDP state. Status:', response.status, 'Body:', response.body)
                    reject({
                        status: response.status,
                        body: response.body
                    })
                } else {
                    this.isExchangeReady('/'+this._sessionPath+'/sdp').then((data:any) => {
                        const response = JSON.parse(data.exchangeResponse)
                        resolve(response)
                    }).catch((error) => {
                        reject(error)
                    })
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

            fetch('https://'+this._host+'/'+this._sessionPath+'/ice', {
                method: 'POST', // *GET, POST, PUT, DELETE, etc.
                cache: 'no-cache',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': 'Bearer '+this._token
                },
                body: JSON.stringify(postData)
            }).then((response) => {
                if(response.status !== 202){
                    console.log('StreamClient.js: Error sending ICE candidate. Status:', response.status, 'Body:', response.body)
                    reject({
                        status: response.status,
                        body: response.body
                    })
                } else {
                    this.isExchangeReady('/'+this._sessionPath+'/ice').then((data:any) => {
                        const response = JSON.parse(data.exchangeResponse)
                        resolve(response)
                    }).catch((error) => {
                        reject(error)
                    })
                }
            }).catch((error) => {
                reject(error)
            });
        })
    }

    sendKeepalive(){
        return new Promise((resolve, reject) => {
            fetch('https://' + this._host + '/' + this._sessionPath + '/keepalive', {
                method: 'POST', // *GET, POST, PUT, DELETE, etc.
                cache: 'no-cache',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': 'Bearer '+this._token
                }
            }).then((response) => {
                if(response.status !== 200){
                    console.log('StreamClient.js: Error sending keepalive signal. Status:', response.status, 'Body:', response.body)
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
}