import type { xStreamToken, xCloudStreamConfig, SDPResponse, startStreamResponse, StatusResponse, ErrorResponse } from '../types/index';
export type { xStreamToken, startStreamResponse, SDPResponse, xCloudStreamConfig, StatusResponse, ErrorResponse };

export const ping = () => 'pong';

/**
 * Error thrown when a request against the streaming API fails.
 *
 * The payload of the failure is kept on the `error` property, so consumers
 * that inspect it keep working, while the rejection itself is a proper
 * `Error` instance with a meaningful message and stack trace.
 */
class HttpRequestError extends Error implements ErrorResponse {
    error: any

    constructor(error: any) {
        super('Request to the streaming API failed')
        this.name = 'HttpRequestError'
        this.error = error
    }
}

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
    const sdpResponse = await httpGet<SDPResponse>(xStreamToken, xCloudStreamConfig, '/'+sessionPath+'/sdp')
    return sdpResponse
}

export const sendICECandidates = async (xStreamToken:xStreamToken, xCloudStreamConfig:xCloudStreamConfig, sessionPath:string, candidates:Array<any>) => {
    await httpPost<StatusResponse>(xStreamToken, xCloudStreamConfig, '/'+sessionPath+'/ice', JSON.stringify({
        candidates: candidates
    }))

    let iceResponse = await httpGet<any>(xStreamToken, xCloudStreamConfig, '/'+sessionPath+'/ice')
    while(iceResponse.status && iceResponse.status === 204){
        iceResponse = await httpGet<any>(xStreamToken, xCloudStreamConfig, '/'+sessionPath+'/ice')
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

const httpGet = async <T>(xStreamToken:xStreamToken, xCloudStreamConfig:xCloudStreamConfig, url:string, headers = {}): Promise<T | StatusResponse | ErrorResponse> => {
    const deviceInfo = getDeviceInfo(xCloudStreamConfig)

    let response:Response
    try {
        response = await fetch(xCloudStreamConfig.host+url, {
            method: 'GET',
            headers: {
                'Accept': 'application/json',
                'Content-Type': 'application/json',
                'X-Gssv-Client': 'XboxComBrowser',
                'X-MS-Device-Info': deviceInfo,
                ...(xStreamToken.token !== '' ? { 'Authorization': 'Bearer '+xStreamToken.token } : {}),
                ...headers,
            },
        })
    } catch (error) {
        throw new HttpRequestError(error)
    }

    if(response.ok === true){
        try {
            const data = await response.json()
            return data as T
        } catch (error) {
            if(response.status >= 200 && response.status <= 299){
                return { status: response.status } as StatusResponse
            }

            throw new HttpRequestError(error)
        }
    }

    throw new HttpRequestError({
        satus: response.status,
        data: response
    })
}

const httpPost = async <T>(xStreamToken:xStreamToken, xCloudStreamConfig:xCloudStreamConfig, url:string, body:string, headers = {}): Promise<T | StatusResponse | ErrorResponse> => {
    const deviceInfo = getDeviceInfo(xCloudStreamConfig)

    let response:Response
    try {
        response = await fetch(xCloudStreamConfig.host+url, {
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
        })
    } catch (error) {
        throw new HttpRequestError(error)
    }

    if(response.ok === true){
        try {
            const data = await response.json()
            return data as T
        } catch (error) {
            if(response.status >= 200 && response.status <= 299){
                return { status: response.status } as StatusResponse
            }

            throw new HttpRequestError(error)
        }
    }

    throw new HttpRequestError({
        satus: response.status,
        data: response.body
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