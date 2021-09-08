import { app, BrowserWindow, session } from 'electron';
import https from 'https';
import TokenStore from './TokenStore';
// import path from 'path';
// import TokenStore from './TokenStore';

interface CookieToken {
    Token: string;
    UserClaims: any;
}

const tokenStore = new TokenStore()

export default function (details:any):void {

    if(details.url === 'https://www.xbox.com/?lc=1033'){
        // Catched logout action

        let windowId = 0
        if(process.env.ISDEV !== undefined){
            windowId = (details.webContentsId-1)
        } else {
            windowId = details.webContentsId
        }
        const window = BrowserWindow.fromId(windowId)
        window.close()

        session.defaultSession.clearStorageData()

        app.relaunch()
        app.exit()

    } else if(details.url.includes('/xbox/accountsignin?returnUrl=https%3a%2f%2fwww.xbox.com%2fen-US%2fplay')){
        // We are already logged in..  Lets get the token..

        let cookieFound = false
        let authToken
        let streamingToken

        if(details.requestHeaders !== undefined || details.responseHeaders !== undefined){

            let cookies;
            if(details.requestHeaders !== undefined){
                cookies = details.requestHeaders.Cookie.split('; ')
            } else if(details.responseHeaders !== undefined){
                cookies = details.responseHeaders['Set-Cookie']
            }

            for(const cookie in cookies){
                // console.log(cookies[cookie])
                if(cookies[cookie].includes('XBXXtkhttp://gssv.xboxlive.com/')){
                    const rawCookie = cookies[cookie]

                    const rawCookieContents = decodeURIComponent(rawCookie.split('=')[1].split(';')[0])
                    const jsonToken:CookieToken = JSON.parse(rawCookieContents)

                    streamingToken = jsonToken
                    cookieFound = true;
                } else if(cookies[cookie].includes('XBXXtkhttp://xboxlive.com')){
                    const rawCookie = cookies[cookie]

                    const rawCookieContents = decodeURIComponent(rawCookie.split('=')[1].split(';')[0])
                    const jsonToken:CookieToken = JSON.parse(rawCookieContents)

                    authToken = jsonToken
                }
            }

        } else {
            throw 'Uh oh.. We could not get your token :/'
        }

        if(cookieFound === true){
            this.setWebTokens(authToken.UserClaims.uhs, authToken.Token)

            let windowId = 0
            if(process.env.ISDEV !== undefined){
                windowId = (details.webContentsId-1)
            } else {
                windowId = details.webContentsId
            }
            const window = BrowserWindow.fromId(windowId)
            window.close()

            requestStreamingToken(streamingToken)
            requestxCloudStreamingToken(streamingToken)
            
        }
    }
}

function requestStreamingToken(streamingToken:CookieToken){
    // Get xHomeStreaming Token
    const data = JSON.stringify({
        "token": streamingToken.Token,
        "offeringId": "xhome"
    })

    const options = {
        hostname: 'xhome.gssv-play-prod.xboxlive.com',
        port: 443,
        path: '/v2/login/user',
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Content-Length': data.length
        }
    }
    const req = https.request(options, (res) => {
        let responseData = ''
        
        res.on('data', (data) => {
            responseData += data
        })

        res.on('close', () => {
            if(res.statusCode == 200){
                const jsonHomeToken = JSON.parse(responseData.toString())

                tokenStore.setStreamingToken(jsonHomeToken.gsToken)
            } else {
                console.log('- Error while retrieving from url:', this.url)
                console.log('  statuscode:', res.statusCode)
                console.log('  body:', responseData.toString())
            }
        })
    })
    
    req.on('error', (error) => {
        console.log('- Error while retrieving from url:', this.url)
        console.log('  Error:', error)
    })

    req.write(data)
    req.end()
}

function requestxCloudStreamingToken(streamingToken:CookieToken){
    // Get xHomeStreaming Token
    const data = JSON.stringify({
        "token": streamingToken.Token,
        "offeringId": "xgpuweb"
    })

    const options = {
        hostname: 'xgpuweb.gssv-play-prod.xboxlive.com',
        port: 443,
        path: '/v2/login/user',
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Content-Length': data.length
        }
    }
    const req = https.request(options, (res) => {
        let responseData = ''
        
        res.on('data', (data) => {
            responseData += data
        })

        res.on('close', () => {
            if(res.statusCode == 200){
                const xgpuToken = JSON.parse(responseData.toString())

                let regionHost
                for(const region in xgpuToken.offeringSettings.regions){
                    // console.log(jsonHomeToken.offeringSettings.regions[region])
                    if(xgpuToken.offeringSettings.regions[region].isDefault === true){
                        regionHost = xgpuToken.offeringSettings.regions[region].baseUri.substr(8)
                    }
                }

                tokenStore.setxCloudStreamingToken(xgpuToken.gsToken, regionHost)
            } else {
                console.log('- Error while retrieving from url:', this.url)
                console.log('  statuscode:', res.statusCode)
                console.log('  body:', responseData.toString())
            }
        })
    })
    
    req.on('error', (error) => {
        console.log('- Error while retrieving from url:', this.url)
        console.log('  Error:', error)
    })

    req.write(data)
    req.end()
}