import { app as ElectronApp, dialog, ipcMain, session } from 'electron'
import { createWindow } from './helpers'
import Application from './application'
import https from 'https'

// Custom loader for xal-node to catch native code errors on stratup
let XalLibrary = null
let xalAuthenticator = null

try {
    XalLibrary = require('../xal-node/src_ts/lib')

    if(XalLibrary.default.XalAuthenticator !== null){
        try {
            // Test loading the XalAuthenticator class
            xalAuthenticator = new XalLibrary.default.XalAuthenticator()
            // Class loads properly, now lets move the class over..
            xalAuthenticator.close()

        } catch(error) {
            dialog.showErrorBox('Startup error', 'XAL Authentication library loaded but was unable to call XalAuthenticator class. Error: ' + XalLibrary)
            ElectronApp.quit()
        }
    } else {
        dialog.showErrorBox('Startup error', 'XAL Authentication library loaded but was unable to find the XalAuthenticator class. Error: ' + XalLibrary)
        ElectronApp.quit()
    }
} catch(error) {
    dialog.showErrorBox('Startup error', 'XAL Authentication library failed to load. Error: ' + error)
    ElectronApp.quit()
}

interface authFlowTokens {
    sisu_local_code_verifier
    sisu_session_id
    sisu_device_token
}

export default class Authentication {
    _application:Application
    _xalAuthenticator

    _isAuthenticated = false
    _isAuthenticating = false

    _authFlowTokens:authFlowTokens
    _authWindow

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
    _appLevel = 0


    constructor(application:Application){
        this._application = application

        this.startSilentFlow()
        this.startIpcEvents()
    }

    checkAuthentication(){
        return this._isAuthenticated
    }

    startAuthflow(){

        this._application.log('authentication', __filename+'[startAuthflow()] Starting full authentication flow')

        if(this._isAuthenticating === true){
            this._application.log('authentication', __filename+'[startAuthflow()] Cancelling flow because we are already in an authentication process')
            return
        }
        this._xalAuthenticator = new XalLibrary.default.XalAuthenticator()

        this._xalAuthenticator.get_device_token().then((device_token:any) => {
            this._application.log('authentication', __filename+'[startAuthflow()] get_device_token() returned:', device_token)
          
            this._xalAuthenticator.do_sisu_authentication(device_token.Token).then((sisu_response:any) => {
                this._application.log('authentication', __filename+'[startAuthflow()] do_sisu_authentication() returned:', device_token)
                
                this._authFlowTokens = {
                    sisu_local_code_verifier: sisu_response.local_code_verifier,
                    sisu_session_id: sisu_response.sisu_session_id,
                    sisu_device_token: device_token,
                }

                this.openAuthWindow(sisu_response.msal_response.MsaOauthRedirect)


            }).catch((error4) => {
                this._application.log('authentication', __filename+'[startAuthflow()] do_sisu_authentication() error:', error4)
                this._xalAuthenticator.close()
            })
            
        }).catch((error1) => {
            this._application.log('authentication', __filename+'[startAuthflow()] get_device_token() error:', error1)
            this._xalAuthenticator.close()
        })

        // this._xalAuthenticator.close()

        return false
    }

    startSilentFlow(){
        this._application.log('authentication', __filename+'[startSilentFlow()] Starting silent auth flow')

        // Check for token
        const storedXstsTokens = this._application._store.get('auth.sisu_token', false)
        const storedCodeTokens = this._application._store.get('auth.code_token', false)
        if(storedXstsTokens !== false && storedCodeTokens !== false){
            this._isAuthenticating = true
            this._application.log('authentication', __filename+'[startSilentFlow()] Found tokens in store:', storedCodeTokens, storedXstsTokens)
            this.retrieveTokens(storedCodeTokens, storedXstsTokens)
            return
        } else {
            this._application.log('authentication', __filename+'[startSilentFlow()] No tokens present on device. We need to start the login flow')
        }
    }

    openAuthWindow(url){
        const authWindow = createWindow('auth', {
            width: 500,
            height: 600,
            title: 'Authentication'
        });
        
        authWindow.loadURL(url);
        this._authWindow = authWindow

        this._authWindow.on('close', () => {
            this._application.log('authentication', __filename+'[openAuthWindow()] Closed auth window')
            this._xalAuthenticator.close()
        })
    }

    startWebviewHooks(){
        this._application.log('authentication', __filename+'[startWebviewHooks()] Setting up authentication hooks')
        session.defaultSession.webRequest.onBeforeRedirect({
            urls: [
                'https://login.live.com/oauth20_authorize.srf?*',
                'https://login.live.com/ppsecure/post.srf?*'
            ]
        }, (details) => {
            this._application.log('authentication', __filename+'[startWebviewHooks()] Got response:', details.redirectURL)
            const url = new URL(details.redirectURL)

            const error = url.searchParams.get('error')
            if(error){
                const error_description = url.searchParams.get('error_description')
                this._application.log('authentication', __filename+'[startWebviewHooks()] Received error from oauth:', error_description)
                this._authWindow.close()
            }

            const code = url.searchParams.get('code')
            if(code){
                const state = url.searchParams.get('state')
                this._application.log('authentication', __filename+'[startWebviewHooks()] Login success! Retrieved code and state:', code, state)

                this._isAuthenticating = true

                this._xalAuthenticator.exchange_code_for_token(code, this._authFlowTokens.sisu_local_code_verifier).then((res5:any) => {
                    this._application._store.set('auth.code_token', res5)
            
                    this._xalAuthenticator.do_sisu_authorization(this._authFlowTokens.sisu_session_id, res5.access_token, this._authFlowTokens.sisu_device_token.Token).then((res6:any) => {
                        this._application._store.set('auth.sisu_token', res6)
                        this._application.log('authentication', __filename+'[startWebviewHooks()] Retrieved sisu tokens:', res6)
                        this._authWindow.close()

                        this.retrieveTokens(res5, res6)

                    }).catch((error6) => {
                        this._application.log('authentication', __filename+'[startWebviewHooks()] do_sisu_authorization error:', error6)
                        this._authWindow.close()
                    })
            
                }).catch((error5) => {
                    this._application.log('authentication', __filename+'[startWebviewHooks()] exchange_code_for_token error:', error5)
                    this._authWindow.close()
                })
            }
        })
    }

    retrieveTokens(code_token, sisu_token){
        this._application.log('authentication', __filename+'[retrieveTokens()] Retrieving tokens...')
        const xalAuth = xalAuthenticator = new XalLibrary.default.XalAuthenticator()

        xalAuth.do_xsts_authorization(sisu_token.DeviceToken, sisu_token.TitleToken.Token, sisu_token.UserToken.Token, "http://gssv.xboxlive.com/").then((xsts_token:any) => {
            
            this._isAuthenticating = true
            
            this.requestxCloudToken(xsts_token.Token).then((result) => {
                // Supports xCloud
                this._appLevel = 2
            }).catch((error) => {
                // Supports xHome only
                this._appLevel = 1

                this.requestxCloudToken(xsts_token.Token, true).then((result) => {
                    this._appLevel = 2
                }).catch((error) => {
                    this._appLevel = 1
                })
            })


            Promise.all([
                xalAuthenticator.exchange_refresh_token_for_xcloud_transfer_token(code_token.refresh_token),
                xalAuthenticator.do_xsts_authorization(sisu_token.DeviceToken, sisu_token.TitleToken.Token, sisu_token.UserToken.Token, "http://xboxlive.com"),
                this.requestxHomeToken(xsts_token.Token)
            ]).then((values) => {
                this._tokens.msal.token = values[0].lpt

                this._tokens.web.uhs = values[1].DisplayClaims.xui[0].uhs
                this._tokens.web.token = values[1].Token
                this._tokens.web.expires = values[1].expires

                // Finished auth flow
                this._application.log('authentication', __filename+'[retrieveTokens()] Authentication successful:', this._tokens)
                this._isAuthenticated = true
                this._isAuthenticating = false
                this._application._events.emit('start', this._tokens)

                xalAuth.close()
            }).catch((error) => {
                this._application.log('authentication', __filename+'[retrieveTokens()] Failed to retrieve tokens')
                xalAuth.close()
            })

        }).catch((error7) => {
            this._application.log('authentication', __filename+'[retrieveTokens()] do_xsts_authorization error returned. Probably tokens expired:')
            this._isAuthenticating = false
            this.startAuthflow()

            xalAuth.close()
        })
    }

    startIpcEvents(){
        ipcMain.on('auth', (event, arg) => {
            if(arg.type === 'init'){
                const gamertag = this._application._store.get('user.gamertag')
                const gamerpic = this._application._store.get('user.gamerpic')
                const gamerscore = this._application._store.get('user.gamerscore')

                // Check loading?
                if(this._isAuthenticating === true){
                    event.sender.send('app_loading', {})
                }
    
                event.sender.send('auth', {
                    loggedIn: gamertag ? this._isAuthenticated : false,
    
                    signedIn: gamertag ? true : false,
                    gamertag: gamertag ? gamertag : '',
                    gamerpic: gamerpic ? gamerpic : '',
                    gamerscore: gamerscore ? gamerscore : '',
                    level: this._appLevel,
                })
                
            } else if(arg.type === 'get_user'){
                const gamertag = this._application._store.get('user.gamertag')
                const gamerpic = this._application._store.get('user.gamerpic')
                const gamerscore = this._application._store.get('user.gamerscore')
    
                event.sender.send('auth', {
                    type: 'user',
                    gamertag: gamertag ? gamertag : '',
                    gamerpic: gamerpic ? gamerpic : '',
                    gamerscore: gamerscore ? gamerscore : '',
                    level: this._appLevel,
                })

            } else if(arg.type === 'logout'){
                this._application.log('authentication', __filename+'[startIpcEvents()] Received logout call')
                session.defaultSession.clearStorageData().then(() => {
                    this._application._store.delete('user')
                    this._application._store.delete('auth')

                    this._application.log('authentication', __filename+'[startIpcEvents()] Received restart request. Restarting application...')
                    this._application.restart()
    
                }).catch((error) => {
                    this._application.log('authentication', __filename+'[startIpcEvents()] Error: Failed to clear local storage!')
                })

            } else if(arg.type === 'quit'){
                this._application.log('authentication', __filename+'[startIpcEvents()] Received quit request. Quitting application...')
                this._application.quit()

            } else if(arg.type == 'login') {
                this.startAuthflow()
            }
        });
    }

    requestxHomeToken(streamingToken){
        return new Promise((resolve, reject) => {
            this._application.log('authentication', __filename+'[requestxHomeToken()] Requesting xHome streaming tokens')

            // Get xHomeStreaming Token
            const data = JSON.stringify({
                "token": streamingToken,
                "offeringId": "xhome"
            })
        
            const options = {
                hostname: 'xhome.gssv-play-prod.xboxlive.com',
                method: 'POST',
                path: '/v2/login/user',
            }

            this.request(options, data).then((response:any) => {
                // this._tokens.web.token = response.gsToken

                this._tokens.gamestreaming.token = response.gsToken
                this._tokens.gamestreaming.expires = (Date.now()+response.durationInSeconds)
                this._tokens.gamestreaming.market = response.market
                this._tokens.gamestreaming.regions = response.offeringSettings.regions
                this._tokens.gamestreaming.settings = response.offeringSettings.clientCloudSettings

                this._application.log('authentication', __filename+'[requestxHomeToken()] Retrieved xHome streaming tokens')

                resolve(response)
            }).catch((error) => {
                this._application.log('authentication', __filename+'[requestxHomeToken()] xHome token retrieval error:', error)
                reject(error)
            })
        })
    }

    requestxCloudToken(streamingToken, f2p = false){
        return new Promise((resolve, reject) => {
            this._application.log('authentication', __filename+'[requestxCloudToken()] Requesting xHome streaming tokens')

            // Get xHomeStreaming Token
            const data = JSON.stringify({
                "token": streamingToken,
                "offeringId": (f2p === true) ? "xgpuwebf2p" : "xgpuweb"
            })
        
            const options = {
                hostname: (f2p === true) ? 'xgpuwebf2p.gssv-play-prod.xboxlive.com' : 'xgpuweb.gssv-play-prod.xboxlive.com',
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

            this._application.log('authentication', __filename+'[requestxCloudToken()] Retrieved xHome streaming tokens')

                resolve(response)
            }).catch((error) => {
                this._application.log('authentication', __filename+'[requestxCloudToken()] xCloud token retrieval error:', error)
                reject(error)
            })
        })
    }

    request(options, data, headers = {}) {

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
                        this._application.log('authentication', __filename+'[request()] Request error ['+res.statusCode+']', responseData.toString())
                        reject({
                            status: res.statusCode,
                            body: responseData.toString()
                        })
                    }
                })
            })
            
            req.on('error', (error) => {
                reject({
                    error: error
                })
            })

            req.write(data)
            req.end()
        })
    }
}