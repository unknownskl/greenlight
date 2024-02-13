import https from 'https'
import Application from '../application'
import { Address6 } from 'ip-address'

export interface playResult {
    sessionPath:string;
    sessionId?:string;
    state?:string;
}

export interface exchangeResult {
    exchangeResponse:string;
    errorDetails: {
        code: any;
        message: any;
    };
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
                    'Authorization': 'Bearer '+this._token,
                },
            }, (response:any) => {
                response.on('data', (data:any) => {
                    responseData += data
                })

                response.on('end', () => {
                    if(response.statusCode >= 200 && response.statusCode <= 299){
                        this._application.log('xCloudApi', 'get('+url+', '+method+') resolve:', response.statusCode)
                        let returnData = responseData
                        try {
                            returnData = JSON.parse(responseData)
                        } catch(error){
                            // Data is not JSON..
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
                            url: url,
                            status: response.statusCode,
                            body: responseData,
                        })
                    }
                })
            })

            req.on('error', (error) => {
                reject(error)
            })
            req.end()
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
                })

                response.on('end', () => {
                    if(response.statusCode >= 200 && response.statusCode <= 299){
                        this._application.log('xCloudApi', 'post('+url+') resolve:', response.statusCode, responseData)

                        let returnData = responseData
                        try {
                            returnData = JSON.parse(responseData)
                        } catch(error){
                            // Data is not JSON..
                        }
                        
                        resolve(returnData)
                    } else {
                        this._application.log('xCloudApi', 'post('+url+') reject:', response.statusCode)
                        reject({
                            url: url,
                            status: response.statusCode,
                            body: responseData,
                        })
                    }
                })
            })

            req.on('error', (error) => {
                reject(error)
            })

            req.write(JSON.stringify(postData))

            req.end()
        })
    }

    getWaitingTimes(titleId){
        return this.get('/v1/waittime/'+titleId)
    }

    getTitles() {
        return this.get('/v2/titles')
    }

    getRecentTitles() {
        return this.get('/v2/titles/mru?mr=25')
    }

    stopStream(sessionId) {
        return this.get('/v5/sessions/'+this._type+'/'+sessionId, 'DELETE')
    }

    startStream(target:string){
        const deviceInfo = JSON.stringify({
            'appInfo': {
                'env': {
                    'clientAppId': 'Microsoft.GamingApp',
                    'clientAppType': 'native',
                    'clientAppVersion': '2203.1001.4.0',
                    'clientSdkVersion': '8.5.2',
                    'httpEnvironment': 'prod',
                    'sdkInstallId': '',
                },
            },
            'dev': {
                'hw': {
                    'make': 'Microsoft',
                    'model': 'Surface Pro',
                    'sdktype': 'native',
                },
                'os': {
                    'name': 'Windows 11',
                    'ver': '22631.2715',
                    'platform': 'desktop',
                },
                'displayInfo': {
                    'dimensions': {
                        'widthInPixels': 1920,
                        'heightInPixels': 1080,
                    },
                    'pixelDensity': {
                        'dpiX': 1,
                        'dpiY': 1,
                    },
                },
            },
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
                'osName': 'windows',
            },
            'serverId': (this._type === 'home') ? target : '',
            'fallbackRegionNames': [],
        }

        return this.post('/v5/sessions/'+this._type+'/play', postData, {
            'X-MS-Device-Info': deviceInfo,
            // 'User-Agent': deviceInfo
        })
    }

    getStreamState(sessionId:string) {
        return this.get('/v5/sessions/'+this._type+'/'+sessionId+'/state')
    }

    sendSdp(sessionId:string, sdp: string){
        return new Promise((resolve, reject) => {
            const postData = {
                'messageType':'offer',
                'sdp': sdp,
                'configuration':{
                    'chatConfiguration':{
                        'bytesPerSample':2,
                        'expectedClipDurationMs':20,
                        'format':{
                            'codec':'opus',
                            'container':'webm',
                        },
                        'numChannels':1,
                        'sampleFrequencyHz':24000,
                    },
                    'chat':{
                        'minVersion':1,
                        'maxVersion':1,
                    },
                    'control':{
                        'minVersion':1,
                        'maxVersion':3,
                    },
                    'input':{
                        'minVersion':1,
                        'maxVersion':8,
                    },
                    'message':{
                        'minVersion':1,
                        'maxVersion':1,
                    },
                },
            }

            this.post('/v5/sessions/'+this._type+'/'+sessionId+'/sdp', postData).then(() => {

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

    sendChatSdp(sessionId:string, sdp: string){
        return new Promise((resolve, reject) => {
            const postData = {
                'messageType':'offer',
                'sdp': sdp,
                'configuration':{
                    'isMediaStreamsChatRenegotiation': true,
                },
            }

            this.post('/v5/sessions/'+this._type+'/'+sessionId+'/sdp', postData).then(() => {

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

    sendIce(sessionId:string, ice:any){
        return new Promise((resolve, reject) => {
            const postData = {
                'messageType': 'iceCandidate',
                'candidate': ice,
            }

            this.post('/v5/sessions/'+this._type+'/'+sessionId+'/ice', postData).then(() => {

                this.get('/v5/sessions/'+this._type+'/'+sessionId+'/ice').then((iceResult:exchangeResult) => {
                    const exchangeIce = JSON.parse(iceResult.exchangeResponse)

                    const computedCandidates = []

                    // Find Teredo Address and extract remote ip
                    for(const candidate in exchangeIce){
                        const candidateAddress = exchangeIce[candidate].candidate.split(' ')
                        
                        if(candidateAddress.length > 4 && candidateAddress[4].substr(0, 4) === '2001'){
                            const address = new Address6(candidateAddress[4])
                            const teredo = address.inspectTeredo()

                            computedCandidates.push({
                                candidate: 'a=candidate:10 1 UDP 1 '+teredo.client4+' 9002 typ host ',
                                messageType: 'iceCandidate',
                                sdpMLineIndex: '0',
                                sdpMid: '0',
                            })
                            computedCandidates.push({
                                candidate: 'a=candidate:11 1 UDP 1 '+teredo.client4+' '+teredo.udpPort+' typ host ',
                                messageType: 'iceCandidate',
                                sdpMLineIndex: '0',
                                sdpMid: '0',
                            })
                        }

                        computedCandidates.push(exchangeIce[candidate])
                    }
                    
                    resolve(computedCandidates)

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
            'userToken': userToken,
        })
    }

    sendKeepalive(sessionId:string){
        return this.post('/v5/sessions/'+this._type+'/'+sessionId+'/keepalive')
    }

    getActiveSessions(){
        return this.get('/v5/sessions/'+this._type+'/active')
    }
}