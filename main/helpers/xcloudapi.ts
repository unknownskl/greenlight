import https from 'https'
import Application from '../application'

export interface playResult {
    sessionPath:string,
    sessionId?:string,
    state?:string,
}

export interface playResult {
    sessionPath:string,
    sessionId?:string,
    state?:string,
}

export interface exchangeResult {
    exchangeResponse:string,
    errorDetails: {
        code: any
        message: any
    }
}

export default class xCloudApi {

    _application

    _host:string
    _token:string
    _type:'home'|'cloud'

    _sessionPath:string

    _exchangeCounter = 0
    _exchangeUrl = ''
    _currentGame = ''

    constructor(application:Application, host:string, token: string, type:'home'|'cloud' = 'home'){
        this._application = application
        this._host = host
        this._token = token
        this._type = type
    }

    get(url: string, method = 'GET') {
        return new Promise((resolve, reject) => {
            let responseData = ''

            const req = https.request({
                host: this._host,
                path: url,
                method: method,
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': 'Bearer '+this._token
                },
            }, (response:any) => {
                response.on('data', (data:any) => {
                    responseData += data
                });

                response.on('end', (data:any) => {
                    if(response.statusCode >= 200 && response.statusCode <= 299){
                        this._application.log('xCloudApi', 'get('+url+', '+method+') resolve:', response.statusCode)
                        let returnData = responseData
                        try {
                            returnData = JSON.parse(responseData)
                        } catch(error){
                        }

                        if(response.statusCode === 204){
                            // We have to retry..
                            setTimeout(() => {
                                this.get(url, method).then((result) => {
                                    resolve(result)

                                }).catch((error) => {
                                    reject(error)
                                })
                            }, 750)
                        } else {
                          resolve(returnData)
                        }
                    } else {
                        this._application.log('xCloudApi', 'get('+url+') reject:', response.statusCode)
                        reject({
                            status: response.statusCode,
                            body: responseData,
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

    post(url: string, postData = {}, headers = {}) {
        return new Promise((resolve, reject) => {
            let responseData = ''
            const mergedHeaders = Object.assign({}, {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer '+this._token,
            }, headers)

            const req = https.request({
                host: this._host,
                path: url,
                method: 'POST',
                headers: mergedHeaders,
            }, (response:any) => {

                response.on('data', (data:any) => {
                    responseData += data
                });

                response.on('end', (data:any) => {
                    if(response.statusCode >= 200 && response.statusCode <= 299){
                        this._application.log('xCloudApi', 'post('+url+') resolve:', response.statusCode, responseData)

                        let returnData = responseData
                        try {
                            returnData = JSON.parse(responseData)
                        } catch(error){
                        }
                        
                        resolve(returnData)
                    } else {
                        this._application.log('xCloudApi', 'post('+url+') reject:', response.statusCode)
                        reject({
                            status: response.statusCode,
                            body: responseData,
                        })
                    }
                });
            })

            req.on('error', (error) => {
                reject(error)
            });

            req.write(JSON.stringify(postData))

            req.end();
        })
    }

    getWaitingTimes(titleId){
        return this.get('/v1/waittime/'+titleId)
    }

    getTitles() {
        return this.get('/v1/titles')
    }

    stopStream(sessionId) {
        return this.get('/v5/sessions/'+this._type+'/'+sessionId, 'DELETE')
    }

    startStream(target:string){
        const deviceInfo = JSON.stringify({
            "appInfo": {
                "env": {
                    "clientAppId": "Microsoft.GamingApp",
                    "clientAppType": "native",
                    "clientAppVersion": "2203.1001.4.0",
                    "clientSdkVersion": "5.3.0",
                    "httpEnvironment": "prod",
                    "sdkInstallId": ""
                }
            },
            "dev": {
                "hw": {
                    "make": "Micro-Star International Co., Ltd.",
                    "model": "GS66 Stealth 10SGS",
                    "sdktype": "native"
                },
                "os": {
                    "name": "Windows 10 Pro",
                    "ver": "19041.1.amd64fre.vb_release.191206-1406"
                },
                "displayInfo": {
                    "dimensions": {
                        "widthInPixels": 1920,
                        "heightInPixels": 1080
                    },
                    "pixelDensity": {
                        "dpiX": 1,
                        "dpiY": 1
                    }
                }
            }
        })

        const postData = {
            'titleId': (this._type === 'cloud') ? target : '',
            'systemUpdateGroup': '',
            'clientSessionId': '',
            'settings': {
                'nanoVersion': 'V3;WebrtcTransport.dll',
                'enableTextToSpeech': false,
                'highContrast': 0,
                'locale': 'en-US',
                'useIceConnection': false,
                'timezoneOffsetMinutes': 120,
                'sdkType': 'web',
                'osName': 'windows'
            },
            'serverId': (this._type === 'home') ? target : '',
            'fallbackRegionNames': []
        }

        return this.post('/v5/sessions/'+this._type+'/play', postData, {
            'X-MS-Device-Info': deviceInfo,
            // 'User-Agent': deviceInfo
        })
    }

    getStreamState(sessionId:string) {
        return this.get('/v5/sessions/'+this._type+'/'+sessionId+'/state')
    }

    sendSdpNew(sessionId:string, sdp: string){
        return new Promise((resolve, reject) => {
            const postData = {
                "messageType":"offer",
                "sdp": sdp,
                "configuration":{
                    "chatConfiguration":{
                      "bytesPerSample":2,
                      "expectedClipDurationMs":20,
                      "format":{
                         "codec":"opus",
                         "container":"webm"
                      },
                      "numChannels":1,
                      "sampleFrequencyHz":24000
                   },
                   "chat":{
                      "minVersion":1,
                      "maxVersion":1
                   },
                   "control":{
                      "minVersion":1,
                      "maxVersion":3
                   },
                   "input":{
                      "minVersion":1,
                      "maxVersion":8
                   },
                   "message":{
                      "minVersion":1,
                      "maxVersion":1
                   },
                }
            }

            this.post('/v5/sessions/'+this._type+'/'+sessionId+'/sdp', postData).then((result) => {

                this.get('/v5/sessions/'+this._type+'/'+sessionId+'/sdp').then((sdpResult:exchangeResult) => {
                    const exchangeSdp = JSON.parse(sdpResult.exchangeResponse)
                    
                    resolve(exchangeSdp)

                }).catch((error) => {
                    reject(error)
                })

            }).catch((error) => {
                reject(error)
            })
        })
    }

    sendIceNew(sessionId:string, ice:any){
        return new Promise((resolve, reject) => {
            const postData = {
                "messageType": "iceCandidate",
                "candidate": ice
            }

            this.post('/v5/sessions/'+this._type+'/'+sessionId+'/ice', postData).then((result) => {

                this.get('/v5/sessions/'+this._type+'/'+sessionId+'/ice').then((iceResult:exchangeResult) => {
                    const exchangeIce = JSON.parse(iceResult.exchangeResponse)
                    
                    resolve(exchangeIce)

                }).catch((error) => {
                    reject(error)
                })

            }).catch((error) => {
                reject(error)
            })
        })
    }

    sendMSALAuth(sessionId:string, userToken:string){
        return this.post('/v5/sessions/'+this._type+'/'+sessionId+'/connect', {
            "userToken": userToken
        })
    }

    sendKeepalive(sessionId:string){
        return this.post('/v5/sessions/'+this._type+'/'+sessionId+'/keepalive')
    }

    getActiveSessions(){
        return this.get('/v5/sessions/'+this._type+'/active')
    }

    // getConsoles() {
    //     return new Promise((resolve, reject) => {
    //         let responseData = ''

    //         const req = https.request({
    //             host: this._host,
    //             path: '/v6/servers/home',
    //             method: 'GET',
    //             headers: {
    //                 'Content-Type': 'application/json',
    //                 'Authorization': 'Bearer '+this._token
    //             },
    //         }, (response:any) => {
    //             response.on('data', (data:any) => {
    //                 console.log('xCloudApi - getConsoles() response: 200')
    //                 responseData += data
    //             });

    //             response.on('end', (data:any) => {
    //                 if(response.statusCode === 200){
    //                     resolve(JSON.parse(responseData))
    //                 } else {
    //                     reject({
    //                         status: response.statusCode
    //                     })
    //                 }
    //             });
    //         })

    //         req.on('error', (error) => {
    //             reject(error)
    //         });
    //         req.end();
    //     })
    // }


    startSession(inputId:string){
        return new Promise((resolve, reject) => {
            let postData
            if(this._type === 'home'){
                postData = {
                    "titleId":"",
                    "systemUpdateGroup":"",
                    "settings": {
                        "nanoVersion":"V3;WebrtcTransport.dll",
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
                        "nanoVersion":"V3;WebrtcTransport.dll",
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

                this._currentGame = inputId
            }

            const deviceInfo = JSON.stringify({
                "appInfo": {
                    "env": {
                        "clientAppId": "Microsoft.GamingApp",
                        "clientAppType": "native",
                        "clientAppVersion": "2203.1001.4.0",
                        "clientSdkVersion": "5.3.0",
                        "httpEnvironment": "prod",
                        "sdkInstallId": ""
                    }
                },
                "dev": {
                    "hw": {
                        "make": "Micro-Star International Co., Ltd.",
                        "model": "GS66 Stealth 10SGS",
                        "sdktype": "native"
                    },
                    "os": {
                        "name": "Windows 10 Pro",
                        "ver": "19041.1.amd64fre.vb_release.191206-1406"
                    },
                    "displayInfo": {
                        "dimensions": {
                            "widthInPixels": 1920,
                            "heightInPixels": 1080
                        },
                        "pixelDensity": {
                            "dpiX": 1,
                            "dpiY": 1
                        }
                    }
                }
            })

            const req = https.request({
            // fetch('https://'+this._host+'/v5/sessions/'+this._type+'/play', {
                host: this._host,
                path: '/v5/sessions/'+this._type+'/play',
                method: 'POST', // *GET, POST, PUT, DELETE, etc.
                headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer '+this._token,
                // 'Content-Type': 'application/x-www-form-urlencoded',
                'X-MS-Device-Info': deviceInfo,
                'User-Agent': deviceInfo
            }}, (response) => {
                let body = ''

                response.on('data', (chunk) => {
                    body += chunk
                });

                response.on('end', () => {
                    if(response.statusCode !== 200 && response.statusCode !== 202){
                        console.log('Error fetching consoles. Status:', response.statusCode, 'Body:', body)
                        reject({
                            status: response.statusCode,
                            body: body
                        })
                    } else {
                        console.log('xCloudApi - startSession() response: 200')

                        const data = JSON.parse(body)
                        // console.log('resObject', resObject)
                        // response.json().then((data) => {
    
                            this.isProvisioningReady('/'+data.sessionPath+'/state').then((state:any) => {
                                this._sessionPath = data.sessionPath

                                // resolve(state)
    
                                // Console can be in 2 states now: Provisioned and ReadyToConnect
                                if(state.state === 'ReadyToConnect'){
                                    // We need to authenticate with the MSAL token
    
                                    this.xcloudAuth(this._application._authentication._tokens.msal.token, data.sessionPath).then((authResponse) => {
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
    
                            }).catch((error:any) => {
                                reject(error)
                            })
    
                        // }).catch((error) => {
                        //     reject(error)
                        // })
                    }
                });
            })

            req.on('error', (error) => {
                reject(error)
            });

            req.write(JSON.stringify(postData))

            req.end()
        })
    }

    isExchangeReady(url:string) {
        return new Promise((resolve, reject) => {

            if(this._exchangeUrl != url){
                // New session
                this._exchangeUrl = url
                this._exchangeCounter = 0
            } else {
                // Existing session
                if(this._exchangeCounter < 30){
                    this._exchangeCounter++
                } else {
                    reject({
                        error: 'Client API Timeout after 30 tries on ' + url
                    })
                    return;
                }
            }

            // this._exchangeUrl
            // this._exchangeCounter

            // fetch('https://'+this._host+''+url, {
            const req = https.request({
                host: this._host,
                path: url,
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': 'Bearer '+this._token
                },
            }, response => {
                let body = ''

                response.on('data', (chunk) => {
                    body += chunk
                });

                response.on('end', () => {
                    if(response.statusCode !== 200){
                        console.log('StreamClient.js - '+url+' - Waiting...')
                        setTimeout(() => {
                            this.isExchangeReady(url).then((data) => {
                                resolve(data)
                            }).catch((error)  => {
                                reject(error)
                            })
                        }, 1000)
                    } else {
                        const data = JSON.parse(body)
                        console.log('StreamClient.js - '+url+' - Ready! Got data:', data)
                        resolve(data)
                    }
                })
            })

            req.on('error', (error) => {
                reject(error)
            });

            req.end()
        })
    }

    _provisioningPreviousState = ''

    isProvisioningReady(url:string) {
        return new Promise((resolve, reject) => {

            const req = https.request({
                host: this._host,
                path: url,
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': 'Bearer '+this._token
                },
            }, (response) => {
                let body = ''

                response.on('data', (chunk) => {
                    body += chunk
                });

                response.on('end', () => {
                    if(response.statusCode !== 200){
                        console.log('xCloudPlayer Client - '+url+' - Waiting...', body)
                        setTimeout(() => {
                            this.isProvisioningReady(url).then((data:any) => {
                                resolve(data)
                            }).catch((error:any)  => {
                                reject(error)
                            })
                        }, 1000)
                    } else {
                        const data = JSON.parse(body)

                        if(data.state === 'Provisioned' || data.state === 'ReadyToConnect'){
                            console.log('xCloudPlayer Client - '+url+' - Ready! Got data:', data)
                            resolve(data)
                        } else if(data.state == 'Failed') {
                            reject(data)
                        } else {
                            console.log('xCloudPlayer Client - '+url+' -', data)

                            if(this._provisioningPreviousState !== 'WaitingForResources' && data.state === 'WaitingForResources'){
                                console.log('Waiting for xCloud resources...')

                                this.getWaitingTimes(this._currentGame).then((waitingtimes) => {

                                    console.log('Retrieved loading times:', waitingtimes)

                                    // Send waiting times to client
                                    this._application._events.sendIpc('xcloud', {
                                        type: 'waitingtimes',
                                        message: waitingtimes || 'Error in Promise',
                                        data: waitingtimes,
                                    })
                                }).catch((error) => {
                                    console.log('xCloudPlayer Client - Failed to retrieve waiting times:', error)
                                })
                            }

                            setTimeout(() => {
                                this.isProvisioningReady(url).then((data:any) => {
                                    resolve(data)
                                }).catch((error:any)  => {
                                    reject(error)
                                })
                            }, 1000)

                            this._provisioningPreviousState = data.state
                        }
                    }
                })
            })

            req.on('error', (error) => {
                reject(error)
            });

            // req.write(JSON.stringify(postData))

            req.end()
        })
    }

    xcloudAuth(userToken:string, sessionPath:string){
        return new Promise((resolve, reject) => {
            const postData = {
                "userToken": userToken
            }

            // console.log('tokens set: ', this._application._tokenStore)
            // fetch('https://'+this._host+'/'+sessionPath+'/connect', {
            const req = https.request({
                host: this._host,
                path: '/'+sessionPath+'/connect',
                method: 'POST', // *GET, POST, PUT, DELETE, etc.
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': 'Bearer '+ this._token
                }
            }, (response) => {
                let body = ''

                response.on('data', (chunk) => {
                    body += chunk
                })

                response.on('end', () => {

                    if(response.statusCode !== 200 && response.statusCode !== 202){
                        console.log('Error sending login command. Status:', response.statusCode, 'Body:', body)
                        reject('/connect call failed')
                    } else {
                        // console.log('OK:', response.status, 'Body:', response.body)
                        resolve(response.statusCode)
                    }
                })
            })

            req.on('error', (error:any) => {
                reject(error)
            });

            req.write(JSON.stringify(postData))

            req.end()
        })
    }

    sendSdp(sdp: string){
        return new Promise((resolve, reject) => {
            const postData = {
                "messageType":"offer",
                "sdp": sdp,
                "configuration":{
                    "chatConfiguration":{
                      "bytesPerSample":2,
                      "expectedClipDurationMs":20,
                      "format":{
                         "codec":"opus",
                         "container":"webm"
                      },
                      "numChannels":1,
                      "sampleFrequencyHz":24000
                   },
                   "chat":{
                      "minVersion":1,
                      "maxVersion":1
                   },
                   "control":{
                      "minVersion":1,
                      "maxVersion":3
                   },
                   "input":{
                      "minVersion":1,
                      "maxVersion":8
                   },
                   "message":{
                      "minVersion":1,
                      "maxVersion":1
                   },
                }
            }

            // fetch('https://'+this._host+'/'+this._sessionPath+'/sdp', {
            const req = https.request({
                host: this._host,
                path: '/'+this._sessionPath+'/sdp',
                method: 'POST', // *GET, POST, PUT, DELETE, etc.
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': 'Bearer '+this._token
                },
            }, (response) => {
                if(response.statusCode !== 202){
                    console.log('StreamClient.js: Error sending SDP state. Status:', response.statusCode)
                    reject({
                        status: response.statusCode
                    })
                } else {
                    console.log('StreamClient.js: SDP State send ok. Status:', response.statusCode)
                    
                    this.isExchangeReady('/'+this._sessionPath+'/sdp').then((data:any) => {
                        console.log('StreamClient.js: Loop done? resolve now...')
                        const response = JSON.parse(data.exchangeResponse)
                        resolve(response)
                    }).catch((error) => {
                        reject(error)
                    })
                }
            })

            req.on('error', (error:any) => {
                reject(error)
            });

            req.write(JSON.stringify(postData))

            req.end()
        })
    }

    sendIce(ice: string){
        return new Promise((resolve, reject) => {
            const postData = {
                "messageType": "iceCandidate",
                "candidate": ice
            }

            // fetch('https://'+this._host+'/'+this._sessionPath+'/ice', {
            const req = https.request({
                host: this._host,
                path: '/'+this._sessionPath+'/ice',
                method: 'POST', // *GET, POST, PUT, DELETE, etc.
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': 'Bearer '+this._token
                },
                // body: JSON.stringify(postData)
            }, (response) => {
                if(response.statusCode !== 202){
                    console.log('StreamClient.js: Error sending ICE candidate. Status:', response.statusCode)
                    reject({
                        status: response.statusCode,
                    })
                } else {
                    this.isExchangeReady('/'+this._sessionPath+'/ice').then((data:any) => {
                        const response = JSON.parse(data.exchangeResponse)
                        resolve(response)
                    }).catch((error) => {
                        reject(error)
                    })
                }
            })

            req.on('error', (error:any) => {
                reject(error)
            });

            req.write(JSON.stringify(postData))

            req.end()
        })
    }

    // sendKeepalive(){
    //     return new Promise((resolve, reject) => {
    //         const req = https.request({
    //             host: this._host,
    //             path: '/'+this._sessionPath+'/keepalive',
    //             method: 'POST', // *GET, POST, PUT, DELETE, etc.
    //             headers: {
    //                 'Content-Type': 'application/json',
    //                 'Authorization': 'Bearer '+this._token
    //             }
    //         }, (response) => {
    //             if(response.statusCode !== 200){
    //                 console.log('StreamClient.js: Error sending keepalive signal. Status:', response.statusCode)
    //                 reject({
    //                     status: response.statusCode
    //                 })
    //             } else {
    //                 resolve('ok')
    //             }
    //         })

    //         req.on('error', (error:any) => {
    //             reject(error)
    //         });

    //         req.write('')

    //         req.end()
    //     })
    // }
}