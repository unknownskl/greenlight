import { BrowserWindow } from 'electron';
import https from 'https';
// import path from 'path';
// import TokenStore from './TokenStore';

interface CookieToken {
    Token: string;
    UserClaims: any;
}

export default function (details:any):void {
    // console.log(details)
    console.log('Loading URL:', details.url)

    if(details.url.includes('/xbox/accountsignin?returnUrl=https%3a%2f%2fwww.xbox.com%2fen-US%2fplay')){
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
                    // const userHash = jsonToken.UserClaims.uhs
                    // console.log('USERHASH:', userHash)

                    streamingToken = jsonToken
                    cookieFound = true;
                } else if(cookies[cookie].includes('XBXXtkhttp://xboxlive.com')){
                    const rawCookie = cookies[cookie]

                    const rawCookieContents = decodeURIComponent(rawCookie.split('=')[1].split(';')[0])
                    const jsonToken:CookieToken = JSON.parse(rawCookieContents)
                    // console.log('ACCOUNTSTOKEN:', jsonToken)

                    authToken = jsonToken
                }
            }

        } else {
            throw 'Uh oh.. We could not get your token :/'
        }

        if(cookieFound === true){
            // console.log('Web Token:', authToken)
            // console.log('Streaming Token:', streamingToken)

            // const tokenStore = new TokenStore()
            this.setWebTokens(authToken.UserClaims.uhs, authToken.Token)

            // console.log('tokenStore:', this, authToken.UserClaims.uhs, authToken.Token)

            // @TODO: Close window
            // console.log('close windows id: ',details.webContentsId, details)
            const window = BrowserWindow.fromId(details.webContentsId)
            window.close()

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
                        // this.body = responseData.toString()

                        // We successfully received a token. Hooray!
                        const jsonHomeToken = JSON.parse(responseData.toString())

                        // express.setToken(jsonHomeToken.gsToken)
                        this.setStreamingToken(jsonHomeToken.gsToken)
                        // console.log('SetToken:', jsonHomeToken.gsToken)

                        // const mainWindow = BrowserWindow.fromId(1) // @TODO: Make this dynamic
                        // mainWindow.loadFile(path.join(__dirname, 'src/app.html'))
                        // mainWindow.loadURL('http://127.0.0.1:3000/app.html');

                        // callback(this.body)
                    } else {
                        console.log('- Error while retrieving from url:', this.url)
                        console.log('  statuscode:', res.statusCode)
                        console.log('  body:', responseData.toString())

                        // callback(null, {
                        //     statuscode: res.statusCode,
                        //     body: responseData
                        // })
                    }
                })
            })
            
            req.on('error', (error) => {
                console.log('- Error while retrieving from url:', this.url)
                console.log('  Error:', error)

                // callback(null, {
                //     error: error
                // })
            })

            req.write(data)
            req.end()
        }

        console.log('cookieFound:', cookieFound)
    }
}