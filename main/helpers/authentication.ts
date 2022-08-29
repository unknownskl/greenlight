import Store from 'electron-store'
import https from 'https'
import { app, session, BrowserWindow, ipcMain } from 'electron';
import { createWindow } from './index'
import Application from '../background'

const isProd: boolean = process.env.NODE_ENV === 'production';
const store = new Store({ name: 'helper_authentication' })

export default class Authentication {
    _tokens = {
        web: {
            uhs: false,
            token: false,
            expires: false,
        },
        gamestreaming: {
            token: false,
            market: false,
            regions: [],
            settings: false,
            expires: false,
        },
        xcloud: {
            token: false,
            market: false,
            regions: [],
            host: false,
            settings: false,
            expires: false,
        },
        msal: {
            token: false,
            refresh_token: false,
            id_token: false,
            client_info: false,
            expires: false,
        }
    }

    _loggedIn = false
    _appLevel = 0 // 0 = not logged in, 1 = xhomestreamin, 2 = xcloud
    _authWindow:BrowserWindow

    _application:Application

    constructor(application){
        this._application = application

        ipcMain.on('auth', (event, arg) => {
            // console.log('got auth-tokens message', arg)
    
            if(arg.type === 'init'){
                const gamertag = store.get('user.gamertag')
                const gamerpic = store.get('user.gamerpic')
                const gamerscore = store.get('user.gamerscore')
    
                event.sender.send('auth', {
                    loggedIn: gamertag ? this._loggedIn : false,
    
                    signedIn: gamertag ? true : false,
                    gamertag: gamertag ? gamertag : '',
                    gamerpic: gamerpic ? gamerpic : '',
                    gamerscore: gamerscore ? gamerscore : '',
                    level: this._appLevel,
                })
                
            } else if(arg.type === 'get_user'){
                const gamertag = store.get('user.gamertag')
                const gamerpic = store.get('user.gamerpic')
                const gamerscore = store.get('user.gamerscore')
    
                event.sender.send('auth', {
                    type: 'user',
                    gamertag: gamertag ? gamertag : '',
                    gamerpic: gamerpic ? gamerpic : '',
                    gamerscore: gamerscore ? gamerscore : '',
                    level: this._appLevel,
                })

            } else if(arg.type === 'logout'){
                console.log('Application received logout call. Removing session and cached keys')
    
                session.defaultSession.clearStorageData().then(() => {
                    store.delete('user')
                    console.log('Restarting application...')
                    this._application.restart()
    
                }).catch((error) => {
                    console.log('Failed to remove local storage:', error)
                })

            } else if(arg.type === 'quit'){
                console.log('Application received quit call. Exiting application')
                this._application.quit()

            } else if(arg.type == 'login') {
                console.log('opening auth flow')
                // if(! this.checkAuthentication()){
                    this.startHooks()
                    this.startAuthflow()
                // }
            }
        });
    }

    startHooks() {
        session.defaultSession.webRequest.onBeforeRedirect({
            urls: [
                'https://account.xbox.com/*'
            ]
        }, this.interceptTokens.bind(this))
    
        session.defaultSession.webRequest.onSendHeaders({
            urls: [
                'https://www.xbox.com/*',
                'https://account.xbox.com/*'
            ]
        }, this.interceptTokens.bind(this))
    
        session.defaultSession.webRequest.onBeforeSendHeaders((details, callback) => {
            details.requestHeaders['User-Agent'] = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/103.0.0.0 Safari/537.36 Edg/103.0.1264.44';
                callback({ cancel: false, requestHeaders: details.requestHeaders });
            });
        
            session.defaultSession.webRequest.onBeforeSendHeaders({
            urls: [
                'https://login.microsoftonline.com/consumers/oauth2/v2.0/token'
            ]
        }, this.interceptMsalToken.bind(this))
    }

    checkAuthentication() {
        if(this._tokens.web.token !== false && this._tokens.gamestreaming.token !== false){
            // @PROPOSAL: Send event for logged in to application?
            return true
        } else {
            return false
        }
    }

    async startAuthflow() {

        const authWindow = createWindow('auth', {
            width: 500,
            height: 600,
            title: 'Authentication'
        });
        
        await authWindow.loadURL('https://account.xbox.com/account/signin?returnUrl=https%3A%2F%2Fwww.xbox.com%2Fen-US%2Fplay&ru=https%3A%2F%2Fwww.xbox.com%2Fen-US%2Fplay');
        this._authWindow = authWindow

        return authWindow
    }

    interceptTokens(details:any):void {
        if(details.url === 'https://www.xbox.com/?lc=1033'){
            // We want to logout. Lets clear the storage and relaunch the app.
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
                        const jsonToken = JSON.parse(rawCookieContents)

                        streamingToken = jsonToken
                        cookieFound = true;
                    } else if(cookies[cookie].includes('XBXXtkhttp://xboxlive.com')){
                        const rawCookie = cookies[cookie]

                        const rawCookieContents = decodeURIComponent(rawCookie.split('=')[1].split(';')[0])
                        const jsonToken = JSON.parse(rawCookieContents)

                        authToken = jsonToken
                    }
                }

            } else {
                throw new Error('Uh oh.. We could not get your token :/')
            }

            if(cookieFound === true){
                this._tokens.web.uhs = authToken.UserClaims.uhs
                this._tokens.web.token = authToken.Token
                this._tokens.web.expires = authToken.expires

                this.requestStreamingToken(streamingToken)
                this.requestxCloudToken(streamingToken).then((value)  => {
                    // do nothing and lets wait for the msal token
                    
                }).catch((error) => {
                    //  Failed to retrieve xcloud Token. Lets close the login window.
                    try {
                        this._authWindow.close()
                    } catch(error){
                        console.log('Failed to close parent window in cookieIntercept', details.webContentsId)
                        console.log(error)
                    }

                    this.setAppTokens(1)
                })
            }
        }
    }

    interceptMsalToken(details:any, callback:any):void {
        if (details.uploadData !== undefined && details.requestHeaders !== undefined && details.method === 'POST'){
            // this.setMSALData(details.uploadData, details.requestHeaders)
            // console.log('- MSAL DATA:', details.uploadData, details.requestHeaders)

            this.requestMsalToken(details.uploadData, details.requestHeaders)

            try {
                this._authWindow.close()
            } catch(error){
                console.log('Failed to close parent window in requestIntercept', details.webContentsId)
                console.log(error)
            }
        
            callback({cancel: true})
        } else {
            callback({cancel: false})
        }
    }

    requestMsalToken(body, headers){
        // Get MSAL Token
        const data = body[0].bytes
    
        const options = {
            hostname: 'login.microsoftonline.com',
            method: 'POST',
            path: '/consumers/oauth2/v2.0/token',
        }

        const reqHeaders = {
            'Origin': 'https://www.xbox.com',
            ...headers,
        }

        this.request(options, data, reqHeaders).then((response:any) => {
            this._tokens.msal.token = response.access_token
            this._tokens.gamestreaming.expires = (Date.now()+response.durationInSeconds)
            this._tokens.msal.refresh_token = response.refresh_token
            this._tokens.msal.id_token = response.id_token
            this._tokens.msal.client_info = response.client_info

            console.log('- Retrieved MSAL token', response)
            this.setAppTokens(2)
        }).catch((error) => {

        })
    }

    requestStreamingToken(streamingToken){
        // Get xHomeStreaming Token
        const data = JSON.stringify({
            "token": streamingToken.Token,
            "offeringId": "xhome"
        })
    
        const options = {
            hostname: 'xhome.gssv-play-prod.xboxlive.com',
            method: 'POST',
            path: '/v2/login/user',
        }

        this.request(options, data).then((response:any) => {
            this._tokens.gamestreaming.token = response.gsToken
            this._tokens.gamestreaming.expires = (Date.now()+response.durationInSeconds)
            this._tokens.gamestreaming.market = response.market
            this._tokens.gamestreaming.regions = response.offeringSettings.regions
            this._tokens.gamestreaming.settings = response.offeringSettings.clientCloudSettings

            console.log('- Retrieved xHome streaming tokens')
        }).catch((error) => {

        })
    }

    requestxCloudToken(streamingToken){
        return new Promise((resolve, reject) => {

            // Get xHomeStreaming Token
            const data = JSON.stringify({
                "token": streamingToken.Token,
                "offeringId": "xgpuweb"
            })
        
            const options = {
                hostname: 'xgpuweb.gssv-play-prod.xboxlive.com',
                method: 'POST',
                path: '/v2/login/user',
            }

            this.request(options, data).then((response:any) => {
                this._tokens.xcloud.token = response.gsToken
                this._tokens.xcloud.expires = (Date.now()+response.durationInSeconds)
                this._tokens.xcloud.market = response.market
                this._tokens.xcloud.regions = response.offeringSettings.regions
                this._tokens.xcloud.settings = response.offeringSettings.clientCloudSettings

                for(const region in this._tokens.xcloud.regions){
                    if(this._tokens.xcloud.regions[region].isDefault){
                        this._tokens.xcloud.host = this._tokens.xcloud.regions[region].baseUri.substr(8)
                    }
                }

                console.log('- Retrieved xCloud streaming tokens')

                resolve(response)
            }).catch((error) => {
                console.log('xcloud request error:', error)
                reject(error)
            })
        })
    }

    request(options, data = '', headers = {}) {

        return new Promise((resolve, reject) => {
            const reqOptions = {
                hostname: '',
                port: 443,
                path: '',
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                    'Content-Length': data.length,
                    'x-gssv-client': 'XboxComBrowser',
                    ...headers,
                },
                ...options
            }
            const req = https.request(reqOptions, (res) => {
                let responseData = ''
                
                res.on('data', (data) => {
                    responseData += data
                })
        
                res.on('close', () => {
                    if(res.statusCode == 200){
                        const response = JSON.parse(responseData.toString())
        
                        resolve(response)
                    } else {
                        console.log('- Request error ['+res.statusCode+']', responseData.toString())
                        reject({
                            status: res.statusCode,
                            body: responseData.toString()
                        })
                    }
                })
            })
            
            req.on('error', (error) => {
                // console.log('- Error while retrieving from url:', this.url)
                // console.log('  Error:', error)
                reject({
                    error: error
                })
            })
        
            req.write(data)
            req.end()
        })
    }

    isAuthenticated() {
        return this._loggedIn
    }

    setAppTokens(level) {
        this._loggedIn = true
        this._appLevel = level

        this._application._events.emit('start', this._tokens)
    }
}