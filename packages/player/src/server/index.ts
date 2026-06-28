import type { xStreamToken, xCloudStreamConfig, SDPResponse, ICEResponse, startStreamResponse, StatusResponse, ErrorResponse } from '../types/index';
export type { xStreamToken, startStreamResponse, SDPResponse, ICEResponse, xCloudStreamConfig, StatusResponse, ErrorResponse };

export const ping = () => 'pong';

export const startStream = async (xStreamToken:xStreamToken, xCloudStreamConfig:xCloudStreamConfig) => {
    return await httpPost<startStreamResponse>(xStreamToken, xCloudStreamConfig, '/v5/sessions/'+xCloudStreamConfig.type+'/play', JSON.stringify({
        clientSessionId: '',
        titleId: (xCloudStreamConfig.type === 'cloud') ? xCloudStreamConfig.id : '',
        systemUpdateGroup: '',
        settings: {
            nanoVersion: 'V3;WebrtcTransport.dll',
            enableOptionalDataCollection: false,
            enableTextToSpeech: false,
            highContrast: 0,
            locale: xCloudStreamConfig.language,
            useIceConnection: false,
            timezoneOffsetMinutes: 120,
            sdkType: 'web',
            osName: 'windows',
        },
        serverId: (xCloudStreamConfig.type === 'home') ? xCloudStreamConfig.id : '',
        fallbackRegionNames: [],
    }))
}

export const getStreamStatus = async (xStreamToken:xStreamToken, xCloudStreamConfig:xCloudStreamConfig, sessionPath:string) => {
    return await httpGet<startStreamResponse>(xStreamToken, xCloudStreamConfig, '/'+sessionPath+'/state')
}

export const sendSDPOffer = async (xStreamToken:xStreamToken, xCloudStreamConfig:xCloudStreamConfig, sessionPath:string, sdpOffer:RTCSessionDescriptionInit) => {
    await httpPost<StatusResponse>(xStreamToken, xCloudStreamConfig, '/'+sessionPath+'/sdp', JSON.stringify({
        'messageType':'offer',
        'sdp': sdpOffer.sdp,
        'requestId': '1',
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
                'maxVersion':9,
            },
            'message':{
                'minVersion':1,
                'maxVersion':1,
            },
            'reliableinput':{
                'minVersion':9,
                'maxVersion':9,
            },
            'unreliableinput':{
                'minVersion':9,
                'maxVersion':9,
            },
        },
    }))

    // @TODO: Await for 200 status?
    let sdpResponse = await httpGet<SDPResponse>(xStreamToken, xCloudStreamConfig, '/'+sessionPath+'/sdp')
    while((sdpResponse as StatusResponse).status && (sdpResponse as StatusResponse).status === 204){
        sdpResponse = await httpGet<SDPResponse>(xStreamToken, xCloudStreamConfig, '/'+sessionPath+'/sdp')
    }

    return sdpResponse
}

export const sendICECandidates = async (xStreamToken:xStreamToken, xCloudStreamConfig:xCloudStreamConfig, sessionPath:string, candidates:Array<any>) => {
    await httpPost<StatusResponse>(xStreamToken, xCloudStreamConfig, '/'+sessionPath+'/ice', JSON.stringify({
        candidates: candidates
    }))

    let iceResponse = await httpGet<ICEResponse>(xStreamToken, xCloudStreamConfig, '/'+sessionPath+'/ice')
    while((iceResponse as StatusResponse).status && (iceResponse as StatusResponse).status === 204){
        iceResponse = await httpGet<ICEResponse>(xStreamToken, xCloudStreamConfig, '/'+sessionPath+'/ice')
    }
    return iceResponse
}

export const sendMsalToken = async (xStreamToken:xStreamToken, xCloudStreamConfig:xCloudStreamConfig, sessionPath:string, userRefreshToken:string) => {
    // Fetch token server sided
    const tokenData = await fetch('https://login.live.com/oauth20_token.srf', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        client_id: '1f907974-e22b-4810-a9de-d9647380c97e',
        scope: 'service::http://Passport.NET/purpose::PURPOSE_XBOX_CLOUD_CONSOLE_TRANSFER_TOKEN',
        grant_type: 'refresh_token',
        refresh_token: userRefreshToken,
      }),
    })
    const token = await tokenData.json();

    return await httpPost<StatusResponse>(xStreamToken, xCloudStreamConfig, '/'+sessionPath+'/connect', JSON.stringify({
        userToken: token.access_token
    }))
}

export const sendKeepalive = async (xStreamToken:xStreamToken, xCloudStreamConfig:xCloudStreamConfig, sessionPath:string) => {
    return await httpPost<StatusResponse>(xStreamToken, xCloudStreamConfig, '/'+sessionPath+'/keepalive', JSON.stringify({}))
}

const httpGet = <T>(xStreamToken:xStreamToken, xCloudStreamConfig:xCloudStreamConfig, url:string, headers = {}) => {
    return new Promise<T | StatusResponse | ErrorResponse>((resolve, reject) => {
        const deviceInfo = getDeviceInfo(xCloudStreamConfig)

        try {
            fetch(xCloudStreamConfig.host+url, {
                method: 'GET',
                headers: {
                    'Accept': 'application/json',
                    'Content-Type': 'application/json',
                    'X-Gssv-Client': 'XboxComBrowser',
                    'X-MS-Device-Info': deviceInfo,
                    ...(xStreamToken.token !== '' ? { 'Authorization': 'Bearer '+xStreamToken.token } : {}),
                    ...headers,
                }
            }).then(response => {
                if(response.ok === true){
                    response.json().then(data => {
                        resolve(data)
                    }).catch((error) => {
                        if(response.status >= 200 && response.status <= 299){
                            resolve({ status: response.status })
                        } else {
                            reject({ error: error })
                        }
                    })
                } else {
                    reject({
                        error: {
                            satus: response.status,
                            data: response
                        }
                    } as ErrorResponse)
                }
            })
        } catch (error) {
            reject({ error: error } as ErrorResponse)
        }
    })
}

const httpPost = <T>(xStreamToken:xStreamToken, xCloudStreamConfig:xCloudStreamConfig, url:string, body:string, headers = {}) => {
    return new Promise<T | StatusResponse | ErrorResponse>((resolve, reject) => {
        const deviceInfo = getDeviceInfo(xCloudStreamConfig)

        try {
            fetch(xCloudStreamConfig.host+url, {
                method: 'POST',
                headers: {
                    'Accept': 'application/json',
                    'Content-Type': 'application/json',
                    'X-Gssv-Client': 'XboxComBrowser',
                    'X-MS-Device-Info': deviceInfo,
                    ...(xStreamToken.token !== '' ? { 'Authorization': 'Bearer '+xStreamToken.token } : {}),
                    ...headers,
                },
                body: body,
            }).then(response => {
                if(response.ok === true){
                    response.json().then(data => {
                        resolve(data)
                    }).catch((error) => {
                        if(response.status >= 200 && response.status <= 299){
                            resolve({ status: response.status })
                        } else {
                            reject({ error: error })
                        }
                    })
                } else {
                    reject({
                        error: {
                            satus: response.status,
                            data: response.body
                        }
                    } as ErrorResponse)
                }
            })
        } catch (error) {
            reject({ error: error } as ErrorResponse)
        }
    })
}

const getDeviceInfo = (xCloudStreamConfig:xCloudStreamConfig) => {
    return JSON.stringify({
        'appInfo': {
            'env': {
                'clientAppId':'www.xbox.com',
                'clientAppType':'browser',
                'clientAppVersion':'21.1.98',
                'clientSdkVersion':'8.5.3',
                'httpEnvironment':'prod',
                'sdkInstallId':'',
            },
        },
        'dev': {
            'hw': {
                'make': 'Microsoft',
                'model': 'unknown',
                'sdktype': 'web',
            },
            'os': {
                'name': (xCloudStreamConfig.resolution === 1080) ? 'windows' : 'android',
                'ver': '22631.2715',
                'platform': 'desktop',
            },
            'displayInfo': {
                'dimensions': {
                    'widthInPixels': 1920,
                    'heightInPixels': 1080,
                },
                'pixelDensity': {
                    'dpiX': 2,
                    'dpiY': 2,
                },
            },
            'browser':{
                'browserName':'chrome',
                'browserVersion':'119.0',
            },
        },
    })
}