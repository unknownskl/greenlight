import { BrowserWindow } from 'electron';
import https from 'https';

interface CookieToken {
    Token: string;
}

export default function (details:any):void {
    // console.log(details)
    console.log('Loading URL:', details.url)

    if(details.url.includes('/xbox/accountsignin?returnUrl=https%3a%2f%2fwww.xbox.com%2fen-US%2fplay')){
        // We are already logged in..  Lets get the token..

        let cookieFound = false
        let authToken = ''
        let jsonToken

        if(details.requestHeaders !== undefined || details.responseHeaders !== undefined){

            let cookies;
            if(details.requestHeaders !== undefined){
                cookies = details.requestHeaders.Cookie.split('; ')
            } else if(details.responseHeaders !== undefined){
                cookies = details.responseHeaders['Set-Cookie']
            }

            for(const cookie in cookies){
                if(cookies[cookie].includes('XBXXtkhttp://gssv.xboxlive.com/')){
                    const rawCookie = cookies[cookie]

                    const rawCookieContents = decodeURIComponent(rawCookie.split('=')[1].split(';')[0])
                    const jsonToken:CookieToken = JSON.parse(rawCookieContents)
                    // console.log(JSON.parse(rawCookieContents))

                    authToken = jsonToken.Token
                    cookieFound = true;
                }
            }

        } else {
            throw 'Uh oh.. We could not get your token :/'
        }

        if(cookieFound === true){
            console.log('Logindata found:', jsonToken)
            console.log('Token:', authToken)

            // @TODO: Close window
            const window = BrowserWindow.fromId(details.webContentsId)
            window.close()

            // Get xHomeStreaming Token
            const data = JSON.stringify({
                "token": authToken,
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
                        this.body = responseData.toString()

                        // We successfully received a token. Hooray!
                        const jsonHomeToken = JSON.parse(this.body)
                        // console.log(jsonHomeToken)

                        // express.setToken(jsonHomeToken.gsToken)
                        // console.log(express)

                        // express.setToken(jsonHomeToken.gsToken)

                        const mainWindow = BrowserWindow.fromId(1) // @TODO: Make this dynamic
                        // mainWindow.loadFile(path.join(__dirname, '../www/app.html'))
                        mainWindow.loadURL('http://127.0.0.1:3000/app.html');

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