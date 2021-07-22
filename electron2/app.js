const { app, BrowserWindow, session, protocol } = require('electron')
const path  = require('path')
const https = require('https')
const express = require(path.join(__dirname, 'backend/app.js')); //your express app

const appIcon = path.join(__dirname, '../assets/icon.ico');

function createWindow () {
    const win = new BrowserWindow({
        width: 1500,
        height: 900,
        // fullscreen: true,

        title: 'Xbox Cloud Gaming',
        icon: appIcon,
        spellcheck: false,
        webPreferences: {
            // preload: path.join(__dirname, 'preload.js')
        }
    })

    // win.loadFile(path.join(__dirname, '../www/auth.html'))
    win.loadURL('http://127.0.0.1:3000/auth.html');
}

app.whenReady().then(() => {
    session.defaultSession.webRequest.onBeforeRedirect({
        urls: [
            'https://account.xbox.com/*'
        ]
    }, interceptToken)

    app.whenReady().then(() => {
        session.defaultSession.webRequest.onSendHeaders({
            urls: [
                'https://account.xbox.com/*'
            ]
        }, interceptToken)
    })
    
    createWindow()
})

var interceptToken = function(details) {
    // console.log(details)
    // console.log('Loading URL:', details.url)

    if(details.url === 'https://account.xbox.com/en-us/xbox/accountsignin?returnUrl=https%3a%2f%2fwww.xbox.com%2fen-US%2fplay'){
        // We are already logged in..  Lets get the token..

        var cookieFound = false
        var authToken = ''

        if(details.requestHeaders !== undefined || details.responseHeaders !== undefined){

            if(details.requestHeaders !== undefined){
                var cookies = details.requestHeaders.Cookie.split('; ')
            } else if(details.responseHeaders !== undefined){
                var cookies = details.responseHeaders['Set-Cookie']
            }

            for(var cookie in cookies){
                if(cookies[cookie].includes('XBXXtkhttp://gssv.xboxlive.com/')){
                    var rawCookie = cookies[cookie]

                    var jsonToken = decodeURIComponent(rawCookie.split('=')[1].split(';')[0])
                    jsonToken = JSON.parse(jsonToken)

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
            var window = BrowserWindow.fromId(details.webContentsId)
            window.close()

            // Get xHomeStreaming Token
            var data = JSON.stringify({
                "token": authToken,
                "offeringId": "xhome"
            })

            var options = {
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
                var responseData = ''
              
                res.on('data', (data) => {
                    responseData += data
                })

                res.on('close', () => {
                    if(res.statusCode == 200){
                        this.body = responseData.toString()

                        // We successfully received a token. Hooray!
                        var jsonHomeToken = JSON.parse(this.body)
                        // console.log(jsonHomeToken)

                        // express.setToken(jsonHomeToken.gsToken)
                        // console.log(express)

                        express.setToken(jsonHomeToken.gsToken)

                        var mainWindow = BrowserWindow.fromId(1) // @TODO: Make this dynamic
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